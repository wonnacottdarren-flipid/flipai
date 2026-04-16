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

function calculateFlipMetrics({
  buyPrice,
  repairCost,
  condition,
  manualSoldPrices,
}) {
  const buy = Number(buyPrice || 0);
  const repair = Number(repairCost || 0);
  const text = String(condition || "").toLowerCase();

  const soldComps = buildManualSoldComps(manualSoldPrices);

  let estimatedResale = 0;
  let pricingMode = "Estimated fallback model";

  if (soldComps.connected && soldComps.medianSoldPrice > 0) {
    estimatedResale = soldComps.medianSoldPrice;
    pricingMode = "Manual sold comps";
  } else {
    let multiplier = 2.0;

    if (text.includes("excellent")) multiplier = 2.5;
    else if (text.includes("good")) multiplier = 2.3;
    else if (text.includes("light")) multiplier = 2.2;
    else if (text.includes("cracked")) multiplier = 2.0;

    estimatedResale = Math.round(buy * multiplier);
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
    });

    const aiResult = await runAnalysis({
      product,
      condition,
      buyPrice,
      repairCost,
      extras,
      goal,
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
      filterPriceMax,
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
