import OpenAI from "openai";
import { safeUser, getUserById } from "./db.js";
import jwt from "jsonwebtoken";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const model = process.env.OPENAI_MODEL || "gpt-5.4";
const JWT_SECRET = process.env.JWT_SECRET || "change_me";

const developerPrompt = `You are a professional UK-based eBay reseller and product flipper with 10+ years of real-world experience.

Your job is to analyse items for resale and generate high-converting eBay listings that prioritise FAST sales and consistent profit.

Return JSON only using this schema:
{
  "flip_analysis": {
    "estimated_resale_value_range": "string",
    "brief_reasoning": "string",
    "estimated_repair_or_refurbishment_cost": "string",
    "buy_price": number,
    "sale_price": number,
    "fees": number,
    "costs": number,
    "net_profit": number,
    "time_to_sell_estimate": "Fast: <7 days" | "Medium: 1–3 weeks" | "Slow: 3+ weeks",
    "risk_level": "Low" | "Medium" | "High",
    "final_verdict": "BUY" | "MARGINAL" | "SKIP"
  },
  "ebay_listing": {
    "title": "string max 80 chars",
    "quick_sale_price": number,
    "max_value_price": number,
    "description": "string",
    "keywords": ["string"]
  }
}

Rules:
- Always assume UK market.
- Use realistic UK eBay SOLD-price thinking, not optimistic live listings.
- eBay fees are 15%.
- Be slightly conservative.
- Focus on FAST turnover over highest price.
- Return valid JSON only.
`;

function roundMoney(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function toMoney(value) {
  return Number(value || 0).toFixed(2);
}

function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    throw new Error("Model returned invalid JSON.");
  }
}

function clampTitle(title) {
  const text = String(title || "").trim();
  if (text.length <= 80) return text;
  return text.slice(0, 80).trim();
}

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

async function generateAnalysis(payload) {
  const completion = await client.chat.completions.create({
    model,
    messages: [
      { role: "developer", content: developerPrompt },
      { role: "user", content: JSON.stringify(payload) },
    ],
  });

  const content = completion.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("No analysis returned.");
  }

  return safeJsonParse(content);
}

export async function runAnalysis(req, res) {
  try {
    const user = getUserFromCookie(req);

    if (!user) {
      return res.status(401).json({ error: "Please sign in." });
    }

    const {
      product,
      condition,
      buyPrice = 0,
      repairCost = 0,
      extras = "",
      goal = "Fast sale",
      manualSoldPrices = "",
    } = req.body || {};

    const result = await generateAnalysis({
      product,
      condition,
      buyPrice: roundMoney(buyPrice),
      repairCost: roundMoney(repairCost),
      extras,
      goal,
      manualSoldPrices,
    });

    if (!result.flip_analysis) result.flip_analysis = {};
    if (!result.ebay_listing) result.ebay_listing = {};

    const salePrice = Number(result.flip_analysis.sale_price || 0);
    const fees = roundMoney(salePrice * 0.15);
    const costs = roundMoney(Number(buyPrice) + Number(repairCost));
    const netProfit = roundMoney(salePrice - fees - costs);

    result.flip_analysis.buy_price = roundMoney(buyPrice);
    result.flip_analysis.costs = costs;
    result.flip_analysis.fees = fees;
    result.flip_analysis.net_profit = netProfit;
    result.flip_analysis.estimated_repair_or_refurbishment_cost = `£${toMoney(repairCost)}`;

    result.ebay_listing.title = clampTitle(result.ebay_listing.title || product);

    const refreshedUser = getUserById(user.id);

    return res.json({
      ok: true,
      result,
      user: safeUser(refreshedUser),
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      error: err.message || "Analysis failed.",
    });
  }
}
