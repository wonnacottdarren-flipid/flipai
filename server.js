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

  const suggestedOffer = roundMoney(askPrice * 0.9);
  const aggressiveOffer = roundMoney(askPrice * 0.82);

  let maxSafeOffer = roundMoney(resale * 0.7);

  // ✅ HARD CAP (FIX)
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
   🚀 FIND DEALS (SAFE)
========================= */

app.post("/api/find-deals", async (req, res) => {
  try {
    const user = getUserFromCookie(req);
    if (!user) {
      return res.status(401).json({ error: "Please sign in." });
    }

    const { query, limit = 30 } = req.body;

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

    const deals = listings.map((item) => {
      const price = Number(item.price || 0);
      const shipping = Number(item.shipping || 0);
      const total = price + shipping;

      const avg =
        market.reduce((sum, m) => sum + Number(m.price || 0), 0) /
        (market.length || 1);

      const resale = roundMoney(avg * 0.9);
      const fees = roundMoney(resale * 0.15);
      const profit = roundMoney(resale - fees - total);

      const scanner = {
        totalBuyPrice: total,
        estimatedResale: resale,
        repairCost: 0,
      };

      return {
        ...item,
        scanner,
        bestOffer: buildBestOfferGuidance(item, scanner),
        estimatedProfit: profit,
      };
    });

    /* =========================
       🔥 DYSON SAFE FILTER
    ========================= */

    const searchText = normalizeText(query);

    let filtered = deals;

    if (searchText.includes("dyson")) {
      const isMain = searchText.includes("main unit") || searchText.includes("body");
      const isOutsize = searchText.includes("outsize");

      filtered = deals.filter((d) => {
        const t = normalizeText(d.title);

        const main =
          t.includes("main unit") ||
          t.includes("motor unit") ||
          t.includes("body");

        const outsize = t.includes("outsize");

        const parts =
          t.includes("battery only") ||
          t.includes("filter") ||
          t.includes("wand") ||
          t.includes("head") ||
          t.includes("attachments") ||
          t.includes("spares") ||
          t.includes("parts");

        if (parts) return false;

        if (isMain) return main && !outsize;
        if (isOutsize) return outsize && !main;

        return !main && !outsize;
      });
    }

    return res.json({
      ok: true,
      deals: filtered.slice(0, 8),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to find deals" });
  }
});

/* =========================
   OTHER ROUTES (UNCHANGED)
========================= */

app.post("/api/signup", signupHandler);
app.post("/api/login", loginHandler);
app.post("/api/logout", logoutHandler);

app.post("/api/analyze", runAnalysis);

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
