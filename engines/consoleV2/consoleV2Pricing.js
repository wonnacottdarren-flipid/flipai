export function buildConsoleV2Pricing({
  queryContext,
  marketItems = [],
  listingItems = [],
}) {
  function round(v) {
    return Math.round((Number(v) || 0) * 100) / 100;
  }

  function median(values = []) {
    const nums = values
      .map((v) => Number(v || 0))
      .filter((v) => Number.isFinite(v) && v > 0)
      .sort((a, b) => a - b);

    if (!nums.length) return 0;

    const mid = Math.floor(nums.length / 2);
    return nums.length % 2 === 0
      ? round((nums[mid - 1] + nums[mid]) / 2)
      : round(nums[mid]);
  }

  function percentile(values = [], p = 0.5) {
    const nums = values
      .map((v) => Number(v || 0))
      .filter((v) => Number.isFinite(v) && v > 0)
      .sort((a, b) => a - b);

    if (!nums.length) return 0;

    const idx = (nums.length - 1) * p;
    const lo = Math.floor(idx);
    const hi = Math.ceil(idx);

    if (lo === hi) return round(nums[lo]);

    const weight = idx - lo;
    return round(nums[lo] * (1 - weight) + nums[hi] * weight);
  }

  function getTotal(item) {
    return Number(item?.total || 0);
  }

  function isBundle(item) {
    return item?.bundleType === "bundle";
  }

  function isConsole(item) {
    return !isBundle(item);
  }

  // 🔥 Split pools
  const marketTotals = marketItems.map(getTotal).filter((v) => v > 0);
  const listingTotals = listingItems.map(getTotal).filter((v) => v > 0);

  const bundleMarket = marketItems.filter(isBundle).map(getTotal).filter((v) => v > 0);
  const consoleMarket = marketItems.filter(isConsole).map(getTotal).filter((v) => v > 0);

  // 🔥 Fallback if no separation
  const basePool =
    consoleMarket.length >= 5 ? consoleMarket : marketTotals;

  // 🔥 Core stats
  const marketMedian = median(basePool);
  const marketLow = percentile(basePool, 0.35);

  // 🔥 Bundle uplift
  let bundleBoost = 0;
  if (bundleMarket.length >= 3) {
    const bundleMedian = median(bundleMarket);
    bundleBoost = Math.max(0, bundleMedian - marketMedian);
  }

  // 🔥 Final resale logic
  let estimatedResale = marketMedian;

  if (queryContext?.wantsBundle) {
    estimatedResale = round(marketMedian + bundleBoost * 0.6);
  } else {
    // 🔥 Protect base consoles from being dragged down
    estimatedResale = round(Math.max(marketMedian, marketLow * 1.08));
  }

  // 🔥 Confidence
  const compCount = basePool.length;

  let confidence = 30;
  if (compCount >= 5) confidence = 60;
  if (compCount >= 8) confidence = 75;
  if (compCount >= 12) confidence = 85;
  if (compCount >= 16) confidence = 92;

  let confidenceLabel = "Low";
  if (confidence >= 80) confidenceLabel = "High";
  else if (confidence >= 55) confidenceLabel = "Medium";

  return {
    pricingMode: "Console V2 structured pricing",
    estimatedResale: round(estimatedResale),
    marketMedian: round(marketMedian),
    marketLow: round(marketLow),
    listingMedian: median(listingTotals),
    fallbackResale: round(marketMedian),
    confidence,
    confidenceLabel,
    compCount,
    listingCount: listingTotals.length,
    marketPool: basePool.slice(0, 20),
    listingPool: listingTotals.slice(0, 20),
  };
}
