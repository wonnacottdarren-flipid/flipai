import OpenAI from "openai";
import { safeUser, incrementUsage, getUserById } from "./db.js";
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
- eBay fees are 15% of sale price.
- Net profit formula: sale price - fees - buy price - costs.
- Be slightly conservative.
- Focus on FAST turnover over highest possible price.
- If details are missing, make sensible assumptions and keep them conservative.
- The eBay title must be 80 characters or fewer.
- Return valid JSON only.

Very important pricing rules:
- If forcedEstimatedResale is provided and greater than 0, you MUST anchor pricing to it.
- If manualSoldComps.connected is true, treat manual sold comps as the strongest pricing signal.
- If manualSoldComps.compCount is 2 or more, do not invent a resale value far away from the manual sold comp range.
- quick_sale_price should usually be at or slightly below sale_price.
- max_value_price can be slightly above sale_price, but should still stay realistic.
- brief_reasoning should mention when manual sold comps were used if they were provided.`;

const responseSchema = {
  name: "flipai_analysis",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      flip_analysis: {
        type: "object",
        additionalProperties: false,
        properties: {
          estimated_resale_value_range: { type: "string" },
          brief_reasoning: { type: "string" },
          estimated_repair_or_refurbishment_cost: { type: "string" },
          buy_price: { type: "number" },
          sale_price: { type: "number" },
          fees: { type: "number" },
          costs: { type: "number" },
          net_profit: { type: "number" },
          time_to_sell_estimate: {
            type: "string",
            enum: ["Fast: <7 days", "Medium: 1–3 weeks", "Slow: 3+ weeks"],
          },
          risk_level: {
            type: "string",
            enum: ["Low", "Medium", "High"],
          },
          final_verdict: {
            type: "string",
            enum: ["BUY", "MARGINAL", "SKIP"],
          },
        },
        required: [
          "estimated_resale_value_range",
          "brief_reasoning",
          "estimated_repair_or_refurbishment_cost",
          "buy_price",
          "sale_price",
          "fees",
          "costs",
          "net_profit",
          "time_to_sell_estimate",
          "risk_level",
          "final_verdict",
        ],
      },
      ebay_listing: {
        type: "object",
        additionalProperties: false,
        properties: {
          title: { type: "string" },
          quick_sale_price: { type: "number" },
          max_value_price: { type: "number" },
          description: { type: "string" },
          keywords: {
            type: "array",
            items: { type: "string" },
            minItems: 8,
            maxItems: 12,
          },
        },
        required: [
          "title",
          "quick_sale_price",
          "max_value_price",
          "description",
          "keywords",
        ],
      },
    },
    required: ["flip_analysis", "ebay_listing"],
  },
};

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

function getPlanLimit(user) {
  const plan = String(user?.plan || "free").toLowerCase();
  const status = String(user?.subscriptionStatus || "free").toLowerCase();

  if (plan === "pro" && (status === "active" || status === "trialing")) {
    return Infinity;
  }

  if (plan === "starter" && (status === "active" || status === "trialing")) {
    return 25;
  }

  return 5;
}

function buildEstimatedRange(forcedEstimatedResale, manualSoldComps) {
  const forced = Number(forcedEstimatedResale || 0);

  if (
    manualSoldComps &&
    manualSoldComps.connected &&
    Number(manualSoldComps.minSoldPrice || 0) > 0 &&
    Number(manualSoldComps.maxSoldPrice || 0) > 0
  ) {
    return `£${toMoney(manualSoldComps.minSoldPrice)} - £${toMoney(
      manualSoldComps.maxSoldPrice
    )}`;
  }

  if (forced > 0) {
    const low = roundMoney(forced * 0.97);
    const high = roundMoney(forced * 1.03);
    return `£${toMoney(low)} - £${toMoney(high)}`;
  }

  return "£0.00 - £0.00";
}

function buildReasoningPrefix({ manualSoldComps, pricingMode, forcedEstimatedResale }) {
  const forced = Number(forcedEstimatedResale || 0);

  if (manualSoldComps?.connected && Number(manualSoldComps.compCount || 0) > 0) {
    return `Manual sold comps were used as the main pricing anchor. Pricing mode: ${
      pricingMode || "Manual sold comps"
    }. Median sold price: £${toMoney(manualSoldComps.medianSoldPrice)}. `;
  }

  if (forced > 0) {
    return `Pricing was anchored to a forced estimated resale value of £${toMoney(
      forced
    )}. `;
  }

  return "";
}

function normaliseOutput(parsed, context) {
  const manualSoldComps = context.manualSoldComps || {};
  const forcedEstimatedResale = Number(context.forcedEstimatedResale || 0);
  const buyPrice = Number(context.buyPrice || 0);
  const repairCost = Number(context.repairCost || 0);

  if (!parsed.flip_analysis) parsed.flip_analysis = {};
  if (!parsed.ebay_listing) parsed.ebay_listing = {};

  let salePrice = Number(parsed.flip_analysis.sale_price || 0);

  if (forcedEstimatedResale > 0) {
    salePrice = roundMoney(forcedEstimatedResale);
  }

  const costs = roundMoney(buyPrice + repairCost);
  const fees = roundMoney(salePrice * 0.15);
  const netProfit = roundMoney(salePrice - fees - buyPrice - repairCost);

  const prefix = buildReasoningPrefix({
    manualSoldComps,
    pricingMode: context.pricingMode,
    forcedEstimatedResale,
  });

  const modelReasoning = String(parsed.flip_analysis.brief_reasoning || "").trim();
  const combinedReasoning = `${prefix}${modelReasoning}`.trim();

  parsed.flip_analysis.estimated_resale_value_range =
    buildEstimatedRange(forcedEstimatedResale, manualSoldComps);

  parsed.flip_analysis.brief_reasoning =
    combinedReasoning || "Conservative UK resale estimate based on the details provided.";

  parsed.flip_analysis.estimated_repair_or_refurbishment_cost = `£${toMoney(repairCost)}`;
  parsed.flip_analysis.buy_price = roundMoney(buyPrice);
  parsed.flip_analysis.sale_price = salePrice;
  parsed.flip_analysis.fees = fees;
  parsed.flip_analysis.costs = costs;
  parsed.flip_analysis.net_profit = netProfit;

  parsed.ebay_listing.quick_sale_price =
    forcedEstimatedResale > 0
      ? roundMoney(forcedEstimatedResale)
      : roundMoney(Number(parsed.ebay_listing.quick_sale_price || salePrice || 0));

  parsed.ebay_listing.max_value_price =
    forcedEstimatedResale > 0
      ? roundMoney(forcedEstimatedResale * 1.03)
      : roundMoney(Number(parsed.ebay_listing.max_value_price || salePrice || 0));

  parsed.ebay_listing.title = clampTitle(parsed.ebay_listing.title || context.product || "");

  if (!Array.isArray(parsed.ebay_listing.keywords)) {
    parsed.ebay_listing.keywords = [];
  }

  parsed.ebay_listing.keywords = parsed.ebay_listing.keywords
    .map((k) => String(k || "").trim())
    .filter(Boolean)
    .slice(0, 12);

  while (parsed.ebay_listing.keywords.length < 8) {
    parsed.ebay_listing.keywords.push("uk ebay");
  }

  return parsed;
}

async function generateAnalysis({
  product,
  condition,
  buyPrice,
  repairCost,
  extras,
  goal,
  manualSoldPrices,
  manualSoldComps,
  forcedEstimatedResale,
  pricingMode,
}) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OpenAI is not configured yet.");
  }

  const cleanProduct = String(product || "").trim();
  const cleanCondition = String(condition || "").trim();

  if (!cleanProduct) {
    throw new Error("Product is required.");
  }

  if (!cleanCondition) {
    throw new Error("Condition is required.");
  }

  const cleanExtras = extras ? String(extras).trim() : "None stated";
  const cleanGoal = goal ? String(goal).trim() : "Fast sale";
  const forcedResale = Number(forcedEstimatedResale || 0);

  const userPayload = {
    product: cleanProduct,
    condition: cleanCondition,
    buyPrice: roundMoney(buyPrice),
    repairCost: roundMoney(repairCost),
    extras: cleanExtras,
    goal: cleanGoal,
    pricingMode: pricingMode || "Unknown",
    forcedEstimatedResale: forcedResale,
    manualSoldPrices: manualSoldPrices || "",
    manualSoldComps: manualSoldComps || {
      connected: false,
      compCount: 0,
      avgSoldPrice: 0,
      medianSoldPrice: 0,
      minSoldPrice: 0,
      maxSoldPrice: 0,
      confidence: 0,
      confidenceLabel: "Low",
    },
    instructions: {
      useForcedEstimatedResaleAsPrimaryAnchor: forcedResale > 0,
      mentionManualCompsIfPresent: Boolean(manualSoldComps?.connected),
      keepPricingConservative: true,
      market: "UK eBay",
    },
  };

  const completion = await client.chat.completions.create({
    model,
    messages: [
      {
        role: "developer",
        content: developerPrompt,
      },
      {
        role: "user",
        content: JSON.stringify(userPayload),
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: responseSchema,
    },
  });

  const content = completion.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("No analysis content returned from OpenAI.");
  }

  const parsed = safeJsonParse(content);

  return normaliseOutput(parsed, {
    product: cleanProduct,
    buyPrice: roundMoney(buyPrice),
    repairCost: roundMoney(repairCost),
    manualSoldComps,
    forcedEstimatedResale: forcedResale,
    pricingMode,
  });
}

export async function runAnalysis(req, res) {
  try {
    const user = getUserFromCookie(req);

    if (!user) {
      return res.status(401).json({ error: "Please sign in." });
    }

    const planLimit = getPlanLimit(user);
    const usageCount = Number(user.usageCount || 0);

    if (Number.isFinite(planLimit) && usageCount >= planLimit) {
      return res.status(403).json({
        error:
          planLimit === 25
            ? "You have used all 25 Starter analyses. Upgrade to Pro for unlimited access."
            : "You have used all 5 free analyses. Upgrade to continue.",
        locked: true,
        user: safeUser(user),
      });
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

    const manualPrices = String(manualSoldPrices || "")
      .split(/[\n,]+/)
      .map((value) => Number(String(value).trim()))
      .filter((value) => Number.isFinite(value) && value > 0);

    const sortedPrices = [...manualPrices].sort((a, b) => a - b);
    const compCount = sortedPrices.length;

    const avgSoldPrice = compCount
      ? roundMoney(sortedPrices.reduce((sum, value) => sum + value, 0) / compCount)
      : 0;

    const medianSoldPrice = compCount
      ? (
          compCount % 2 === 0
            ? roundMoney(
                (sortedPrices[compCount / 2 - 1] + sortedPrices[compCount / 2]) / 2
              )
            : roundMoney(sortedPrices[Math.floor(compCount / 2)])
        )
      : 0;

    const minSoldPrice = compCount ? roundMoney(sortedPrices[0]) : 0;
    const maxSoldPrice = compCount ? roundMoney(sortedPrices[compCount - 1]) : 0;

    let confidence = 20;
    if (compCount >= 3) confidence = 55;
    if (compCount >= 5) confidence = 72;
    if (compCount >= 8) confidence = 86;

    let confidenceLabel = "Low";
    if (confidence >= 80) confidenceLabel = "High";
    else if (confidence >= 55) confidenceLabel = "Medium";

    const manualSoldComps = {
      connected: compCount > 0,
      compCount,
      avgSoldPrice,
      medianSoldPrice,
      minSoldPrice,
      maxSoldPrice,
      confidence,
      confidenceLabel,
    };

    const forcedEstimatedResale =
      compCount > 0 ? medianSoldPrice || avgSoldPrice || 0 : 0;

    const pricingMode =
      compCount > 0 ? "Manual sold comps" : "Condition estimate";

    const result = await generateAnalysis({
      product,
      condition,
      buyPrice: Number(buyPrice || 0),
      repairCost: Number(repairCost || 0),
      extras,
      goal,
      manualSoldPrices,
      manualSoldComps,
      forcedEstimatedResale,
      pricingMode,
    });

    incrementUsage(user.id);
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
