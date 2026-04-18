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
import { detectCategoryEngine } from "./engines/index.js";
import {
  normalizeText,
  roundMoney,
  average,
  median,
  extractNumericPrice,
  extractNumericShipping,
  extractItemTitle,
  removePriceOutliers,
} from "./engines/baseEngine.js";

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

function buildReasonBreakdown({
  pricingMode = "Market median",
  confidence = 0,
  confidenceLabel = "Low",
  compCount = 0,
  marginPercent = 0,
  undervaluedAmount = 0,
  undervaluedPercent = 0,
  estimatedProfit = 0,
  estimatedResale = 0,
  totalBuyPrice = 0,
  ebayFees = 0,
  risk = "High",
  verdict = "AVOID",
  title = "",
}) {
  const bullets = [];

  if (undervaluedAmount > 0) {
    bullets.push(
      `Spread of ${roundMoney(undervaluedAmount).toFixed(2)} between total buy cost and estimated resale.`
    );
  }

  if (estimatedProfit > 0) {
    bullets.push(
      `Projected profit of ${roundMoney(estimatedProfit).toFixed(2)} after estimated eBay fees.`
    );
  } else if (estimatedProfit < 0) {
    bullets.push(
      `Current pricing leaves an estimated loss of ${Math.abs(roundMoney(estimatedProfit)).toFixed(2)} after fees.`
    );
  }

  if (compCount > 0) {
    bullets.push(
      `${compCount} pricing comps support this estimate using ${pricingMode.toLowerCase()}.`
    );
  } else {
    bullets.push(`No strong comp depth was found, so confidence is lower on this estimate.`);
  }

  if (marginPercent >= 40) {
    bullets.push(`Strong margin profile for a resale candidate.`);
  } else if (marginPercent >= 15) {
    bullets.push(`Decent margin if the item matches the expected condition.`);
  } else if (marginPercent > 0) {
    bullets.push(`Thin margin, so buying discipline matters here.`);
  } else {
    bullets.push(`No real safety margin at the current ask price.`);
  }

  if (confidenceLabel === "High") {
    bullets.push(`High confidence from a stronger matching comp pool.`);
  } else if (confidenceLabel === "Medium") {
    bullets.push(`Medium confidence with enough comps for a usable guide price.`);
  } else {
    bullets.push(`Low confidence because the comp pool is still light or mixed.`);
  }

  if (risk === "Low") {
    bullets.push(`Risk is lower because projected profit clears the current threshold comfortably.`);
  } else if (risk === "Medium") {
    bullets.push(`Risk is moderate because the deal has some buffer but not a huge one.`);
  } else {
    bullets.push(`Risk is high because the current price leaves little room for error.`);
  }

  return {
    pricingMode,
    confidence: Number(confidence || 0),
    confidenceLabel,
    compCount: Number(compCount || 0),
    marginPercent: roundMoney(marginPercent),
    undervaluedAmount: roundMoney(undervaluedAmount),
    undervaluedPercent: roundMoney(undervaluedPercent),
    estimatedProfit: roundMoney(estimatedProfit),
    estimatedResale: roundMoney(estimatedResale),
    totalBuyPrice: roundMoney(totalBuyPrice),
    ebayFees: roundMoney(ebayFees),
    risk,
    verdict,
    bullets,
    title,
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

function buildDealAnalytics({
  item,
  pricing,
  title,
  itemContext = {},
}) {
  const price = extractNumericPrice(item);
  const shipping = extractNumericShipping(item);
  const total = roundMoney(price + shipping);

  const repairCost = Number(itemContext?.repairCost || 0);
  const resale = roundMoney(pricing?.estimatedResale || 0);
  const fees = roundMoney(resale * 0.15);
  const estimatedProfit = roundMoney(resale - fees - total - repairCost);
  const marginPercent =
    total > 0 ? roundMoney((estimatedProfit / total) * 100) : 0;

  let verdict = "AVOID";
  if (estimatedProfit >= 40) verdict = "GOOD DEAL";
  else if (estimatedProfit >= 15) verdict = "OK DEAL";
  else if (estimatedProfit >= 5) verdict = "MARGINAL";

  let risk = "High";
  if (estimatedProfit >= 40) risk = "Low";
  else if (estimatedProfit >= 15) risk = "Medium";

  const score = roundMoney(
    Math.max(0, estimatedProfit) +
      Math.max(0, marginPercent) +
      (risk === "Low" ? 15 : risk === "Medium" ? 8 : 0)
  );

  const undervaluedAmount = roundMoney(Math.max(0, resale - total));
  const undervaluedPercent =
    total > 0 ? roundMoney((undervaluedAmount / total) * 100) : 0;

  let finderLabel = "Tight";
  if (estimatedProfit >= 40) finderLabel = "Buy";
  else if (estimatedProfit >= 15) finderLabel = "Offer";

  const scanner = {
    totalBuyPrice: total,
    estimatedResale: resale,
    repairCost,
    estimatedProfit,
    ebayFees: fees,
    marginPercent,
    verdict,
    risk,
    score,
    compCount: Number(pricing?.compCount || 0),
    confidence: Number(pricing?.confidence || 0),
    confidenceLabel: pricing?.confidenceLabel || "Low",
    pricingMode: pricing?.pricingMode || "Market median",
  };

  const reasonBreakdown = buildReasonBreakdown({
    pricingMode: scanner.pricingMode,
    confidence: scanner.confidence,
    confidenceLabel: scanner.confidenceLabel,
    compCount: scanner.compCount,
    marginPercent,
    undervaluedAmount,
    undervaluedPercent,
    estimatedProfit,
    estimatedResale: resale,
    totalBuyPrice: total,
    ebayFees: fees,
    risk,
    verdict,
    title,
  });

  let reason = `Estimated resale based on conservative UK resale assumptions. Risk: ${risk}.`;

  if (repairCost > 0) {
    reason = `Repair-adjusted deal: about £${undervaluedAmount.toFixed(2)} below model with £${estimatedProfit.toFixed(2)} projected profit after fees and estimated repair cost.`;
  } else if (undervaluedAmount > 0 && estimatedProfit > 0) {
    reason = `Strong spread: about £${undervaluedAmount.toFixed(2)} below model with £${estimatedProfit.toFixed(2)} projected profit.`;
  } else if (estimatedProfit > 0) {
    reason = `Projected profit of about £${estimatedProfit.toFixed(2)} after fees. Risk: ${risk}.`;
  } else {
    reason = `Limited or negative margin at the current ask price. Risk: ${risk}.`;
  }

  return {
    price,
    shipping,
    total,
    resale,
    fees,
    repairCost,
    estimatedProfit,
    marginPercent,
    verdict,
    risk,
    score,
    undervaluedAmount,
    undervaluedPercent,
    finderLabel,
    scanner,
    reasonBreakdown,
    reason,
  };
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

    const engine = detectCategoryEngine(query);
    const queryContext = engine.classifyQuery(query);
    const searchVariantsOverride = engine.expandSearchVariants(query);

    const items = await searchEbayListings({
      query,
      maxPrice: filterPriceMax,
      condition,
      freeShippingOnly,
      limit,
      searchVariantsOverride,
    });

    const market = await searchEbayMarketPool({
      query,
      condition,
      limit: 50,
      searchVariantsOverride,
    });

    let filtered = Array.isArray(items) ? items : [];
    let cleanMarket = Array.isArray(market) ? market : [];
    let cleanListingsForPricing = Array.isArray(items) ? items : [];

    filtered = filtered.filter((item) => itemMatchesCondition(item, condition));
    filtered = filtered.filter((item) => itemMatchesPrice(item, filterPriceMax));
    filtered = filtered.filter((item) => itemMatchesFreeShipping(item, freeShippingOnly));
    filtered = filtered.filter((item) => engine.matchesItem(item, queryContext));

    cleanMarket = cleanMarket.filter((item) => engine.matchesItem(item, queryContext));
    cleanListingsForPricing = cleanListingsForPricing.filter((item) =>
      engine.matchesItem(item, queryContext)
    );

    const pricing = engine.buildPricingModel({
      query,
      queryContext,
      marketItems: cleanMarket,
      listingItems: cleanListingsForPricing,
    });

    const enrichedItems = filtered.map((item) => {
      const title = extractItemTitle(item);
      const itemContext =
        typeof engine.classifyItem === "function"
          ? engine.classifyItem(item, queryContext)
          : {};

      const analytics = buildDealAnalytics({
        item,
        pricing,
        title,
        itemContext,
      });

      return {
        ...item,
        price: analytics.price,
        shipping: analytics.shipping,
        scanner: analytics.scanner,
        estimatedProfit: analytics.estimatedProfit,
        reason: analytics.reason,
        reasonBreakdown: analytics.reasonBreakdown,
        bestOffer: buildBestOfferGuidance(item, analytics.scanner),
        dealScore: analytics.score,
        undervaluedAmount: analytics.undervaluedAmount,
        undervaluedPercent: analytics.undervaluedPercent,
        finderLabel: analytics.finderLabel,
        url:
          item?.itemWebUrl ||
          item?.viewItemURL ||
          item?.url ||
          item?.link ||
          "",
      };
    });

    return res.json({
      ok: true,
      items: enrichedItems,
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
    const engine = detectCategoryEngine(searchQuery);
    const queryContext = engine.classifyQuery(searchQuery);
    const searchVariantsOverride = engine.expandSearchVariants(searchQuery);

    const marketItems = await searchEbayMarketPool({
      query: searchQuery,
      condition,
      limit: 24,
      searchVariantsOverride,
    });

    let filtered = Array.isArray(marketItems) ? marketItems : [];

    if (condition.trim()) {
      filtered = filtered.filter((item) => itemMatchesCondition(item, condition));
    }

    filtered = filtered.filter((item) => engine.matchesItem(item, queryContext));

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

    const engine = detectCategoryEngine(query);
    const queryContext = engine.classifyQuery(query);
    const searchVariantsOverride = engine.expandSearchVariants(query);

    const listings = await searchEbayListings({
      query,
      maxPrice: filterPriceMax,
      condition,
      freeShippingOnly,
      limit,
      searchVariantsOverride,
    });

    const market = await searchEbayMarketPool({
      query,
      condition,
      limit: 50,
      searchVariantsOverride,
    });

    let cleanMarket = Array.isArray(market) ? market : [];
    let cleanListingsForPricing = Array.isArray(listings) ? listings : [];

    cleanMarket = cleanMarket.filter((item) => engine.matchesItem(item, queryContext));
    cleanListingsForPricing = cleanListingsForPricing.filter((item) =>
      engine.matchesItem(item, queryContext)
    );

    const pricing = engine.buildPricingModel({
      query,
      queryContext,
      marketItems: cleanMarket,
      listingItems: cleanListingsForPricing,
    });

    let deals = (Array.isArray(listings) ? listings : []).map((item) => {
      const title = extractItemTitle(item);
      const itemContext =
        typeof engine.classifyItem === "function"
          ? engine.classifyItem(item, queryContext)
          : {};

      const analytics = buildDealAnalytics({
        item,
        pricing,
        title,
        itemContext,
      });

      return {
        ...item,
        price: analytics.price,
        shipping: analytics.shipping,
        scanner: analytics.scanner,
        bestOffer: buildBestOfferGuidance(item, analytics.scanner),
        estimatedProfit: analytics.estimatedProfit,
        dealScore: analytics.score,
        undervaluedAmount: analytics.undervaluedAmount,
        undervaluedPercent: analytics.undervaluedPercent,
        finderLabel: analytics.finderLabel,
        reason: analytics.reason,
        reasonBreakdown: analytics.reasonBreakdown,
        url:
          item?.itemWebUrl ||
          item?.viewItemURL ||
          item?.url ||
          item?.link ||
          "",
      };
    });

    deals = deals.filter((item) => itemMatchesCondition(item, condition));
    deals = deals.filter((item) => itemMatchesPrice(item, filterPriceMax));
    deals = deals.filter((item) => itemMatchesFreeShipping(item, freeShippingOnly));
    deals = deals.filter((item) => engine.matchesItem(item, queryContext));

    deals = deals.filter((item) => {
      const verdict = String(item?.scanner?.verdict || "").toUpperCase();
      const score = Number(item?.dealScore || item?.scanner?.score || 0);

      if (verdict === "AVOID" && score <= 0) {
        return false;
      }

      return true;
    });

    deals.sort((a, b) => Number(b.dealScore || 0) - Number(a.dealScore || 0));

    const finalDeals = deals.slice(0, Number(topN || 8)).map((deal, index) => ({
      ...deal,
      bestDeal: index === 0,
    }));

    return res.json({
      ok: true,
      deals: finalDeals,
      totalFetched: Array.isArray(listings) ? listings.length : 0,
      totalMatched: deals.length,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to find deals" });
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
