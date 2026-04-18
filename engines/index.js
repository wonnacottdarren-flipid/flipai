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
  ["ps5_disc", ["ps5 disc", "playstation 5 disc", "ps5 standard", "playstation 5 standard", "standard edition", "disc edition", "disk edition", "cfi 1116a", "cfi 1216a"]],
  ["ps5_digital", ["ps5 digital", "playstation 5 digital", "digital edition", "cfi 1116b", "cfi 1216b"]],
  ["xbox_series_x", ["xbox series x", "series x"]],
  ["xbox_series_s", ["xbox series s", "series s"]],
  ["switch_oled", ["switch oled", "nintendo switch oled", "oled model"]],
  ["switch_lite", ["switch lite", "nintendo switch lite"]],
  ["switch_v2", ["nintendo switch", "switch console"]],
];

function hasAny(text, phrases = []) {
  return phrases.some((phrase) => text.includes(phrase));
}

function normalizeConsoleText(value) {
  return normalizeText(String(value || ""))
    .replace(/\bps\s*5\b/g, "ps5")
    .replace(/\bplaystation\s*5\b/g, "playstation5")
    .replace(/\bplaystation 5\b/g, "playstation5")
    .replace(/\bsony ps5\b/g, "ps5")
    .replace(/\bps5 slim\b/g, "ps5")
    .replace(/\bplaystation5 slim\b/g, "playstation5")
    .replace(/\bdisk edition\b/g, "disc edition");
}

function getCombinedItemText(item) {
  return normalizeConsoleText(
    [
      item?.title,
      item?.subtitle,
      item?.condition,
      item?.conditionDisplayName,
      item?.itemCondition,
    ]
      .filter(Boolean)
      .join(" ")
  );
}

function getCategoryText(item) {
  const categories = Array.isArray(item?.categories) ? item.categories : [];
  return normalizeConsoleText(
    categories
      .map((category) => category?.categoryName)
      .filter(Boolean)
      .join(" ")
  );
}

function detectConsoleBrand(text) {
  const t = normalizeConsoleText(text);

  if (t.includes("ps5") || t.includes("playstation5")) return "playstation";
  if (t.includes("xbox")) return "xbox";
  if (t.includes("switch") || t.includes("nintendo")) return "nintendo";

  return "";
}

function parseConsoleFamily(text) {
  const t = normalizeConsoleText(text);

  for (const [family, patterns] of CONSOLE_FAMILIES) {
    if (patterns.some((pattern) => t.includes(normalizeConsoleText(pattern)))) {
      return family;
    }
  }

  return "";
}

function isBareAccessoryTitle(text) {
  const t = normalizeConsoleText(text);

  const hasConsoleWords =
    t.includes("ps5") ||
    t.includes("playstation5") ||
    t.includes("xbox series x") ||
    t.includes("xbox series s") ||
    t.includes("switch") ||
    t.includes("console");

  const hasControllerAccessoryWords = hasAny(t, [
    "dualsense",
    "dualshock",
    "dual shock",
    "joy con",
    "joy-con",
    "media remote",
    "headset",
    "charger",
    "charging dock",
    "dock station",
    "hdmi cable",
    "faceplate",
    "face plate",
    "shell only",
    "replacement shell",
    "replacement housing",
    "cover only",
    "skin only",
    "case only",
    "thumb grips",
    "remote only",
    "disc drive only",
    "disc reader only",
    "mount only",
    "fan only",
  ]);

  const explicitAccessoryOnly = hasAny(t, [
    "controller only",
    "dualsense only",
    "dualshock only",
    "joy con only",
    "joy-con only",
    "headset only",
    "dock only",
    "charger only",
    "power cable only",
    "cable only",
    "stand only",
    "vertical stand",
    "base stand",
    "empty box",
    "box only",
    "manual only",
    "console stand",
  ]);

  if (explicitAccessoryOnly) return true;

  if (hasControllerAccessoryWords && !hasConsoleWords) {
    return true;
  }

  if (
    t.includes("controller") &&
    !t.includes("console") &&
    !t.includes("ps5") &&
    !t.includes("playstation5") &&
    !t.includes("xbox") &&
    !t.includes("switch")
  ) {
    return true;
  }

  return false;
}

function isAccessoryCategory(item) {
  const categoryText = getCategoryText(item);

  return hasAny(categoryText, [
    "controllers attachments",
    "controllers and attachments",
    "video game accessories",
    "accessories",
    "headsets",
    "chargers docks",
    "chargers and docks",
    "replacement parts tools",
    "replacement parts and tools",
    "bags skins travel",
    "bags skins and travel",
  ]);
}

function isConsoleAccessoryOnly(itemOrText) {
  if (typeof itemOrText === "string") {
    return isBareAccessoryTitle(itemOrText);
  }

  const item = itemOrText || {};
  const text = getCombinedItemText(item);

  if (isBareAccessoryTitle(text)) return true;
  if (isAccessoryCategory(item)) return true;

  return false;
}

function isSeverelyBadConsole(text) {
  const t = normalizeConsoleText(text);

  return hasAny(t, [
    "for parts",
    "for spares",
    "spares or repairs",
    "spares repairs",
    "faulty",
    "broken",
    "not working",
    "no power",
    "wont turn on",
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
  const t = normalizeConsoleText(text);

  if (
    hasAny(t, [
      "for parts",
      "for spares",
      "spares or repairs",
      "spares repairs",
      "faulty",
      "broken",
      "not working",
      "no power",
      "wont turn on",
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
      "unboxed",
      "read caption",
      "read description",
    ])
  ) {
    return "minor_fault";
  }

  return "clean_working";
}

function shouldAllowDamagedConsoles(queryContext) {
  const q = normalizeConsoleText(queryContext?.normalizedQuery || "");

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
  const t = normalizeConsoleText(text);

  if (family.startsWith("switch")) {
    if (hasAny(t, ["tablet only", "console only", "no joy cons", "no joy-cons"])) return false;
    if (hasAny(t, ["joy con included", "joy-cons included", "with joy cons", "with joy-cons"])) return true;
    return true;
  }

  if (hasAny(t, ["no controller", "without controller", "missing controller"])) return false;
  if (hasAny(t, ["with controller", "controller included", "pad included"])) return true;

  return true;
}

function detectExtraControllerCount(text) {
  const t = normalizeConsoleText(text);

  if (hasAny(t, ["4 controllers", "four controllers"])) return 3;
  if (hasAny(t, ["3 controllers", "three controllers"])) return 2;
  if (hasAny(t, ["2 controllers", "two controllers", "extra controller", "second controller", "spare controller"])) return 1;
  return 0;
}

function detectIncludedGamesCount(text) {
  const t = normalizeConsoleText(text);

  if (hasAny(t, ["10 games", "10x games", "ten games"])) return 10;
  if (hasAny(t, ["8 games", "eight games"])) return 8;
  if (hasAny(t, ["6 games", "six games"])) return 6;
  if (hasAny(t, ["5 games", "five games"])) return 5;
  if (hasAny(t, ["4 games", "four games"])) return 4;
  if (hasAny(t, ["3 games", "three games"])) return 3;
  if (hasAny(t, ["2 games", "two games"])) return 2;
  if (hasAny(t, ["with game", "with games", "game included", "games included"])) return 1;
  return 0;
}

function detectBundleSignals(text, family) {
  const t = normalizeConsoleText(text);
  const extraControllerCount = detectExtraControllerCount(t);
  const includedGamesCount = detectIncludedGamesCount(t);

  const hasBox =
    hasAny(t, ["boxed", "box included", "original box", "complete in box"]) ? 1 : 0;

  const hasAccessories =
    hasAny(t, [
      "with headset",
      "with charging station",
      "with dock",
      "with camera",
      "with media remote",
      "with accessories",
      "extras included",
      "with extra accessories",
    ]) ? 1 : 0;

  const explicitBundleWords =
    hasAny(t, [
      "bundle",
      "job lot",
      "comes with",
      "includes",
      "included",
      "plus games",
      "plus controller",
      "with games",
      "with controller",
      "with 2 controllers",
      "with two controllers",
    ]) ? 1 : 0;

  let bundleType = "standard";

  if (!hasControllerIncluded(t, family)) {
    bundleType = "console_only";
  }

  if (hasBox) {
    bundleType = "boxed";
  }

  if (
    explicitBundleWords ||
    extraControllerCount > 0 ||
    includedGamesCount > 0 ||
    hasAccessories
  ) {
    bundleType = "bundle";
  }

  return {
    bundleType,
    extraControllerCount,
    includedGamesCount,
    hasBox: Boolean(hasBox),
    hasAccessories: Boolean(hasAccessories),
    explicitBundleWords: Boolean(explicitBundleWords),
  };
}

function estimateConsoleRepairCost(queryContext, conditionState, text) {
  const t = normalizeConsoleText(text);
  const family = String(queryContext?.family || "");

  if (conditionState === "faulty_or_parts") {
    if (family.startsWith("ps5")) return 90;
    if (family.startsWith("xbox_series")) return 80;
    if (family.startsWith("switch")) return 65;
    return 75;
  }

  if (conditionState === "minor_fault") {
    if (hasAny(t, ["no controller", "missing controller"])) {
      if (family.startsWith("ps5")) return 30;
      if (family.startsWith("xbox_series")) return 28;
      if (family.startsWith("switch")) return 35;
    }

    if (hasAny(t, ["poor condition", "heavy wear", "bad condition"])) {
      return 15;
    }

    return 12;
  }

  return 0;
}

function matchesConsoleFamily(text, queryContext) {
  const t = normalizeConsoleText(text);
  const family = String(queryContext?.family || "");

  if (!family) return true;

  if (family === "ps5_disc") {
    const hasPs5 = t.includes("ps5") || t.includes("playstation5");
    const saysDigital = t.includes("digital") || t.includes("digital edition");
    return hasPs5 && !saysDigital;
  }

  if (family === "ps5_digital") {
    const hasPs5 = t.includes("ps5") || t.includes("playstation5");
    const saysDigital = t.includes("digital") || t.includes("digital edition");
    return hasPs5 && saysDigital;
  }

  if (family === "xbox_series_x") {
    const hasSeriesX = t.includes("xbox series x") || t.includes("series x");
    const saysSeriesS = t.includes("xbox series s") || t.includes("series s");
    return hasSeriesX && !saysSeriesS;
  }

  if (family === "xbox_series_s") {
    const hasSeriesS = t.includes("xbox series s") || t.includes("series s");
    const saysSeriesX = t.includes("xbox series x") || t.includes("series x");
    return hasSeriesS && !saysSeriesX;
  }

  if (family === "switch_oled") {
    return t.includes("switch") && t.includes("oled");
  }

  if (family === "switch_lite") {
    return t.includes("switch") && t.includes("lite");
  }

  if (family === "switch_v2") {
    const hasSwitch = t.includes("switch") || t.includes("nintendo switch");
    const saysOled = t.includes("oled");
    const saysLite = t.includes("lite");
    return hasSwitch && !saysOled && !saysLite;
  }

  return true;
}

function estimateBundleValueBonus(queryContext, bundleSignals, text) {
  const family = String(queryContext?.family || "");
  const t = normalizeConsoleText(text);
  const extraControllerCount = Number(bundleSignals?.extraControllerCount || 0);
  const includedGamesCount = Number(bundleSignals?.includedGamesCount || 0);
  const hasBox = Boolean(bundleSignals?.hasBox);
  const hasAccessories = Boolean(bundleSignals?.hasAccessories);

  let bonus = 0;

  if (family.startsWith("ps5")) {
    bonus += extraControllerCount * 35;
    bonus += Math.min(includedGamesCount, 6) * 12;
    if (hasBox) bonus += 8;
    if (hasAccessories) bonus += 10;

    if (hasAny(t, ["fifa", "fc 24", "fc24", "cod", "call of duty", "spiderman", "spider man", "gow", "god of war", "gran turismo", "gta"])) {
      bonus += 10;
    }
  } else if (family.startsWith("xbox_series")) {
    bonus += extraControllerCount * 30;
    bonus += Math.min(includedGamesCount, 6) * 10;
    if (hasBox) bonus += 8;
    if (hasAccessories) bonus += 8;
  } else if (family.startsWith("switch")) {
    bonus += extraControllerCount * 28;
    bonus += Math.min(includedGamesCount, 6) * 9;
    if (hasBox) bonus += 10;
    if (hasAccessories) bonus += 10;
  } else {
    bonus += extraControllerCount * 25;
    bonus += Math.min(includedGamesCount, 6) * 8;
    if (hasBox) bonus += 8;
    if (hasAccessories) bonus += 8;
  }

  return roundMoney(bonus);
}

function buildConsoleWarningFlags(text, queryContext, bundleSignals) {
  const t = normalizeConsoleText(text);
  const flags = [];

  if (hasAny(t, ["read description", "read desc", "see description"])) {
    flags.push("Read description carefully");
  }

  if (hasAny(t, ["read caption", "see caption"])) {
    flags.push("Seller may have important notes in caption");
  }

  if (hasAny(t, ["no controller", "missing controller", "without controller"])) {
    flags.push("No controller included");
  }

  if (hasAny(t, ["console only", "unit only", "tablet only"])) {
    flags.push("Console-only listing");
  }

  if (hasAny(t, ["unboxed", "no box", "without box"])) {
    flags.push("No box included");
  }

  if (hasAny(t, ["poor condition", "heavy wear", "bad condition", "fair condition", "worn"])) {
    flags.push("Condition may reduce resale appeal");
  }

  if (hasAny(t, ["scratches", "scratched", "cosmetic marks", "cosmetic wear"])) {
    flags.push("Visible cosmetic wear mentioned");
  }

  if (hasAny(t, ["upcoming giveaway", "giveaway", "for giveaway"])) {
    flags.push("Listing wording looks unusual");
  }

  if (hasAny(t, ["low firmware", "jailbreak", "modded", "modded firmware"])) {
    flags.push("Specialist buyer wording");
  }

  if (
    queryContext?.wantsBundle &&
    (!bundleSignals || bundleSignals.bundleType !== "bundle")
  ) {
    flags.push("Bundle intent was searched, but extras look weak");
  }

  return flags;
}

function calculateWarningPenalty(flags = []) {
  let penalty = 0;

  for (const flag of flags) {
    if (flag === "Read description carefully") penalty += 8;
    else if (flag === "Seller may have important notes in caption") penalty += 6;
    else if (flag === "No controller included") penalty += 10;
    else if (flag === "Console-only listing") penalty += 6;
    else if (flag === "No box included") penalty += 2;
    else if (flag === "Condition may reduce resale appeal") penalty += 5;
    else if (flag === "Visible cosmetic wear mentioned") penalty += 4;
    else if (flag === "Listing wording looks unusual") penalty += 7;
    else if (flag === "Specialist buyer wording") penalty += 4;
    else if (flag === "Bundle intent was searched, but extras look weak") penalty += 6;
  }

  return penalty;
}

function getDiscDigitalPricingBias(queryContext, text) {
  const family = String(queryContext?.family || "");
  const t = normalizeConsoleText(text);

  if (family === "ps5_disc") {
    if (hasAny(t, ["disc edition", "disk edition", "standard edition", "cfi 1116a", "cfi 1216a"])) {
      return 15;
    }
    return 8;
  }

  if (family === "ps5_digital") {
    if (hasAny(t, ["digital edition", "cfi 1116b", "cfi 1216b"])) {
      return -8;
    }
    return -5;
  }

  return 0;
}

function scoreConsoleCandidate(item, queryContext) {
  const text = getCombinedItemText(item);

  if (!text) return -10;
  if (isConsoleAccessoryOnly(item)) return -10;
  if (isSeverelyBadConsole(text) && !shouldAllowDamagedConsoles(queryContext)) return -10;

  const conditionState = classifyConsoleConditionState(text);
  const allowDamaged = shouldAllowDamagedConsoles(queryContext);

  if (!allowDamaged && isDamagedConsoleConditionState(conditionState)) {
    return -10;
  }

  let score = 0;

  const itemBrand = detectConsoleBrand(text);
  const bundleSignals = detectBundleSignals(text, queryContext.family || "");
  const bundleType = bundleSignals.bundleType;

  if (queryContext.brand) {
    if (itemBrand === queryContext.brand) score += 1.2;
    else return -10;
  }

  if (matchesConsoleFamily(text, queryContext)) {
    score += 5;
  } else {
    return -10;
  }

  if (conditionState === "clean_working") score += 1.5;
  if (conditionState === "minor_fault") score -= 2;
  if (conditionState === "faulty_or_parts") score -= 8;

  if (bundleType === "bundle") score += 1.3;
  if (bundleType === "boxed") score += 0.5;
  if (bundleType === "console_only") score -= 1.5;

  score += Math.min(bundleSignals.extraControllerCount, 2) * 0.6;
  score += Math.min(bundleSignals.includedGamesCount, 4) * 0.2;
  if (bundleSignals.hasAccessories) score += 0.25;
  if (bundleSignals.explicitBundleWords) score += 0.35;

  if (queryContext.family === "ps5_disc" && hasAny(text, ["disc edition", "disk edition", "standard edition"])) {
    score += 1;
  }

  if (queryContext.family === "ps5_digital" && hasAny(text, ["digital edition"])) {
    score += 1;
  }

  const warningFlags = buildConsoleWarningFlags(text, queryContext, bundleSignals);
  const warningPenalty = calculateWarningPenalty(warningFlags);

  return score - warningPenalty * 0.08;
}

function enrichConsoleCompPool(queryContext, items = []) {
  return (Array.isArray(items) ? items : [])
    .map((item) => {
      const text = getCombinedItemText(item);
      const bundleSignals = detectBundleSignals(text, queryContext.family || "");
      const bundleValueBonus = estimateBundleValueBonus(queryContext, bundleSignals, text);
      const warningFlags = buildConsoleWarningFlags(text, queryContext, bundleSignals);
      const warningPenalty = calculateWarningPenalty(warningFlags);
      const discDigitalBias = getDiscDigitalPricingBias(queryContext, text);

      return {
        item,
        total: extractTotalPrice(item),
        adjustedTotal: roundMoney(
          extractTotalPrice(item) -
            bundleValueBonus +
            Math.min(warningPenalty, 12) +
            discDigitalBias * -1
        ),
        score: scoreConsoleCandidate(item, queryContext),
        conditionState: classifyConsoleConditionState(text),
        bundleType: bundleSignals.bundleType,
        bundleSignals,
        bundleValueBonus,
        warningFlags,
        warningPenalty,
        discDigitalBias,
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
      .slice(0, 24)
      .map((entry) => entry.adjustedTotal)
  );

  let listingTotals = removePriceOutliers(
    (usableListings.length ? usableListings : listingConditionPool)
      .slice(0, 16)
      .map((entry) => entry.adjustedTotal)
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

  if (queryContext.family === "ps5_disc") {
    baseline = roundMoney(baseline + 12);
    pricingMode = "PS5 disc median";
  } else if (queryContext.family === "ps5_digital") {
    baseline = roundMoney(Math.max(0, baseline - 8));
    pricingMode = "PS5 digital median";
  } else if (queryContext.family === "xbox_series_x") {
    pricingMode = "Series X median";
  } else if (queryContext.family === "xbox_series_s") {
    pricingMode = "Series S median";
  }

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
    listingMedian: roundMoney(listingTotals.length ? listingMedian : 0),
  };
}

function applyBundleValueToListing(queryContext, item, baseResale) {
  const text = getCombinedItemText(item);
  const bundleSignals = detectBundleSignals(text, queryContext.family || "");
  const bundleValueBonus = estimateBundleValueBonus(queryContext, bundleSignals, text);
  const warningFlags = buildConsoleWarningFlags(text, queryContext, bundleSignals);
  const warningPenalty = calculateWarningPenalty(warningFlags);
  const discDigitalBias = getDiscDigitalPricingBias(queryContext, text);

  return {
    bundleSignals,
    bundleType: bundleSignals.bundleType,
    bundleValueBonus,
    warningFlags,
    warningScorePenalty: warningPenalty,
    estimatedResale: roundMoney(
      Number(baseResale || 0) + bundleValueBonus + discDigitalBias
    ),
  };
}

export const consoleEngine = {
  ...baseEngine,
  id: "console",

  detect(query = "") {
    const text = normalizeConsoleText(query);

    return (
      text.includes("ps5") ||
      text.includes("playstation5") ||
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
    const normalizedQuery = normalizeConsoleText(rawQuery);
    const brand = detectConsoleBrand(normalizedQuery);
    const family = parseConsoleFamily(normalizedQuery);
    const allowDamaged = shouldAllowDamagedConsoles({ normalizedQuery });

    const wantsBundle =
      normalizedQuery.includes("bundle") ||
      normalizedQuery.includes("with games") ||
      normalizedQuery.includes("with controller") ||
      normalizedQuery.includes("controllers") ||
      normalizedQuery.includes("games") ||
      normalizedQuery.includes("job lot") ||
      normalizedQuery.includes("comes with") ||
      normalizedQuery.includes("includes");

    return {
      rawQuery,
      normalizedQuery,
      brand,
      family,
      allowDamaged,
      wantsBundle,
    };
  },

  expandSearchVariants(query = "") {
    const rawQuery = String(query || "").trim();
    const ctx = this.classifyQuery(rawQuery);
    const variants = [rawQuery];

    if (ctx.family === "ps5_disc") {
      variants.push("ps5");
      variants.push("ps 5");
      variants.push("ps5 console");
      variants.push("sony ps5");
      variants.push("playstation 5");
      variants.push("playstation5");
      variants.push("playstation 5 console");
      variants.push("playstation5 console");
      variants.push("playstation 5 standard");
      variants.push("ps5 standard");
      variants.push("disc edition");
      variants.push("disk edition");
      variants.push("standard edition");
      variants.push("ps5 bundle");
      variants.push("ps5 with games");
      variants.push("ps5 2 controllers");
      variants.push("ps5 with controller");
    }

    if (ctx.family === "ps5_digital") {
      variants.push("ps5 digital");
      variants.push("playstation 5 digital");
      variants.push("playstation5 digital");
      variants.push("digital edition");
      variants.push("ps5 digital bundle");
      variants.push("ps5 digital with games");
    }

    if (ctx.family === "xbox_series_x") {
      variants.push("xbox series x");
      variants.push("series x");
      variants.push("xbox x console");
      variants.push("xbox series x bundle");
      variants.push("xbox series x with games");
    }

    if (ctx.family === "xbox_series_s") {
      variants.push("xbox series s");
      variants.push("series s");
      variants.push("xbox s console");
      variants.push("xbox series s bundle");
      variants.push("xbox series s with games");
    }

    if (ctx.family === "switch_oled") {
      variants.push("switch oled");
      variants.push("nintendo switch oled");
      variants.push("oled model");
      variants.push("switch oled bundle");
      variants.push("switch oled with games");
    }

    if (ctx.family === "switch_lite") {
      variants.push("switch lite");
      variants.push("nintendo switch lite");
      variants.push("switch lite bundle");
      variants.push("switch lite with games");
    }

    if (ctx.family === "switch_v2") {
      variants.push("nintendo switch");
      variants.push("switch console");
      variants.push("switch v2");
      variants.push("switch bundle");
      variants.push("switch with games");
    }

    return [...new Set(variants.filter(Boolean))];
  },

  matchesItem(item, queryContext) {
    const text = getCombinedItemText(item);

    if (!text) return false;
    if (isConsoleAccessoryOnly(item)) return false;
    if (isSeverelyBadConsole(text) && !queryContext.allowDamaged) return false;

    const conditionState = classifyConsoleConditionState(text);

    if (!queryContext.allowDamaged && isDamagedConsoleConditionState(conditionState)) {
      return false;
    }

    const itemBrand = detectConsoleBrand(text);
    if (queryContext.brand && itemBrand !== queryContext.brand) return false;

    if (!matchesConsoleFamily(text, queryContext)) {
      return false;
    }

    const bundleSignals = detectBundleSignals(text, queryContext.family || "");

    if (queryContext.wantsBundle) {
      const isRealBundle =
        bundleSignals.bundleType === "bundle" ||
        bundleSignals.extraControllerCount > 0 ||
        bundleSignals.includedGamesCount > 0 ||
        bundleSignals.explicitBundleWords;

      if (!isRealBundle) {
        return false;
      }
    }

    return true;
  },

  buildPricingModel({ queryContext, marketItems = [], listingItems = [] }) {
    return buildConsolePricingModel(queryContext, marketItems, listingItems);
  },

  classifyItem(item, queryContext) {
    const text = getCombinedItemText(item);
    const conditionState = classifyConsoleConditionState(text);
    const repairCost = estimateConsoleRepairCost(queryContext, conditionState, text);
    const bundleSignals = detectBundleSignals(text, queryContext.family || "");
    const bundleValueBonus = estimateBundleValueBonus(queryContext, bundleSignals, text);
    const warningFlags = buildConsoleWarningFlags(text, queryContext, bundleSignals);
    const warningScorePenalty = calculateWarningPenalty(warningFlags);

    return {
      conditionState,
      repairCost,
      bundleType: bundleSignals.bundleType,
      bundleSignals,
      bundleValueBonus,
      warningFlags,
      warningScorePenalty,
    };
  },

  adjustListingPricing({ queryContext, item, pricingModel }) {
    const baseResale = Number(pricingModel?.estimatedResale || 0);
    return applyBundleValueToListing(queryContext, item, baseResale);
  },
};
