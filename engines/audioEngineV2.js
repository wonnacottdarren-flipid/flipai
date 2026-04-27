import {
  baseEngine,
  normalizeText,
  roundMoney,
  median,
  percentile,
  removePriceOutliers,
  extractTotalPrice,
} from "./baseEngine.js";

import { detectAudioBrand, parseAudioFamily } from "./audioV2Families.js";

import {
  failsAudioBaseFilters,
} from "./audioV2Filters.js";

function getAudioFallbackResale(queryContext = {}) {
  const family = String(queryContext?.family || "");

  if (family === "airpods_pro_2") return 105;
  if (family === "airpods_pro") return 70;
  if (family === "airpods_3") return 65;
  if (family === "airpods_2") return 45;
  if (family === "airpods_max") return 260;

  if (family === "sony_wf_1000xm5") return 115;
  if (family === "sony_wf_1000xm4") return 70;
  if (family === "sony_wh_1000xm5") return 210;
  if (family === "sony_wh_1000xm4") return 150;

  if (family === "galaxy_buds3_pro") return 115;
  if (family === "galaxy_buds2_pro") return 70;
  if (family === "galaxy_buds2") return 42;
  if (family === "galaxy_buds_fe") return 40;

  return 45;
}

function scoreAudioComp(item = {}, queryContext = {}) {
  const text = normalizeText(
    [
      item?.title,
      item?.condition,
      item?.conditionDisplayName,
    ]
      .filter(Boolean)
      .join(" ")
  );

  if (!text) return -10;
  if (failsAudioBaseFilters(text, item, queryContext)) return -10;

  let score = 0;

  const itemBrand = detectAudioBrand(text);
  const itemFamily = parseAudioFamily(text, queryContext.brand);

  if (queryContext.brand) {
    if (itemBrand === queryContext.brand) score += 3;
    else return -10;
  }

  if (queryContext.family) {
    if (itemFamily === queryContext.family) score += 5;
    else if (itemFamily && itemFamily !== queryContext.family) return -10;
    else score -= 1;
  }

  if (text.includes("used")) score += 1;
  if (text.includes("working")) score += 1;
  if (text.includes("tested")) score += 1;
  if (text.includes("boxed")) score += 1;
  if (text.includes("with case")) score += 1;

  return score;
}

function buildAudioPricingModel(queryContext = {}, marketItems = [], listingItems = []) {
  const marketPool = (Array.isArray(marketItems) ? marketItems : [])
    .map((item) => ({
      item,
      total: extractTotalPrice(item),
      score: scoreAudioComp(item, queryContext),
    }))
    .filter((entry) => entry.total > 0 && entry.score >= 0)
    .sort((a, b) => b.score - a.score);

  const listingPool = (Array.isArray(listingItems) ? listingItems : [])
    .map((item) => ({
      item,
      total: extractTotalPrice(item),
      score: scoreAudioComp(item, queryContext),
    }))
    .filter((entry) => entry.total > 0 && entry.score >= 0)
    .sort((a, b) => b.score - a.score);

  let marketTotals = removePriceOutliers(
    marketPool.slice(0, 20).map((entry) => entry.total)
  );

  let listingTotals = removePriceOutliers(
    listingPool.slice(0, 12).map((entry) => entry.total)
  );

  if (marketTotals.length < 3 && listingTotals.length >= 2) {
    marketTotals = removePriceOutliers([...marketTotals, ...listingTotals]);
  }

  const marketMedian = median(marketTotals);
  const marketLow = percentile(marketTotals, 0.35);
  const listingMedian = median(listingTotals);
  const fallbackResale = getAudioFallbackResale(queryContext);

  let baseline = marketMedian || marketLow || listingMedian || fallbackResale;
  let pricingMode = "Audio market median";

  if (!marketMedian && marketLow) pricingMode = "Audio low-band fallback";
  if (!marketMedian && !marketLow && listingMedian) pricingMode = "Audio listing fallback";
  if (!marketMedian && !marketLow && !listingMedian) pricingMode = "Audio family fallback";

  const estimatedResale = roundMoney(baseline * 0.94);
  const compCount = marketTotals.length;

  let confidence = 35;
  if (compCount >= 2) confidence = 48;
  if (compCount >= 3) confidence = 58;
  if (compCount >= 5) confidence = 70;
  if (compCount >= 8) confidence = 82;

  if (queryContext.family) confidence += 4;
  confidence = Math.min(88, confidence);

  let confidenceLabel = "Low";
  if (confidence >= 80) confidenceLabel = "High";
  else if (confidence >= 55) confidenceLabel = "Medium";

  return {
    estimatedResale,
    confidence,
    confidenceLabel,
    compCount,
    pricingMode,
    marketMedian: roundMoney(marketMedian),
    marketLow: roundMoney(marketLow),
    listingMedian: roundMoney(listingMedian),
  };
}

export const audioEngine = {
  ...baseEngine,
  id: "audio_v2",

  detect(query = "") {
    const text = normalizeText(query);

    return (
      text.includes("airpods") ||
      text.includes("earbuds") ||
      text.includes("earphones") ||
      text.includes("headphones") ||
      text.includes("galaxy buds") ||
      text.includes("sony") ||
      text.includes("bose")
    );
  },

  classifyQuery(query = "") {
    const rawQuery = String(query || "").trim();
    const normalizedQuery = normalizeText(rawQuery);

    const brand = detectAudioBrand(normalizedQuery);
    const family = parseAudioFamily(normalizedQuery, brand);

    return {
      rawQuery,
      normalizedQuery,
      brand,
      family,
    };
  },

  expandSearchVariants(query = "") {
    const raw = String(query || "").trim();
    const ctx = this.classifyQuery(raw);

    const variants = [raw];

    if (ctx.family) {
      const cleanFamily = ctx.family.replaceAll("_", " ");

      if (!raw.toLowerCase().includes(cleanFamily)) {
        variants.push(cleanFamily);
      }

      if (ctx.brand && !raw.toLowerCase().includes(ctx.brand)) {
        variants.push(`${ctx.brand} ${cleanFamily}`);
      }
    }

    return [...new Set(variants.map((v) => String(v || "").trim()).filter(Boolean))];
  },

  matchesItem(item, queryContext) {
    const text = normalizeText(
      [
        item?.title,
        item?.condition,
        item?.conditionDisplayName,
      ]
        .filter(Boolean)
        .join(" ")
    );

    if (!text) return false;

    if (failsAudioBaseFilters(text, item, queryContext)) {
      return false;
    }

    const itemBrand = detectAudioBrand(text);
    if (queryContext.brand && itemBrand !== queryContext.brand) {
      return false;
    }

    const itemFamily = parseAudioFamily(text, queryContext.brand);
    if (queryContext.family && itemFamily && itemFamily !== queryContext.family) {
      return false;
    }

    return true;
  },

  buildPricingModel({ queryContext, marketItems = [], listingItems = [] }) {
    return buildAudioPricingModel(queryContext, marketItems, listingItems);
  },

  classifyItem() {
    return {
      conditionState: "clean_working",
      repairCost: 0,
    };
  },
};
