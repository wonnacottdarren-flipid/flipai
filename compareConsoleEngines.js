import "dotenv/config";

import { searchEbayListings, searchEbayMarketPool } from "./ebay.js";
import * as engineRegistry from "./engines/index.js";
import { runConsoleV2Engine } from "./engines/consoleV2/consoleV2Engine.js";

function resolveV1Engine(query) {
  if (typeof engineRegistry.detectEngineForQuery === "function") {
    return engineRegistry.detectEngineForQuery(query);
  }

  if (typeof engineRegistry.getEngineForQuery === "function") {
    return engineRegistry.getEngineForQuery(query);
  }

  if (typeof engineRegistry.detectEngine === "function") {
    return engineRegistry.detectEngine(query);
  }

  return null;
}

function getTitle(item = {}) {
  return String(item?.title || item?.name || item?.product || "").trim();
}

function getTotal(item = {}) {
  const price = Number(
    item?.price?.value ??
      item?.currentPrice?.value ??
      item?.sellingStatus?.currentPrice?.value ??
      item?.price ??
      0
  );

  const shipping = Number(
    item?.shippingOptions?.[0]?.shippingCost?.value ??
      item?.shippingCost?.value ??
      item?.shipping ??
      0
  );

  return Math.round((price + shipping) * 100) / 100;
}

async function runComparison() {
  const query = "ps5";

  console.log("=== CONSOLE ENGINE COMPARISON START ===");
  console.log("Query:", query);

  const listings = await searchEbayListings({
    query,
    limit: 30,
  });

  const market = await searchEbayMarketPool({
    query,
    limit: 30,
  });

  console.log("Listings fetched:", listings.length);
  console.log("Market fetched:", market.length);

  const v1Engine = resolveV1Engine(query);

  if (!v1Engine) {
    console.log("\n=== V1 ===");
    console.log("V1 engine not found.");
  } else {
    const v1QueryContext =
      typeof v1Engine.classifyQuery === "function"
        ? v1Engine.classifyQuery(query)
        : { rawQuery: query };

    const v1Matched =
      typeof v1Engine.matchesItem === "function"
        ? listings.filter((item) => v1Engine.matchesItem(item, v1QueryContext))
        : listings;

    const v1Pricing =
      typeof v1Engine.buildPricingModel === "function"
        ? v1Engine.buildPricingModel({
            queryContext: v1QueryContext,
            marketItems: market,
            listingItems: listings,
          })
        : null;

    console.log("\n=== V1 RESULTS ===");
    console.log("Matched:", v1Matched.length);
    console.log("Pricing:", {
      pricingMode: v1Pricing?.pricingMode,
      estimatedResale: v1Pricing?.estimatedResale,
      confidence: v1Pricing?.confidence,
      confidenceLabel: v1Pricing?.confidenceLabel,
      compCount: v1Pricing?.compCount,
    });

    console.log("\nV1 Top 5:");
    v1Matched.slice(0, 5).forEach((item, index) => {
      console.log(`#${index + 1}`, {
        title: getTitle(item),
        total: getTotal(item),
      });
    });
  }

  const v2 = runConsoleV2Engine({
    query,
    marketItems: market,
    listingItems: listings,
  });

  console.log("\n=== V2 RESULTS ===");
  console.log("Matched:", v2.listings.matchedCount);
  console.log("Pricing:", {
    pricingMode: v2.pricing?.pricingMode,
    estimatedResale: v2.pricing?.estimatedResale,
    confidence: v2.pricing?.confidence,
    confidenceLabel: v2.pricing?.confidenceLabel,
    compCount: v2.pricing?.compCount,
    bundleBoost: v2.pricing?.bundleBoost,
  });

  console.log("\nV2 Top 5:");
  v2.listings.items.slice(0, 5).forEach((entry, index) => {
    console.log(`#${index + 1}`, {
      title: entry.titleText,
      total: entry.total,
      score: entry.score,
      bundleType: entry.bundleType,
      conditionState: entry.conditionState,
      warnings: entry.warningFlags,
    });
  });

  console.log("\n=== CONSOLE ENGINE COMPARISON END ===");
}

runComparison().catch((err) => {
  console.error("Comparison test failed:", err);
});
