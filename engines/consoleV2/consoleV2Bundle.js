import { hasAny, normalizeConsoleText } from "./consoleV2Text.js";

export function hasControllerIncludedV2(text = "", family = "") {
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

  if (
    hasAny(t, [
      "with controller",
      "controller included",
      "includes controller",
      "pad included",
    ])
  ) {
    return true;
  }

  return true;
}

export function isConsoleOnlyListingV2(text = "", family = "") {
  const t = normalizeConsoleText(text);

  if (!(family.startsWith("ps5") || family.startsWith("xbox_series"))) {
    return false;
  }

  return hasAny(t, [
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
    "controller not included",
    "pad not included",
  ]);
}

export function detectExtraControllerCountV2(text = "") {
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

export function detectIncludedGamesCountV2(text = "") {
  const t = normalizeConsoleText(text);

  if (hasAny(t, ["10 games", "ten games"])) return 10;
  if (hasAny(t, ["8 games", "eight games"])) return 8;
  if (hasAny(t, ["6 games", "six games"])) return 6;
  if (hasAny(t, ["5 games", "five games"])) return 5;
  if (hasAny(t, ["4 games", "four games"])) return 4;
  if (hasAny(t, ["3 games", "three games"])) return 3;
  if (hasAny(t, ["2 games", "two games"])) return 2;

  if (
    hasAny(t, [
      "with game",
      "with games",
      "game included",
      "games included",
      "includes game",
      "includes games",
    ])
  ) {
    return 1;
  }

  return 0;
}

export function detectBundleSignalsV2(text = "", family = "") {
  const t = normalizeConsoleText(text);

  const extraControllerCount = detectExtraControllerCountV2(t);
  const includedGamesCount = detectIncludedGamesCountV2(t);

  const hasBox =
    !hasAny(t, ["unboxed", "no box", "without box"]) &&
    hasAny(t, ["boxed", "box included", "original box", "complete in box"]);

  const hasAccessories = hasAny(t, [
    "with headset",
    "with charging station",
    "with camera",
    "with media remote",
    "with accessories",
    "extras included",
    "plus accessories",
    "case included",
    "carrying case",
    "dock included",
    "with dock",
  ]);

  const explicitBundleWords = hasAny(t, [
    "bundle",
    "job lot",
    "comes with games",
    "includes games",
    "games included",
    "plus games",
    "with games",
  ]);

  let bundleType = "standard";

  if (!hasControllerIncludedV2(t, family) || isConsoleOnlyListingV2(t, family)) {
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
