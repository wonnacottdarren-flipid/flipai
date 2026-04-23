import {
  roundMoney,
  median,
  percentile,
  removePriceOutliers,
  extractTotalPrice,
} from "./baseEngine.js";
import {
  MINOR_WARNING_TERMS,
  hasAny,
  normalizeConsoleText,
  getTitleText,
  getCombinedItemText,
  detectConsoleBrand,
  matchesConsoleFamily,
  detectBundleSignals,
  detectConsoleType,
  detectConsoleStorage,
  isConsoleCategory,
  looksLikeMainConsoleTitle,
  isDamagedConsoleConditionState,
  shouldAllowDamagedConsoles,
  isSeverelyBadConsole,
  isIncompleteSwitchConsole,
  isHardAccessoryListing,
  isClearlyNonConsole,
  classifyConsoleConditionState,
  hasReadDescriptionSignal,
  hasStrongCleanConditionSignal,
  hasFaultKeywordCombo,
  hasPs5DiscOddStorageWording,
  hasPs5DiscCustomStorageSignal,
  hasPs5DiscOddSlimVariant,
  hasPs5DiscVagueSpecSignal,
  detectSwitchGeneration,
  isGenericUnknownSwitchTitle,
  hasRiskySwitchWording,
  hasConfirmedCompleteSwitchV2Signals,
  getNintendoSwitchRankingAdjustment,
  getSwitchPricingBucket,
  isHomeConsoleOnlyListing,
  isStorageMismatch,
  isHardNonConsoleCategory,
  failsSharedConsoleGate,
} from "./consoleFilters.js";

const PS5_GAME_TERMS = [
  "fifa",
  "fc 24",
  "fc24",
  "fc 25",
  "fc25",
  "cod",
  "call of duty",
  "spiderman",
  "spider man",
  "spider-man",
  "gow",
  "god of war",
  "gran turismo",
  "gt7",
  "gta",
  "horizon",
  "last of us",
  "minecraft",
  "elden ring",
  "ratchet",
  "returnal",
  "ea sports fc",
  "astro bot",
];

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
    if (hasAny(t, ["doesnt read discs", "doesn't read discs", "wont read discs", "won't read discs"])) {
      return 25;
    }
    if (hasAny(t, ["hdmi issue"])) return 25;
    if (hasAny(t, ["overheating"])) return 20;
    if (hasAny(t, ["missing thumbstick"])) return 12;
    if (hasFaultKeywordCombo(t)) return 20;
    return 10;
  }

  if (hasAny(t, ["no controller", "missing controller"])) {
    if (family.startsWith("ps5")) return 30;
    if (family.startsWith("xbox_series")) return 28;
    if (family.startsWith("switch")) return 35;
  }

  return 0;
}

function estimateBundleValueBonus(queryContext, bundleSignals, text) {
  const family = String(queryContext?.family || "");
  const t = normalizeConsoleText(text);
  const extraControllerCount = Number(bundleSignals?.extraControllerCount || 0);
  const includedGamesCount = Number(bundleSignals?.includedGamesCount || 0);
  const hasBox = Boolean(bundleSignals?.hasBox);
  const hasAccessories = Boolean(bundleSignals?.hasAccessories);

  let bonus = 0;

  if (family.startsWith("ps5") || t.includes("ps5") || t.includes("playstation5")) {
    bonus += extraControllerCount * 30;
    bonus += Math.min(includedGamesCount, 5) * 9;
    if (hasBox) bonus += 5;
    if (hasAccessories) bonus += 6;
    if (PS5_GAME_TERMS.some((term) => t.includes(term))) bonus += 5;
  } else if (family.startsWith("xbox_series")) {
    bonus += extraControllerCount * 26;
    bonus += Math.min(includedGamesCount, 5) * 8;
    if (hasBox) bonus += 5;
    if (hasAccessories) bonus += 5;
  } else if (family.startsWith("switch")) {
    bonus += extraControllerCount * 24;
    bonus += Math.min(includedGamesCount, 5) * 7;
    if (hasBox) bonus += 6;
    if (hasAccessories) bonus += 6;
  } else {
    bonus += extraControllerCount * 22;
    bonus += Math.min(includedGamesCount, 5) * 7;
    if (hasBox) bonus += 5;
    if (hasAccessories) bonus += 5;
  }

  return roundMoney(bonus);
}

function buildConsoleWarningFlags(text, queryContext, bundleSignals, item = null) {
  const t = normalizeConsoleText(text);
  const flags = [];
  const family = String(queryContext?.family || "");
  const queryStorage = String(queryContext?.storagePreference || "");
  const itemStorage = detectConsoleStorage(t, family);
  const titleText = item ? getTitleText(item) : "";

  for (const [needle, flag] of MINOR_WARNING_TERMS) {
    if (t.includes(needle) && !flags.includes(flag)) {
      flags.push(flag);
    }
  }

  if (queryContext?.wantsBundle && (!bundleSignals || bundleSignals.bundleType !== "bundle")) {
    flags.push("Bundle intent was searched, but extras look weak");
  }

  if (
    queryContext?.wantsConsoleOnly &&
    bundleSignals &&
    bundleSignals.bundleType !== "console_only"
  ) {
    flags.push("Console-only intent was searched, but extras look stronger than expected");
  }

  if (hasReadDescriptionSignal(t) && hasFaultKeywordCombo(t)) {
    flags.push("Description suggests a likely fault");
  }

  if (
    family === "ps5_digital" &&
    hasReadDescriptionSignal(t) &&
    !hasStrongCleanConditionSignal(t)
  ) {
    flags.push("PS5 digital listing needs manual verification");
  }

  if (family === "ps5_disc") {
    if (hasPs5DiscOddStorageWording(t)) {
      flags.push("Odd PS5 disc storage wording");
    }

    if (hasPs5DiscCustomStorageSignal(t)) {
      flags.push("Custom PS5 disc storage upgrade");
    }

    if (hasPs5DiscOddSlimVariant(t)) {
      flags.push("Odd PS5 slim storage variant");
    }

    if (hasPs5DiscVagueSpecSignal(t)) {
      flags.push("PS5 disc spec not confirmed");
    }
  }

  if (family === "switch_v2") {
    const switchGeneration = detectSwitchGeneration(`${titleText} ${t}`);

    if (switchGeneration === "unknown" && !flags.includes("Unknown Switch version")) {
      flags.push("Unknown Switch version");
    }

    if (
      switchGeneration === "unknown" &&
      isGenericUnknownSwitchTitle(titleText) &&
      !flags.includes("Generic Switch title")
    ) {
      flags.push("Generic Switch title");
    }
  }

  if (
    (family === "switch_v2" || family === "switch_oled" || family === "switch_lite") &&
    hasRiskySwitchWording(`${titleText} ${t}`, family) &&
    !flags.includes("Risky Switch wording")
  ) {
    flags.push("Risky Switch wording");
  }

  if (
    queryStorage &&
    queryStorage !== "unknown" &&
    (!itemStorage || itemStorage === "unknown") &&
    (family === "ps5_digital" || family === "xbox_series_x" || family === "xbox_series_s")
  ) {
    flags.push("Storage not confirmed");
  }

  return flags;
}

function calculateWarningPenalty(flags = []) {
  let penalty = 0;

  for (const flag of flags) {
    if (flag === "Read description carefully") penalty += 5;
    else if (flag === "Seller may have important notes in caption") penalty += 3;
    else if (flag === "No returns accepted") penalty += 4;
    else if (flag === "Untested listing") penalty += 6;
    else if (flag === "No controller included") penalty += 10;
    else if (flag === "Console-only listing") penalty += 16;
    else if (flag === "No box included") penalty += 1;
    else if (flag === "Condition may reduce resale appeal") penalty += 6;
    else if (flag === "Visible cosmetic wear mentioned") penalty += 4;
    else if (flag === "Specialist buyer wording") penalty += 3;
    else if (flag === "Disc drive issue mentioned") penalty += 11;
    else if (flag === "HDMI issue mentioned") penalty += 11;
    else if (flag === "Overheating risk mentioned") penalty += 10;
    else if (flag === "Error wording mentioned") penalty += 12;
    else if (flag === "Issue wording mentioned") penalty += 10;
    else if (flag === "Stability issue mentioned") penalty += 12;
    else if (flag === "Boot or loading issue mentioned") penalty += 14;
    else if (flag === "Description suggests a likely fault") penalty += 16;
    else if (flag === "PS5 digital listing needs manual verification") penalty += 18;
    else if (flag === "Odd PS5 disc storage wording") penalty += 10;
    else if (flag === "Custom PS5 disc storage upgrade") penalty += 12;
    else if (flag === "Odd PS5 slim storage variant") penalty += 14;
    else if (flag === "PS5 disc spec not confirmed") penalty += 10;
    else if (flag === "Bundle intent was searched, but extras look weak") penalty += 3;
    else if (flag === "Console-only intent was searched, but extras look stronger than expected") penalty += 4;
    else if (flag === "Unknown Switch version") penalty += 12;
    else if (flag === "Generic Switch title") penalty += 10;
    else if (flag === "Risky Switch wording") penalty += 12;
    else if (flag === "Storage not confirmed") penalty += 4;
  }

  return penalty;
}

function getDiscDigitalPricingBias(queryContext, text) {
  const family = String(queryContext?.family || "");
  const consoleType = detectConsoleType(text, family);

  if (family === "ps5_disc") {
    if (consoleType === "disc") return 10;
    if (consoleType === "unknown") return 6;
    return -16;
  }

  if (family === "ps5_digital") {
    if (consoleType === "digital") return -4;
    if (consoleType === "unknown") return 4;
    return 10;
  }

  if (consoleType === "disc") return 4;
  if (consoleType === "digital") return -3;
  return 0;
}

function getStorageBias(queryContext, text) {
  const family = String(queryContext?.family || "");
  const queryStorage = String(queryContext?.storagePreference || "");
  const itemStorage = detectConsoleStorage(text, family);

  if (!queryStorage || queryStorage === "unknown") return 0;
  if (itemStorage === queryStorage) return 6;
  if (itemStorage === "unknown") return -2;

  if (
    (family === "xbox_series_s" ||
      family === "xbox_series_x" ||
      family === "ps5_disc" ||
      family === "ps5_digital") &&
    itemStorage !== queryStorage
  ) {
    return -14;
  }

  return 0;
}

function getConsoleOnlyAdjustment(queryContext, text, bundleSignals) {
  const family = String(queryContext?.family || "");
  const t = normalizeConsoleText(text);
  const bundleType = String(bundleSignals?.bundleType || "");

  if (bundleType !== "console_only" && !isHomeConsoleOnlyListing(t, family)) {
    return 0;
  }

  if (family.startsWith("ps5")) return 34;
  if (family.startsWith("xbox_series")) return 28;
  if (family.startsWith("switch")) return 18;
  return 20;
}

function getFamilyHardFloor(family = "") {
  if (family === "ps5_disc") return 390;
  if (family === "ps5_digital") return 315;
  if (family === "xbox_series_x") return 305;
  if (family === "xbox_series_s") return 165;
  if (family === "switch_oled") return 210;
  if (family === "switch_lite") return 115;
  if (family === "switch_v2") return 165;
  return 0;
}

function getFamilyLowBandFloor(family = "") {
  if (family === "ps5_disc") return 375;
  if (family === "ps5_digital") return 300;
  if (family === "xbox_series_x") return 290;
  if (family === "xbox_series_s") return 155;
  if (family === "switch_oled") return 195;
  if (family === "switch_lite") return 105;
  if (family === "switch_v2") return 150;
  return 0;
}

function getSwitchBucketHardFloor(bucket = "") {
  if (bucket === "switch_v2_confirmed") return 165;
  if (bucket === "switch_unknown_standard") return 146;
  if (bucket === "switch_v1_confirmed") return 138;
  return 0;
}

function getSwitchBucketLowBandFloor(bucket = "") {
  if (bucket === "switch_v2_confirmed") return 155;
  if (bucket === "switch_unknown_standard") return 138;
  if (bucket === "switch_v1_confirmed") return 128;
  return 0;
}

export function getMatchDebug(item, queryContext) {
  const titleText = getTitleText(item);
  const text = getCombinedItemText(item);
  const conditionState = classifyConsoleConditionState(text);
  const itemBrand = detectConsoleBrand(text);
  const familyMatch = matchesConsoleFamily(text, queryContext, item);
  const bundleSignals = detectBundleSignals(text, queryContext.family || "");
  const switchGeneration = detectSwitchGeneration(`${titleText} ${text}`);
  const switchPricingBucket = getSwitchPricingBucket(item, queryContext);
  const storageTier = detectConsoleStorage(`${titleText} ${text}`, queryContext.family || "");

  const isRealBundle =
    bundleSignals.bundleType === "bundle" ||
    bundleSignals.extraControllerCount > 0 ||
    bundleSignals.includedGamesCount > 0 ||
    bundleSignals.explicitBundleWords ||
    bundleSignals.hasAccessories;

  if (!text) return { matched: false, reason: "empty_text" };
  if (isHardNonConsoleCategory(item)) {
    return { matched: false, reason: "hard_non_console_category" };
  }
  if (failsSharedConsoleGate(item, `${titleText} ${text}`, queryContext)) {
    return { matched: false, reason: "shared_console_gate_failed" };
  }
  if (isIncompleteSwitchConsole(text, queryContext)) {
    return { matched: false, reason: "incomplete_switch_console" };
  }
  if (isHardAccessoryListing(text, item)) return { matched: false, reason: "accessory_listing" };
  if (isClearlyNonConsole(item, text)) return { matched: false, reason: "non_console_listing" };
  if (isSeverelyBadConsole(text, queryContext) && !queryContext.allowDamaged) {
    return { matched: false, reason: "severely_bad_console_blocked" };
  }
  if (!queryContext.allowDamaged && isDamagedConsoleConditionState(conditionState)) {
    return { matched: false, reason: `condition_blocked_${conditionState}` };
  }
  if (queryContext.brand && itemBrand !== queryContext.brand) {
    return { matched: false, reason: `brand_mismatch_${itemBrand || "unknown"}` };
  }
  if (queryContext.family === "switch_v2" && switchGeneration === "v1") {
    return { matched: false, reason: "switch_v1_blocked_for_v2_search" };
  }
  if (
    queryContext?.storagePreference &&
    queryContext.storagePreference !== "unknown" &&
    isStorageMismatch(queryContext.storagePreference, storageTier, queryContext.family || "")
  ) {
    return {
      matched: false,
      reason: "storage_mismatch",
      storageTier,
    };
  }
  if (!familyMatch) {
    return {
      matched: false,
      reason: `family_mismatch_${queryContext.family || "none"}`,
      consoleType: detectConsoleType(titleText || text, queryContext.family || ""),
      switchGeneration,
      switchPricingBucket,
      storageTier,
    };
  }
  if (queryContext.wantsBundle && !isRealBundle) {
    return { matched: false, reason: "bundle_required_but_not_detected" };
  }
  if (queryContext.wantsConsoleOnly && bundleSignals.bundleType !== "console_only") {
    return {
      matched: false,
      reason: "console_only_required_but_not_detected",
      bundleType: bundleSignals.bundleType,
    };
  }

  return {
    matched: true,
    reason: "matched",
    conditionState,
    bundleType: bundleSignals.bundleType,
    consoleType: detectConsoleType(titleText || text, queryContext.family || ""),
    switchGeneration,
    switchPricingBucket,
    storageTier,
  };
}

function scoreConsoleCandidate(item, queryContext) {
  const titleText = getTitleText(item);
  const text = getCombinedItemText(item);

  if (!text) return -10;
  if (isHardNonConsoleCategory(item)) return -10;
  if (failsSharedConsoleGate(item, `${titleText} ${text}`, queryContext)) return -10;
  if (isIncompleteSwitchConsole(text, queryContext)) return -10;
  if (isHardAccessoryListing(text, item)) return -10;
  if (isClearlyNonConsole(item, text)) return -10;
  if (isSeverelyBadConsole(text, queryContext) && !shouldAllowDamagedConsoles(queryContext)) return -10;

  const conditionState = classifyConsoleConditionState(text);
  const allowDamaged = shouldAllowDamagedConsoles(queryContext);
  const switchGeneration = detectSwitchGeneration(`${titleText} ${text}`);

  if (!allowDamaged && isDamagedConsoleConditionState(conditionState)) {
    return -10;
  }

  const itemBrand = detectConsoleBrand(text);
  const bundleSignals = detectBundleSignals(text, queryContext.family || "");
  const bundleType = bundleSignals.bundleType;
  const consoleType = detectConsoleType(titleText || text, queryContext.family || "");
  const storageTier = detectConsoleStorage(`${titleText} ${text}`, queryContext.family || "");
  const queryStorage = String(queryContext?.storagePreference || "");

  let score = 0;

  if (queryContext.brand) {
    if (itemBrand === queryContext.brand) score += 1.2;
    else return -10;
  }

  if (matchesConsoleFamily(text, queryContext, item)) {
    score += 5.2;
  } else {
    return -10;
  }

  if (queryContext.family === "switch_v2" && switchGeneration === "v1") {
    return -10;
  }

  if (isConsoleCategory(item)) score += 1.3;
  if (looksLikeMainConsoleTitle(titleText)) score += 1.2;
  if (conditionState === "clean_working") score += 1.5;
  if (conditionState === "minor_fault") score -= 3.25;
  if (conditionState === "faulty_or_parts") score -= 8;

  if (bundleType === "bundle") score += 1.35;
  if (bundleType === "boxed") score += 0.45;
  if (bundleType === "console_only") score -= 1.9;

  if (queryContext.wantsConsoleOnly) {
    if (bundleType === "console_only") score += 2.4;
    else score -= 5.5;
  }

  score += Math.min(bundleSignals.extraControllerCount, 2) * 0.55;
  score += Math.min(bundleSignals.includedGamesCount, 4) * 0.2;
  if (bundleSignals.hasAccessories) score += 0.35;
  if (bundleSignals.explicitBundleWords) score += 0.35;

  if (queryContext.family === "ps5_disc" && consoleType === "disc") score += 1.1;
  if (queryContext.family === "ps5_disc" && consoleType === "unknown") score += 0.55;
  if (queryContext.family === "ps5_digital" && consoleType === "digital") score += 1.2;

  if (
    (queryContext.family === "xbox_series_x" || queryContext.family === "xbox_series_s") &&
    queryStorage &&
    queryStorage !== "unknown"
  ) {
    if (storageTier === queryStorage) score += 1.15;
    else if (storageTier === "unknown") score -= 0.45;
  }

  if (
    (queryContext.family === "ps5_disc" || queryContext.family === "ps5_digital") &&
    queryStorage &&
    queryStorage !== "unknown"
  ) {
    if (storageTier === queryStorage) score += 0.8;
    else if (storageTier === "unknown") score -= 0.35;
  }

  const warningFlags = buildConsoleWarningFlags(text, queryContext, bundleSignals, item);

  if (queryContext.family === "ps5_digital") {
    if (hasReadDescriptionSignal(text)) {
      score -= 1.6;
    }

    if (hasReadDescriptionSignal(text) && !hasStrongCleanConditionSignal(text)) {
      score -= 2.8;
    }

    if (hasFaultKeywordCombo(text)) {
      score -= 2.4;
    }

    if (hasReadDescriptionSignal(text) && hasFaultKeywordCombo(text)) {
      score -= 3.2;
    }
  }

  if (queryContext.family === "ps5_disc") {
    if (hasPs5DiscOddStorageWording(text)) {
      score -= 1.9;
    }

    if (hasPs5DiscCustomStorageSignal(text)) {
      score -= 2.3;
    }

    if (hasPs5DiscOddSlimVariant(text)) {
      score -= 2.8;
    }

    if (hasPs5DiscVagueSpecSignal(text)) {
      score -= 1.8;
    }
  }

  if (queryContext.family === "switch_v2") {
    if (switchGeneration === "v2") {
      score += 3.8;

      if (hasConfirmedCompleteSwitchV2Signals(`${titleText} ${text}`, queryContext.family)) {
        score += 1.6;
      }

      if (bundleType === "bundle") score += 0.45;
      if (bundleSignals.hasAccessories) score += 0.2;
      if (bundleSignals.hasBox) score += 0.2;
    }

    if (switchGeneration === "unknown") {
      score -= 3.6;
      if (!warningFlags.includes("Unknown Switch version")) {
        warningFlags.push("Unknown Switch version");
      }
    }

    if (isGenericUnknownSwitchTitle(titleText) && switchGeneration === "unknown") {
      score -= 3.4;
      if (!warningFlags.includes("Generic Switch title")) {
        warningFlags.push("Generic Switch title");
      }
    }

    if (hasRiskySwitchWording(`${titleText} ${text}`, queryContext.family)) {
      score -= 2.8;
      if (!warningFlags.includes("Risky Switch wording")) {
        warningFlags.push("Risky Switch wording");
      }
    }
  }

  if (queryContext.family === "switch_oled" || queryContext.family === "switch_lite") {
    if (hasRiskySwitchWording(`${titleText} ${text}`, queryContext.family)) {
      score -= queryContext.family === "switch_oled" ? 2.2 : 2.0;

      if (!warningFlags.includes("Risky Switch wording")) {
        warningFlags.push("Risky Switch wording");
      }
    }
  }

  const warningPenalty = calculateWarningPenalty(warningFlags);
  score -= warningPenalty * 0.06;

  if (queryContext.family === "switch_lite") {
    if (hasAny(text, ["heavily used", "lot of wear", "well used"])) score -= 1.15;
    if (hasAny(text, ["scratch", "scratches", "scratched", "scratched up", "heavy scratches"])) score -= 0.65;
    if (hasAny(text, ["heavy wear", "cosmetic wear", "cosmetic marks", "worn"])) score -= 0.55;
  }

  if (queryContext.family === "switch_oled") {
    if (hasAny(text, ["heavily used", "lot of wear"])) score -= 0.75;
    if (hasAny(text, ["scratch", "scratches", "scratched", "scratched up", "heavy scratches"])) score -= 0.4;
    if (hasReadDescriptionSignal(text)) score -= 2.4;
  }

  return score;
}

function enrichConsoleCompPool(queryContext, items = []) {
  return (Array.isArray(items) ? items : [])
    .map((item) => {
      const titleText = getTitleText(item);
      const text = getCombinedItemText(item);
      const bundleSignals = detectBundleSignals(text, queryContext.family || "");
      const bundleValueBonus = estimateBundleValueBonus(queryContext, bundleSignals, text);

      const warningFlags = buildConsoleWarningFlags(text, queryContext, bundleSignals, item);
      const nintendoSwitchRankingAdjustment = getNintendoSwitchRankingAdjustment(
        queryContext,
        item,
        `${titleText} ${text}`,
        bundleSignals
      );

      const warningPenalty = calculateWarningPenalty(warningFlags);
      const discDigitalBias = getDiscDigitalPricingBias(queryContext, text);
      const storageBias = getStorageBias(queryContext, `${titleText} ${text}`);
      const consoleOnlyAdjustment = getConsoleOnlyAdjustment(queryContext, `${titleText} ${text}`, bundleSignals);
      const matchDebug = getMatchDebug(item, queryContext);

      return {
        item,
        total: extractTotalPrice(item),
        adjustedTotal: roundMoney(
          extractTotalPrice(item) -
            bundleValueBonus * 0.55 +
            Math.min(warningPenalty, 24) -
            discDigitalBias -
            storageBias +
            consoleOnlyAdjustment +
            nintendoSwitchRankingAdjustment
        ),
        score: scoreConsoleCandidate(item, queryContext),
        conditionState: classifyConsoleConditionState(text),
        bundleType: bundleSignals.bundleType,
        bundleSignals,
        bundleValueBonus,
        warningFlags,
        warningPenalty,
        discDigitalBias,
        storageBias,
        consoleOnlyAdjustment,
        nintendoSwitchRankingAdjustment,
        matchDebug,
        switchGeneration: detectSwitchGeneration(`${titleText} ${text}`),
        switchPricingBucket: getSwitchPricingBucket(item, queryContext),
        storageTier: detectConsoleStorage(`${titleText} ${text}`, queryContext.family || ""),
      };
    })
    .filter((entry) => entry.total > 0 && entry.score > -5)
    .sort((a, b) => b.score - a.score);
}

export function buildConsolePricingModel(queryContext, marketItems = [], listingItems = []) {
  const allowDamaged = shouldAllowDamagedConsoles(queryContext);

  const marketPool = enrichConsoleCompPool(queryContext, marketItems);
  const listingPool = enrichConsoleCompPool(queryContext, listingItems);

  const desiredConditionState = allowDamaged ? null : "clean_working";

  let marketConditionPool = desiredConditionState
    ? marketPool.filter((entry) => entry.conditionState === desiredConditionState)
    : marketPool;

  let listingConditionPool = desiredConditionState
    ? listingPool.filter((entry) => entry.conditionState === desiredConditionState)
    : listingPool;

  if (!marketConditionPool.length && marketPool.length) {
    marketConditionPool = marketPool;
  }

  if (!listingConditionPool.length && listingPool.length) {
    listingConditionPool = listingPool;
  }

  const exactMarket = marketConditionPool.filter((entry) => entry.score >= 5.0);
  const usableMarket =
    exactMarket.length >= 3
      ? exactMarket
      : marketConditionPool.filter((entry) => entry.score >= 1.2);

  const exactListings = listingConditionPool.filter((entry) => entry.score >= 5.0);
  const usableListings =
    exactListings.length >= 2
      ? exactListings
      : listingConditionPool.filter((entry) => entry.score >= 1.2);

  let marketTotals = [];
  let listingTotals = [];
  let pricingMode = "Console model median";
  let baseline = 0;

  if (queryContext.family === "switch_v2") {
    const v2Market = marketConditionPool.filter((entry) => entry.switchPricingBucket === "switch_v2_confirmed");
    const unknownMarket = marketConditionPool.filter(
      (entry) => entry.switchPricingBucket === "switch_unknown_standard"
    );

    const v2Listings = listingConditionPool.filter((entry) => entry.switchPricingBucket === "switch_v2_confirmed");
    const unknownListings = listingConditionPool.filter(
      (entry) => entry.switchPricingBucket === "switch_unknown_standard"
    );

    const v2MarketTotals = removePriceOutliers(
      v2Market
        .slice(0, 24)
        .map((entry) => entry.adjustedTotal)
        .filter((value) => value > 0)
    );

    const unknownMarketTotals = removePriceOutliers(
      unknownMarket
        .slice(0, 24)
        .map((entry) => entry.adjustedTotal)
        .filter((value) => value > 0)
    );

    const v2ListingTotals = removePriceOutliers(
      v2Listings
        .slice(0, 16)
        .map((entry) => entry.adjustedTotal)
        .filter((value) => value > 0)
    );

    const unknownListingTotals = removePriceOutliers(
      unknownListings
        .slice(0, 16)
        .map((entry) => entry.adjustedTotal)
        .filter((value) => value > 0)
    );

    const blendedV2Totals = removePriceOutliers(
      [...v2MarketTotals, ...v2ListingTotals].filter((value) => value > 0)
    );

    if (v2MarketTotals.length >= 3 || blendedV2Totals.length >= 3) {
      marketTotals = v2MarketTotals.length >= 3 ? v2MarketTotals : blendedV2Totals;
      listingTotals = v2ListingTotals.length ? v2ListingTotals : unknownListingTotals;

      baseline =
        median(blendedV2Totals) ||
        percentile(blendedV2Totals, 0.35) ||
        median(v2MarketTotals) ||
        median(v2ListingTotals) ||
        0;

      baseline = Math.max(baseline, getSwitchBucketLowBandFloor("switch_v2_confirmed"));
      pricingMode = "Switch V2 confirmed blended median";
    } else if (unknownMarketTotals.length >= 3) {
      marketTotals = unknownMarketTotals;
      listingTotals = unknownListingTotals.length ? unknownListingTotals : v2ListingTotals;

      baseline =
        median(unknownMarketTotals) ||
        percentile(unknownMarketTotals, 0.35) ||
        median(unknownListingTotals) ||
        0;

      baseline = Math.max(baseline, getSwitchBucketLowBandFloor("switch_unknown_standard"));
      pricingMode = "Switch unknown-version median";
    } else {
      const fallbackCombined = removePriceOutliers(
        [...v2MarketTotals, ...unknownMarketTotals, ...v2ListingTotals, ...unknownListingTotals].filter(
          (value) => value > 0
        )
      );

      marketTotals = fallbackCombined;
      listingTotals = fallbackCombined;

      baseline = median(fallbackCombined) || percentile(fallbackCombined, 0.35) || 0;

      baseline = Math.max(baseline, getSwitchBucketLowBandFloor("switch_unknown_standard"));
      pricingMode = "Switch mixed fallback";
    }
  } else {
    marketTotals = removePriceOutliers(
      (usableMarket.length ? usableMarket : marketConditionPool)
        .slice(0, 28)
        .map((entry) => entry.adjustedTotal)
        .filter((value) => value > 0)
    );

    listingTotals = removePriceOutliers(
      (usableListings.length ? usableListings : listingConditionPool)
        .slice(0, 18)
        .map((entry) => entry.adjustedTotal)
        .filter((value) => value > 0)
    );

    if (marketTotals.length < 3 && listingTotals.length >= 2) {
      marketTotals = removePriceOutliers([...marketTotals, ...listingTotals].filter((value) => value > 0));
    }

    if (listingTotals.length < 2 && marketTotals.length >= 2) {
      listingTotals = marketTotals.slice(0, 12);
    }

    const marketMedianBase = median(marketTotals);
    const marketLowBase = percentile(marketTotals, 0.35);
    const listingMedianBase = median(listingTotals);

    baseline = marketMedianBase || marketLowBase || listingMedianBase || 0;

    if (!marketMedianBase && listingMedianBase) pricingMode = "Console listings fallback";
    if (!marketMedianBase && !listingMedianBase && marketLowBase) pricingMode = "Console low-band fallback";
  }

  const marketMedian = median(marketTotals);
  const marketLow = percentile(marketTotals, 0.35);
  const listingMedian = median(listingTotals);

  const familyHardFloor = getFamilyHardFloor(String(queryContext?.family || ""));
  const familyLowBandFloor = getFamilyLowBandFloor(String(queryContext?.family || ""));

  if (queryContext.family !== "switch_v2") {
    if (baseline && familyLowBandFloor > 0) {
      baseline = Math.max(baseline, familyLowBandFloor);
    }

    if (!baseline && familyHardFloor > 0) {
      baseline = familyHardFloor;
      pricingMode =
        queryContext.family === "ps5_disc"
          ? "PS5 disc hard fallback"
          : queryContext.family === "ps5_digital"
          ? "PS5 digital hard fallback"
          : "Console hard fallback";
    }
  } else {
    if (!baseline) {
      baseline = getSwitchBucketHardFloor("switch_unknown_standard");
      pricingMode = "Switch unknown hard fallback";
    }
  }

  let conservativeMultiplier = 0.972;
  if (exactMarket.length >= 5) conservativeMultiplier = 0.978;
  if (exactMarket.length >= 8) conservativeMultiplier = 0.982;

  if (queryContext.family === "ps5_disc") {
    baseline = roundMoney(Math.max(baseline, 390));
    pricingMode = pricingMode.includes("fallback") ? pricingMode : "PS5 disc median";
  } else if (queryContext.family === "ps5_digital") {
    baseline = roundMoney(Math.max(baseline, 315));
    pricingMode = pricingMode.includes("fallback") ? pricingMode : "PS5 digital median";
  } else if (queryContext.family === "xbox_series_x") {
    baseline = roundMoney(Math.max(baseline, 305));
    pricingMode = "Series X median";
  } else if (queryContext.family === "xbox_series_s") {
    baseline = roundMoney(Math.max(baseline, 165));
    pricingMode = "Series S median";
  } else if (queryContext.family === "switch_oled") {
    baseline = roundMoney(Math.max(baseline, 210));
    pricingMode = "Switch OLED median";
  } else if (queryContext.family === "switch_lite") {
    baseline = roundMoney(Math.max(baseline, 115));
    pricingMode = "Switch Lite median";
  } else if (queryContext.family === "switch_v2") {
    if (pricingMode === "Switch V2 confirmed blended median") {
      baseline = roundMoney(Math.max(baseline, getSwitchBucketHardFloor("switch_v2_confirmed")));
    } else {
      baseline = roundMoney(Math.max(baseline, getSwitchBucketHardFloor("switch_unknown_standard")));
    }
  }

  const estimatedResale = roundMoney(baseline * conservativeMultiplier);
  const compCount = marketTotals.length;

  let confidence = 24;
  if (compCount >= 3) confidence = 55;
  if (compCount >= 5) confidence = 70;
  if (compCount >= 8) confidence = 84;
  if (compCount >= 12) confidence = 88;
  if (compCount >= 16) confidence = 92;

  if (exactMarket.length >= 3) confidence += 4;
  if (exactMarket.length >= 5) confidence += 4;
  if (exactListings.length >= 3) confidence += 3;
  if (queryContext.family) confidence += 2;
  if (queryContext?.storagePreference && queryContext.storagePreference !== "unknown") confidence += 1;

  if (queryContext.family === "ps5_disc") {
    const vagueDiscCompCount = marketConditionPool.filter(
      (entry) => hasPs5DiscVagueSpecSignal(`${getTitleText(entry.item)} ${getCombinedItemText(entry.item)}`)
    ).length;

    if (vagueDiscCompCount >= 1) {
      confidence -= 6;
    }
  }

  if (
    pricingMode === "PS5 disc hard fallback" ||
    pricingMode === "PS5 digital hard fallback" ||
    pricingMode === "Console hard fallback" ||
    pricingMode === "Switch unknown hard fallback"
  ) {
    confidence = Math.min(confidence, 56);
  }

  if (queryContext.family === "switch_v2" && pricingMode !== "Switch V2 confirmed blended median") {
    confidence = Math.min(confidence, 74);
  }

  if (queryContext.family === "switch_v2") {
    const confirmedV2Count = marketConditionPool.filter(
      (entry) => entry.switchPricingBucket === "switch_v2_confirmed"
    ).length;
    const unknownSwitchCount = marketConditionPool.filter(
      (entry) => entry.switchPricingBucket === "switch_unknown_standard"
    ).length;
    const riskySwitchCount = marketConditionPool.filter(
      (entry) => entry.warningFlags.includes("Risky Switch wording")
    ).length;
    const genericUnknownCount = marketConditionPool.filter(
      (entry) => entry.warningFlags.includes("Generic Switch title")
    ).length;

    if (pricingMode === "Switch V2 confirmed blended median" && confirmedV2Count >= 4) {
      confidence += 6;
    }

    if (confirmedV2Count >= 6) {
      confidence += 4;
    }

    if (unknownSwitchCount > confirmedV2Count) {
      confidence -= 6;
    }

    if (genericUnknownCount >= 2) {
      confidence -= 4;
    }

    if (riskySwitchCount >= 2) {
      confidence -= 4;
    }

    if (riskySwitchCount >= 4) {
      confidence -= 3;
    }
  }

  if (queryContext.family === "switch_oled" || queryContext.family === "switch_lite") {
    const riskySwitchCount = marketConditionPool.filter(
      (entry) => entry.warningFlags.includes("Risky Switch wording")
    ).length;

    if (riskySwitchCount >= 2) {
      confidence -= 4;
    }
  }

  confidence = Math.min(92, confidence);
  confidence = Math.max(24, confidence);

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
    debug: {
      marketPoolSize: marketPool.length,
      listingPoolSize: listingPool.length,
      marketConditionPoolSize: marketConditionPool.length,
      listingConditionPoolSize: listingConditionPool.length,
      exactMarketCount: exactMarket.length,
      usableMarketCount: usableMarket.length,
      exactListingsCount: exactListings.length,
      usableListingsCount: usableListings.length,
      familyHardFloor,
      familyLowBandFloor,
      baseline,
      multiplier: conservativeMultiplier,
      switchMarketV2Count: marketConditionPool.filter(
        (entry) => entry.switchPricingBucket === "switch_v2_confirmed"
      ).length,
      switchMarketUnknownCount: marketConditionPool.filter(
        (entry) => entry.switchPricingBucket === "switch_unknown_standard"
      ).length,
      switchListingV2Count: listingConditionPool.filter(
        (entry) => entry.switchPricingBucket === "switch_v2_confirmed"
      ).length,
      switchListingUnknownCount: listingConditionPool.filter(
        (entry) => entry.switchPricingBucket === "switch_unknown_standard"
      ).length,
      switchMarketRiskyCount: marketConditionPool.filter(
        (entry) => entry.warningFlags.includes("Risky Switch wording")
      ).length,
      switchMarketGenericCount: marketConditionPool.filter(
        (entry) => entry.warningFlags.includes("Generic Switch title")
      ).length,
    },
  };
}

export function classifyConsoleItem(item, queryContext) {
  const titleText = getTitleText(item);
  const text = getCombinedItemText(item);
  const conditionState = classifyConsoleConditionState(text);
  const repairCost = estimateConsoleRepairCost(queryContext, conditionState, text);
  const bundleSignals = detectBundleSignals(text, queryContext.family || "");
  const bundleValueBonus = estimateBundleValueBonus(queryContext, bundleSignals, text);
  const warningFlags = buildConsoleWarningFlags(text, queryContext, bundleSignals, item);
  const warningScorePenalty = calculateWarningPenalty(warningFlags);
  const matchDebug = getMatchDebug(item, queryContext);

  return {
    conditionState,
    repairCost,
    bundleType: bundleSignals.bundleType,
    bundleSignals,
    bundleValueBonus,
    warningFlags,
    warningScorePenalty,
    debug: matchDebug,
  };
}

export function applyBundleValueToListing({ queryContext, item, baseResale }) {
  const titleText = getTitleText(item);
  const text = getCombinedItemText(item);
  const bundleSignals = detectBundleSignals(text, queryContext.family || "");
  const bundleValueBonus = estimateBundleValueBonus(queryContext, bundleSignals, text);
  const warningFlags = buildConsoleWarningFlags(text, queryContext, bundleSignals, item);
  const warningPenalty = calculateWarningPenalty(warningFlags);
  const discDigitalBias = getDiscDigitalPricingBias(queryContext, text);
  const storageBias = getStorageBias(queryContext, `${titleText} ${text}`);
  const consoleOnlyAdjustment = getConsoleOnlyAdjustment(queryContext, `${titleText} ${text}`, bundleSignals);
  const switchGeneration = detectSwitchGeneration(`${titleText} ${text}`);
  const nintendoSwitchRankingAdjustment = getNintendoSwitchRankingAdjustment(
    queryContext,
    item,
    `${titleText} ${text}`,
    bundleSignals
  );

  let estimatedResale =
    Number(baseResale || 0) +
    bundleValueBonus * 0.75 +
    discDigitalBias +
    storageBias -
    nintendoSwitchRankingAdjustment;

  if (consoleOnlyAdjustment > 0) {
    estimatedResale -= consoleOnlyAdjustment;
  }

  if (warningPenalty >= 10) {
    estimatedResale -= Math.min(warningPenalty, 22);
  }

  if (
    queryContext.family === "ps5_digital" &&
    hasReadDescriptionSignal(text) &&
    !hasStrongCleanConditionSignal(text)
  ) {
    estimatedResale -= 14;
  }

  if (
    queryContext.family === "ps5_digital" &&
    hasReadDescriptionSignal(text) &&
    hasFaultKeywordCombo(text)
  ) {
    estimatedResale -= 18;
  }

  if (queryContext.family === "ps5_disc") {
    if (hasPs5DiscOddStorageWording(text)) {
      estimatedResale -= 12;
    }

    if (hasPs5DiscCustomStorageSignal(text)) {
      estimatedResale -= 14;
    }

    if (hasPs5DiscOddSlimVariant(text)) {
      estimatedResale -= 18;
    }

    if (hasPs5DiscVagueSpecSignal(text)) {
      estimatedResale -= 14;
    }
  }

  if (queryContext.family === "switch_v2") {
    if (switchGeneration === "v2") {
      estimatedResale += 12;

      if (hasConfirmedCompleteSwitchV2Signals(`${titleText} ${text}`, queryContext.family)) {
        estimatedResale += 6;
      }

      if (bundleSignals.bundleType === "bundle") estimatedResale += 2;
      if (bundleSignals.hasAccessories) estimatedResale += 1;
      if (bundleSignals.hasBox) estimatedResale += 1;
    } else if (switchGeneration === "unknown") {
      estimatedResale -= 16;

      if (isGenericUnknownSwitchTitle(titleText)) {
        estimatedResale -= 10;
      }
    }

    if (hasRiskySwitchWording(`${titleText} ${text}`, queryContext.family)) {
      estimatedResale -= 12;
    }
  }

  if (
    (queryContext.family === "switch_oled" || queryContext.family === "switch_lite") &&
    hasRiskySwitchWording(`${titleText} ${text}`, queryContext.family)
  ) {
    estimatedResale -= queryContext.family === "switch_oled" ? 10 : 8;
  }

  return {
    bundleSignals,
    bundleType: bundleSignals.bundleType,
    bundleValueBonus,
    warningFlags,
    warningScorePenalty: warningPenalty,
    estimatedResale: roundMoney(estimatedResale),
    debug: {
      discDigitalBias,
      storageBias,
      consoleOnlyAdjustment,
      nintendoSwitchRankingAdjustment,
      consoleType: detectConsoleType(getTitleText(item) || text, queryContext.family || ""),
      switchGeneration,
      switchPricingBucket: getSwitchPricingBucket(item, queryContext),
      storageTier: detectConsoleStorage(`${titleText} ${text}`, queryContext.family || ""),
    },
  };
}
