import {
  baseEngine,
  normalizeText,
  roundMoney,
  median,
  percentile,
  extractItemTitle,
  removePriceOutliers,
} from "./baseEngine.js";

function hasAny(text, phrases = []) {
  return phrases.some((phrase) => text.includes(phrase));
}

function isDysonPartsCategory(item) {
  const categories = Array.isArray(item?.categories) ? item.categories : [];
  return categories.some((category) =>
    normalizeText(category?.categoryName).includes("parts")
  );
}

function isDysonHardAccessoryOnly(text) {
  return hasAny(text, [
    "attachment only",
    "attachments only",
    "tool only",
    "tools only",
    "battery only",
    "charger only",
    "filter only",
    "wand only",
    "head only",
    "roller head only",
    "motorhead only",
    "floor head only",
    "bin only",
    "canister only",
    "hose only",
    "dock only",
    "wall dock only",
    "nozzle only",
    "crevice tool only",
    "brush only",
    "trigger only",
    "spares",
    "spare parts",
    "for parts only",
    "parts only",
  ]);
}

function isDysonAccessoryOrParts(text) {
  return hasAny(text, [
    "parts",
    "spares",
    "attachment",
    "attachments",
    "tool only",
    "tools only",
    "battery only",
    "charger only",
    "filter only",
    "wand only",
    "head only",
    "dock only",
    "wall dock",
    "filter",
    "filters",
    "wand",
    "pipe",
    "crevice",
    "brush",
    "roller",
    "roller head",
    "floor head",
    "motorhead",
    "motor head",
    "nozzle",
    "hose",
    "trigger",
    "bin only",
    "canister only",
  ]);
}

function isDysonMainUnitListing(text) {
  return hasAny(text, [
    "main unit",
    "motor unit",
    "body only",
    "main body",
    "machine body",
    "vacuum body",
    "body unit",
    "handheld unit",
    "main vacuum unit",
    "bare unit",
    "unit only",
    "main machine",
    "motor body",
    "body",
  ]);
}

function isDysonFullMachineListing(text) {
  return hasAny(text, [
    "vacuum cleaner",
    "cordless vacuum",
    "stick vacuum",
    "complete vacuum",
    "full vacuum",
    "complete machine",
    "complete set",
    "full set",
  ]);
}

function isDysonHousingStyleListing(text) {
  return hasAny(text, [
    "housing",
    "housing body",
    "body housing",
    "shell",
    "casing",
    "outer body",
    "plastic body",
    "cover only",
  ]);
}

function isDysonAssemblyStyleListing(text) {
  return hasAny(text, [
    "assembly",
    "trigger assembly",
    "handle assembly",
    "handle trigger assembly",
    "cyclone assembly",
    "body assembly",
  ]);
}

function isDysonUnitPartStyleListing(text) {
  return hasAny(text, [
    "unit part",
    "body unit part",
    "main body part",
    "housing body a unit part",
    "part no",
    "part number",
  ]);
}

function isDysonFaultyStyleListing(text) {
  return hasAny(text, [
    "cuts out",
    "cuts out after",
    "faulty",
    "not working",
    "does not work",
    "broken",
    "for repair",
    "needs repair",
    "intermittent",
    "stops working",
    "dead",
    "no power",
    "not fully working",
  ]);
}

function hasStrongWorkingSignals(text) {
  return hasAny(text, [
    "fully working",
    "full working order",
    "working perfectly",
    "tested working",
    "tested and working",
    "good working order",
    "in working order",
  ]);
}

function isLikelyValidDysonMainUnitListing(text) {
  if (!isDysonMainUnitListing(text)) return false;
  if (isDysonHardAccessoryOnly(text)) return false;
  if (isDysonFullMachineListing(text)) return false;
  if (isDysonHousingStyleListing(text)) return false;
  if (isDysonAssemblyStyleListing(text)) return false;
  if (isDysonUnitPartStyleListing(text)) return false;
  return true;
}

function matchesDysonVariant(searchText, item) {
  if (!searchText.includes("dyson")) {
    return true;
  }

  const titleText = normalizeText(item?.title || item?.name || item?.product || "");

  const wantsV11 = searchText.includes("v11");
  const wantsOutsize = searchText.includes("outsize");
  const wantsMainUnit =
    searchText.includes("main unit") ||
    searchText.includes("main body") ||
    searchText.includes("body only") ||
    searchText.includes("motor unit") ||
    searchText.includes("bare unit") ||
    searchText.includes("unit only") ||
    searchText.includes("handheld unit") ||
    searchText.includes("machine body") ||
    searchText.includes("vacuum body") ||
    searchText.includes("body");

  const titleHasV11 = titleText.includes("v11");
  const titleHasOutsize = titleText.includes("outsize");
  const titleIsMainUnit = isLikelyValidDysonMainUnitListing(titleText);
  const titleIsParts = isDysonAccessoryOrParts(titleText);
  const titleIsFullMachine =
    isDysonFullMachineListing(titleText) ||
    (!titleIsMainUnit && !titleIsParts);

  if (wantsV11 && !titleHasV11) return false;

  if (isDysonHousingStyleListing(titleText)) return false;
  if (isDysonAssemblyStyleListing(titleText)) return false;
  if (isDysonUnitPartStyleListing(titleText)) return false;

  if (wantsOutsize) {
    if (!titleHasOutsize) return false;
    if (titleIsMainUnit) return false;
    if (isDysonPartsCategory(item)) return false;
    if (isDysonFaultyStyleListing(titleText)) return false;
    return titleIsFullMachine;
  }

  if (wantsMainUnit) {
    if (titleHasOutsize) return false;
    if (!titleIsMainUnit) return false;
    if (isDysonFaultyStyleListing(titleText)) return false;
    return true;
  }

  if (wantsV11) {
    if (!titleHasV11) return false;
    if (titleHasOutsize) return false;
    if (titleIsMainUnit) return false;
    if (isDysonPartsCategory(item)) return false;
    if (isDysonFaultyStyleListing(titleText)) return false;
    return titleIsFullMachine;
  }

  if (isDysonPartsCategory(item) && !titleIsMainUnit) return false;
  return true;
}

function scoreDysonTitleAgainstQuery(searchText, item) {
  const titleText = normalizeText(extractItemTitle(item));

  const tokens = Array.from(
    new Set(
      searchText
        .split(/[^a-z0-9]+/g)
        .map((t) => t.trim())
        .filter(
          (t) =>
            t &&
            t.length >= 2 &&
            !["dyson", "used", "the", "and", "for", "with", "vacuum", "cleaner", "cordless"].includes(t)
        )
    )
  );

  if (!tokens.length) return 0;

  let matched = 0;
  for (const token of tokens) {
    if (titleText.includes(token)) matched += 1;
  }

  let score = matched / tokens.length;

  if (searchText.includes("outsize")) {
    score += titleText.includes("outsize") ? 0.35 : -0.5;
  }

  if (
    searchText.includes("main unit") ||
    searchText.includes("main body") ||
    searchText.includes("body only") ||
    searchText.includes("motor unit") ||
    searchText.includes("bare unit") ||
    searchText.includes("unit only") ||
    searchText.includes("handheld unit") ||
    searchText.includes("machine body") ||
    searchText.includes("vacuum body") ||
    searchText.includes("body")
  ) {
    score += isLikelyValidDysonMainUnitListing(titleText) ? 0.4 : -0.35;
  }

  if (
    searchText.includes("dyson") &&
    searchText.includes("v11") &&
    titleText.includes("v11")
  ) {
    score += 0.2;
  }

  if (hasStrongWorkingSignals(titleText)) {
    score += 0.2;
  }

  if (isDysonHardAccessoryOnly(titleText)) {
    score -= 0.7;
  }

  if (isDysonFullMachineListing(titleText) && searchText.includes("main unit")) {
    score -= 0.5;
  }

  if (isDysonHousingStyleListing(titleText)) {
    score -= 1.1;
  }

  if (isDysonAssemblyStyleListing(titleText)) {
    score -= 0.9;
  }

  if (isDysonUnitPartStyleListing(titleText)) {
    score -= 1.1;
  }

  if (isDysonFaultyStyleListing(titleText)) {
    score -= 1.2;
  }

  return score;
}

function enrichDysonCompPool(searchText, items = []) {
  return (Array.isArray(items) ? items : [])
    .map((item) => ({
      item,
      total: roundMoney(
        Number(item?.totalBuyPrice || 0) ||
          (
            Number(item?.price?.value ?? item?.currentPrice?.value ?? item?.sellingStatus?.currentPrice?.value ?? item?.price ?? 0) +
            Number(item?.shippingOptions?.[0]?.shippingCost?.value ?? item?.shippingCost?.value ?? item?.shipping ?? 0)
          )
      ),
      score: scoreDysonTitleAgainstQuery(searchText, item),
    }))
    .filter((entry) => entry.total > 0)
    .sort((a, b) => b.score - a.score);
}

function uniqueRoundedValues(values = []) {
  const seen = new Set();
  const result = [];

  for (const raw of values) {
    const value = roundMoney(raw);
    if (!value || !Number.isFinite(value)) continue;
    const key = value.toFixed(2);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(value);
  }

  return result;
}

function buildLowCompFallbackTotals(searchText, marketPool = [], listingPool = []) {
  const isMainUnit =
    searchText.includes("main unit") ||
    searchText.includes("main body") ||
    searchText.includes("body only") ||
    searchText.includes("motor unit") ||
    searchText.includes("bare unit") ||
    searchText.includes("unit only") ||
    searchText.includes("handheld unit") ||
    searchText.includes("machine body") ||
    searchText.includes("vacuum body") ||
    searchText.includes("body");

  const isOutsize = searchText.includes("outsize");

  const relaxedMarket = marketPool
    .filter((entry) => entry.score >= (isMainUnit || isOutsize ? 0.12 : 0.15))
    .slice(0, 16)
    .map((entry) => entry.total);

  const relaxedListings = listingPool
    .filter((entry) => entry.score >= (isMainUnit || isOutsize ? 0.12 : 0.15))
    .slice(0, 14)
    .map((entry) => entry.total);

  const combined = uniqueRoundedValues([...relaxedMarket, ...relaxedListings]);
  return removePriceOutliers(combined);
}

function buildDysonPricingModel(searchText, marketItems = [], listingItems = []) {
  const marketPool = enrichDysonCompPool(searchText, marketItems);
  const listingPool = enrichDysonCompPool(searchText, listingItems);

  const strongMarket = marketPool.filter((entry) => entry.score >= 0.4);
  const usableMarket = strongMarket.length >= 3 ? strongMarket : marketPool;

  const strongListings = listingPool.filter((entry) => entry.score >= 0.4);
  const usableListings = strongListings.length >= 2 ? strongListings : listingPool;

  let marketTotals = removePriceOutliers(usableMarket.map((entry) => entry.total));
  let listingTotals = removePriceOutliers(usableListings.map((entry) => entry.total));

  const isOutsize = searchText.includes("outsize");
  const isMainUnit =
    searchText.includes("main unit") ||
    searchText.includes("main body") ||
    searchText.includes("body only") ||
    searchText.includes("motor unit") ||
    searchText.includes("bare unit") ||
    searchText.includes("unit only") ||
    searchText.includes("handheld unit") ||
    searchText.includes("machine body") ||
    searchText.includes("vacuum body") ||
    searchText.includes("body");

  let pricingMode = "Market median";

  if (marketTotals.length < 3) {
    const fallbackTotals = buildLowCompFallbackTotals(searchText, marketPool, listingPool);

    if (fallbackTotals.length >= marketTotals.length) {
      marketTotals = fallbackTotals;
      pricingMode = "Low-comp fallback blend";
    }

    if (listingTotals.length < 2 && fallbackTotals.length >= 2) {
      listingTotals = fallbackTotals;
    }
  }

  const marketMedian = median(marketTotals);
  const marketLow = percentile(marketTotals, 0.35);
  const listingMedian = median(listingTotals);

  let baseline = marketMedian || marketLow || listingMedian || 0;

  if (!baseline && listingMedian) {
    baseline = listingMedian;
  }

  if (!marketMedian && listingMedian) pricingMode = "Listings median fallback";
  if (!marketMedian && !listingMedian && marketLow) pricingMode = "Market low-band";

  let conservativeMultiplier = 0.95;
  if (isOutsize) conservativeMultiplier = 0.97;
  else if (isMainUnit) conservativeMultiplier = 0.98;

  let estimatedResale = roundMoney(baseline * conservativeMultiplier);

  if (isOutsize && marketMedian && listingMedian) {
    estimatedResale = roundMoney(
      Math.max(estimatedResale, marketMedian * 0.96, listingMedian * 0.93)
    );
    pricingMode =
      pricingMode === "Low-comp fallback blend"
        ? "Outsize fallback blend"
        : "Outsize weighted median";
  }

  if (isMainUnit) {
    if (marketMedian && listingMedian) {
      estimatedResale = roundMoney(
        Math.max(estimatedResale, marketMedian * 0.97, listingMedian * 0.94)
      );
      pricingMode =
        pricingMode === "Low-comp fallback blend"
          ? "Main unit fallback blend"
          : "Main unit weighted median";
    } else if (marketMedian) {
      estimatedResale = roundMoney(Math.max(estimatedResale, marketMedian * 0.97));
      pricingMode = "Main unit fallback blend";
    } else if (listingMedian) {
      estimatedResale = roundMoney(Math.max(estimatedResale, listingMedian * 0.94));
      pricingMode = "Main unit listings fallback";
    }
  }

  const compCount = marketTotals.length;
  let confidence = 24;
  if (compCount >= 3) confidence = 55;
  if (compCount >= 5) confidence = 70;
  if (compCount >= 8) confidence = 84;

  if (usableMarket.length >= 5) confidence += 4;
  if (strongMarket.length >= 5) confidence += 4;
  if (usableListings.length >= 4) confidence += 3;

  if (isMainUnit && compCount >= 3) {
    confidence += 4;
  }

  if (pricingMode.includes("fallback")) {
    confidence = Math.min(confidence, 72);
  }

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

function getDysonListingWarnings(item, queryContext) {
  const titleText = normalizeText(extractItemTitle(item));
  const warnings = [];
  let penalty = 0;

  if (isDysonHousingStyleListing(titleText)) {
    warnings.push("Title suggests housing or shell style parts, not a clean resale-ready main unit.");
    penalty += 55;
  }

  if (isDysonAssemblyStyleListing(titleText)) {
    warnings.push("Title suggests an assembly listing rather than a straightforward working main motor unit.");
    penalty += 35;
  }

  if (isDysonUnitPartStyleListing(titleText)) {
    warnings.push("Title reads like a part-number style component listing rather than a complete main unit.");
    penalty += 55;
  }

  if (isDysonFaultyStyleListing(titleText)) {
    warnings.push("Fault wording detected in the title, so resale risk is much higher.");
    penalty += 80;
  }

  if (
    queryContext?.isMainUnit &&
    isDysonPartsCategory(item) &&
    !hasStrongWorkingSignals(titleText)
  ) {
    warnings.push("This is in a parts category and the title does not clearly confirm fully working condition.");
    penalty += 12;
  }

  return {
    warningFlags: warnings,
    warningScorePenalty: penalty,
  };
}

export const dysonEngine = {
  ...baseEngine,
  id: "dyson",

  detect(query = "") {
    return normalizeText(query).includes("dyson");
  },

  classifyQuery(query = "") {
    const searchText = normalizeText(query);

    const isV11 = searchText.includes("v11");
    const isOutsize = searchText.includes("outsize");
    const isMainUnit =
      searchText.includes("main unit") ||
      searchText.includes("main body") ||
      searchText.includes("body only") ||
      searchText.includes("motor unit") ||
      searchText.includes("bare unit") ||
      searchText.includes("unit only") ||
      searchText.includes("handheld unit") ||
      searchText.includes("machine body") ||
      searchText.includes("vacuum body") ||
      searchText.includes("body");

    return {
      rawQuery: String(query || "").trim(),
      normalizedQuery: searchText,
      family: isV11 ? "dyson_v11" : "dyson_generic",
      subtype: isOutsize ? "outsize" : isMainUnit ? "main_unit" : "full_machine",
      isV11,
      isOutsize,
      isMainUnit,
    };
  },

  expandSearchVariants(query = "") {
    const q = normalizeText(query);
    const variants = [String(query).trim()];

    const isDyson = q.includes("dyson");
    const isV11 = q.includes("v11");
    const isOutsize = q.includes("outsize");
    const isMainUnit =
      q.includes("main unit") ||
      q.includes("main body") ||
      q.includes("body only") ||
      q.includes("motor unit") ||
      q.includes("bare unit") ||
      q.includes("unit only") ||
      q.includes("handheld unit") ||
      q.includes("machine body") ||
      q.includes("vacuum body") ||
      q.includes("body");

    if (!isDyson) {
      return variants.filter(Boolean);
    }

    if (isOutsize) {
      variants.push("dyson v11 outsize");
      variants.push("dyson outsize");
      variants.push("dyson outsize absolute");
      variants.push("dyson v11 outsize absolute");
    } else if (isMainUnit) {
      if (isV11) {
        variants.push("dyson v11 main unit");
        variants.push("dyson v11 main body");
        variants.push("dyson v11 motor unit");
        variants.push("dyson v11 body only");
      } else {
        variants.push("dyson main unit");
        variants.push("dyson main body");
        variants.push("dyson motor unit");
        variants.push("dyson body only");
      }
    } else if (isV11) {
      variants.push("dyson v11");
      variants.push("dyson v11 absolute");
      variants.push("dyson v11 cordless vacuum");
      variants.push("dyson cordless stick vacuum cleaner v11");
    }

    return [...new Set(variants.filter(Boolean))];
  },

  matchesItem(item, queryContext) {
    return matchesDysonVariant(queryContext?.normalizedQuery || "", item);
  },

  buildPricingModel({ queryContext, marketItems = [], listingItems = [] }) {
    return buildDysonPricingModel(
      queryContext?.normalizedQuery || "",
      marketItems,
      listingItems
    );
  },

  adjustListingPricing({ item, queryContext, pricingModel }) {
    const baseEstimatedResale = roundMoney(pricingModel?.estimatedResale || 0);
    const warningData = getDysonListingWarnings(item, queryContext);
    const titleText = normalizeText(extractItemTitle(item));

    let estimatedResale = baseEstimatedResale;

    if (isDysonFaultyStyleListing(titleText)) {
      estimatedResale = roundMoney(baseEstimatedResale * 0.55);
    } else if (isDysonHousingStyleListing(titleText) || isDysonUnitPartStyleListing(titleText)) {
      estimatedResale = roundMoney(baseEstimatedResale * 0.5);
    } else if (isDysonAssemblyStyleListing(titleText)) {
      estimatedResale = roundMoney(baseEstimatedResale * 0.68);
    } else if (isDysonPartsCategory(item) && !hasStrongWorkingSignals(titleText)) {
      estimatedResale = roundMoney(baseEstimatedResale * 0.92);
    }

    return {
      estimatedResale,
      bundleValueBonus: 0,
      warningFlags: warningData.warningFlags,
      warningScorePenalty: warningData.warningScorePenalty,
      bundleSignals: {},
      bundleType: "standard",
    };
  },
};

export {
  matchesDysonVariant,
  isDysonPartsCategory,
  isDysonAccessoryOrParts,
  isDysonMainUnitListing,
  isDysonFullMachineListing,
};
