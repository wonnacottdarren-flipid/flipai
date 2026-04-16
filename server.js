import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import bodyParser from "body-parser";
import path from "path";
import { fileURLToPath } from "url";

const app = express();
const PORT = process.env.PORT || 3000;

// =========================
// PATH SETUP (REQUIRED)
// =========================
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// =========================
// MIDDLEWARE
// =========================
app.use(cors({
  origin: true,
  credentials: true
}));

app.use(bodyParser.json({ limit: "2mb" }));
app.use(cookieParser());

// =========================
// SERVE FRONTEND (CRITICAL FIX)
// =========================
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// =========================
// SIMPLE IN-MEMORY USERS
// =========================
const users = new Map();

// =========================
// HELPERS (PROFIT ENGINE)
// =========================
const FEE_RATE = 0.1325;
const FIXED_FEE = 0.30;

function parsePrices(text = "") {
  return text
    .split(",")
    .map(v => parseFloat(v.trim()))
    .filter(v => !isNaN(v) && v > 0);
}

function median(arr) {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

function avg(arr) {
  if (!arr.length) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function fees(resale) {
  return resale * FEE_RATE + FIXED_FEE;
}

// =========================
// CORE ANALYSIS ENGINE
// =========================
function analyze(payload, comps = []) {
  const buy = Number(payload.buyPrice || 0);
  const repair = Number(payload.repairCost || 0);

  let resale = comps.length ? median(comps) : buy * 1.35;

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
          `Resale £${resale.toFixed(2)} | Cost £${totalCost.toFixed(2)} | Profit £${profit.toFixed(2)}`
      },
      ebay_listing: {
        title: `${payload.product || "Item"} - Fast Sale`
      }
    }
  };
}

// =========================
// AUTH (SIMPLE DEMO)
// =========================
app.post("/api/signup", (req, res) => {
  const { email, password, name } = req.body;
  if (!email || !password) return res.status(400).json({ error: "Missing fields" });

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

// =========================
// AUTO COMPS (FAKE BUT WORKING)
// =========================
app.post("/api/auto-comps", (req, res) => {
  const { product } = req.body;

  const base = product.length * 3 + 60;

  const comps = [
    base - 12,
    base,
    base + 10,
    base + 5
  ];

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

// =========================
// ANALYSIS ROUTE (IMPORTANT)
// =========================
app.post("/api/analyze", (req, res) => {
  const user = users.get(req.cookies.user);
  if (!user) return res.status(401).json({ error: "Not logged in" });

  if (user.plan === "free" && user.usageCount >= 5) {
    return res.status(403).json({ error: "Free limit reached", user });
  }

  const comps = parsePrices(req.body.manualSoldPrices || "");

  const output = analyze(req.body, comps);

  user.usageCount += 1;
  users.set(req.cookies.user, user);

  res.json({
    ...output,
    user
  });
});

// =========================
// eBay SEARCH (MOCK DATA)
// =========================
app.post("/api/search-ebay", (req, res) => {
  const { query } = req.body;

  const base = query.length * 2 + 60;

  const items = Array.from({ length: 6 }).map((_, i) => ({
    title: `${query} Item ${i + 1}`,
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

// =========================
// CHECKOUT STUB
// =========================
app.post("/api/create-checkout-session", (req, res) => {
  res.json({ url: "https://example.com/checkout" });
});

app.post("/api/create-portal-session", (req, res) => {
  res.json({ url: "https://example.com/billing" });
});

// =========================
// START SERVER
// =========================
app.listen(PORT, () => {
  console.log(`FlipAI running on port ${PORT}`);
});
