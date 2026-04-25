import { roundMoney } from "./baseEngine.js";
import { hasAny, normalizeConsoleText } from "./consoleItemText.js";

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

function hasControllerIncluded(text, family) {
  const t = normalizeConsoleText(text);

  if (family.startsWith("switch")) {
    if (
      hasAny(t, [
        "tablet only",
        "console only",
        "no joy cons",
        "no joy-cons",
        "without joy cons",
        "without joy-cons",
        "missing joy cons",
        "missing joy-cons",
        "joy cons not included",
        "joy-cons not included",
      ])
    ) {
      return false;
    }

    if (
      hasAny(t, [
        "joy con included",
        "joy-cons included",
        "with joy cons",
        "with joy-cons",
      ])
    ) {
      return true;
    }

    return true;
  }

  if (hasAny(t, ["no controller", "without controller", "missing controller"])) return false;
  if (hasAny(t, ["with controller", "controller included", "pad included"])) return true;

  return true;
}

function isHomeConsoleOnlyListing(text = "", family = "") {
  const t = normalizeConsoleText(text);
  const fam = String(family || "");

  if (!(fam.startsWith("ps5") || fam.startsWith("xbox_series"))) return false;

  if (
    hasAny(t, [
      "console only",
      "unit only",
      "main unit only",
      "base unit only",
      "just console",
      "console unit only",
      "body only",
      "without controller",
      "missing controller",
      "no controller",
      "pad not included",
      "controller not included",
    ])
  ) {
    return true;
  }

  return false;
}

function detectExtraControllerCount(text) {
  const t = normalizeConsoleText(text);

  if (hasAny(t, ["4 controllers", "four controllers"])) return 3;
  if (hasAny(t, ["3 controllers", "three controllers"])) return 2;
  if (
    hasAny(t, [
      "2 controllers",
      "two controllers",
      "extra controller",
      "second controller",
      "spare controller",
    ])
  ) {
    return 1;
  }

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
  if (
    hasAny(t, ["with game", "with games", "game included", "games included", "includes game", "includes games"])
  ) {
    return 1;
  }

  const matchedNamedGames = PS5_GAME_TERMS.filter((term) => t.includes(term));
  if (matchedNamedGames.length) {
    return Math.min(matchedNamedGames.length, 3);
  }

  return 0;
}

export function detectBundleSignals(text, family) {
  const t = normalizeConsoleText(text);
  const extraControllerCount = detectExtraControllerCount(t);
  const includedGamesCount = detectIncludedGamesCount(t);

  const hasBox =
    !hasAny(t, ["unboxed", "no box", "without box"]) &&
    hasAny(t, ["boxed", "box included", "original box", "complete in box"])
      ? 1
      : 0;

  const hasAccessories =
    hasAny(t, [
      "with headset",
      "with charging station",
      "with camera",
      "with media remote",
      "with accessories",
      "extras included",
      "with extra accessories",
      "plus headset",
      "plus accessories",
      "official case",
      "carrying case",
      "case included",
      "dock included",
      "with dock",
      "official dock",
    ])
      ? 1
      : 0;

  const explicitBundleWords = hasAny(t, [
    "bundle",
    "job lot",
    "comes with games",
    "includes games",
    "games included",
    "plus games",
    "with games",
    "with 2 controllers",
    "with two controllers",
    "extra controller",
    "second controller",
    "spare controller",
  ])
    ? 1
    : 0;

  let bundleType = "standard";

  if (!hasControllerIncluded(t, family) || isHomeConsoleOnlyListing(t, family)) {
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

export function estimateBundleValueBonus(queryContext, bundleSignals, text) {
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
