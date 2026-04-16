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
import { searchEbayListings, getSoldComparables } from "./ebay.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const port = process.env.PORT || 3000;
const appUrl = process.env.APP_URL || `http://localhost:${port}`;
const JWT_SECRET = process.env.JWT_SECRET || "change_me";

function roundMoney(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function calculateFlipMetrics({ buyPrice, repairCost, condition }) {
  const buy = Number(buyPrice || 0);
  const repair = Number(repairCost || 0);
  const text = String(condition || "").toLowerCase();

  let multiplier = 2.0;

  if (text.includes("excellent")) multiplier = 2.5;
  else if (text.includes("good")) multiplier = 2.3;
  else if (text.includes("light")) multiplier = 2.2;
  else if (text.includes("cracked")) multiplier = 2.0;

  const estimatedResale = Math.round(buy * multiplier);
  const totalCost = buy + repair;
  const ebayFees = Math.round(estimatedResale * 0.15);
  const profit = estimatedResale - totalCost - ebayFees;

  let verdict = "AVOID ❌";
  if (profit > 40) verdict = "GOOD DEAL ✅";
  else if (profit > 15) verdict = "OK DEAL ⚠️";

  return {
    estimatedResale,
    totalCost,
    ebayFees,
    profit,
    verdict,
  };
}

function extractBatteryPercent(text) {
  const match = String(text || "").match(/(\d{2})\s*%?\s*battery/i);
  if (!match) return null;

  const value = Number(match[1]);
  if (!Number.isFinite(value)) return null;

  return value;
}

function getBaseResaleFromTitle(item) {
  const title = String(item?.title || "").toLowerCase();

  if (title.includes("iphone 12 mini")) return 150;
  if (title.includes("iphone 12 pro max")) return 320;
  if (title.includes("iphone 12 pro")) return 255;

  if (title.includes("iphone 12")) {
    if (title.includes("128gb")) return 210;
    if (title.includes("256gb")) return 240;
    return 190;
  }

  return 0;
}

function getConditionPenalty(item) {
  const title = String(item?.title || "").toLowerCase();
  const condition = String(item?.condition || "").toLowerCase();

  let penalty = 0;

  if (title.includes("cracked")) penalty += 70;
  if (title.includes("faulty")) penalty += 90;
  if (title.includes("spares")) penalty += 110;
  if (title.includes("parts")) penalty += 110;
  if (title.includes("locked")) penalty += 60;
  if (title.includes("not opened")) penalty += 10;
  if (title.includes("read description")) penalty += 8;
  if (title.includes("battery issue")) penalty += 25;
  if (
    title.includes("face id") &&
    (title.includes("not working") || title.includes("doesn't work"))
  ) {
    penalty += 18;
  }

  if (condition.includes("refurbished")) penalty -= 8;
  if (condition.includes("new")) penalty -= 15;

  return Math.max(0, penalty);
}

function getConditionBonus(item) {
  const title = String(item?.title || "").toLowerCase();
  const condition = String(item?.condition || "").toLowerCase();

  let bonus = 0;

  if (title.includes("unlocked")) bonus += 12;
  if (title.includes("excellent")) bonus += 10;
  if (title.includes("very good")) bonus += 6;
  if (title.includes("mint")) bonus += 14;
  if (title.includes("great condition")) bonus += 6;
  if (condition.includes("refurbished")) bonus += 10;

  return bonus;
}

function getBatteryAdjustment(item) {
  const title = String(item?.title || "");
  const battery = extractBatteryPercent(title);

  if (battery === null) return 0;

  if (battery >= 95) return 12;
  if (battery >= 90) return 8;
  if (battery >= 87) return 4;
  if (battery >= 85) return 0;
  if (battery >= 83) return -8;
  if (battery >= 80) return -15;

  return -25;
}

function getConfidenceScore(item, baseResale, soldCompsUsed) {
  const title = String(item?.title || "").toLowerCase();
  const condition = String(item?.condition || "").toLowerCase();

  let score = 50;

  if (baseResale > 0) score += 15;
  if (title.includes("unlocked")) score += 8;
  if (
    title.includes("128gb") ||
    title.includes("64gb") ||
    title.includes("256gb")
  ) {
    score += 6;
  }
  if (extractBatteryPercent(title) !== null) score += 6;
  if (condition.includes("used")) score += 2;
  if (condition.includes("refurbished")) score += 4;
  if (soldCompsUsed) score += 12;

  if (title.includes("read description")) score -= 8;
  if (title.includes("job lot")) score -= 20;
  if (title.includes("spares")) score -= 25;
  if (title.includes("parts")) score -= 25;
  if (title.includes("faulty")) score -= 20;
  if (title.includes("locked")) score -= 15;

  return Math.max(1, Math.min(99, score));
}

function getSuggestedRepairCost(item) {
  const title = String(item?.title || "").toLowerCase();

  if (title.includes("cracked")) return 45;
  if (title.includes("back glass")) return 35;
  if (title.includes("battery")) return 25;
  if (title.includes("faulty")) return 40;

  return 0;
}

function buildReasonText({ soldComps, risk, soldCompsUsed }) {
  if (soldCompsUsed && soldComps) {
    return `Based on sold comparables (${soldComps.soldCount} sold items). Confidence: ${soldComps.confidence}. Risk: ${risk}.`;
  }

  return `Estimated resale based on conservative UK resale assumptions. Risk: ${risk}.`;
}

function buildScannerMetrics(item, soldComps = null) {
  const itemPrice = Number(item?.price || 0);
  const shipping = Number(item?.shipping || 0);
  const totalBuyPrice = roundMoney(itemPrice + shipping);

  const baseResale = getBaseResaleFromTitle(item);
  const bonus = getConditionBonus(item);
  const penalty = getConditionPenalty(item);
  const batteryAdjustment = getBatteryAdjustment(item);
  const repairCost = getSuggestedRepairCost(item);

  const soldCompsUsed =
    soldComps &&
    Number(soldComps.soldCount || 0) > 0 &&
    Number(soldComps.averageSoldPrice || 0) > 0;

  let estimatedResale = 0;

  if (soldCompsUsed) {
    const soldAverage = Number(soldComps.averageSoldPrice || 0);
    estimatedResale = soldAverage + bonus + batteryAdjustment - penalty;
  } else {
    estimatedResale = baseResale + bonus + batteryAdjustment - penalty;
    if (!estimatedResale || estimatedResale <= 0) {
      estimatedResale = totalBuyPrice * 1.18;
    }
  }

  estimatedResale = roundMoney(Math.max(0, estimatedResale));
  const ebayFees = roundMoney(estimatedResale * 0.15);
  const estimatedProfit = roundMoney(
    estimatedResale - ebayFees - totalBuyPrice - repairCost
  );

  let verdict = "SKIP";
  if (estimatedProfit >= 35) verdict = "GOOD DEAL";
  else if (estimatedProfit >= 15) verdict = "MARGINAL";

  let risk = "High";
  if (verdict === "GOOD DEAL") risk = "Low";
  else if (verdict === "MARGINAL") risk = "Medium";

  const confidence = getConfidenceScore(item, baseResale, soldCompsUsed);

  let score = Math.round(
    Math.max(
      1,
      Math.min(99, confidence * 0.55 + Math.max(0, estimatedProfit) * 1.1)
    )
  );

  if (estimatedProfit < 10) score = Math.min(score, 45);
  if (estimatedProfit < 0) score = Math.min(score, 20);

  return {
    estimatedResale,
    estimatedProfit,
    totalBuyPrice,
    ebayFees,
    repairCost,
    score,
    confidence,
    risk,
    verdict,
    baseResale: roundMoney(baseResale),
    batteryAdjustment: roundMoney(batteryAdjustment),
    bonus: roundMoney(bonus),
    penalty: roundMoney(penalty),
    soldCompsUsed,
    soldAveragePrice: roundMoney(soldComps?.averageSoldPrice || 0),
    soldMedianPrice: roundMoney(soldComps?.medianSoldPrice || 0),
    soldMinPrice: roundMoney(soldComps?.minSoldPrice || 0),
    soldMaxPrice: roundMoney(soldComps?.maxSoldPrice || 0),
    soldCount: Number(soldComps?.soldCount || 0),
    soldSource: soldComps?.source || null,
    soldConfidence: soldComps?.confidence || null,
    reason: buildReasonText({ soldComps, risk, soldCompsUsed }),
  };
}

function applyScannerFiltersAndSort(items, filters = {}) {
  const minProfit = Number(filters.minProfit || 0);
  const minScore = Number(filters.minScore || 0);
  const sortBy = String(filters.sortBy || "best_profit");

  let filtered = items.filter((item) => {
    const scanner = item?.scanner || {};
    const estimatedProfit = Number(scanner.estimatedProfit || 0);
    const score = Number(scanner.score || 0);

    return estimatedProfit >= minProfit && score >= minScore;
  });

  filtered.sort((a, b) => {
    const aScanner = a?.scanner || {};
    const bScanner = b?.scanner || {};

    if (sortBy === "best_score") {
      return Number(bScanner.score || 0) - Number(aScanner.score || 0);
    }

    if (sortBy === "lowest_price") {
      return Number(a?.price || 0) - Number(b?.price || 0);
    }

    if (sortBy === "highest_resale") {
      return (
        Number(bScanner.estimatedResale || 0) -
        Number(aScanner.estimatedResale || 0)
      );
    }

    return (
      Number(bScanner.estimatedProfit || 0) -
      Number(aScanner.estimatedProfit || 0)
    );
  });

  return filtered.map((item, index) => {
    const scanner = item?.scanner || {};
    const bestDeal =
      index === 0 &&
      Number(scanner.estimatedProfit || 0) >= 25 &&
      Number(scanner.score || 0) >= 55 &&
      String(scanner.verdict || "") === "GOOD DEAL";

    return {
      ...item,
      bestDeal,
    };
  });
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

    const { product, condition, buyPrice, repairCost, extras, goal } =
      req.body || {};

    if (!product || !condition) {
      return res.status(400).json({
        error: "Product name and condition are required.",
      });
    }

    const flipMetrics = calculateFlipMetrics({
      buyPrice,
      repairCost,
      condition,
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

    const {
      query,
      limit,
      filterPriceMax,
      condition,
      freeShippingOnly,
      minProfit,
      minScore,
      sortBy,
    } = req.body || {};

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

    const soldComps = await getSoldComparables({ query }).catch((error) => {
      console.error("Sold comps provider failed:", error.message);
      return null;
    });

    const scannedItems = items.map((item) => ({
      ...item,
      scanner: buildScannerMetrics(item, soldComps),
      reason: buildScannerMetrics(item, soldComps).reason,
    }));

    const filteredAndSortedItems = applyScannerFiltersAndSort(scannedItems, {
      minProfit,
      minScore,
      sortBy,
    });

    return res.json({
      items: filteredAndSortedItems,
      meta: {
        totalFound: scannedItems.length,
        totalAfterFilters: filteredAndSortedItems.length,
        minProfit: Number(minProfit || 0),
        minScore: Number(minScore || 0),
        sortBy: String(sortBy || "best_profit"),
        soldComparablesAvailable: Boolean(
          soldComps && Number(soldComps.soldCount || 0) > 0
        ),
      },
      soldComparables: soldComps,
    });
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
