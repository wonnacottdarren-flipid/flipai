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
import { searchEbayListings, searchEbayMarketPool } from "./ebay.js";

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
  return String(value || "").toLowerCase();
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

  const compCount = prices.length;
  const avgSoldPrice = average(prices);
  const medianSoldPrice = median(prices);
  const minSoldPrice = compCount ? roundMoney(Math.min(...prices)) : 0;
  const maxSoldPrice = compCount ? roundMoney(Math.max(...prices)) : 0;

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
    samplePrices: prices.slice(0, 12),
    manualSoldPricesText: prices.join(", "),
  };
}

/* =========================
   💰 FIXED BEST OFFER
========================= */

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

/* =========================
   🔐 AUTH HELPERS
========================= */

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

/* =========================
   🔎 DYSON MATCH HELPERS
========================= */

function hasAny(text, phrases = []) {
  return phrases.some((phrase) => text.includes(phrase));
}

function isDysonAccessoryOrParts(text) {
  return hasAny(text, [
    "parts",
    "spares",
    "attachment",
    "attachments",
    "tool only",
    "tools only",
    "battery only",
    "battery",
    "charger",
    "dock",
    "wall dock",
    "filter",
    "filters",
    "wand",
    "pipe",
    "crevice",
    "brush",
    "roller",
    "roller head",
    "head only",
    "floor head",
    "motorhead",
    "motor head",
    "nozzle",
    "hose",
    "trigger",
    "bin only",
    "canister only",
  ]);
}

function isDysonMainUnitListing(text) {
  return hasAny(text, [
    "main unit",
    "motor unit",
    "body only",
    "main body",
    "machine body",
    "handheld unit",
    "main vacuum unit",
    "bare unit",
    "unit only",
  ]);
}

function isDysonFullMachineListing(text) {
  return hasAny(text, [
    "vacuum cleaner",
    "cordless vacuum",
    "stick vacuum",
    "complete vacuum",
    "full vacuum",
    "complete machine",
    "complete set",
    "full set",
  ]);
}

function matchesDysonVariant(searchText, titleText) {
  if (!searchText.includes("dyson")) {
    return true;
  }

  const wantsV11 = searchText.includes("v11");
  const wantsOutsize = searchText.includes("outsize");
  const wantsMainUnit =
    searchText.includes("main unit") ||
    searchText.includes("main body") ||
    searchText.includes("body only") ||
    searchText.includes("motor unit") ||
    searchText.includes("body");

  const titleHasV11 = titleText.includes("v11");
  const titleHasOutsize = titleText.includes("outsize");
  const titleIsMainUnit = isDysonMainUnitListing(titleText);
  const titleIsParts = isDysonAccessoryOrParts(titleText);
  const titleIsFullMachine =
    isDysonFullMachineListing(titleText) ||
    (!titleIsMainUnit && !titleIsParts);

  if (titleIsParts) {
    return false;
  }

  if (wantsV11 && !titleHasV11) {
    return false;
  }

  if (wantsOutsize) {
    if (!titleHasOutsize) return false;
    if (titleIsMainUnit) return false;
    return titleIsFullMachine;
  }

  if (wantsMainUnit) {
    if (wantsV11 && !titleHasV11) return false;
    if (titleHasOutsize) return false;
    return titleIsMainUnit;
  }

  if (wantsV11) {
    if (!titleHasV11) return false;
    if (titleHasOutsize) return false;
    if (titleIsMainUnit) return false;
    return titleIsFullMachine;
  }

  return true;
}

/* =========================
   👤 USER ROUTE
========================= */

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

/* =========================
   🔎 SEARCH EBAY
========================= */

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

    const items = await searchEbayListings({
      query,
      limit,
    });

    const searchText = normalizeText(query);

    let filtered = Array.isArray(items) ? items : [];

    filtered = filtered.filter((item) => itemMatchesCondition(item, condition));
    filtered = filtered.filter((item) => itemMatchesPrice(item, filterPriceMax));
    filtered = filtered.filter((item) =>
      itemMatchesFreeShipping(item, freeShippingOnly)
    );

    if (searchText.includes("dyson")) {
      filtered = filtered.filter((item) => {
        const titleText = normalizeText(extractItemTitle(item));
        return matchesDysonVariant(searchText, titleText);
      });
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

/* =========================
   📊 AUTO COMPS
========================= */

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

    const marketItems = await searchEbayMarketPool({
      query: searchQuery,
      limit: 24,
    });

    let filtered = Array.isArray(marketItems) ? marketItems : [];

    if (condition.trim()) {
      filtered = filtered.filter((item) => itemMatchesCondition(item, condition));
    }

    const searchText = normalizeText(searchQuery);
    if (searchText.includes("dyson")) {
      filtered = filtered.filter((item) => {
        const titleText = normalizeText(extractItemTitle(item));
        return matchesDysonVariant(searchText, titleText);
      });
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

/* =========================
   🚀 FIND DEALS (SAFE)
========================= */

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

    const listings = await searchEbayListings({
      query,
      limit,
    });

    const market = await searchEbayMarketPool({
      query,
      limit: 50,
    });

    const marketPrices = (Array.isArray(market) ? market : [])
      .map((m) => extractNumericPrice(m))
      .filter((v) => Number.isFinite(v) && v > 0);

    const avgMarket = average(marketPrices);

    let deals = (Array.isArray(listings) ? listings : []).map((item) => {
      const price = extractNumericPrice(item);
      const shipping = extractNumericShipping(item);
      const total = roundMoney(price + shipping);

      const resale = roundMoney(avgMarket * 0.9);
      const fees = roundMoney(resale * 0.15);
      const estimatedProfit = roundMoney(resale - fees - total);
      const marginPercent =
        total > 0 ? roundMoney((estimatedProfit / total) * 100) : 0;

      let verdict = "AVOID";
      if (estimatedProfit >= 40) verdict = "GOOD DEAL";
      else if (estimatedProfit >= 15) verdict = "OK DEAL";
      else if (estimatedProfit >= 5) verdict = "MARGINAL";

      let risk = "High";
      if (estimatedProfit >= 40) risk = "Low";
      else if (estimatedProfit >= 15) risk = "Medium";

      const scanner = {
        totalBuyPrice: total,
        estimatedResale: resale,
        repairCost: 0,
        estimatedProfit,
        ebayFees: fees,
        marginPercent,
        verdict,
        risk,
        score: roundMoney(
          Math.max(0, estimatedProfit) +
            Math.max(0, marginPercent) +
            (risk === "Low" ? 15 : risk === "Medium" ? 8 : 0)
        ),
        compCount: marketPrices.length,
      };

      const undervaluedAmount = roundMoney(Math.max(0, resale - total));
      const undervaluedPercent =
        total > 0 ? roundMoney((undervaluedAmount / total) * 100) : 0;

      let finderLabel = "Tight";
      if (estimatedProfit >= 40) finderLabel = "Buy";
      else if (estimatedProfit >= 15) finderLabel = "Offer";

      return {
        ...item,
        price,
        shipping,
        scanner,
        bestOffer: buildBestOfferGuidance(item, scanner),
        estimatedProfit,
        dealScore: scanner.score,
        undervaluedAmount,
        undervaluedPercent,
        finderLabel,
        reason: `Estimated resale based on conservative UK resale assumptions. Risk: ${risk}.`,
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

    const searchText = normalizeText(query);

    if (searchText.includes("dyson")) {
      deals = deals.filter((d) => {
        const titleText = normalizeText(d.title);
        return matchesDysonVariant(searchText, titleText);
      });
    }

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

/* =========================
   AUTH ROUTES
========================= */

app.post("/api/signup", signupHandler);
app.post("/api/login", loginHandler);
app.post("/api/logout", logoutHandler);

/* =========================
   ANALYZE
========================= */

app.post("/api/analyze", runAnalysis);

/* =========================
   STRIPE ROUTES
========================= */

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

/* =========================
   FRONTEND
========================= */

app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(port, () => {
  console.log(`FlipAI running on ${appUrl}`);
});
