import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import bodyParser from "body-parser";
import path from "path";
import { fileURLToPath } from "url";

const app = express();
const PORT = process.env.PORT || 3000;

// =======================
// PATH FIX (REQUIRED)
// =======================
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// =======================
// MIDDLEWARE
// =======================
app.use(cors({
  origin: true,
  credentials: true
}));

app.use(bodyParser.json({ limit: "2mb" }));
app.use(cookieParser());

// =======================
// STATIC FRONTEND (CRITICAL FIX)
// =======================
// THIS IS WHAT WAS BROKEN BEFORE
app.use(express.static(path.join(__dirname, "public")));

// FORCE FRONTEND LOAD ON "/"
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// HEALTH CHECK (for debugging)
app.get("/health", (req, res) => {
  res.json({ status: "ok", message: "FlipAI running" });
});

// =======================
// IN-MEMORY USERS (DEMO ONLY)
// =======================
const users = new Map();

// =======================
// PROFIT ENGINE
// =======================
const FEE_RATE = 0.1325;
const FIXED_FEE = 0.30;

function parseComps(text = "") {
  return text
    .split(",")
    .map(v => parseFloat(v.trim()))
    .filter(v => !isNaN(v) && v > 0);
}

function median(arr) {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function avg(arr) {
  return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
}

function fees(resale) {
  return resale * FEE_RATE + FIXED_FEE;
}

// =======================
// ANALYSIS CORE
// =======================
function runAnalysis(payload, comps = []) {
  const buy = Number(payload.buyPrice || 0);
  const repair = Number(payload.repairCost || 0);

  const resale = comps.length ? median(comps) : buy * 1.35;

  const ebayFees = fees(resale);
  const totalCost = buy + repair + ebayFees;
  const profit = resale - totalCost;

  let verdict = "SKIP";
  if (profit > 50) verdict = "GOOD";
  else if (profit > 15) verdict = "OK";
  else if (profit > 0) verdict = "MARGINAL";
  else verdict = "AVOID";

  return {
    result: {
      flipMetrics: {
        profit: +profit.toFixed(2),
        totalCost: +totalCost.toFixed(2),
        estimatedResale: +resale.toFixed(2),
        ebayFees: +ebayFees.toFixed(2),
        pricingMode: comps.length ? "Live comps" : "Estimated",
        soldComps: {
          medianSoldPrice: +median(comps).toFixed(2),
          avgSoldPrice: +avg(comps).toFixed(2),
          minSoldPrice: Math.min(...comps) || 0,
          maxSoldPrice: Math.max(...comps) || 0,
          compCount: comps.length,
          confidence: comps.length > 3 ? 0.85 : 0.4,
          confidenceLabel: comps.length > 3 ? "High" : "Low"
        },
        verdict
      },
      flip_analysis: {
        final_verdict: verdict,
        risk_level: profit > 50 ? "Low" : profit > 15 ? "Medium" : "High",
        time_to_sell_estimate:
          profit > 50 ? "1–5 days" :
          profit > 15 ? "3–14 days" : "2–6 weeks",
        brief_reasoning:
          `Buy £${buy}, Resale £${resale.toFixed(2)}, Profit £${profit.toFixed(2)}`
      },
      ebay_listing: {
        title: `${payload.product || "Item"} - FlipAI Listing`
      }
    }
  };
}

// =======================
// AUTH (SIMPLE DEMO)
// =======================
app.post("/api/signup", (req, res) => {
  const { email, password, name } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Missing fields" });
  }

  users.set(email, {
    email,
    name,
    password,
    plan: "free",
    usageCount: 0
  });

  res.cookie("user", email);
  res.json({ user: users.get(email) });
});

app.post("/api/login", (req, res) => {
  const { email, password } = req.body;
  const user = users.get(email);

  if (!user || user.password !== password) {
    return res.status(401).json({ error: "Invalid login" });
  }

  res.cookie("user", email);
  res.json({ user });
});

app.post("/api/logout", (req, res) => {
  res.clearCookie("user");
  res.json({ ok: true });
});

app.get("/api/me", (req, res) => {
  const user = users.get(req.cookies.user);
  if (!user) return res.status(401).json({ error: "Not logged in" });
  res.json({ user });
});

// =======================
// AUTO COMPS
// =======================
app.post("/api/auto-comps", (req, res) => {
  const { product } = req.body;

  const base = product.length * 3 + 60;

  const comps = [base - 10, base, base + 12, base + 5];

  res.json({
    searchQuery: product,
    autoComps: {
      manualSoldPricesText: comps.join(", "),
      compCount: comps.length,
      confidence: 0.8,
      confidenceLabel: "Simulated",
      pricingMode: "Auto comps"
    }
  });
});

// =======================
// ANALYZE
// =======================
app.post("/api/analyze", (req, res) => {
  const user = users.get(req.cookies.user);

  if (!user) return res.status(401).json({ error: "Not logged in" });

  if (user.plan === "free" && user.usageCount >= 5) {
    return res.status(403).json({ error: "Free limit reached", user });
  }

  const comps = parseComps(req.body.manualSoldPrices || "");

  const output = runAnalysis(req.body, comps);

  user.usageCount++;
  users.set(req.cookies.user, user);

  res.json({
    ...output,
    user
  });
});

// =======================
// EBAY SEARCH (MOCK)
// =======================
app.post("/api/search-ebay", (req, res) => {
  const { query } = req.body;

  const base = query.length * 2 + 60;

  const items = Array.from({ length: 6 }).map((_, i) => ({
    title: `${query} - Item ${i + 1}`,
    price: { value: base + i * 10 },
    shipping: { value: i % 2 ? 4.99 : 0 },
    scanner: {
      estimatedResale: base + 30 + i * 8,
      estimatedProfit: 20 + i * 6,
      ebayFees: base * 0.13,
      score: 70 + i,
      risk: i % 2 ? "Medium" : "Low",
      verdict: i % 2 ? "OK" : "GOOD"
    }
  }));

  res.json({ items });
});

// =======================
// START SERVER
// =======================
app.listen(PORT, () => {
  console.log(`FlipAI running on port ${PORT}`);
});
