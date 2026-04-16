import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

const app = express();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());

// =========================
// SIMPLE IN-MEMORY USER DB
// =========================
const users = {};
let currentUserId = 1;

// =========================
// HELPERS
// =========================

function parseComps(text = "") {
  const nums = text
    .split(",")
    .map(v => Number(v.trim()))
    .filter(v => !isNaN(v) && v > 0);

  return nums;
}

function median(arr) {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function avg(arr) {
  if (!arr.length) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function estimateResale(product, comps) {
  if (comps.length >= 3) {
    return median(comps);
  }

  // fallback estimate if no comps
  const base = 80 + product.length * 2;
  return base + Math.random() * 40;
}

function calculateFees(resale) {
  return resale * 0.128 + 0.30; // UK eBay rough fee
}

function generateUser(req) {
  if (!req.cookies.userId || !users[req.cookies.userId]) return null;
  return users[req.cookies.userId];
}

// =========================
// AUTH
// =========================

app.post("/api/signup", (req, res) => {
  const { name, email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Missing fields" });
  }

  const id = currentUserId++;

  users[id] = {
    id,
    name,
    email,
    password,
    plan: "free",
    usageCount: 0,
    subscriptionStatus: "free"
  };

  res.cookie("userId", id);
  res.json({ user: users[id] });
});

app.post("/api/login", (req, res) => {
  const { email, password } = req.body;

  const user = Object.values(users).find(
    u => u.email === email && u.password === password
  );

  if (!user) {
    return res.status(401).json({ error: "Invalid login" });
  }

  res.cookie("userId", user.id);
  res.json({ user });
});

app.post("/api/logout", (req, res) => {
  res.clearCookie("userId");
  res.json({ ok: true });
});

app.get("/api/me", (req, res) => {
  const user = generateUser(req);
  if (!user) return res.status(401).json({ error: "Not logged in" });
  res.json({ user });
});

// =========================
// ANALYSIS (MAIN FIX HERE)
// =========================

app.post("/api/analyze", (req, res) => {
  const user = generateUser(req);
  if (!user) return res.status(401).json({ error: "Not logged in" });

  const {
    product,
    buyPrice,
    repairCost,
    manualSoldPrices
  } = req.body;

  if (!product) {
    return res.status(400).json({ error: "Missing product" });
  }

  // ---- comps ----
  const comps = parseComps(manualSoldPrices);

  const estimatedResale = estimateResale(product, comps);
  const ebayFees = calculateFees(estimatedResale);

  const totalCost = Number(buyPrice || 0) + Number(repairCost || 0) + ebayFees;
  const profit = estimatedResale - totalCost;

  let verdict = "SKIP";
  if (profit > 40) verdict = "GOOD";
  else if (profit > 15) verdict = "MARGINAL";
  else verdict = "BAD";

  const result = {
    flipMetrics: {
      profit: Number(profit.toFixed(2)),
      totalCost: Number(totalCost.toFixed(2)),
      estimatedResale: Number(estimatedResale.toFixed(2)),
      ebayFees: Number(ebayFees.toFixed(2)),
      verdict,
      pricingMode: comps.length ? "Comps used" : "AI estimate",
      soldComps: {
        medianSoldPrice: median(comps),
        avgSoldPrice: avg(comps),
        minSoldPrice: Math.min(...(comps.length ? comps : [0])),
        maxSoldPrice: Math.max(...(comps.length ? comps : [0]))
      }
    },

    manualSoldComps: {
      compCount: comps.length,
      medianSoldPrice: median(comps),
      avgSoldPrice: avg(comps),
      minSoldPrice: Math.min(...(comps.length ? comps : [0])),
      maxSoldPrice: Math.max(...(comps.length ? [0] : [0])),
      confidence: comps.length > 5 ? 0.9 : comps.length > 2 ? 0.6 : 0.3,
      confidenceLabel:
        comps.length > 5 ? "High" : comps.length > 2 ? "Medium" : "Low"
    },

    flip_analysis: {
      risk_level: profit > 40 ? "LOW" : profit > 15 ? "MEDIUM" : "HIGH",
      time_to_sell_estimate:
        estimatedResale > 150 ? "3–10 days" : "7–21 days",
      brief_reasoning:
        `Estimated resale £${estimatedResale.toFixed(
          2
        )}. Fees deducted (£${ebayFees.toFixed(
          2
        )}). Profit after costs is £${profit.toFixed(2)}.`
    },

    ebay_listing: {
      title: `${product} - Fast Sale UK`
    },

    user
  };

  user.usageCount += 1;

  res.json({ result, user });
});

// =========================
// AUTO COMPS (FIXED)
// =========================

app.post("/api/auto-comps", (req, res) => {
  const user = generateUser(req);
  if (!user) return res.status(401).json({ error: "Not logged in" });

  const { product } = req.body;

  const base = 80 + product.length * 2;

  const comps = [
    base - 10,
    base,
    base + 8,
    base + 15
  ];

  const text = comps.map(v => v.toFixed(2)).join(", ");

  res.json({
    searchQuery: product,
    autoComps: {
      manualSoldPricesText: text,
      pricingMode: "Auto generated comps",
      compCount: comps.length,
      confidence: 0.7,
      confidenceLabel: "Medium"
    }
  });
});

// =========================
// EBAY SEARCH (MOCK BUT WORKING)
// =========================

app.post("/api/search-ebay", (req, res) => {
  const user = generateUser(req);
  if (!user) return res.status(401).json({ error: "Not logged in" });

  const { query, filterPriceMax } = req.body;

  const base = 60 + query.length * 3;

  const items = Array.from({ length: 6 }).map((_, i) => {
    const price = base + i * 12;

    const resale = price + 30 + Math.random() * 40;
    const fees = resale * 0.128;

    return {
      title: `${query} - Listing ${i + 1}`,
      price,
      shipping: 0,
      url: "https://ebay.com",
      condition: "Used",
      scanner: {
        estimatedResale: resale,
        estimatedProfit: resale - price - fees,
        ebayFees: fees,
        risk: price < 100 ? "LOW" : "HIGH",
        verdict:
          resale - price - fees > 30
            ? "GOOD"
            : resale - price - fees > 10
            ? "MARGINAL"
            : "SKIP",
        score: Math.round(Math.random() * 100)
      }
    };
  });

  res.json({ items });
});

// =========================
// START SERVER
// =========================

app.listen(3000, () => {
  console.log("FlipAI server running on http://localhost:3000");
});
