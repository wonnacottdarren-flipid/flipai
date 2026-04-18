import "dotenv/config";
import express from "express";
import path from "path";
import cors from "cors";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import { fileURLToPath } from "url";

import {
  getUserById,
  safeUser,
} from "./db.js";

import {
  loginHandler,
  logoutHandler,
  signupHandler,
} from "./auth.js";

import {
  createCheckoutSession,
  createPortalSession,
  stripeWebhookHandler,
} from "./stripe.js";

import { runAnalysis } from "./openai.js";
import { searchEbayListings, searchEbayMarketPool } from "./ebay.js";
import { detectEngineForQuery } from "./engines/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;
const appUrl = process.env.APP_URL || `http://localhost:${port}`;
const JWT_SECRET = process.env.JWT_SECRET || "change_me";

app.use(cors({ origin: appUrl, credentials: true }));
app.use(cookieParser());
app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

function normalizeText(value) {
  return String(value || "").toLowerCase().trim();
}

function roundMoney(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function median(values) {
  const nums = values
    .map((v) => Number(v || 0))
    .filter((v) => Number.isFinite(v) && v > 0)
    .sort((a, b) => a - b);

  if (!nums.length) return 0;

  const mid = Math.floor(nums.length / 2);
  return nums.length % 2 === 0
    ? roundMoney((nums[mid - 1] + nums[mid]) / 2)
    : roundMoney(nums[mid]);
}

function average(values) {
  const nums = values
    .map((v) => Number(v || 0))
    .filter((v) => Number.isFinite(v) && v > 0);

  if (!nums.length) return 0;
  return roundMoney(nums.reduce((sum, v) => sum + v, 0) / nums.length);
}

function percentile(values, p) {
  const nums = values
    .map((v) => Number(v || 0))
    .filter((v) => Number.isFinite(v) && v > 0)
    .sort((a, b) => a - b);

  if (!nums.length) return 0;
  if (nums.length === 1) return roundMoney(nums[0]);

  const index = (nums.length - 1) * p;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);

  if (lower === upper) return roundMoney(nums[lower]);

  const weight = index - lower;
  return roundMoney(nums[lower] * (1 - weight) + nums[upper] * weight);
}

function removePriceOutliers(values = []) {
  const nums = values
    .map((v) => Number(v || 0))
    .filter((v) => Number.isFinite(v) && v > 0)
    .sort((a, b) => a - b);

  if (nums.length <= 4) return nums;

  const q1 = percentile(nums, 0.25);
  const q3 = percentile(nums, 0.75);
  const iqr = q3 - q1;

  if (!Number.isFinite(iqr) || iqr <= 0) return nums;

  const lower = q1 - iqr * 1.5;
  const upper = q3 + iqr * 1.5;

  const filtered = nums.filter((v) => v >= lower && v <= upper);
  return filtered.length >= Math.max(3, Math.floor(nums.length * 0.5))
    ? filtered
    : nums;
}

function extractNumericPrice(item) {
  return roundMoney(
    Number(
      item?.price?.value ??
        item?.currentPrice?.value ??
        item?.sellingStatus?.currentPrice?.value ??
        item?.price ??
        0
    ) || 0
  );
}

function extractNumericShipping(item) {
  return roundMoney(
    Number(
      item?.shippingOptions?.[0]?.shippingCost?.value ??
        item?.shippingCost?.value ??
        item?.shipping ??
        0
    ) || 0
  );
}

function extractItemTitle(item) {
  return String(item?.title || item?.name || item?.product || "").trim();
}

function extractTotalPrice(item) {
  return roundMoney(extractNumericPrice(item) + extractNumericShipping(item));
}

function itemMatchesCondition(item, conditionText) {
  const wanted = normalizeText(conditionText).trim();
  if (!wanted) return true;

  const haystack = normalizeText(
    [
      item?.condition,
      item?.conditionDisplayName,
      item?.itemCondition,
      item?.subtitle,
      item?.title,
    ]
      .filter(Boolean)
      .join(" ")
  );

  return haystack.includes(wanted);
}

function itemMatchesPrice(item, filterPriceMax) {
  const max = Number(filterPriceMax || 0);
  if (!max || max <= 0) return true;

  const total = extractNumericPrice(item) + extractNumericShipping(item);
  return total <= max;
}

function itemMatchesFreeShipping(item, freeShippingOnly) {
  if (!freeShippingOnly) return true;
  return extractNumericShipping(item) <= 0;
}

function buildAutoCompsFromItems(items = []) {
  const prices = items
    .map((item) => extractNumericPrice(item))
    .filter((v) => Number.isFinite(v) && v > 0);

  const cleanedPrices = removePriceOutliers(prices);

  const compCount = cleanedPrices.length;
  const avgSoldPrice = average(cleanedPrices);
  const medianSoldPrice = median(cleanedPrices);
  const minSoldPrice = compCount ? roundMoney(Math.min(...cleanedPrices)) : 0;
  const maxSoldPrice = compCount ? roundMoney(Math.max(...cleanedPrices)) : 0;

  let confidence = 20;
  if (compCount >= 3) confidence = 55;
  if (compCount >= 5) confidence = 72;
  if (compCount >= 8) confidence = 86;

  let confidenceLabel = "Low";
  if (confidence >= 80) confidenceLabel = "High";
  else if (confidence >= 55) confidenceLabel = "Medium";

  return {
    pricingMode: "Auto comps estimate",
    compCount,
    confidence,
    confidenceLabel,
    avgSoldPrice,
    medianSoldPrice,
    minSoldPrice,
    maxSoldPrice,
    samplePrices: cleanedPrices.slice(0, 12),
    manualSoldPricesText: cleanedPrices.join(", "),
  };
}

function buildBestOfferGuidance(item, scanner) {
  const hasBestOffer =
    Array.isArray(item?.buyingOptions) &&
    item.buyingOptions.includes("BEST_OFFER");

  if (!hasBestOffer) return null;

  const askPrice = Number(scanner?.totalBuyPrice || 0);
  const resale = Number(scanner?.estimatedResale || 0);
  const repairCost = Number(scanner?.repairCost || 0);

  if (!askPrice || !resale) return null;

  const suggestedOffer = roundMoney(Math.min(askPrice * 0.9, askPrice));
  const aggressiveOffer = roundMoney(Math.min(askPrice * 0.82, askPrice));

  let maxSafeOffer = roundMoney(resale * 0.7);

  if (maxSafeOffer > askPrice) {
    maxSafeOffer = askPrice;
  }

  function calcProfit(offer) {
    const fees = roundMoney(resale * 0.15);
    return roundMoney(resale - fees - offer - repairCost);
  }

  return {
    hasBestOffer: true,
    askPrice,
    suggestedOffer,
    aggressiveOffer,
    maxSafeOffer,
    profitAtSuggested: calcProfit(suggestedOffer),
    profitAtAggressive: calcProfit(aggressiveOffer),
    profitAtMaxSafe: calcProfit(maxSafeOffer),
  };
}

function getUserFromCookie(req) {
  try {
    const token = req.cookies?.flipai_token;
    if (!token) return null;
    const decoded = jwt.verify(token, JWT_SECRET);
    return getUserById(decoded.userId);
  } catch {
    return null;
  }
}

function createGenericPricingModel(items = []) {
  const totals = removePriceOutliers(
    (Array.isArray(items) ? items : [])
      .map((item) => extractTotalPrice(item))
      .filter((v) => Number.isFinite(v) && v > 0)
  );

  const marketMedian = median(totals);
  const marketLow = percentile(totals, 0.35);

  let baseline = marketMedian || marketLow || 0;
  const estimatedResale = roundMoney(baseline * 0.95);

  const compCount = totals.length;
  let confidence = 22;
  if (compCount >= 3) confidence = 55;
  if (compCount >= 5) confidence = 70;
  if (compCount >= 8) confidence = 84;

  confidence = Math.min(92, confidence);

  let confidenceLabel = "Low";
  if (confidence >= 80) confidenceLabel = "High";
  else if (confidence >= 55) confidenceLabel = "Medium";

  return {
    estimatedResale,
    compCount,
    confidence,
    confidenceLabel,
    pricingMode: "Generic market median",
    marketMedian,
    marketLow,
    listingMedian: 0,
  };
}

function buildDealReasonBreakdown({
  title,
  pricingMode,
  confidence,
  confidenceLabel,
  compCount,
  marginPercent,
  undervaluedAmount,
  undervaluedPercent,
  estimatedProfit,
  estimatedResale,
  totalBuyPrice,
  ebayFees,
  risk,
  verdict,
  bundleValueBonus = 0,
  repairCost = 0,
  warningFlags = [],
  warningScorePenalty = 0,
}) {
  const bullets = [];

  bullets.push(
    `Spread of ${roundMoney(undervaluedAmount).toFixed(2)} between total buy cost and estimated resale.`
  );
  bullets.push(
    `Projected profit of ${roundMoney(estimatedProfit).toFixed(2)} after estimated eBay fees.`
  );

  if (compCount > 0) {
    bullets.push(
      `${Number(compCount || 0)} pricing comps support this estimate using ${pricingMode || "market pricing"}.`
    );
  }

  if (bundleValueBonus > 0) {
    bullets.push(
      `Bundle value boost of ${roundMoney(bundleValueBonus).toFixed(2)} applied for included extras.`
    );
  }

  if (repairCost > 0) {
    bullets.push(
      `Repair or replacement allowance of ${roundMoney(repairCost).toFixed(2)} was factored into the deal.`
    );
  }

  if (marginPercent >= 25) {
    bullets.push("Strong margin profile for a resale candidate.");
  } else if (marginPercent >= 12) {
    bullets.push("Decent margin if the item matches the expected condition.");
  } else {
    bullets.push("Thin margin, so buying discipline matters here.");
  }

  if (confidence >= 80) {
    bullets.push("High confidence from a stronger matching comp pool.");
  } else if (confidence >= 55) {
    bullets.push("Medium confidence because there is some useful comp support.");
  } else {
    bullets.push("Low confidence, so this needs extra manual checking.");
  }

  if (warningFlags.length) {
    bullets.push(
      `${warningFlags.length} warning${warningFlags.length > 1 ? "s were" : " was"} detected and ranking was adjusted.`
    );
  }

  if (risk === "Low") {
    bullets.push("Risk is lower because projected profit clears the current threshold comfortably.");
  } else if (risk === "Medium") {
    bullets.push("Risk is moderate because the deal has some buffer but not a huge one.");
  } else {
    bullets.push("Risk is high because the current price leaves little room for error.");
  }

  return {
    pricingMode,
    confidence,
    confidenceLabel,
    compCount,
    marginPercent: roundMoney(marginPercent),
    undervaluedAmount: roundMoney(undervaluedAmount),
    undervaluedPercent: roundMoney(undervaluedPercent),
    estimatedProfit: roundMoney(estimatedProfit),
    estimatedResale: roundMoney(estimatedResale),
    totalBuyPrice: roundMoney(totalBuyPrice),
    ebayFees: roundMoney(ebayFees),
    repairCost: roundMoney(repairCost),
    bundleValueBonus: roundMoney(bundleValueBonus),
    warningFlags,
    warningScorePenalty,
    risk,
    verdict,
    bullets,
    title: String(title || "").trim(),
  };
}

function buildReasonText({ estimatedProfit, undervaluedAmount }) {
  return `Strong spread: about £${roundMoney(undervaluedAmount).toFixed(2)} below model with £${roundMoney(estimatedProfit).toFixed(2)} projected profit.`;
}

function evaluateDeal({
  item,
  pricingModel,
  queryContext,
  engine,
}) {
  const title = extractItemTitle(item);
  const price = extractNumericPrice(item);
  const shipping = extractNumericShipping(item);
  const total = roundMoney(price + shipping);

  const classified = typeof engine?.classifyItem === "function"
    ? engine.classifyItem(item, queryContext)
    : {};

  const repairCost = roundMoney(classified?.repairCost || 0);

  const adjusted = typeof engine?.adjustListingPricing === "function"
    ? engine.adjustListingPricing({
        queryContext,
        item,
        pricingModel,
        classifiedItem: classified,
      })
    : {
        estimatedResale: roundMoney(pricingModel?.estimatedResale || 0),
        bundleValueBonus: 0,
        warningFlags: [],
        warningScorePenalty: 0,
        bundleSignals: classified?.bundleSignals || {},
        bundleType: classified?.bundleType || "standard",
      };

  const estimatedResale = roundMoney(
    adjusted?.estimatedResale ?? pricingModel?.estimatedResale ?? 0
  );

  const ebayFees = roundMoney(estimatedResale * 0.15);
  const estimatedProfit = roundMoney(
    estimatedResale - ebayFees - total - repairCost
  );
  const marginPercent =
    total > 0 ? roundMoney((estimatedProfit / total) * 100) : 0;

  let verdict = "AVOID";
  if (estimatedProfit >= 40) verdict = "GOOD DEAL";
  else if (estimatedProfit >= 15) verdict = "OK DEAL";
  else if (estimatedProfit >= 5) verdict = "MARGINAL";

  let risk = "High";
  if (estimatedProfit >= 40) risk = "Low";
  else if (estimatedProfit >= 15) risk = "Medium";

  const rawScore = roundMoney(
    Math.max(0, estimatedProfit) +
      Math.max(0, marginPercent) +
      (risk === "Low" ? 15 : risk === "Medium" ? 8 : 0)
  );

  const warningFlags = Array.isArray(adjusted?.warningFlags)
    ? adjusted.warningFlags
    : Array.isArray(classified?.warningFlags)
      ? classified.warningFlags
      : [];

  const warningScorePenalty = Number(
    adjusted?.warningScorePenalty ??
      classified?.warningScorePenalty ??
      0
  ) || 0;

  const score = roundMoney(Math.max(0, rawScore - warningScorePenalty));

  const undervaluedAmount = roundMoney(Math.max(0, estimatedResale - total));
  const undervaluedPercent =
    total > 0 ? roundMoney((undervaluedAmount / total) * 100) : 0;

  let finderLabel = "Tight";
  if (estimatedProfit >= 40) finderLabel = "Buy";
  else if (estimatedProfit >= 15) finderLabel = "Offer";

  const scanner = {
    totalBuyPrice: total,
    estimatedResale,
    repairCost,
    estimatedProfit,
    ebayFees,
    marginPercent,
    verdict,
    risk,
    score,
    rawScore,
    warningScorePenalty,
    compCount: Number(pricingModel?.compCount || 0),
    confidence: Number(pricingModel?.confidence || 0),
    confidenceLabel: pricingModel?.confidenceLabel || "Low",
    pricingMode: pricingModel?.pricingMode || "Market median",
  };

  const reasonBreakdown = buildDealReasonBreakdown({
    title,
    pricingMode: scanner.pricingMode,
    confidence: scanner.confidence,
    confidenceLabel: scanner.confidenceLabel,
    compCount: scanner.compCount,
    marginPercent: scanner.marginPercent,
    undervaluedAmount,
    undervaluedPercent,
    estimatedProfit,
    estimatedResale,
    totalBuyPrice: total,
    ebayFees,
    repairCost,
    bundleValueBonus: roundMoney(adjusted?.bundleValueBonus || 0),
    warningFlags,
    warningScorePenalty,
    risk,
    verdict,
  });

  return {
    ...item,
    title,
    price,
    shipping,
    scanner,
    bestOffer: buildBestOfferGuidance(item, scanner),
    estimatedProfit,
    dealScore: score,
    rawDealScore: rawScore,
    warningFlags,
    warningScorePenalty,
    undervaluedAmount,
    undervaluedPercent,
    finderLabel,
    reason: buildReasonText({ estimatedProfit, undervaluedAmount }),
    reasonBreakdown,
    url:
      item?.itemWebUrl ||
      item?.viewItemURL ||
      item?.url ||
      item?.link ||
      "",
    bundleType: adjusted?.bundleType || classified?.bundleType || "",
    bundleSignals: adjusted?.bundleSignals || classified?.bundleSignals || {},
    bundleValueBonus: roundMoney(adjusted?.bundleValueBonus || 0),
  };
}

function sortDealsForFindDeals(deals = [], queryContext = {}) {
  const wantsBundle = Boolean(queryContext?.wantsBundle);

  const sorted = [...deals].sort((a, b) => {
    if (wantsBundle) {
      const aBundle = a?.bundleType === "bundle" ? 1 : 0;
      const bBundle = b?.bundleType === "bundle" ? 1 : 0;

      if (bBundle !== aBundle) {
        return bBundle - aBundle;
      }
    }

    return Number(b?.dealScore || 0) - Number(a?.dealScore || 0);
  });

  return sorted;
}

function applyBundlePreferenceFallback(deals = [], queryContext = {}) {
  if (!queryContext?.wantsBundle) {
    return deals;
  }

  const bundleDeals = deals.filter((deal) => deal?.bundleType === "bundle");
  if (bundleDeals.length > 0) {
    return sortDealsForFindDeals(bundleDeals, queryContext);
  }

  return sortDealsForFindDeals(deals, queryContext);
}

app.get("/api/me", (req, res) => {
  try {
    const user = getUserFromCookie(req);

    if (!user) {
      return res.status(401).json({ error: "Not signed in." });
    }

    return res.json({ user: safeUser(user) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to load user." });
  }
});

app.post("/api/search-ebay", async (req, res) => {
  try {
    const user = getUserFromCookie(req);
    if (!user) {
      return res.status(401).json({ error: "Please sign in." });
    }

    const {
      query,
      condition = "",
      filterPriceMax = 0,
      limit = 8,
      freeShippingOnly = false,
    } = req.body || {};

    if (!query) {
      return res.status(400).json({ error: "Search query required." });
    }

    const engine = detectEngineForQuery(query);
    const queryContext =
      typeof engine?.classifyQuery === "function"
        ? engine.classifyQuery(query)
        : { rawQuery: query, normalizedQuery: normalizeText(query) };

    const items = await searchEbayListings({
      query,
      maxPrice: filterPriceMax,
      condition,
      freeShippingOnly,
      limit,
    });

    let filtered = Array.isArray(items) ? items : [];

    filtered = filtered.filter((item) => itemMatchesCondition(item, condition));
    filtered = filtered.filter((item) => itemMatchesPrice(item, filterPriceMax));
    filtered = filtered.filter((item) =>
      itemMatchesFreeShipping(item, freeShippingOnly)
    );

    if (typeof engine?.matchesItem === "function") {
      filtered = filtered.filter((item) => engine.matchesItem(item, queryContext));
    }

    return res.json({
      ok: true,
      items: filtered,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Could not search eBay." });
  }
});

app.post("/api/auto-comps", async (req, res) => {
  try {
    const user = getUserFromCookie(req);
    if (!user) {
      return res.status(401).json({ error: "Please sign in." });
    }

    const { product = "", condition = "" } = req.body || {};

    if (!product.trim()) {
      return res.status(400).json({ error: "Product is required." });
    }

    const searchQuery = [product, condition].filter(Boolean).join(" ").trim();
    const engine = detectEngineForQuery(searchQuery);
    const queryContext =
      typeof engine?.classifyQuery === "function"
        ? engine.classifyQuery(searchQuery)
        : { rawQuery: searchQuery, normalizedQuery: normalizeText(searchQuery) };

    const marketItems = await searchEbayMarketPool({
      query: searchQuery,
      condition,
      limit: 24,
    });

    let filtered = Array.isArray(marketItems) ? marketItems : [];

    if (condition.trim()) {
      filtered = filtered.filter((item) => itemMatchesCondition(item, condition));
    }

    if (typeof engine?.matchesItem === "function") {
      filtered = filtered.filter((item) => engine.matchesItem(item, queryContext));
    }

    const autoComps = buildAutoCompsFromItems(filtered);

    return res.json({
      ok: true,
      searchQuery,
      autoComps,
      itemsUsed: filtered.length,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Could not auto-fill comps." });
  }
});

app.post("/api/find-deals", async (req, res) => {
  try {
    const user = getUserFromCookie(req);
    if (!user) {
      return res.status(401).json({ error: "Please sign in." });
    }

    const {
      query,
      condition = "",
      filterPriceMax = 0,
      limit = 30,
      topN = 8,
      freeShippingOnly = false,
    } = req.body || {};

    if (!query) {
      return res.status(400).json({ error: "Search query required." });
    }

    const engine = detectEngineForQuery(query);
    const queryContext =
      typeof engine?.classifyQuery === "function"
        ? engine.classifyQuery(query)
        : { rawQuery: query, normalizedQuery: normalizeText(query) };

    const listings = await searchEbayListings({
      query,
      maxPrice: filterPriceMax,
      condition,
      freeShippingOnly,
      limit,
    });

    const market = await searchEbayMarketPool({
      query,
      condition,
      limit: 50,
    });

    let cleanListings = Array.isArray(listings) ? listings : [];
    let cleanMarket = Array.isArray(market) ? market : [];

    cleanListings = cleanListings.filter((item) => itemMatchesCondition(item, condition));
    cleanListings = cleanListings.filter((item) => itemMatchesPrice(item, filterPriceMax));
    cleanListings = cleanListings.filter((item) =>
      itemMatchesFreeShipping(item, freeShippingOnly)
    );

    if (condition.trim()) {
      cleanMarket = cleanMarket.filter((item) => itemMatchesCondition(item, condition));
    }

    if (typeof engine?.matchesItem === "function") {
      cleanListings = cleanListings.filter((item) => engine.matchesItem(item, queryContext));
      cleanMarket = cleanMarket.filter((item) => engine.matchesItem(item, queryContext));
    }

    const pricingModel =
      typeof engine?.buildPricingModel === "function"
        ? engine.buildPricingModel({
            queryContext,
            marketItems: cleanMarket,
            listingItems: cleanListings,
          })
        : createGenericPricingModel(cleanMarket);

    let deals = cleanListings.map((item) =>
      evaluateDeal({
        item,
        pricingModel,
        queryContext,
        engine,
      })
    );

    deals = deals.filter((item) => {
      const verdict = String(item?.scanner?.verdict || "").toUpperCase();
      const score = Number(item?.dealScore || item?.scanner?.score || 0);

      if (verdict === "AVOID" && score <= 0) {
        return false;
      }

      return true;
    });

    const preferredDeals = applyBundlePreferenceFallback(deals, queryContext);
    const finalDeals = preferredDeals
      .slice(0, Number(topN || 8))
      .map((deal, index) => ({
        ...deal,
        bestDeal: index === 0,
      }));

    return res.json({
      ok: true,
      deals: finalDeals,
      totalFetched: Array.isArray(listings) ? listings.length : 0,
      totalMatched: preferredDeals.length,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to find deals" });
  }
});

app.post("/api/signup", signupHandler);
app.post("/api/login", loginHandler);
app.post("/api/logout", logoutHandler);

app.post("/api/analyze", runAnalysis);

app.post("/api/create-checkout-session", async (req, res) => {
  try {
    const maybeResponse = await createCheckoutSession(req, res);
    if (!res.headersSent && maybeResponse !== undefined) {
      return res.json(maybeResponse);
    }
  } catch (firstErr) {
    try {
      const user = getUserFromCookie(req);
      if (!user) {
        return res.status(401).json({ error: "Please sign in." });
      }

      const maybeResponse = await createCheckoutSession({
        plan: req.body?.plan,
        user,
        appUrl,
        req,
        res,
      });

      if (!res.headersSent && maybeResponse !== undefined) {
        return res.json(maybeResponse);
      }

      if (!res.headersSent) {
        return res.status(500).json({ error: "Could not start checkout." });
      }
    } catch (err) {
      console.error(firstErr);
      console.error(err);
      if (!res.headersSent) {
        return res.status(500).json({ error: "Could not start checkout." });
      }
    }
  }
});

app.post("/api/create-portal-session", async (req, res) => {
  try {
    const maybeResponse = await createPortalSession(req, res);
    if (!res.headersSent && maybeResponse !== undefined) {
      return res.json(maybeResponse);
    }
  } catch (firstErr) {
    try {
      const user = getUserFromCookie(req);
      if (!user) {
        return res.status(401).json({ error: "Please sign in." });
      }

      const maybeResponse = await createPortalSession({
        user,
        appUrl,
        req,
        res,
      });

      if (!res.headersSent && maybeResponse !== undefined) {
        return res.json(maybeResponse);
      }

      if (!res.headersSent) {
        return res.status(500).json({ error: "Could not open billing portal." });
      }
    } catch (err) {
      console.error(firstErr);
      console.error(err);
      if (!res.headersSent) {
        return res.status(500).json({ error: "Could not open billing portal." });
      }
    }
  }
});

app.post(
  "/api/stripe/webhook",
  express.raw({ type: "application/json" }),
  stripeWebhookHandler
);

app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(port, () => {
  console.log(`FlipAI running on ${appUrl}`);
});
