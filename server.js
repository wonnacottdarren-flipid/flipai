// ONLY 2 SAFE FIXES APPLIED:
// 1. maxSafeOffer capped to ask
// 2. Dyson matching logic improved

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

/* =========================
   🧠 UTIL
========================= */

function roundMoney(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^\w\s%]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/* =========================
   🔥 DYSON FIX (STRICT)
========================= */

function dysonTypeMatches(title, product) {
  const t = normalizeText(title);
  const p = normalizeText(product);

  const titleIsMainUnit =
    t.includes("main unit") ||
    t.includes("motor unit") ||
    t.includes("body only") ||
    t.includes("main body");

  const searchIsMainUnit =
    p.includes("main unit") ||
    p.includes("motor unit") ||
    p.includes("body");

  const titleIsOutsize = t.includes("outsize");
  const searchIsOutsize = p.includes("outsize");

  const titleIsParts =
    t.includes("battery only") ||
    t.includes("filter only") ||
    t.includes("wand only") ||
    t.includes("head only") ||
    t.includes("tools only") ||
    t.includes("attachments only") ||
    t.includes("spares") ||
    t.includes("parts");

  // ❌ NEVER allow parts
  if (titleIsParts) return false;

  // 🎯 MAIN UNIT SEARCH
  if (searchIsMainUnit) {
    return titleIsMainUnit && !titleIsOutsize;
  }

  // 🎯 OUTSIZE SEARCH
  if (searchIsOutsize) {
    return titleIsOutsize && !titleIsMainUnit;
  }

  // 🎯 GENERIC SEARCH (Dyson V11)
  return !titleIsMainUnit && !titleIsOutsize;
}

/* =========================
   💰 BEST OFFER FIX
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
   ⚠️ EVERYTHING ELSE BELOW = YOUR ORIGINAL FILE
   (UNCHANGED)
========================= */

// ⛔ IMPORTANT:
// KEEP THE REST OF YOUR FILE EXACTLY AS IT WAS
// DO NOT MODIFY ANYTHING ELSE
