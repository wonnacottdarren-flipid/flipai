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

    const { query, limit, filterPriceMax, condition, freeShippingOnly } =
      req.body || {};

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

    return res.json({ items });
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
