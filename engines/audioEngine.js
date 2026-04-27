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
  isCompatibleAudioFamily,
} from "./audioV2Families.js";

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
    categories.map((category) => category?.categoryName).filter(Boolean).join(" ")
  );
}

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

function isAudioPartsCategory(item) {
  const categoryText = getAudioCategoryText(item);

  return hasAny(categoryText, [
    "rechargeable batteries",
    "multipurpose batteries",
    "batteries",
    "battery",
    "parts",
    "replacement parts",
    "accessories",
  ]);
}

function isIncompleteAudioListing(text = "") {
  const t = normalizeText(text);

  return hasAny(t, [
    "case only",
    "charging case only",
    "left only",
    "right only",
    "left ear only",
    "right ear only",
    "ear only",
    "left airpod only",
    "right airpod only",
    "left airpod earbud only",
    "right airpod earbud only",
    "left earbud only",
    "right earbud only",
    "airpod earbud only",
    "earbud only",
    "bud only",
    "single earbud",
    "single airpod",
    "single bud",
    "one earbud",
    "one airpod",
    "one bud",
    "left earbud",
    "right earbud",
    "left bud",
    "right bud",
    "replacement bud",
    "replacement earbud",
    "replacement airpod",
    "individual earbud",
    "individual airpod",
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

function isAudioPartListing(text = "", item = null) {
  const t = normalizeText(text);

  if (item && isAudioPartsCategory(item)) return true;

  return hasAny(t, [
    "battery",
    "battery replacement",
    "replacement battery",
    "charging case battery",
    "case battery",
    "zenipower",
    "zeni power",
    "z55h",
    "cp1254",
    "3.85v",
    "75mah",
    "rechargeable battery",
    "rechargeable batteries",
    "multipurpose batteries",
    "for sony wf1000xm4 battery",
    "for sony wf-1000xm4 battery",
    "sony wf-1000xm4 battery",
    "wf1000xm4 battery",
    "wf-1000xm4 battery",
    "oem battery",
    "original battery",
    "spare battery",
    "repair battery",
    "replacement part",
    "spare part",
    "parts only",
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

  if (isIncompleteAudioListing(t)) return true;
  if (isAudioPartListing(t, item)) return true;

  return false;
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

  if (f.includes("galaxy_buds3_pro")) return 125;
  if (f.includes("galaxy_buds3")) return 85;
  if (f.includes("galaxy_buds2_pro")) return 75;
  if (f.includes("galaxy_buds2")) return 45;
  if (f.includes("galaxy_buds_live")) return 35;
  if (f.includes("galaxy_buds")) return 50;

  if (f.includes("bose_qc_ultra")) return 210;
  if (f.includes("bose_qc")) return 130;
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
  const combinedText = `${titleText} ${text}`;

  if (!text) return -10;
  if (isHardNonAudioListing(combinedText, item)) return -10;

  const itemBrand = detectAudioBrand(combinedText);
  if (queryContext.brand && itemBrand && itemBrand !== queryContext.brand) return -10;

  const itemFamily = parseAudioFamily(combinedText, queryContext.brand || itemBrand);

  if (
    queryContext.family &&
    itemFamily &&
    !isCompatibleAudioFamily(queryContext.family, itemFamily)
  ) {
    return -10;
  }

  const conditionState = classifyAudioConditionState(text);
  if (!queryContext.allowDamaged && isDamagedAudioConditionState(conditionState)) return -10;

  let score = 0;

  if (queryContext.brand && itemBrand === queryContext.brand) score += 2;
  if (queryContext.family && itemFamily === queryContext.family) score += 4;
  if (
    queryContext.family &&
    itemFamily &&
    itemFamily !== queryContext.family &&
    isCompatibleAudioFamily(queryContext.family, itemFamily)
  ) {
    score += 3;
  }
  if (!queryContext.family && itemFamily) score += 1;
  if (!itemFamily && queryContext.family && combinedText.includes("airpods pro")) score += 2.5;

  if (isAudioCategory(item)) score += 1;
  if (conditionState === "clean_working") score += 1.5;
  if (conditionState === "minor_fault") score -= 2;
  if (conditionState === "faulty_or_parts") score -= 5;

  if (hasAny(text, ["with case", "charging case", "complete", "pair", "both"])) {
    score += 0.75;
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

function normalizeBuildPricingArgs(firstArg = {}, secondArg = [], thirdArg = []) {
  if (
    firstArg &&
    typeof firstArg === "object" &&
    !Array.isArray(firstArg) &&
    (
      Object.prototype.hasOwnProperty.call(firstArg, "queryContext") ||
      Object.prototype.hasOwnProperty.call(firstArg, "marketItems") ||
      Object.prototype.hasOwnProperty.call(firstArg, "listingItems")
    )
  ) {
    return {
      queryContext: firstArg.queryContext || {},
      marketItems: Array.isArray(firstArg.marketItems) ? firstArg.marketItems : [],
      listingItems: Array.isArray(firstArg.listingItems) ? firstArg.listingItems : [],
    };
  }

  return {
    queryContext: firstArg || {},
    marketItems: Array.isArray(secondArg) ? secondArg : [],
    listingItems: Array.isArray(thirdArg) ? thirdArg : [],
  };
}

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

      if (ctx.family === "airpods_pro") {
        variants.push("airpods pro 2");
        variants.push("apple airpods pro");
        variants.push("apple airpods pro 2");
      }

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
    const combinedText = `${titleText} ${text}`;

    if (!text) return false;
    if (isHardNonAudioListing(combinedText, item)) return false;

    const conditionState = classifyAudioConditionState(text);
    if (!queryContext.allowDamaged && isDamagedAudioConditionState(conditionState)) return false;

    const itemBrand = detectAudioBrand(combinedText);
    if (queryContext.brand && itemBrand && itemBrand !== queryContext.brand) return false;

    const itemFamily = parseAudioFamily(combinedText, queryContext.brand || itemBrand);

    if (
      queryContext.family &&
      itemFamily &&
      !isCompatibleAudioFamily(queryContext.family, itemFamily)
    ) {
      return false;
    }

    return true;
  },

  buildPricingModel(firstArg = {}, secondArg = [], thirdArg = []) {
    const { queryContext, marketItems, listingItems } = normalizeBuildPricingArgs(
      firstArg,
      secondArg,
      thirdArg
    );

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
