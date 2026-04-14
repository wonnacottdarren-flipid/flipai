import OpenAI from "openai";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const systemPrompt = `You are a professional UK-based eBay reseller and product flipper with 10+ years of real-world experience.

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
- Return valid JSON only.`;

export async function runAnalysis({ product, condition, buyPrice, repairCost, extras, goal }) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OpenAI is not configured yet.");
  }

  const userPrompt = `Analyse this product for UK eBay flipping and generate a listing.\n\nProduct: ${product}\nCondition: ${condition}\nBuy price: £${Number(buyPrice || 0).toFixed(2)}\nRepair cost: £${Number(repairCost || 0).toFixed(2)}\nExtras: ${extras || "None stated"}\nSelling goal: ${goal || "Fast sale"}`;

  const response = await client.responses.create({
    model: "gpt-5.4",
    input: [
      { role: "system", content: [{ type: "input_text", text: systemPrompt }] },
      { role: "user", content: [{ type: "input_text", text: userPrompt }] }
    ],
    text: {
      format: {
        type: "json_schema",
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
                time_to_sell_estimate: { type: "string", enum: ["Fast: <7 days", "Medium: 1–3 weeks", "Slow: 3+ weeks"] },
                risk_level: { type: "string", enum: ["Low", "Medium", "High"] },
                final_verdict: { type: "string", enum: ["BUY", "MARGINAL", "SKIP"] }
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
                "final_verdict"
              ]
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
                  maxItems: 12
                }
              },
              required: ["title", "quick_sale_price", "max_value_price", "description", "keywords"]
            }
          },
          required: ["flip_analysis", "ebay_listing"]
        }
      }
    }
  });

  return JSON.parse(response.output_text);
}
