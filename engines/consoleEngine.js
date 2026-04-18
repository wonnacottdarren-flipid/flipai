import {
  baseEngine,
  normalizeText,
  roundMoney,
  median,
  percentile,
  removePriceOutliers,
  extractTotalPrice,
} from "./baseEngine.js";

const CONSOLE_FAMILIES = [
  ["ps5_disc", ["ps5 disc", "playstation 5 disc", "ps5 standard", "playstation 5 standard"]],
  ["ps5_digital", ["ps5 digital", "playstation 5 digital"]],
  ["xbox_series_x", ["xbox series x", "series x"]],
  ["xbox_series_s", ["xbox series s", "series s"]],
  ["switch_oled", ["switch oled", "nintendo switch oled", "oled model"]],
  ["switch_lite", ["switch lite", "nintendo switch lite"]],
  ["switch_v2", ["nintendo switch", "switch console"]],
];

function hasAny(text, phrases = []) {
  return phrases.some((phrase) => text.includes(phrase));
}

function detectConsoleBrand(text) {
  const t = normalizeText(text);

  if (t.includes("ps5") || t.includes("playstation 5")) return "playstation";
  if (t.includes("xbox")) return "xbox";
  if (t.includes("switch") || t.includes("nintendo")) return "nintendo";

  return "";
}

function parseConsoleFamily(text) {
  const t = normalizeText(text);

  for (const [family, patterns] of CONSOLE_FAMILIES) {
    if (patterns.some((pattern) => t.includes(pattern))) {
      return family;
    }
  }

  return "";
}

function isConsoleAccessoryOnly(text) {
  const t = normalizeText(text);

  return hasAny(t, [
    "controller only",
    "pad only",
    "joy con only",
    "joy-con only",
    "dock only",
    "hdmi only",
    "power cable only",
    "charger only",
    "stand only",
    "vertical stand only",
    "base stand only",
    "faceplate only",
    "shell only",
    "cover only",
    "empty box",
    "box only",
    "manual only",
    "replacement shell",
    "replacement housing",
    "thumb grips",
    "skin only",
    "case only",
    "console stand",
  ]);
}

function isSeverelyBadConsole(text) {
  const t = normalizeText(text);

  return hasAny(t, [
    "for parts",
    "for spares",
    "spares or repairs",
    "spares/repairs",
    "faulty",
    "broken",
    "not working",
    "no power",
    "won't turn on",
    "will not turn on",
    "hdmi fault",
    "no hdmi",
    "repair required",
    "needs repair",
    "banned",
    "account locked",
    "console banned",
    "water damaged",
    "motherboard fault",
    "blue light of death",
    "overheating issue",
  ]);
}

function classifyConsoleConditionState(text) {
  const t = normalizeText(text);

  if (
    hasAny(t, [
      "for parts",
      "for spares",
      "spares or repairs",
      "spares/repairs",
      "faulty",
      "broken",
      "not working",
      "no power",
      "won't turn on",
      "will not turn on",
      "hdmi fault",
      "no hdmi",
      "repair required",
      "needs repair",
      "banned",
      "account locked",
      "console banned",
      "water damaged",
      "motherboard fault",
      "blue light of death",
      "overheating issue",
    ])
  ) {
    return "faulty_or_parts";
  }

  if (
    hasAny(t, [
      "poor condition",
      "heavy wear",
      "scratched badly",
      "bad condition",
      "fair condition",
      "missing controller",
      "no controller",
      "console only",
      "unit only",
      "tablet only",
    ])
  ) {
    return "minor_fault";
  }

  return "clean_working";
}

function shouldAllowDamagedConsoles(queryContext) {
  const q = normalizeText(queryContext?.normalizedQuery || "");

  return hasAny(q, [
    "faulty",
    "broken",
    "damaged",
    "for parts",
    "spares",
    "repairs",
    "no power",
    "no hdmi",
    "banned",
  ]);
}

function isDamagedConsoleConditionState(conditionState) {
  return conditionState === "minor_fault" || conditionState === "faulty_or_parts";
}

function hasControllerIncluded(text, family) {
  const t = normalizeText(text);

  if (family.startsWith("switch")) {
    if (hasAny(t, ["tablet only", "console only", "no joy cons", "no joy-cons"])) return false;
    if (hasAny(t, ["joy con included", "joy-cons included", "with joy cons", "with joy-cons"])) return true;
    return true;
  }

  if (hasAny(t, ["no controller", "without controller", "missing controller"])) return false;
  if (hasAny(t, ["with controller", "controller included", "pad included"])) return true;

  return true;
}

function classifyConsoleBundleType(text, family) {
  const t = normalizeText(text);

  if (hasAny(t, ["bundle", "with games", "2 controllers", "two controllers", "extra controller"])) {
    return "bundle";
  }

  if (hasAny(t, ["boxed", "box included", "original box"])) {
    return "boxed";
  }

  if (!hasControllerIncluded(t, family)) {
    return "console_only";
  }

  return "standard";
}

function estimateConsoleRepairCost(queryContext, conditionState, text) {
  const t = normalizeText(text);
  const family = String(queryContext?.family || "");

  if (conditionState === "faulty_or_parts") {
    if (family.startsWith("ps5")) return 90;
    if (family.startsWith("xbox_series")) return 80;
    if (family.startsWith("switch")) return 65;
    return 75;
  }

  if (conditionState === "minor_fault") {
    if (hasAny(t, ["no controller", "missing controller"])) {
      if (family.startsWith("ps5")) return 35;
      if (family.startsWith("xbox_series")) return 30;
      if (family.startsWith("switch")) return 40;
    }

    if (hasAny(t, ["poor condition", "heavy wear", "bad condition"])) {
      return 15;
    }

    return 20;
  }

  return 0;
}

function scoreConsoleCandidate(item, queryContext) {
  const text = normalizeText(
    [
      item?.title,
      item?.condition,
      item?.conditionDisplayName,
      item?.subtitle,
    ]
      .filter(Boolean)
      .join(" ")
  );

  if (!text) return -10;
  if (isConsoleAccessoryOnly(text)) return -10;
  if (isSeverelyBadConsole(text) && !shouldAllowDamagedConsoles(queryContext)) return -10;

  const conditionState = classifyConsoleConditionState(text);
  const allowDamaged = shouldAllowDamagedConsoles(queryContext);

  if (!allowDamaged && isDamagedConsoleConditionState(conditionState)) {
    return -10;
  }

  let score = 0;

  const itemBrand = detectConsoleBrand(text);
  const itemFamily = parseConsoleFamily(text);
  const bundleType = classifyConsoleBundleType(text, itemFamily || queryContext.family);

  if (queryContext.brand) {
    if (itemBrand === queryContext.brand) score += 1.2;
    else return -10;
  }

  if (queryContext.family) {
    if (itemFamily === queryContext.family) score += 5;
    else if (itemFamily && itemFamily !== queryContext.family) score -= 6;
    else score -= 1.5;
  }

  if (queryContext.family === "ps5_disc" && text.includes("digital")) score -= 8;
  if (queryContext.family === "ps5_digital" && text.includes("disc")) score -= 8;
  if (queryContext.family === "xbox_series_x" && text.includes("series s")) score -= 8;
  if (queryContext.family === "xbox_series_s" && text.includes("series x")) score -= 8;
  if (queryContext.family === "switch_oled" && !text.includes("oled")) score -= 4;
  if (queryContext.family === "switch_lite" && !text.includes("lite")) score -= 4;

  if (conditionState === "clean_working") score += 1.5;
  if (conditionState === "minor_fault") score -= 2;
  if (conditionState === "faulty_or_parts") score -= 8;

  if (bundleType === "bundle") score += 0.8;
  if (bundleType === "boxed") score += 0.5;
  if (bundleType === "console_only") score -= 1.5;

  return score;
}

function enrichConsoleCompPool(queryContext, items = []) {
  return (Array.isArray(items) ? items : [])
    .map((item) => {
      const text = normalizeText(
        [
          item?.title,
          item?.condition,
          item?.conditionDisplayName,
          item?.subtitle,
        ]
          .filter(Boolean)
          .join(" ")
      );

      return {
        item,
        total: extractTotalPrice(item),
        score: scoreConsoleCandidate(item, queryContext),
        conditionState: classifyConsoleConditionState(text),
      };
    })
    .filter((entry) => entry.total > 0 && entry.score > -5)
    .sort((a, b) => b.score - a.score);
}

function buildConsolePricingModel(queryContext, marketItems = [], listingItems = []) {
  const allowDamaged = shouldAllowDamagedConsoles(queryContext);

  const marketPool = enrichConsoleCompPool(queryContext, marketItems);
  const listingPool = enrichConsoleCompPool(queryContext, listingItems);

  const desiredConditionState = allowDamaged ? null : "clean_working";

  const marketConditionPool = desiredConditionState
    ? marketPool.filter((entry) => entry.conditionState === desiredConditionState)
    : marketPool;

  const listingConditionPool = desiredConditionState
    ? listingPool.filter((entry) => entry.conditionState === desiredConditionState)
    : listingPool;

  const exactMarket = marketConditionPool.filter((entry) => entry.score >= 5.5);
  const usableMarket =
    exactMarket.length >= 3
      ? exactMarket
      : marketConditionPool.filter((entry) => entry.score >= 2.5);

  const exactListings = listingConditionPool.filter((entry) => entry.score >= 5.5);
  const usableListings =
    exactListings.length >= 2
      ? exactListings
      : listingConditionPool.filter((entry) => entry.score >= 2.5);

  let marketTotals = removePriceOutliers(
    (usableMarket.length ? usableMarket : marketConditionPool)
      .slice(0, 20)
      .map((entry) => entry.total)
  );

  let listingTotals = removePriceOutliers(
    (usableListings.length ? usableListings : listingConditionPool)
      .slice(0, 14)
      .map((entry) => entry.total)
  );

  if (marketTotals.length < 3 && listingTotals.length >= 2) {
    marketTotals = removePriceOutliers([...marketTotals, ...listingTotals]);
  }

  if (listingTotals.length < 2 && marketTotals.length >= 2) {
    listingTotals = marketTotals.slice(0, 12);
  }

  const marketMedian = median(marketTotals);
  const marketLow = percentile(marketTotals, 0.35);
  const listingMedian = median(listingTotals);

  let pricingMode = "Console model median";
  let baseline = marketMedian || marketLow || listingMedian || 0;

  if (!marketMedian && listingMedian) pricingMode = "Console listings fallback";
  if (!marketMedian && !listingMedian && marketLow) pricingMode = "Console low-band fallback";

  let conservativeMultiplier = 0.95;
  if (exactMarket.length >= 5) conservativeMultiplier = 0.96;

  const estimatedResale = roundMoney(baseline * conservativeMultiplier);

  const compCount = marketTotals.length;

  let confidence = 24;
  if (compCount >= 3) confidence = 55;
  if (compCount >= 5) confidence = 70;
  if (compCount >= 8) confidence = 84;

  if (exactMarket.length >= 3) confidence += 4;
  if (exactMarket.length >= 5) confidence += 4;
  if (exactListings.length >= 3) confidence += 3;
  if (queryContext.family) confidence += 2;

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

export const consoleEngine = {
  ...baseEngine,
  id: "console",

  detect(query = "") {
    const text = normalizeText(query);

    return (
      text.includes("ps5") ||
      text.includes("playstation 5") ||
      text.includes("xbox series x") ||
      text.includes("xbox series s") ||
      text.includes("switch oled") ||
      text.includes("switch lite") ||
      text.includes("nintendo switch")
    );
  },

  classifyQuery(query = "") {
    const rawQuery = String(query || "").trim();
    const normalizedQuery = normalizeText(rawQuery);
    const brand = detectConsoleBrand(normalizedQuery);
    const family = parseConsoleFamily(normalizedQuery);
    const allowDamaged = shouldAllowDamagedConsoles({ normalizedQuery });

    return {
      rawQuery,
      normalizedQuery,
      brand,
      family,
      allowDamaged,
    };
  },

  expandSearchVariants(query = "") {
    const rawQuery = String(query || "").trim();
    const ctx = this.classifyQuery(rawQuery);
    const variants = [rawQuery];

    if (ctx.family === "ps5_disc") {
      variants.push("ps5 disc");
      variants.push("playstation 5 disc");
      variants.push("playstation 5 standard");
    }

    if (ctx.family === "ps5_digital") {
      variants.push("ps5 digital");
      variants.push("playstation 5 digital");
    }

    if (ctx.family === "xbox_series_x") {
      variants.push("xbox series x");
      variants.push("series x");
    }

    if (ctx.family === "xbox_series_s") {
      variants.push("xbox series s");
      variants.push("series s");
    }

    if (ctx.family === "switch_oled") {
      variants.push("switch oled");
      variants.push("nintendo switch oled");
      variants.push("oled model");
    }

    if (ctx.family === "switch_lite") {
      variants.push("switch lite");
      variants.push("nintendo switch lite");
    }

    if (ctx.family === "switch_v2") {
      variants.push("nintendo switch");
      variants.push("switch console");
    }

    return [...new Set(variants.filter(Boolean))];
  },

  matchesItem(item, queryContext) {
    const text = normalizeText(
      [
        item?.title,
        item?.condition,
        item?.conditionDisplayName,
        item?.subtitle,
      ]
        .filter(Boolean)
        .join(" ")
    );

    if (!text) return false;
    if (isConsoleAccessoryOnly(text)) return false;
    if (isSeverelyBadConsole(text) && !queryContext.allowDamaged) return false;

    const conditionState = classifyConsoleConditionState(text);

    if (!queryContext.allowDamaged && isDamagedConsoleConditionState(conditionState)) {
      return false;
    }

    const itemBrand = detectConsoleBrand(text);
    if (queryContext.brand && itemBrand !== queryContext.brand) return false;

    const itemFamily = parseConsoleFamily(text);
    if (queryContext.family && itemFamily && itemFamily !== queryContext.family) {
      return false;
    }

    if (queryContext.family === "ps5_disc" && text.includes("digital")) return false;
    if (queryContext.family === "ps5_digital" && text.includes("disc")) return false;
    if (queryContext.family === "xbox_series_x" && text.includes("series s")) return false;
    if (queryContext.family === "xbox_series_s" && text.includes("series x")) return false;
    if (queryContext.family === "switch_oled" && !text.includes("oled")) return false;
    if (queryContext.family === "switch_lite" && !text.includes("lite")) return false;

    return true;
  },

  buildPricingModel({ queryContext, marketItems = [], listingItems = [] }) {
    return buildConsolePricingModel(queryContext, marketItems, listingItems);
  },

  classifyItem(item, queryContext) {
    const text = normalizeText(
      [
        item?.title,
        item?.condition,
        item?.conditionDisplayName,
        item?.subtitle,
      ]
        .filter(Boolean)
        .join(" ")
    );

    const conditionState = classifyConsoleConditionState(text);
    const repairCost = estimateConsoleRepairCost(queryContext, conditionState, text);
    const bundleType = classifyConsoleBundleType(text, queryContext.family);

    return {
      conditionState,
      repairCost,
      bundleType,
    };
  },
};
