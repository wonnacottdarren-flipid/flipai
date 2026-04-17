import "dotenv/config";
import express from "express";
import path from "path";
import cors from "cors";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import { fileURLToPath } from "url";
import {
  enforceUsage,
  getUserById,
  incrementUsage,
  safeUser,
} from "./db.js";
import {
  loginHandler,
  logoutHandler,
  requireAuth,
  signupHandler,
} from "./auth.js";
import {
  createCheckoutSession,
  createPortalSession,
  stripeWebhookHandler,
} from "./stripe.js";
import { runAnalysis } from "./openai.js";
import { searchEbayListings } from "./ebay.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const port = process.env.PORT || 3000;
const appUrl = process.env.APP_URL || `http://localhost:${port}`;
const JWT_SECRET = process.env.JWT_SECRET || "change_me";

function roundMoney(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function parseManualSoldPrices(input) {
  if (!input) return [];

  if (Array.isArray(input)) {
    return input
      .map((v) => Number(v))
      .filter((v) => Number.isFinite(v) && v > 0);
  }

  const text = String(input)
    .replace(/£/g, "")
    .replace(/\n/g, ",")
    .replace(/\r/g, ",")
    .trim();

  if (!text) return [];

  return text
    .split(",")
    .map((part) => Number(String(part).trim()))
    .filter((v) => Number.isFinite(v) && v > 0);
}

function getMedian(values) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return roundMoney((sorted[mid - 1] + sorted[mid]) / 2);
  }

  return roundMoney(sorted[mid]);
}

function getAverage(values) {
  if (!values.length) return 0;
  const total = values.reduce((sum, value) => sum + value, 0);
  return roundMoney(total / values.length);
}

function buildManualSoldComps(input) {
  const prices = parseManualSoldPrices(input);

  if (!prices.length) {
    return {
      connected: false,
      pricingMode: "Estimated fallback model",
      compCount: 0,
      soldCount: 0,
      samplePrices: [],
      avgSoldPrice: 0,
      medianSoldPrice: 0,
      minSoldPrice: 0,
      maxSoldPrice: 0,
      confidence: 0,
      confidenceLabel: "Low",
      keywordUsed: "",
      debug: {
        source: "manual",
        reason: "No manual sold prices entered",
      },
    };
  }

  const avgSoldPrice = getAverage(prices);
  const medianSoldPrice = getMedian(prices);
  const minSoldPrice = roundMoney(Math.min(...prices));
  const maxSoldPrice = roundMoney(Math.max(...prices));

  let confidence = 35;
  if (prices.length >= 3) confidence = 55;
  if (prices.length >= 5) confidence = 72;
  if (prices.length >= 8) confidence = 86;
  if (prices.length >= 12) confidence = 94;

  let confidenceLabel = "Low";
  if (confidence >= 80) confidenceLabel = "High";
  else if (confidence >= 55) confidenceLabel = "Medium";

  return {
    connected: true,
    pricingMode: "Manual sold comps",
    compCount: prices.length,
    soldCount: prices.length,
    samplePrices: prices.slice(0, 12).map(roundMoney),
    avgSoldPrice,
    medianSoldPrice,
    minSoldPrice,
    maxSoldPrice,
    confidence,
    confidenceLabel,
    keywordUsed: "manual_entry",
    debug: {
      source: "manual",
      prices,
    },
  };
}

function getCompConfidenceAdjustment(soldComps) {
  if (!soldComps?.connected || !Number(soldComps.compCount || 0)) {
    return {
      multiplier: 1,
      reason: "no comps",
    };
  }

  const compCount = Number(soldComps.compCount || 0);
  const confidence = Number(soldComps.confidence || 0);

  let multiplier = 1;

  // First anchor to comp count
  if (compCount <= 2) {
    multiplier = 0.95;
  } else if (compCount <= 4) {
    multiplier = 0.98;
  } else if (compCount <= 6) {
    multiplier = 0.99;
  } else {
    multiplier = 1.0;
  }

  // Then refine by confidence
  if (confidence >= 85) {
    multiplier += 0.01;
  } else if (confidence >= 70) {
    multiplier += 0.005;
  } else if (confidence < 45) {
    multiplier -= 0.01;
  }

  // Keep safe bounds
  if (multiplier > 1.0) multiplier = 1.0;
  if (multiplier < 0.93) multiplier = 0.93;

  return {
    multiplier: roundMoney(multiplier),
    reason: `compCount=${compCount}, confidence=${confidence}`,
  };
}

function calculateFlipMetrics({
  buyPrice,
  repairCost,
  condition,
  manualSoldPrices,
  goal,
}) {
  const buy = Number(buyPrice || 0);
  const repair = Number(repairCost || 0);
  const text = String(condition || "").toLowerCase();
  const goalText = String(goal || "").toLowerCase();

  const soldComps = buildManualSoldComps(manualSoldPrices);

  let estimatedResale = 0;
  let pricingMode = "Estimated fallback model";
  let confidenceAdjustment = null;

  if (soldComps.connected && soldComps.medianSoldPrice > 0) {
    const adjustment = getCompConfidenceAdjustment(soldComps);
    confidenceAdjustment = adjustment;

    estimatedResale = roundMoney(
      soldComps.medianSoldPrice * Number(adjustment.multiplier || 1)
    );

    pricingMode = "Manual sold comps";

    if (goalText.includes("fast")) {
      estimatedResale = roundMoney(estimatedResale * 0.95);
      pricingMode = "Manual sold comps (fast-sale adjusted)";
    } else if (goalText.includes("maximum")) {
      estimatedResale = roundMoney(estimatedResale * 1.03);
      pricingMode = "Manual sold comps (profit adjusted)";
    }

    estimatedResale = Math.max(0, estimatedResale);
  } else {
    let multiplier = 2.0;

    if (text.includes("excellent")) multiplier = 2.5;
    else if (text.includes("good")) multiplier = 2.3;
    else if (text.includes("light")) multiplier = 2.2;
    else if (text.includes("cracked")) multiplier = 2.0;
    else if (text.includes("fault")) multiplier = 1.7;
    else if (text.includes("parts")) multiplier = 1.45;

    estimatedResale = roundMoney(buy * multiplier);

    if (goalText.includes("fast")) {
      estimatedResale = roundMoney(estimatedResale * 0.95);
      pricingMode = "Estimated fallback model (fast-sale adjusted)";
    } else if (goalText.includes("maximum")) {
      estimatedResale = roundMoney(estimatedResale * 1.03);
      pricingMode = "Estimated fallback model (profit adjusted)";
    }
  }

  const totalCost = roundMoney(buy + repair);
  const ebayFees = roundMoney(estimatedResale * 0.15);
  const profit = roundMoney(estimatedResale - totalCost - ebayFees);

  let verdict = "AVOID ❌";
  if (profit > 40) verdict = "GOOD DEAL ✅";
  else if (profit > 15) verdict = "OK DEAL ⚠️";

  return {
    estimatedResale: roundMoney(estimatedResale),
    totalCost,
    ebayFees,
    profit,
    verdict,
    pricingMode,
    soldComps,
    confidenceAdjustment,
  };
}

function getScannerMultiplier(item) {
  const title = String(item?.title || "").toLowerCase();
  const condition = String(item?.condition || "").toLowerCase();
  const buyingOptions = Array.isArray(item?.buyingOptions)
    ? item.buyingOptions.join(" ").toLowerCase()
    : "";

  let multiplier = 1.33;

  if (condition.includes("new")) multiplier = 1.7;
  else if (condition.includes("refurb")) multiplier = 1.52;
  else if (condition.includes("used")) multiplier = 1.4;

  if (title.includes("unlocked")) multiplier += 0.08;
  if (title.includes("excellent")) multiplier += 0.08;
  if (title.includes("very good")) multiplier += 0.05;
  if (title.includes("91% battery")) multiplier += 0.06;
  else if (title.includes("90% battery")) multiplier += 0.05;
  else if (title.includes("89% battery")) multiplier += 0.04;
  else if (title.includes("88% battery")) multiplier += 0.03;
  else if (title.includes("87% battery")) multiplier += 0.02;

  if (title.includes("cracked")) multiplier -= 0.35;
  if (title.includes("faulty")) multiplier -= 0.45;
  if (title.includes("spares")) multiplier -= 0.5;
  if (title.includes("parts")) multiplier -= 0.5;
  if (title.includes("locked")) multiplier -= 0.3;
  if (buyingOptions.includes("auction")) multiplier -= 0.02;

  if (multiplier < 1.02) multiplier = 1.02;
  return multiplier;
}

function buildScannerMetrics(item) {
  const itemPrice = Number(item?.price || 0);
  const shipping = Number(item?.shipping || 0);
  const repairCost = 0;
  const totalBuyPrice = roundMoney(itemPrice + shipping);
  const multiplier = getScannerMultiplier(item);

  const estimatedResale = roundMoney(totalBuyPrice * multiplier);
  const ebayFees = roundMoney(estimatedResale * 0.15);
  const estimatedProfit = roundMoney(
    estimatedResale - ebayFees - totalBuyPrice - repairCost
  );

  let verdict = "SKIP";
  if (estimatedProfit >= 30) verdict = "GOOD DEAL";
  else if (estimatedProfit >= 10) verdict = "MARGINAL";

  let risk = "High";
  if (verdict === "GOOD DEAL") risk = "Low";
  else if (verdict === "MARGINAL") risk = "Medium";

  let score = 0;
  if (estimatedProfit > 0) {
    score = Math.min(
      99,
      Math.max(
        1,
        Math.round(
          estimatedProfit * 1.8 +
            (verdict === "GOOD DEAL" ? 18 : verdict === "MARGINAL" ? 8 : 0) +
            (String(item?.condition || "").toLowerCase().includes("used") ? 3 : 0)
        )
      )
    );
  }

  return {
    estimatedResale,
    estimatedProfit,
    totalBuyPrice,
    ebayFees,
    repairCost,
    score,
    risk,
    verdict,
    multiplier: roundMoney(multiplier),
  };
}

function getUserFromCookie(req) {
  try {
    const token = req.cookies?.flipai_token;
    if (!token) return null;

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = getUserById(decoded.userId);

    return user || null;
  } catch {
    return null;
  }
}

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractStorageTokens(text) {
  const matches = normalizeText(text).match(/\b(16|32|64|128|256|512|1024)\s?gb\b/g);
  return matches ? matches.map((m) => m.replace(/\s+/g, "")) : [];
}

function extractEssentialTokens(product) {
  const cleaned = normalizeText(product);
  const words = cleaned.split(" ").filter(Boolean);

  const stopWords = new Set([
    "the",
    "and",
    "for",
    "with",
    "used",
    "new",
    "good",
    "very",
    "excellent",
    "sale",
    "phone",
    "mobile",
    "smartphone",
    "black",
    "white",
    "blue",
    "red",
    "green",
    "pink",
    "purple",
    "grey",
    "gray",
    "silver",
    "gold",
    "boxed",
    "unboxed",
  ]);

  const tokens = words.filter((word) => word.length >= 2 && !stopWords.has(word));

  return [...new Set(tokens)].slice(0, 8);
}

function buildAutoCompSearchQuery(product, condition) {
  const productText = String(product || "").trim();
  const conditionText = String(condition || "").trim().toLowerCase();
  const essentialTokens = extractEssentialTokens(productText);
  const storageTokens = extractStorageTokens(productText);

  let query = essentialTokens.join(" ");

  if (!query) {
    query = productText;
  }

  if (storageTokens.length) {
    const storage = storageTokens[0];
    if (!query.toLowerCase().includes(storage.toLowerCase())) {
      query += ` ${storage}`;
    }
  }

  if (conditionText.includes("unlocked") && !query.toLowerCase().includes("unlocked")) {
    query += " unlocked";
  }

  if (
    (conditionText.includes("used") || conditionText.includes("fully working")) &&
    !query.toLowerCase().includes("used")
  ) {
    query += " used";
  }

  return query.trim();
}

function isBadCompTitle(title) {
  const text = normalizeText(title);

  const banned = [
    "spares",
    "parts",
    "not working",
    "faulty",
    "cracked",
    "broken",
    "read description",
    "empty box",
    "box only",
    "case only",
    "cover only",
    "screen only",
    "icloud locked",
    "network locked",
    "locked to",
    "for repair",
    "repair only",
  ];

  return banned.some((term) => text.includes(term));
}

function itemMatchesProduct(itemTitle, product, condition) {
  const title = normalizeText(itemTitle);
  const productText = normalizeText(product);
  const conditionText = normalizeText(condition);

  if (!title) return false;
  if (isBadCompTitle(title)) return false;

  const productTokens = extractEssentialTokens(productText);
  const storageTokens = extractStorageTokens(productText);

  const matchedCoreTokens = productTokens.filter((token) => title.includes(token));
  const matchedStorageTokens = storageTokens.filter((token) =>
    title.includes(token.replace(/\s+/g, ""))
  );

  const requiresUnlocked =
    productText.includes("unlocked") || conditionText.includes("unlocked");

  if (requiresUnlocked && !title.includes("unlocked")) {
    return false;
  }

  if (storageTokens.length > 0 && matchedStorageTokens.length === 0) {
    return false;
  }

  if (productTokens.length >= 3 && matchedCoreTokens.length < 1) {
    return false;
  }

  return true;
}

function removePriceOutliers(prices) {
  if (prices.length <= 4) return [...prices].sort((a, b) => a - b);

  const sorted = [...prices].sort((a, b) => a - b);
  const q1Index = Math.floor((sorted.length - 1) * 0.25);
  const q3Index = Math.floor((sorted.length - 1) * 0.75);
  const q1 = sorted[q1Index];
  const q3 = sorted[q3Index];
  const iqr = q3 - q1;
  const minAllowed = q1 - iqr * 1.5;
  const maxAllowed = q3 + iqr * 1.5;

  const filtered = sorted.filter((price) => price >= minAllowed && price <= maxAllowed);
  return filtered.length >= 3 ? filtered : sorted;
}

function selectCompPrices(prices) {
  const cleaned = removePriceOutliers(prices);

  if (!cleaned.length) return [];

  const sorted = [...cleaned].sort((a, b) => a - b);

  if (sorted.length <= 5) {
    return sorted.map(roundMoney);
  }

  const start = Math.floor(sorted.length * 0.15);
  const end = Math.ceil(sorted.length * 0.65);
  const slice = sorted.slice(start, end);

  return (slice.length ? slice : sorted.slice(0, 6)).map(roundMoney);
}

function buildAutoCompsFromItems({ items, product, condition }) {
  const matched = items.filter((item) =>
    itemMatchesProduct(item?.title || "", product, condition)
  );

  const priced = matched
    .map((item) => ({
      title: String(item?.title || ""),
      price: roundMoney(Number(item?.price || 0)),
      shipping: roundMoney(Number(item?.shipping || 0)),
      total: roundMoney(Number(item?.price || 0) + Number(item?.shipping || 0)),
      condition: String(item?.condition || ""),
      url: item?.itemWebUrl || item?.viewItemURL || item?.url || "",
    }))
    .filter((item) => item.total > 0);

  const totals = priced.map((item) => item.total);
  const selectedPrices = selectCompPrices(totals);

  let confidence = 25;
  if (selectedPrices.length >= 3) confidence = 50;
  if (selectedPrices.length >= 5) confidence = 68;
  if (selectedPrices.length >= 7) confidence = 82;
  if (selectedPrices.length >= 10) confidence = 92;

  let confidenceLabel = "Low";
  if (confidence >= 80) confidenceLabel = "High";
  else if (confidence >= 55) confidenceLabel = "Medium";

  return {
    pricingMode: "Auto comps estimate",
    searchCount: items.length,
    matchedCount: matched.length,
    compCount: selectedPrices.length,
    prices: selectedPrices,
    manualSoldPricesText: selectedPrices.join(", "),
    avgPrice: selectedPrices.length ? getAverage(selectedPrices) : 0,
    medianPrice: selectedPrices.length ? getMedian(selectedPrices) : 0,
    minPrice: selectedPrices.length ? roundMoney(Math.min(...selectedPrices)) : 0,
    maxPrice: selectedPrices.length ? roundMoney(Math.max(...selectedPrices)) : 0,
    confidence,
    confidenceLabel,
    matchedItemsPreview: priced.slice(0, 8),
  };
}

app.post(
  "/api/stripe/webhook",
  express.raw({ type: "application/json" }),
  stripeWebhookHandler
);

app.use(cors({ origin: appUrl, credentials: true }));
app.use(cookieParser());
app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

app.post("/api/signup", signupHandler);
app.post("/api/login", loginHandler);
app.post("/api/logout", logoutHandler);

app.get("/api/me", requireAuth, (req, res) => {
  res.json({ user: safeUser(req.user) });
});

app.post("/api/create-checkout-session", requireAuth, async (req, res) => {
  try {
    const plan = String(req.body?.plan || "").toLowerCase();
    const url = await createCheckoutSession(req.user, plan);
    res.json({ url });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ error: error.message || "Could not create checkout session." });
  }
});

app.post("/api/create-portal-session", requireAuth, async (req, res) => {
  try {
    const url = await createPortalSession(req.user);
    res.json({ url });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ error: error.message || "Could not open billing portal." });
  }
});

app.post("/api/analyze", async (req, res) => {
  try {
    const user = getUserFromCookie(req);

    if (!user) {
      return res.status(401).json({
        error: "Please sign in to use FlipAI analysis.",
        locked: true,
      });
    }

    const allowedUser = enforceUsage(user);

    const {
      product,
      condition,
      buyPrice,
      repairCost,
      extras,
      goal,
      manualSoldPrices,
    } = req.body || {};

    if (!product || !condition) {
      return res.status(400).json({
        error: "Product name and condition are required.",
      });
    }

    const flipMetrics = calculateFlipMetrics({
      buyPrice,
      repairCost,
      condition,
      manualSoldPrices,
      goal,
    });

    const aiResult = await runAnalysis({
      product,
      condition,
      buyPrice,
      repairCost,
      extras,
      goal,
      manualSoldPrices,
      manualSoldComps: flipMetrics.soldComps,
      forcedEstimatedResale: flipMetrics.estimatedResale,
      pricingMode: flipMetrics.pricingMode,
    });

    const updatedUser = incrementUsage(allowedUser.id);

    return res.json({
      result: {
        ...aiResult,
        flipMetrics,
        manualSoldComps: flipMetrics.soldComps,
        locked: false,
      },
      user: safeUser(updatedUser),
    });
  } catch (error) {
    if (error.statusCode === 403) {
      return res.status(403).json({
        error: error.message,
        locked: true,
      });
    }

    console.error(error);
    return res.status(500).json({
      error: error.message || "Could not generate analysis.",
    });
  }
});

app.post("/api/auto-comps", async (req, res) => {
  try {
    const user = getUserFromCookie(req);

    if (!user) {
      return res.status(401).json({
        error: "Please sign in to auto-fill comps.",
      });
    }

    const { product, condition } = req.body || {};

    if (!product || !String(product).trim()) {
      return res.status(400).json({
        error: "Product is required.",
      });
    }

    const searchQuery = buildAutoCompSearchQuery(product, condition);

    const items = await searchEbayListings({
      query: searchQuery,
      limit: 30,
      condition: "",
      freeShippingOnly: false,
    });

    const autoComps = buildAutoCompsFromItems({
      items,
      product,
      condition,
    });

    if (!autoComps.compCount) {
      return res.status(404).json({
        error: "No strong matching live comps were found.",
        searchQuery,
        autoComps,
      });
    }

    return res.json({
      ok: true,
      searchQuery,
      autoComps,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      error: error.message || "Could not auto-fill comps.",
    });
  }
});

app.post("/api/search-ebay", async (req, res) => {
  try {
    const user = getUserFromCookie(req);

    if (!user) {
      return res.status(401).json({
        error: "Please sign in to search eBay.",
      });
    }

    const { query, limit, filterPriceMax, condition, freeShippingOnly } =
      req.body || {};

    if (!query || !String(query).trim()) {
      return res.status(400).json({
        error: "Search query is required.",
      });
    }

    const items = await searchEbayListings({
      query,
      limit,
      maxPrice: filterPriceMax,
      condition,
      freeShippingOnly,
    });

    const scannedItems = items
      .map((item) => ({
        ...item,
        scanner: buildScannerMetrics(item),
      }))
      .sort((a, b) => {
        return (
          Number(b?.scanner?.estimatedProfit || 0) -
          Number(a?.scanner?.estimatedProfit || 0)
        );
      })
      .map((item, index) => ({
        ...item,
        bestDeal: index === 0 && Number(item?.scanner?.estimatedProfit || 0) > 0,
      }));

    return res.json({ items: scannedItems });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      error: error.message || "Could not search eBay.",
    });
  }
});

app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(port, () => {
  console.log(`FlipAI running on ${appUrl}`);
});
