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

// -----------------------------
// HELPERS (UNCHANGED)
// -----------------------------
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

// -----------------------------
// EBAY AUTO-COMP SEARCH FIX
// -----------------------------
function buildAutoCompSearchQuery(product, condition) {
  const text = String(product || "").toLowerCase();

  let query = text;

  if (condition?.toLowerCase().includes("unlocked")) {
    query += " unlocked";
  }

  if (condition?.toLowerCase().includes("used")) {
    query += " used";
  }

  return query.trim();
}

// -----------------------------
// STRIPE WEBHOOK
// -----------------------------
app.post(
  "/api/stripe/webhook",
  express.raw({ type: "application/json" }),
  stripeWebhookHandler
);

// -----------------------------
// MIDDLEWARE
// -----------------------------
app.use(cors({ origin: appUrl, credentials: true }));
app.use(cookieParser());
app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

// -----------------------------
// AUTH
// -----------------------------
app.post("/api/signup", signupHandler);
app.post("/api/login", loginHandler);
app.post("/api/logout", logoutHandler);

app.get("/api/me", requireAuth, (req, res) => {
  res.json({ user: safeUser(req.user) });
});

// -----------------------------
// STRIPE
// -----------------------------
app.post("/api/create-checkout-session", requireAuth, async (req, res) => {
  try {
    const plan = String(req.body?.plan || "").toLowerCase();
    const url = await createCheckoutSession(req.user, plan);
    res.json({ url });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/create-portal-session", requireAuth, async (req, res) => {
  try {
    const url = await createPortalSession(req.user);
    res.json({ url });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// -----------------------------
// ANALYZE (UNCHANGED)
// -----------------------------
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

    const result = await runAnalysis(req.body);

    const updatedUser = incrementUsage(allowedUser.id);

    return res.json({
      result,
      user: safeUser(updatedUser),
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// -----------------------------
// AUTO COMPS (FIXED EBAY CALL)
// -----------------------------
app.post("/api/auto-comps", async (req, res) => {
  try {
    const user = getUserFromCookie(req);
    if (!user) {
      return res.status(401).json({
        error: "Please sign in to auto-fill comps.",
      });
    }

    const { product, condition } = req.body || {};

    if (!product) {
      return res.status(400).json({ error: "Product is required" });
    }

    const searchQuery = buildAutoCompSearchQuery(product, condition);

    const items = await searchEbayListings({
      query: searchQuery,
      limit: 30,
      condition: "USED", // ✅ FIXED
    });

    return res.json({
      ok: true,
      searchQuery,
      items,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// -----------------------------
// SEARCH EBAY (FIXED PARAM MAPPING)
// -----------------------------
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
    } = req.body || {};

    const items = await searchEbayListings({
      query,
      limit,
      maxPrice: filterPriceMax, // ✅ FIXED
      condition: condition || "USED", // ✅ FIXED
      freeShippingOnly,
    });

    return res.json({ items });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// -----------------------------
// FRONTEND ROUTE
// -----------------------------
app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// -----------------------------
// START SERVER
// -----------------------------
app.listen(port, () => {
  console.log(`FlipAI running on ${appUrl}`);
});
