function normalizeText(value) {
  return String(value || "").toLowerCase();
}

function roundMoney(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function median(values) {
  const nums = values
    .map((v) => Number(v || 0))
    .filter((v) => Number.isFinite(v) && v > 0)
    .sort((a, b) => a - b);

  if (!nums.length) return 0;

  const mid = Math.floor(nums.length / 2);
  return nums.length % 2 === 0
    ? roundMoney((nums[mid - 1] + nums[mid]) / 2)
    : roundMoney(nums[mid]);
}

function average(values) {
  const nums = values
    .map((v) => Number(v || 0))
    .filter((v) => Number.isFinite(v) && v > 0);

  if (!nums.length) return 0;
  return roundMoney(nums.reduce((sum, v) => sum + v, 0) / nums.length);
}

function percentile(values, p) {
  const nums = values
    .map((v) => Number(v || 0))
    .filter((v) => Number.isFinite(v) && v > 0)
    .sort((a, b) => a - b);

  if (!nums.length) return 0;
  if (nums.length === 1) return roundMoney(nums[0]);

  const index = (nums.length - 1) * p;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);

  if (lower === upper) return roundMoney(nums[lower]);

  const weight = index - lower;
  return roundMoney(nums[lower] * (1 - weight) + nums[upper] * weight);
}

function extractNumericPrice(item) {
  return roundMoney(
    Number(
      item?.price?.value ??
        item?.currentPrice?.value ??
        item?.sellingStatus?.currentPrice?.value ??
        item?.price ??
        0
    ) || 0
  );
}

function extractNumericShipping(item) {
  return roundMoney(
    Number(
      item?.shippingOptions?.[0]?.shippingCost?.value ??
        item?.shippingCost?.value ??
        item?.shipping ??
        0
    ) || 0
  );
}

function extractItemTitle(item) {
  return String(item?.title || item?.name || item?.product || "").trim();
}

function extractTotalPrice(item) {
  return roundMoney(extractNumericPrice(item) + extractNumericShipping(item));
}

function getQueryTokens(searchText) {
  const stopWords = new Set([
    "used",
    "the",
    "and",
    "for",
    "with",
    "a",
    "an",
  ]);

  return Array.from(
    new Set(
      normalizeText(searchText)
        .split(/[^a-z0-9]+/g)
        .map((t) => t.trim())
        .filter((t) => t && t.length >= 2 && !stopWords.has(t))
    )
  );
}

function scoreTitleAgainstQuery(searchText, item) {
  const titleText = normalizeText(extractItemTitle(item));
  const tokens = getQueryTokens(searchText);

  if (!tokens.length) return 0;

  let matched = 0;
  for (const token of tokens) {
    if (titleText.includes(token)) matched += 1;
  }

  return matched / tokens.length;
}

function removePriceOutliers(values = []) {
  const nums = values
    .map((v) => Number(v || 0))
    .filter((v) => Number.isFinite(v) && v > 0)
    .sort((a, b) => a - b);

  if (nums.length <= 4) return nums;

  const q1 = percentile(nums, 0.25);
  const q3 = percentile(nums, 0.75);
  const iqr = q3 - q1;

  if (!Number.isFinite(iqr) || iqr <= 0) return nums;

  const lower = q1 - iqr * 1.5;
  const upper = q3 + iqr * 1.5;

  const filtered = nums.filter((v) => v >= lower && v <= upper);
  return filtered.length >= Math.max(3, Math.floor(nums.length * 0.5))
    ? filtered
    : nums;
}

function enrichCompPool(searchText, items = []) {
  return (Array.isArray(items) ? items : [])
    .map((item) => ({
      item,
      total: extractTotalPrice(item),
      score: scoreTitleAgainstQuery(searchText, item),
    }))
    .filter((entry) => entry.total > 0)
    .sort((a, b) => b.score - a.score);
}

function buildGenericPricingModel(searchText, marketItems = [], listingItems = []) {
  const marketPool = enrichCompPool(searchText, marketItems);
  const listingPool = enrichCompPool(searchText, listingItems);

  const strongMarket = marketPool.filter((entry) => entry.score >= 0.45);
  const usableMarket = strongMarket.length >= 3 ? strongMarket : marketPool;

  const strongListings = listingPool.filter((entry) => entry.score >= 0.45);
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

  let pricingMode = "Market median";
  let baseline = marketMedian || marketLow || listingMedian || 0;

  if (!marketMedian && listingMedian) pricingMode = "Listings median fallback";
  if (!marketMedian && !listingMedian && marketLow) pricingMode = "Market low-band";

  if (!baseline && listingMedian) {
    baseline = listingMedian;
  }

  const estimatedResale = roundMoney(baseline * 0.94);

  const compCount = marketTotals.length;
  let confidence = 22;
  if (compCount >= 3) confidence = 55;
  if (compCount >= 5) confidence = 70;
  if (compCount >= 8) confidence = 84;

  if (usableMarket.length >= 5) confidence += 4;
  if (strongMarket.length >= 5) confidence += 4;
  if (usableListings.length >= 4) confidence += 3;

  confidence = Math.min(92, confidence);

  let confidenceLabel = "Low";
  if (confidence >= 80) confidenceLabel = "High";
  else if (confidence >= 55) confidenceLabel = "Medium";

  return {
    estimatedResale,
    compCount,
    confidence,
    confidenceLabel,
    pricingMode,
    marketMedian: roundMoney(marketMedian),
    marketLow: roundMoney(marketLow),
    listingMedian: roundMoney(listingMedian),
  };
}

export const baseEngine = {
  id: "generic",

  detect(query = "") {
    return Boolean(String(query || "").trim());
  },

  classifyQuery(query = "") {
    return {
      rawQuery: String(query || "").trim(),
      normalizedQuery: normalizeText(query),
    };
  },

  expandSearchVariants(query = "") {
    return [String(query || "").trim()].filter(Boolean);
  },

  matchesItem(_item, _queryContext) {
    return true;
  },

  buildPricingModel({ queryContext, marketItems = [], listingItems = [] }) {
    return buildGenericPricingModel(
      queryContext?.normalizedQuery || "",
      marketItems,
      listingItems
    );
  },
};

export {
  normalizeText,
  roundMoney,
  median,
  average,
  percentile,
  extractNumericPrice,
  extractNumericShipping,
  extractItemTitle,
  extractTotalPrice,
  getQueryTokens,
  scoreTitleAgainstQuery,
  removePriceOutliers,
  enrichCompPool,
  buildGenericPricingModel,
};
