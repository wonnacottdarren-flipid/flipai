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

function printLine(label = "", value = "") {
  console.log(`${label}: ${value}`);
}

function printDivider(title = "") {
  console.log("");
  console.log("==================================================");
  console.log(title);
  console.log("==================================================");
}

function printSmallDivider() {
  console.log("--------------------------------------------------");
}

function printV1Item(item, index) {
  printLine(`V1 #${index + 1} title`, getTitle(item));
  printLine(`V1 #${index + 1} total`, getTotal(item));
  printSmallDivider();
}

function printV2Item(entry, index) {
  printLine(`V2 #${index + 1} title`, entry?.titleText || "");
  printLine(`V2 #${index + 1} total`, entry?.total || 0);
  printLine(`V2 #${index + 1} score`, entry?.score || 0);
  printLine(`V2 #${index + 1} bundleType`, entry?.bundleType || "");
  printLine(`V2 #${index + 1} conditionState`, entry?.conditionState || "");
  printLine(
    `V2 #${index + 1} warnings`,
    Array.isArray(entry?.warningFlags) && entry.warningFlags.length
      ? entry.warningFlags.join(", ")
      : "none"
  );
  printSmallDivider();
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

  printLine("Listings fetched", listings.length);
  printLine("Market fetched", market.length);

  const v1Engine = resolveV1Engine(query);

  if (!v1Engine) {
    printLine("V1 status", "engine not found");
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

    printLine("V1 matched", v1Matched.length);
    printLine("V1 pricing mode", v1Pricing?.pricingMode || "");
    printLine("V1 estimated resale", v1Pricing?.estimatedResale || 0);
    printLine("V1 confidence", v1Pricing?.confidence || 0);
    printLine("V1 confidence label", v1Pricing?.confidenceLabel || "");
    printLine("V1 comp count", v1Pricing?.compCount || 0);

    printSmallDivider();
    console.log("V1 TOP 3");
    v1Matched.slice(0, 3).forEach(printV1Item);
  }

  const v2 = runConsoleV2Engine({
    query,
    marketItems: market,
    listingItems: listings,
  });

  printLine("V2 matched", v2?.listings?.matchedCount || 0);
  printLine("V2 pricing mode", v2?.pricing?.pricingMode || "");
  printLine("V2 estimated resale", v2?.pricing?.estimatedResale || 0);
  printLine("V2 confidence", v2?.pricing?.confidence || 0);
  printLine("V2 confidence label", v2?.pricing?.confidenceLabel || "");
  printLine("V2 comp count", v2?.pricing?.compCount || 0);
  printLine("V2 bundle boost", v2?.pricing?.bundleBoost || 0);

  printSmallDivider();
  console.log("V2 TOP 5");
  v2.listings.items.slice(0, 5).forEach(printV2Item);
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
