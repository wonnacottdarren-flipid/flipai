import { extractTotalPrice } from "../baseEngine.js";
import { detectBundleSignalsV2 } from "./consoleV2Bundle.js";
import {
  isAccessoryCategory,
  isHardNonConsoleCategory,
  isVideoGameOnlyCategory,
} from "./consoleV2Categories.js";
import {
  classifyConsoleV2Condition,
  isSeverelyBadConsoleV2,
} from "./consoleV2Condition.js";
import {
  detectConsoleBrand,
  isXboxOneFamilySignal,
  parseConsoleFamily,
} from "./consoleV2Family.js";
import {
  calculateConsoleV2WarningPenalty,
  buildConsoleV2WarningFlags,
} from "./consoleV2Warnings.js";
import {
  getCombinedItemText,
  getTitleText,
  hasAny,
  normalizeConsoleText,
} from "./consoleV2Text.js";

function titleLooksLikeConsoleV2(titleText = "", family = "") {
  const t = normalizeConsoleText(titleText);

  if (!t) return false;

  if (
    hasAny(t, [
      "console",
      "system",
      "boxed",
      "bundle",
      "disc edition",
      "digital edition",
      "standard edition",
      "with controller",
      "controller included",
      "1tb",
      "2tb",
      "825gb",
      "512gb",
      "64gb",
      "32gb",
      "dock included",
      "with dock",
      "joy cons",
      "joy-cons",
    ])
  ) {
    return true;
  }

  if (
    family === "ps5_disc" ||
    family === "ps5_digital" ||
    family === "xbox_series_x" ||
    family === "xbox_series_s" ||
    family === "switch_oled" ||
    family === "switch_lite" ||
    family === "switch_v2"
  ) {
    return parseConsoleFamily(t) === family;
  }

  return Boolean(parseConsoleFamily(t));
}

function isObviousNonConsoleTitleV2(titleText = "") {
  const t = normalizeConsoleText(titleText);

  return hasAny(t, [
    "game only",
    "disc only",
    "download code",
    "digital code",
    "membership",
    "subscription",
    "gift card",
    "voucher",
    "steelbook",
    "art book",
    "soundtrack",
    "poster",
    "figure",
    "figurine",
    "controller only",
    "charger only",
    "dock only",
    "case only",
    "box only",
    "empty box",
    "shell only",
    "replacement",
    "repair part",
    "parts only",
    "hdmi cable",
    "power cable",
    "thumb grips",
    "faceplate",
    "face plate",
    "skin only",
    "cover only",
    "stand only",
    "headset only",
  ]);
}

function familyMatchesV2(text = "", queryContext = {}) {
  const t = normalizeConsoleText(text);
  const wantedFamily = String(queryContext?.family || "");
  const detectedFamily = parseConsoleFamily(t);

  if (!wantedFamily) return Boolean(detectedFamily);
  if (!detectedFamily) return false;

  if (wantedFamily === detectedFamily) return true;

  if (wantedFamily === "ps5_disc" && detectedFamily === "ps5_digital") return false;
  if (wantedFamily === "ps5_digital" && detectedFamily === "ps5_disc") return false;

  if (wantedFamily === "switch_v2") {
    return detectedFamily === "switch_v2";
  }

  return false;
}

function storageMatchesV2(text = "", queryContext = {}) {
  const wantedStorage = String(queryContext?.storagePreference || "");

  if (!wantedStorage || wantedStorage === "unknown") return true;

  const t = normalizeConsoleText(text);

  if (wantedStorage === "2tb") return hasAny(t, ["2tb", "2 tb"]);
  if (wantedStorage === "1tb") return hasAny(t, ["1tb", "1 tb", "1000gb", "1000 gb"]);
  if (wantedStorage === "825gb") return hasAny(t, ["825gb", "825 gb"]);
  if (wantedStorage === "512gb") return hasAny(t, ["512gb", "512 gb"]);
  if (wantedStorage === "64gb") return hasAny(t, ["64gb", "64 gb"]);
  if (wantedStorage === "32gb") return hasAny(t, ["32gb", "32 gb"]);

  return true;
}

function getFamilyScoreBoostV2(text = "", queryContext = {}) {
  const family = String(queryContext?.family || "");
  const t = normalizeConsoleText(text);

  if (family === "ps5_disc") {
    if (hasAny(t, ["disc edition", "standard edition", "disc version", "bluray"])) return 2.2;
    if (hasAny(t, ["digital edition", "digital console", "discless"])) return -8;
    return 1.1;
  }

  if (family === "ps5_digital") {
    if (hasAny(t, ["digital edition", "digital console", "discless"])) return 2.4;
    if (hasAny(t, ["disc edition", "standard edition", "disc drive", "bluray"])) return -8;
    return -1.5;
  }

  if (family === "xbox_series_x") {
    if (isXboxOneFamilySignal(t)) return -8;
    if (hasAny(t, ["series x", "xbox series x"])) return 2.2;
  }

  if (family === "xbox_series_s") {
    if (isXboxOneFamilySignal(t)) return -8;
    if (hasAny(t, ["series s", "xbox series s"])) return 2.2;
  }

  if (family === "switch_oled") {
    if (hasAny(t, ["oled", "switch oled", "oled model"])) return 2.2;
    return -5;
  }

  if (family === "switch_lite") {
    if (hasAny(t, ["switch lite", "lite console"])) return 2.2;
    return -5;
  }

  if (family === "switch_v2") {
    if (hasAny(t, ["switch oled", "oled model", "switch lite"])) return -8;
    if (
      hasAny(t, [
        "v2",
        "hac-001(-01)",
        "hac 001(-01)",
        "red box",
        "improved battery",
        "better battery",
      ])
    ) {
      return 2.5;
    }

    return 0.2;
  }

  return 0;
}

export function scoreConsoleV2Item(item = {}, queryContext = {}) {
  const titleText = getTitleText(item);
  const combinedText = getCombinedItemText(item);
  const fullText = normalizeConsoleText(`${titleText} ${combinedText}`);
  const family = String(queryContext?.family || "");

  if (!fullText) return -100;
  if (extractTotalPrice(item) <= 0) return -100;

  if (isHardNonConsoleCategory(item)) return -100;
  if (isVideoGameOnlyCategory(item) && !titleLooksLikeConsoleV2(titleText, family)) return -100;
  if (isAccessoryCategory(item) && !titleLooksLikeConsoleV2(titleText, family)) return -100;
  if (isObviousNonConsoleTitleV2(titleText) && !titleLooksLikeConsoleV2(titleText, family)) return -100;

  if (!familyMatchesV2(fullText, queryContext)) return -100;

  if (queryContext?.brand) {
    const itemBrand = detectConsoleBrand(fullText);
    if (itemBrand && itemBrand !== queryContext.brand) return -100;
  }

  if (!storageMatchesV2(fullText, queryContext)) return -100;

  if (!queryContext?.allowDamaged && isSeverelyBadConsoleV2(fullText, queryContext)) {
    return -100;
  }

  const conditionState = classifyConsoleV2Condition(fullText);

  if (
    !queryContext?.allowDamaged &&
    (conditionState === "minor_fault" || conditionState === "faulty_or_parts")
  ) {
    return -100;
  }

  const bundleSignals = detectBundleSignalsV2(fullText, family);

  if (queryContext?.wantsBundle && bundleSignals.bundleType !== "bundle") {
    return -100;
  }

  if (queryContext?.wantsConsoleOnly && bundleSignals.bundleType !== "console_only") {
    return -100;
  }

  const warningFlags = buildConsoleV2WarningFlags(fullText, queryContext);
  const warningPenalty = calculateConsoleV2WarningPenalty(warningFlags);

  let score = 0;

  score += 5;
  score += getFamilyScoreBoostV2(fullText, queryContext);

  if (titleLooksLikeConsoleV2(titleText, family)) score += 1.5;

  if (conditionState === "clean_working") score += 1.4;
  if (conditionState === "minor_fault") score -= 3;
  if (conditionState === "faulty_or_parts") score -= 8;

  if (bundleSignals.bundleType === "bundle") score += 1.2;
  if (bundleSignals.bundleType === "boxed") score += 0.5;
  if (bundleSignals.bundleType === "console_only") score -= 1.5;

  score += Math.min(bundleSignals.extraControllerCount, 2) * 0.6;
  score += Math.min(bundleSignals.includedGamesCount, 4) * 0.25;

  if (bundleSignals.hasBox) score += 0.25;
  if (bundleSignals.hasAccessories) score += 0.25;

  if (queryContext?.wantsBundle && bundleSignals.bundleType === "bundle") score += 1.5;
  if (queryContext?.wantsConsoleOnly && bundleSignals.bundleType === "console_only") score += 1.5;

  score -= warningPenalty * 0.08;

  return score;
}

export function buildConsoleV2ScoredItem(item = {}, queryContext = {}) {
  const titleText = getTitleText(item);
  const combinedText = getCombinedItemText(item);
  const fullText = normalizeConsoleText(`${titleText} ${combinedText}`);
  const family = String(queryContext?.family || "");
  const bundleSignals = detectBundleSignalsV2(fullText, family);
  const warningFlags = buildConsoleV2WarningFlags(fullText, queryContext);
  const conditionState = classifyConsoleV2Condition(fullText);
  const score = scoreConsoleV2Item(item, queryContext);

  return {
    item,
    titleText,
    total: extractTotalPrice(item),
    score,
    matched: score > -50,
    family: parseConsoleFamily(fullText),
    conditionState,
    bundleType: bundleSignals.bundleType,
    bundleSignals,
    warningFlags,
    warningPenalty: calculateConsoleV2WarningPenalty(warningFlags),
  };
}

export function scoreConsoleV2Items(items = [], queryContext = {}) {
  return (Array.isArray(items) ? items : [])
    .map((item) => buildConsoleV2ScoredItem(item, queryContext))
    .filter((entry) => entry.matched && entry.total > 0)
    .sort((a, b) => b.score - a.score);
}
