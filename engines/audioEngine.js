import {
  baseEngine,
  normalizeText,
  roundMoney,
  median,
  percentile,
  removePriceOutliers,
  extractTotalPrice,
} from "./baseEngine.js";

import {
  detectAudioBrand,
  parseAudioFamily,
} from "./audioV2Families.js";

/* -------------------------
   SMALL HELPERS
------------------------- */

function squashSpaces(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function hasAny(text, phrases = []) {
  const rawHaystack = String(text || "");
  const haystack = squashSpaces(rawHaystack);

  return phrases.some((phrase) => {
    const rawNeedle = String(phrase || "");
    const needle = squashSpaces(rawNeedle);
    return rawHaystack.includes(rawNeedle) || haystack.includes(needle);
  });
}

function getAudioTitleText(item) {
  return normalizeText([item?.title, item?.subtitle].filter(Boolean).join(" "));
}

function getAudioCombinedItemText(item) {
  return normalizeText(
    [
      item?.title,
      item?.subtitle,
      item?.condition,
      item?.conditionDisplayName,
      item?.itemCondition,
      item?.shortDescription,
      item?.description,
    ]
      .filter(Boolean)
      .join(" ")
  );
}

function getAudioCategoryText(item) {
  const categories = Array.isArray(item?.categories) ? item.categories : [];
  return normalizeText(
    categories
      .map((category) => category?.categoryName)
      .filter(Boolean)
      .join(" ")
  );
}

/* -------------------------
   QUERY CONTEXT
------------------------- */

function wantsCompleteSetFromQuery(queryContext = {}) {
  const q = normalizeText(queryContext?.normalizedQuery || queryContext?.rawQuery || "");

  return hasAny(q, [
    "complete",
    "complete set",
    "full set",
    "boxed complete",
    "with case",
    "with charging case",
    "charging case",
    "pair",
    "both buds",
    "both earbuds",
  ]);
}

function shouldAllowDamagedListings(queryContext) {
  const q = normalizeText(queryContext?.normalizedQuery || "");

  return hasAny(q, [
    "faulty",
    "broken",
    "damaged",
    "for parts",
    "for spares",
    "spares",
    "repairs",
    "not working",
  ]);
}

/* -------------------------
   AUDIO MATCHING / FILTERS
------------------------- */

function isAudioCategory(item) {
  const categoryText = getAudioCategoryText(item);

  return hasAny(categoryText, [
    "headphones",
    "earphones",
    "portable audio",
    "sound vision",
    "consumer electronics",
    "audio",
  ]);
}

function isHardNonAudioListing(text = "", item = null) {
  const t = normalizeText(text);
  const categoryText = item ? getAudioCategoryText(item) : "";

  if (
    hasAny(categoryText, [
      "mobile phones",
      "video game",
      "cameras",
      "computers",
      "tablets",
      "clothes",
      "jewellery",
      "watches",
      "books",
      "toys",
      "vehicle parts",
    ])
  ) {
    return true;
  }

  return hasAny(t, [
    "case only",
    "charging case only",
    "left only",
    "right only",
    "single earbud",
    "single bud",
    "one earbud",
    "one bud",
    "replacement bud",
    "replacement earbud",
    "ear tips only",
    "tips only",
    "box only",
    "empty box",
    "manual only",
    "skin only",
    "cover only",
    "strap only",
    "charger only",
    "cable only",
  ]);
}

function classifyAudioConditionState(text = "") {
  const t = normalizeText(text);

  if (
    hasAny(t, [
      "for parts",
      "for spares",
      "spares or repairs",
      "spares repairs",
      "parts only",
      "faulty",
      "broken",
      "not working",
      "no sound",
      "one side not working",
      "left not working",
      "right not working",
      "does not charge",
      "doesn't charge",
      "wont charge",
      "won't charge",
      "water damaged",
      "damaged",
    ])
  ) {
    return "faulty_or_parts";
  }

  if (
    hasAny(t, [
      "read description",
      "see description",
      "untested",
      "battery weak",
      "battery issue",
      "low battery",
      "crackling",
      "static",
      "intermittent",
      "poor condition",
      "heavy wear",
      "heavily used",
    ])
  ) {
    return "minor_fault";
  }

  return "clean_working";
}

function isDamagedAudioConditionState(conditionState) {
  return conditionState === "minor_fault" || conditionState === "faulty_or_parts";
}

function estimateAudioRepairCost(queryContext = {}, conditionState = "", text = "") {
  const t = normalizeText(text);
  const family = String(queryContext?.family || "");

  if (conditionState === "faulty_or_parts") {
    if (family.includes("airpods")) return 28;
    if (family.includes("buds")) return 24;
    if (family.includes("xm") || family.includes("sony")) return 35;
    if (family.includes("bose") || family.includes("qc")) return 35;
    return 25;
  }

  if (conditionState === "minor_fault") {
    if (hasAny(t, ["battery weak", "battery issue", "low battery"])) return 18;
    if (hasAny(t, ["crackling", "static", "intermittent"])) return 15;
    if (hasAny(t, ["read description", "see description", "untested"])) return 12;
    return 10;
  }

  return 0;
}

function getFamilyFallbackResale(family = "", brand = "") {
  const f = String(family || "");
  const b = String(brand || "");

  if (f.includes("airpods_max")) return 295;
  if (f.includes("airpods_pro_2")) return 145;
  if (f.includes("airpods_pro")) return 95;
  if (f.includes("airpods_3")) return 85;
  if (f.includes("airpods_2")) return 55;
  if (f.includes("airpods")) return 70;

  if (f.includes("wf_1000xm5") || f.includes("xm5")) return 145;
  if (f.includes("wf_1000xm4") || f.includes("xm4")) return 85;
  if (f.includes("wf_1000xm3") || f.includes("xm3")) return 45;
  if (f.includes("wh_1000xm5")) return 210;
  if (f.includes("wh_1000xm4")) return 150;
  if (f.includes("wh_1000xm3")) return 95;

  if (f.includes("galaxy_buds_3_pro")) return 125;
  if (f.includes("galaxy_buds_3")) return 85;
  if (f.includes("galaxy_buds_2_pro")) return 75;
  if (f.includes("galaxy_buds_2")) return 45;
  if (f.includes("galaxy_buds_live")) return 35;
  if (f.includes("galaxy_buds")) return 50;

  if (f.includes("quietcomfort_ultra") || f.includes("qc_ultra")) return 210;
  if (f.includes("quietcomfort") || f.includes("qc")) return 130;
  if (f.includes("bose")) return 110;

  if (b === "apple") return 85;
  if (b === "sony") return 95;
  if (b === "samsung") return 55;
  if (b === "bose") return 120;

  return 0;
}

function scoreAudioCandidate(item, queryContext = {}) {
  const titleText = getAudioTitleText(item);
  const text = getAudioCombinedItemText(item);

  if (!text) return -10;
  if (isHardNonAudioListing(`${titleText} ${text}`, item)) return -10;

  const itemBrand = detectAudioBrand(`${titleText} ${text}`);
  if (queryContext.brand && itemBrand && itemBrand !== queryContext.brand) return -10;

  const itemFamily = parseAudioFamily(`${titleText} ${text}`, queryContext.brand || itemBrand);
  if (queryContext.family && itemFamily && itemFamily !== queryContext.family) return -10;

  const conditionState = classifyAudioConditionState(text);
  if (!queryContext.allowDamaged && isDamagedAudioConditionState(conditionState)) return -10;

  let score = 0;

  if (queryContext.brand && itemBrand === queryContext.brand) score += 2;
  if (queryContext.family && itemFamily === queryContext.family) score += 4;
  if (!queryContext.family && itemFamily) score += 1;

  if (isAudioCategory(item)) score += 1;
  if (conditionState === "clean_working") score += 1.5;
  if (conditionState === "minor_fault") score -= 2;
  if (conditionState === "faulty_or_parts") score -= 5;

  if (
    queryContext.wantsCompleteSet &&
    hasAny(text, ["with case", "charging case", "complete", "pair", "both"])
  ) {
    score += 1;
  }

  if (
    queryContext.wantsCompleteSet &&
    hasAny(text, ["case only", "left only", "right only", "single"])
  ) {
    score -= 6;
  }

  return score;
}

function enrichAudioCompPool(queryContext = {}, items = []) {
  return (Array.isArray(items) ? items : [])
    .map((item) => {
      const titleText = getAudioTitleText(item);
      const text = getAudioCombinedItemText(item);
      const conditionState = classifyAudioConditionState(text);
      const repairCost = estimateAudioRepairCost(queryContext, conditionState, text);

      return {
        item,
        total: extractTotalPrice(item),
        adjustedTotal: roundMoney(extractTotalPrice(item) + repairCost),
        score: scoreAudioCandidate(item, queryContext),
        conditionState,
        repairCost,
        titleText,
        text,
      };
    })
    .filter((entry) => entry.total > 0 && entry.score > -5)
    .sort((a, b) => b.score - a.score);
}

/* -------------------------
   ENGINE
------------------------- */

export const audioEngine = {
  ...baseEngine,
  id: "audio",

  detect(query = "") {
    const text = normalizeText(query);

    return (
      text.includes("airpods") ||
      text.includes("headphones") ||
      text.includes("earbuds") ||
      text.includes("earphones") ||
      text.includes("galaxy buds") ||
      text.includes("sony") ||
      text.includes("xm3") ||
      text.includes("xm4") ||
      text.includes("xm5") ||
      text.includes("bose") ||
      text.includes("qc")
    );
  },

  classifyQuery(query = "") {
    const rawQuery = String(query || "").trim();
    const normalizedQuery = normalizeText(rawQuery);

    const brand = detectAudioBrand(normalizedQuery);
    const family = parseAudioFamily(normalizedQuery, brand);

    const allowDamaged = shouldAllowDamagedListings({ normalizedQuery });
    const wantsCompleteSet = wantsCompleteSetFromQuery({ normalizedQuery, rawQuery });

    return {
      rawQuery,
      normalizedQuery,
      brand,
      family,
      allowDamaged,
      wantsCompleteSet,
    };
  },

  expandSearchVariants(query = "") {
    const rawQuery = String(query || "").trim();
    const ctx = this.classifyQuery(rawQuery);

    const variants = [rawQuery];

    if (ctx.family) {
      const niceFamily = ctx.family.replaceAll("_", " ");
      variants.push(niceFamily);

      if (ctx.brand === "apple") variants.push(`airpods ${niceFamily}`);
      if (ctx.brand === "sony") variants.push(`sony ${niceFamily}`);
      if (ctx.brand === "bose") variants.push(`bose ${niceFamily}`);
      if (ctx.brand === "samsung") variants.push(`galaxy ${niceFamily}`);
    }

    return [...new Set(variants.map((v) => String(v || "").trim()).filter(Boolean))];
  },

  matchesItem(item, queryContext) {
    const text = getAudioCombinedItemText(item);
    const titleText = getAudioTitleText(item);

    if (!text) return false;
    if (isHardNonAudioListing(`${titleText} ${text}`, item)) return false;

    const conditionState = classifyAudioConditionState(text);
    if (!queryContext.allowDamaged && isDamagedAudioConditionState(conditionState)) return false;

    const itemBrand = detectAudioBrand(`${titleText} ${text}`);
    if (queryContext.brand && itemBrand && itemBrand !== queryContext.brand) return false;

    const itemFamily = parseAudioFamily(`${titleText} ${text}`, queryContext.brand || itemBrand);
    if (queryContext.family && itemFamily && itemFamily !== queryContext.family) {
      return false;
    }

    return true;
  },

  buildPricingModel(queryContext = {}, marketItems = [], listingItems = []) {
    const marketPool = enrichAudioCompPool(queryContext, marketItems);
    const listingPool = enrichAudioCompPool(queryContext, listingItems);

    const cleanMarketPool = queryContext.allowDamaged
      ? marketPool
      : marketPool.filter((entry) => entry.conditionState === "clean_working");

    const cleanListingPool = queryContext.allowDamaged
      ? listingPool
      : listingPool.filter((entry) => entry.conditionState === "clean_working");

    const exactMarket = cleanMarketPool.filter((entry) => entry.score >= 4);
    const usableMarket = exactMarket.length >= 3 ? exactMarket : cleanMarketPool;

    const exactListings = cleanListingPool.filter((entry) => entry.score >= 4);
    const usableListings = exactListings.length >= 2 ? exactListings : cleanListingPool;

    const marketTotals = removePriceOutliers(usableMarket.map((entry) => entry.adjustedTotal));
    const listingTotals = removePriceOutliers(usableListings.map((entry) => entry.adjustedTotal));

    const marketMedian = median(marketTotals);
    const marketLow = percentile(marketTotals, 0.35);
    const listingMedian = median(listingTotals);
    const fallbackResale = getFamilyFallbackResale(queryContext.family, queryContext.brand);

    let pricingMode = "Audio market median";
    let baseline = marketMedian || marketLow || listingMedian || fallbackResale || 0;

    if (!marketMedian && marketLow) pricingMode = "Audio market low-band";
    if (!marketMedian && !marketLow && listingMedian) pricingMode = "Audio listing fallback";
    if (!marketMedian && !marketLow && !listingMedian && fallbackResale) {
      pricingMode = "Audio fallback resale";
    }

    const estimatedResale = roundMoney(baseline * 0.94);

    const compCount = marketTotals.length;
    let confidence = 20;

    if (fallbackResale) confidence = 35;
    if (compCount >= 3) confidence = 55;
    if (compCount >= 5) confidence = 68;
    if (compCount >= 8) confidence = 80;

    if (exactMarket.length >= 3) confidence += 6;
    if (exactListings.length >= 2) confidence += 4;
    if (queryContext.family) confidence += 4;

    confidence = Math.min(90, confidence);

    let confidenceLabel = "Low";
    if (confidence >= 78) confidenceLabel = "High";
    else if (confidence >= 55) confidenceLabel = "Medium";

    return {
      estimatedResale,
      compCount,
      confidence,
      confidenceLabel,
      pricingMode,
      marketMedian,
      marketLow,
      listingMedian,
      fallbackResale,
    };
  },

  classifyItem(item, queryContext = {}) {
    const text = getAudioCombinedItemText(item);
    const conditionState = classifyAudioConditionState(text);
    const repairCost = estimateAudioRepairCost(queryContext, conditionState, text);

    return {
      conditionState,
      repairCost,
    };
  },
};
