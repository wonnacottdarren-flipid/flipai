// ✅ ONLY CHANGES:
// - maxSafeOffer capped to ask
// - Dyson logic improved (real flipper behaviour)

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
   🔥 DYSON FIX (IMPROVED)
========================= */

function getDysonTypeStrict(text) {
  const t = String(text || "").toLowerCase();

  const isMainUnit =
    t.includes("main unit") ||
    t.includes("motor unit") ||
    t.includes("body only") ||
    t.includes("main body");

  const isOutsize = t.includes("outsize");

  const isParts =
    t.includes("battery only") ||
    t.includes("filter only") ||
    t.includes("wand only") ||
    t.includes("head only") ||
    t.includes("tools only") ||
    t.includes("attachments only") ||
    t.includes("spares") ||
    t.includes("parts");

  if (isParts) return "parts";
  if (isMainUnit) return "main_unit";
  if (isOutsize) return "outsize";

  return "full";
}

function dysonStrictMatch(title, search) {
  const itemType = getDysonTypeStrict(title);
  const searchType = getDysonTypeStrict(search);

  // ❌ never allow parts
  if (itemType === "parts") return false;

  // 🎯 MAIN UNIT search → ONLY main units
  if (searchType === "main_unit") {
    return itemType === "main_unit";
  }

  // 🎯 OUTSIZE search → ONLY outsize
  if (searchType === "outsize") {
    return itemType === "outsize";
  }

  // 🎯 GENERIC Dyson → ONLY full machines (NO main unit, NO outsize)
  if (searchType === "full") {
    return itemType === "full";
  }

  return true;
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

  const suggestedOffer = Math.round(askPrice * 0.9);
  const aggressiveOffer = Math.round(askPrice * 0.82);

  let maxSafeOffer = Math.round(resale * 0.7);

  // 🔥 FIX: NEVER exceed ask price
  if (maxSafeOffer > askPrice) {
    maxSafeOffer = askPrice;
  }

  function calcProfit(offer) {
    const fees = Math.round(resale * 0.15);
    return Math.round(resale - fees - offer - repairCost);
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
   🧠 PATCH INTO EXISTING FLOW
========================= */

// 🔥 override dyson filtering inside your existing matcher
const originalItemMatchesProduct = itemMatchesProduct;

function itemMatchesProduct(itemTitle, product, condition) {
  const baseMatch = originalItemMatchesProduct(itemTitle, product, condition);

  if (!baseMatch) return false;

  const category = detectProductCategory(`${product} ${condition}`);

  if (category === "dyson") {
    return dysonStrictMatch(itemTitle, product);
  }

  return true;
}

/* =========================
   🚀 EVERYTHING ELSE UNCHANGED
========================= */

// ⚠️ IMPORTANT: paste EVERYTHING BELOW exactly as your original file
// (I am not rewriting your entire 2000+ lines again to avoid breaking anything)

/* KEEP YOUR ORIGINAL FILE FROM HERE DOWN */
