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

// -----------------------------
// HELPERS
// -----------------------------
function roundMoney(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function getUserFromCookie(req) {
  try {
    const token = req.cookies?.flipai_token;
    if (!token) return null;

    const decoded = jwt.verify(token, JWT_SECRET);
    return getUserById(decoded.userId) || null;
  } catch {
    return null;
  }
}

// -----------------------------
// PROFIT ENGINE (FIXED)
// -----------------------------
function calculateFlipMetrics({
  buyPrice,
  repairCost,
  condition,
  manualSoldPrices,
  goal,
}) {
  const buy = Number(buyPrice || 0);
  const repair = Number(repairCost || 0);

  const conditionText = String(condition || "").toLowerCase();
  const goalText = String(goal || "").toLowerCase();

  // fallback resale estimate (simple safe model)
  let estimatedResale = buy * 2.0;
  let pricingMode = "Estimated fallback model";

  if (conditionText.includes("excellent")) estimatedResale = buy * 2.4;
  else if (conditionText.includes("good")) estimatedResale = buy * 2.25;
  else if (conditionText.includes("used")) estimatedResale = buy * 2.1;
  else if (conditionText.includes("fault")) estimatedResale = buy * 1.6;
  else if (conditionText.includes("parts")) estimatedResale = buy * 1.4;

  if (goalText.includes("fast")) estimatedResale *= 0.93;
  if (goalText.includes("maximum")) estimatedResale *= 1.05;

  estimatedResale = roundMoney(estimatedResale);

  // fees
  const ebayFeeRate = 0.1325;
  const paymentFeeRate = 0.034;

  const ebayFees = roundMoney(estimatedResale * ebayFeeRate);
  const paymentFees = roundMoney(estimatedResale * paymentFeeRate);

  // costs
  const shippingCost = 4.5;
  const safetyBuffer = 5;

  const totalCost = roundMoney(buy + repair + shippingCost);
  const totalFees = roundMoney(ebayFees + paymentFees + safetyBuffer);

  const profit = roundMoney(
    estimatedResale - totalCost - totalFees
  );

  let verdict = "SKIP ❌";
  if (profit >= 35) verdict = "GOOD DEAL ✅";
  else if (profit >= 15) verdict = "OK DEAL ⚠️";
  else if (profit >= 5) verdict = "LOW PROFIT ⚠️";

  return {
    estimatedResale,
    buyPrice: buy,
    repairCost: repair,
    totalCost,
    ebayFees,
    paymentFees,
    shippingCost,
    safetyBuffer,
    totalFees,
    profit,
    verdict,
    pricingMode,
  };
}

// -----------------------------
// MIDDLEWARE
// -----------------------------
app.use(cors({ origin: appUrl, credentials: true }));
app.use(cookieParser());
app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

// -----------------------------
// STRIPE WEBHOOK
// -----------------------------
app.post(
  "/api/stripe/webhook",
  express.raw({ type: "application/json" }),
  stripeWebhookHandler
);

// -----------------------------
// AUTH ROUTES
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
    const url = await createCheckoutSession(req.user, req.body?.plan);
    res.json({ url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/create-portal-session", requireAuth, async (req, res) => {
  try {
    const url = await createPortalSession(req.user);
    res.json({ url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -----------------------------
// ANALYZE
// -----------------------------
app.post("/api/analyze", async (req, res) => {
  try {
    const user = getUserFromCookie(req);
    if (!user) {
      return res.status(401).json({ error: "Not logged in" });
    }

    const allowedUser = enforceUsage(user);

    const flipMetrics = calculateFlipMetrics(req.body);

    const aiResult = await runAnalysis({
      ...req.body,
      flipMetrics,
    });

    const updatedUser = incrementUsage(allowedUser.id);

    res.json({
      result: aiResult,
      flipMetrics,
      user: safeUser(updatedUser),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -----------------------------
// AUTO COMPS (FIXED EBAY CALL)
// -----------------------------
app.post("/api/auto-comps", async (req, res) => {
  try {
    const user = getUserFromCookie(req);
    if (!user) return res.status(401).json({ error: "Not logged in" });

    const { product, condition } = req.body;

    const searchQuery = `${product} ${condition || ""}`.trim();

    const items = await searchEbayListings({
      query: searchQuery,
      limit: 30,
      condition: "USED",
    });

    res.json({
      ok: true,
      items,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -----------------------------
// SEARCH EBAY (FIXED PARAMS)
// -----------------------------
app.post("/api/search-ebay", async (req, res) => {
  try {
    const user = getUserFromCookie(req);
    if (!user) return res.status(401).json({ error: "Not logged in" });

    const {
      query,
      limit,
      filterPriceMax,
      condition,
      freeShippingOnly,
    } = req.body;

    const items = await searchEbayListings({
      query,
      limit,
      maxPrice: filterPriceMax,
      condition: condition || "USED",
      freeShippingOnly,
    });

    res.json({ items });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -----------------------------
// FRONTEND
// -----------------------------
app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// -----------------------------
// START
// -----------------------------
app.listen(port, () => {
  console.log(`FlipAI running on ${appUrl}`);
});
