// ✅ YOUR ORIGINAL FILE — ONLY 1 CHANGE APPLIED (camera filter fix)

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
import * as engineRegistry from "./engines/index.js";

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

// (ALL YOUR EXISTING FUNCTIONS REMAIN UNCHANGED — TRIMMED FOR BREVITY)

function resolveEngineForQuery(query) {
  try {
    if (typeof engineRegistry.detectEngineForQuery === "function") {
      return engineRegistry.detectEngineForQuery(query);
    }
    return null;
  } catch {
    return null;
  }
}

// =========================
// 🔥 FIX APPLIED HERE ONLY
// =========================

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
      includeTightDeals = false,
    } = req.body || {};

    if (!query) {
      return res.status(400).json({ error: "Search query required." });
    }

    const engine = resolveEngineForQuery(query);
    const queryContext =
      engine && typeof engine.classifyQuery === "function"
        ? engine.classifyQuery(query)
        : { rawQuery: query, normalizedQuery: normalizeText(query) };

    const fetchedListings = await fetchListingsAcrossVariants({
      engine,
      query,
      condition,
      filterPriceMax,
      freeShippingOnly,
      limit: Math.max(Number(limit || 30), 30),
    });

    const fetchedMarket = await fetchMarketAcrossVariants({
      engine,
      query,
      condition,
      limit: 50,
    });

    let cleanListings = Array.isArray(fetchedListings.items) ? fetchedListings.items : [];
    let cleanMarket = Array.isArray(fetchedMarket.items) ? fetchedMarket.items : [];

    // ✅ ORIGINAL FILTERS
    cleanListings = cleanListings.filter((item) => itemMatchesCondition(item, condition));
    cleanListings = cleanListings.filter((item) => itemMatchesPrice(item, filterPriceMax));
    cleanListings = cleanListings.filter((item) =>
      itemMatchesFreeShipping(item, freeShippingOnly)
    );

    if (condition.trim()) {
      cleanMarket = cleanMarket.filter((item) => itemMatchesCondition(item, condition));
    }

    // =========================
    // 🔥 CAMERA ENGINE FIX
    // =========================
    if (engine && typeof engine.matchesItem === "function") {

      if (engine.id !== "camera") {
        cleanListings = cleanListings.filter((item) =>
          engine.matchesItem(item, queryContext)
        );

        cleanMarket = cleanMarket.filter((item) =>
          engine.matchesItem(item, queryContext)
        );
      } else {
        console.log("📸 Camera engine: skipping strict filtering");
      }
    }

    const pricingModel =
      engine && typeof engine.buildPricingModel === "function"
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

    deals = filterDealsForOutput(deals, Boolean(includeTightDeals));

    const preferredDeals = applyBundlePreferenceFallback(deals, queryContext);
    const finalDeals = preferredDeals
      .slice(0, Number(topN || 8))
      .map((deal, index) => ({
        ...deal,
        bestDeal: index === 0,
      }));

    return res.json({
      ok: true,
      searchQuery: fetchedListings.searchQuery,
      searchVariants: fetchedListings.searchVariants,
      includeTightDeals: Boolean(includeTightDeals),
      deals: finalDeals,
      totalFetched: Array.isArray(fetchedListings.items) ? fetchedListings.items.length : 0,
      totalMatched: preferredDeals.length,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to find deals" });
  }
});

// (REST OF YOUR FILE UNCHANGED)

app.listen(port, () => {
  console.log(`FlipAI running on ${appUrl}`);
});
