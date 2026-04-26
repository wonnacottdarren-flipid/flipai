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

function printLine(label = "", value = "") {
  console.log(`${label}: ${value}`);
}

function printDivider(title = "") {
  console.log("");
  console.log("==================================================");
  console.log(title);
  console.log("==================================================");
}

function printV1Item(item, index) {
  printLine(`#${index + 1} title`, getTitle(item));
  printLine(`#${index + 1} total`, getTotal(item));
  console.log("--------------------------------------------------");
}

function printV2Item(entry, index) {
  printLine(`#${index + 1} title`, entry?.titleText || "");
  printLine(`#${index + 1} total`, entry?.total || 0);
  printLine(`#${index + 1} score`, entry?.score || 0);
  printLine(`#${index + 1} bundleType`, entry?.bundleType || "");
  printLine(`#${index + 1} conditionState`, entry?.conditionState || "");
  printLine(
    `#${index + 1} warnings`,
    Array.isArray(entry?.warningFlags) && entry.warningFlags.length
      ? entry.warningFlags.join(", ")
      : "none"
  );
  console.log("--------------------------------------------------");
}

async function runComparison() {
  const query = "ps5";

  printDivider("CONSOLE ENGINE COMPARISON START");
  printLine("Query", query);

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
    printDivider("V1 RESULTS");
    printLine("Status", "V1 engine not found");
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

    printDivider("V1 RESULTS");
    printLine("Matched", v1Matched.length);
    printLine("Pricing mode", v1Pricing?.pricingMode || "");
    printLine("Estimated resale", v1Pricing?.estimatedResale || 0);
    printLine("Confidence", v1Pricing?.confidence || 0);
    printLine("Confidence label", v1Pricing?.confidenceLabel || "");
    printLine("Comp count", v1Pricing?.compCount || 0);

    printDivider("V1 TOP 5");
    v1Matched.slice(0, 5).forEach(printV1Item);
  }

  const v2 = runConsoleV2Engine({
    query,
    marketItems: market,
    listingItems: listings,
  });

  printDivider("V2 RESULTS");
  printLine("Matched", v2?.listings?.matchedCount || 0);
  printLine("Pricing mode", v2?.pricing?.pricingMode || "");
  printLine("Estimated resale", v2?.pricing?.estimatedResale || 0);
  printLine("Confidence", v2?.pricing?.confidence || 0);
  printLine("Confidence label", v2?.pricing?.confidenceLabel || "");
  printLine("Comp count", v2?.pricing?.compCount || 0);
  printLine("Bundle boost", v2?.pricing?.bundleBoost || 0);

  printDivider("V2 TOP 5");
  v2.listings.items.slice(0, 5).forEach(printV2Item);

  printDivider("CONSOLE ENGINE COMPARISON END");
}

runComparison().catch((err) => {
  console.error("Comparison test failed:", err);
});
