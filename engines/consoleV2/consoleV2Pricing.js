import {
  median,
  percentile,
  removePriceOutliers,
  roundMoney,
} from "../baseEngine.js";
import { scoreConsoleV2Items } from "./consoleV2Scoring.js";

function getFamilyFallbackResaleV2(family = "") {
  if (family === "ps5_disc") return 390;
  if (family === "ps5_digital") return 315;
  if (family === "xbox_series_x") return 305;
  if (family === "xbox_series_s") return 165;
  if (family === "switch_oled") return 210;
  if (family === "switch_lite") return 115;
  if (family === "switch_v2") return 155;
  return 0;
}

function getConfidenceLabelV2(confidence = 0) {
  if (confidence >= 80) return "High";
  if (confidence >= 55) return "Medium";
  return "Low";
}

function isBundleEntry(entry = {}) {
  return entry?.bundleType === "bundle";
}

function getEntryTotal(entry = {}) {
  return Number(entry?.total || 0);
}

export function buildConsoleV2PricingModel(
  queryContext = {},
  marketItems = [],
  listingItems = []
) {
  const family = String(queryContext?.family || "");

  const marketPool = scoreConsoleV2Items(marketItems, queryContext);
  const listingPool = scoreConsoleV2Items(listingItems, queryContext);

  const strongMarket = marketPool.filter((entry) => entry.score >= 5);
  const usableMarket = strongMarket.length >= 3 ? strongMarket : marketPool;

  const strongListings = listingPool.filter((entry) => entry.score >= 5);
  const usableListings = strongListings.length >= 2 ? strongListings : listingPool;

  const consoleOnlyMarket = usableMarket.filter((entry) => !isBundleEntry(entry));
  const bundleMarket = usableMarket.filter((entry) => isBundleEntry(entry));

  const baseMarketPool =
    !queryContext?.wantsBundle && consoleOnlyMarket.length >= 4
      ? consoleOnlyMarket
      : usableMarket;

  const marketTotals = removePriceOutliers(
    baseMarketPool.map(getEntryTotal).filter((value) => value > 0)
  );

  const listingTotals = removePriceOutliers(
    usableListings.map(getEntryTotal).filter((value) => value > 0)
  );

  const bundleTotals = removePriceOutliers(
    bundleMarket.map(getEntryTotal).filter((value) => value > 0)
  );

  const marketMedian = median(marketTotals);
  const marketLow = percentile(marketTotals, 0.35);
  const listingMedian = median(listingTotals);
  const fallbackResale = getFamilyFallbackResaleV2(family);

  const bundleMedian = median(bundleTotals);
  const bundleBoost =
    bundleMedian && marketMedian ? Math.max(0, bundleMedian - marketMedian) : 0;

  let pricingMode = "Console V2 structured market median";
  let baseline = marketMedian || marketLow || listingMedian || fallbackResale || 0;

  if (queryContext?.wantsBundle && marketMedian && bundleBoost > 0) {
    baseline = roundMoney(marketMedian + bundleBoost * 0.6);
    pricingMode = "Console V2 bundle-adjusted median";
  }

  if (!marketMedian && marketLow) {
    pricingMode = "Console V2 market low-band";
  }

  if (!marketMedian && !marketLow && listingMedian) {
    pricingMode = "Console V2 listings fallback";
  }

  if (!marketMedian && !marketLow && !listingMedian && fallbackResale) {
    pricingMode = "Console V2 family fallback";
  }

  if (fallbackResale && baseline > 0) {
    const hardFloor = roundMoney(fallbackResale * 0.78);
    baseline = Math.max(baseline, hardFloor);
  }

  const estimatedResale = roundMoney(baseline);

  const compCount = marketTotals.length;
  const listingCount = listingTotals.length;

  let confidence = 20;
  if (compCount >= 3) confidence = 55;
  if (compCount >= 5) confidence = 70;
  if (compCount >= 8) confidence = 82;
  if (compCount >= 12) confidence = 88;

  if (strongMarket.length >= 5) confidence += 4;
  if (listingCount >= 4) confidence += 3;
  if (pricingMode === "Console V2 family fallback") confidence = 30;

  confidence = Math.min(92, confidence);

  return {
    pricingMode,
    estimatedResale,
    marketMedian,
    marketLow,
    listingMedian,
    fallbackResale,
    bundleMedian,
    bundleBoost: roundMoney(bundleBoost),
    confidence,
    confidenceLabel: getConfidenceLabelV2(confidence),
    compCount,
    listingCount,
    marketPool,
    listingPool,
    usedMarketTotals: marketTotals,
    usedListingTotals: listingTotals,
  };
}
