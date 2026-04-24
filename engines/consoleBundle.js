import { hasAny, normalizeConsoleText } from "./consoleTextHelpers.js";
import { PS5_GAME_TERMS } from "./consoleConstants.js";

export function hasControllerIncluded(text, family) {
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
  if (hasAny(t, ["with controller", "controller included", "includes controller", "controller and cable", "controller and cables", "pad included"])) return true;

  return true;
}

export function isHomeConsoleOnlyListing(text = "", family = "") {
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

export function detectExtraControllerCount(text) {
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

export function detectIncludedGamesCount(text) {
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
    hasAny(t, [
      "boxed",
      "box included",
      "box and cables",
      "box with cables",
      "original box",
      "complete in box",
    ])
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

  const hasStandardCables =
    hasAny(t, [
      "with cable",
      "with cables",
      "cable included",
      "cables included",
      "power cable",
      "hdmi cable included",
      "hdmi and power cable",
      "power and hdmi cable",
      "controller and cable",
      "controller and cables",
      "box and cables",
    ])
      ? 1
      : 0;

  const explicitBundleWords = hasAny(t, [
    "bundle",
    "console bundle",
    "ps5 bundle",
    "playstation5 bundle",
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
    hasStandardCables: Boolean(hasStandardCables),
    explicitBundleWords: Boolean(explicitBundleWords),
  };
}
