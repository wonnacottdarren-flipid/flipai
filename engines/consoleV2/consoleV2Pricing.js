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

  const marketTotals = removePriceOutliers(
    usableMarket.map((entry) => entry.total)
  );

  const listingTotals = removePriceOutliers(
    usableListings.map((entry) => entry.total)
  );

  const marketMedian = median(marketTotals);
  const marketLow = percentile(marketTotals, 0.35);
  const listingMedian = median(listingTotals);
  const fallbackResale = getFamilyFallbackResaleV2(family);

  let pricingMode = "Console V2 market median";
  let baseline = marketMedian || marketLow || listingMedian || fallbackResale || 0;

  if (!marketMedian && marketLow) {
    pricingMode = "Console V2 market low-band";
  }

  if (!marketMedian && !marketLow && listingMedian) {
    pricingMode = "Console V2 listings fallback";
  }

  if (!marketMedian && !marketLow && !listingMedian && fallbackResale) {
    pricingMode = "Console V2 family fallback";
  }

  const estimatedResale = roundMoney(baseline);

  const compCount = marketTotals.length;
  const listingCount = listingTotals.length;

  let confidence = 20;

  if (compCount >= 3) confidence = 55;
  if (compCount >= 5) confidence = 70;
  if (compCount >= 8) confidence = 82;

  if (strongMarket.length >= 5) confidence += 5;
  if (listingCount >= 4) confidence += 4;
  if (pricingMode === "Console V2 family fallback") confidence = 30;

  confidence = Math.min(90, confidence);

  return {
    pricingMode,
    estimatedResale,
    marketMedian,
    marketLow,
    listingMedian,
    fallbackResale,
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
