import "dotenv/config";

import { searchEbayListings, searchEbayMarketPool } from "./ebay.js";
import * as engineRegistry from "./engines/index.js";
import { runConsoleV2Engine } from "./engines/consoleV2/consoleV2Engine.js";

const TEST_QUERIES = [
  "ps5",
  "ps5 digital",
  "xbox series x",
  "xbox series s",
  "nintendo switch",
  "nintendo switch oled",
  "nintendo switch lite",
];

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

function printDivider(title = "") {
  console.log("");
  console.log("==================================================");
  console.log(title);
  console.log("==================================================");
}

function printTopItems(label = "", items = [], isV2 = false) {
  console.log(`${label} TOP 5`);

  items.slice(0, 5).forEach((entry, index) => {
    if (isV2) {
      console.log(
        `${index + 1}. ${entry?.titleText || ""} | £${entry?.total || 0} | score ${
          entry?.score || 0
        } | ${entry?.bundleType || "unknown"} | ${
          Array.isArray(entry?.warningFlags) && entry.warningFlags.length
            ? entry.warningFlags.join(", ")
            : "no warnings"
        }`
      );
      return;
    }

    console.log(`${index + 1}. ${getTitle(entry)} | £${getTotal(entry)}`);
  });
}

async function runSingleComparison(query = "") {
  printDivider(`QUERY: ${query}`);

  const listings = await searchEbayListings({
    query,
    limit: 30,
  });

  const market = await searchEbayMarketPool({
    query,
    limit: 30,
  });

  const v1Engine = resolveV1Engine(query);

  let v1Matched = [];
  let v1Pricing = null;

  if (v1Engine) {
    const v1QueryContext =
      typeof v1Engine.classifyQuery === "function"
        ? v1Engine.classifyQuery(query)
        : { rawQuery: query };

    v1Matched =
      typeof v1Engine.matchesItem === "function"
        ? listings.filter((item) => v1Engine.matchesItem(item, v1QueryContext))
        : listings;

    v1Pricing =
      typeof v1Engine.buildPricingModel === "function"
        ? v1Engine.buildPricingModel({
            queryContext: v1QueryContext,
            marketItems: market,
            listingItems: listings,
          })
        : null;
  }

  const v2 = runConsoleV2Engine({
    query,
    marketItems: market,
    listingItems: listings,
  });

  console.log(`Fetched: listings ${listings.length}, market ${market.length}`);
  console.log(
    `V1: matched ${v1Matched.length}, resale £${v1Pricing?.estimatedResale || 0}, confidence ${
      v1Pricing?.confidence || 0
    } ${v1Pricing?.confidenceLabel || ""}`
  );
  console.log(
    `V2: matched ${v2?.listings?.matchedCount || 0}, resale £${
      v2?.pricing?.estimatedResale || 0
    }, confidence ${v2?.pricing?.confidence || 0} ${
      v2?.pricing?.confidenceLabel || ""
    }`
  );

  printTopItems("V1", v1Matched, false);
  printTopItems("V2", v2?.listings?.items || [], true);
}

async function runComparison() {
  printDivider("CONSOLE ENGINE COMPARISON START");

  for (const query of TEST_QUERIES) {
    await runSingleComparison(query);
  }

  printDivider("CONSOLE ENGINE COMPARISON END");
}

runComparison().catch((err) => {
  console.error("Comparison test failed:", err);
});
