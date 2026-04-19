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
  ["ps5_disc", ["ps5 disc", "ps5 disk", "playstation 5 disc", "playstation 5 disk", "ps5 standard", "playstation 5 standard", "standard edition", "disc edition", "disk edition", "cfi 1116a", "cfi 1216a"]],
  ["ps5_digital", ["ps5 digital", "playstation 5 digital", "digital edition", "cfi 1116b", "cfi 1216b"]],
  ["xbox_series_x", ["xbox series x", "series x"]],
  ["xbox_series_s", ["xbox series s", "series s"]],
  ["switch_oled", ["switch oled", "nintendo switch oled", "oled model"]],
  ["switch_lite", ["switch lite", "nintendo switch lite"]],
  ["switch_v2", ["nintendo switch", "switch console"]],
];

const HARD_ACCESSORY_TERMS = [
  "controller only",
  "dualsense only",
  "dualshock only",
  "joy con only",
  "joy-con only",
  "remote only",
  "headset only",
  "charger only",
  "charging dock",
  "charging stand",
  "dock only",
  "dock station",
  "vertical stand",
  "base stand",
  "stand only",
  "faceplate",
  "face plate",
  "shell only",
  "replacement shell",
  "replacement housing",
  "cover only",
  "skin only",
  "case only",
  "carry case",
  "thumb grips",
  "thumb grip",
  "media remote",
  "remote control",
  "headset",
  "charger",
  "power cable only",
  "cable only",
  "hdmi cable",
  "fan only",
  "cooling fan",
  "mount only",
  "disc drive only",
  "disc reader only",
  "replacement part",
  "replacement parts",
  "portal",
  "playstation portal",
  "psvr",
  "vr2",
  "playstation vr",
  "empty box",
  "box only",
  "manual only",
  "cover plate",
  "side plate",
];

const ACCESSORY_CATEGORY_TERMS = [
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
];

const HARD_REJECT_TERMS = [
  "for parts",
  "for spares",
  "spares or repairs",
  "spares repairs",
  "parts only",
  "faulty",
  "broken",
  "not working",
  "no power",
  "wont turn on",
  "will not turn on",
  "repair required",
  "needs repair",
  "water damaged",
  "motherboard fault",
  "blue light of death",
  "console banned",
  "banned",
  "account locked",
  "motherboard only",
  "shell only",
  "empty box",
  "box only",
  "digital code",
  "download code",
  "game code",
];

const MINOR_WARNING_TERMS = [
  ["read description", "Read description carefully"],
  ["read desc", "Read description carefully"],
  ["see description", "Read description carefully"],
  ["read caption", "Seller may have important notes in caption"],
  ["see caption", "Seller may have important notes in caption"],
  ["no returns", "No returns accepted"],
  ["untested", "Untested listing"],
  ["poor condition", "Condition may reduce resale appeal"],
  ["heavy wear", "Condition may reduce resale appeal"],
  ["bad condition", "Condition may reduce resale appeal"],
  ["fair condition", "Condition may reduce resale appeal"],
  ["worn", "Condition may reduce resale appeal"],
  ["scratches", "Visible cosmetic wear mentioned"],
  ["scratched", "Visible cosmetic wear mentioned"],
  ["cosmetic marks", "Visible cosmetic wear mentioned"],
  ["cosmetic wear", "Visible cosmetic wear mentioned"],
  ["missing controller", "No controller included"],
  ["no controller", "No controller included"],
  ["without controller", "No controller included"],
  ["console only", "Console-only listing"],
  ["unit only", "Console-only listing"],
  ["tablet only", "Console-only listing"],
  ["unboxed", "No box included"],
  ["no box", "No box included"],
  ["without box", "No box included"],
  ["low firmware", "Specialist buyer wording"],
  ["jailbreak", "Specialist buyer wording"],
  ["modded", "Specialist buyer wording"],
  ["modded firmware", "Specialist buyer wording"],
  ["doesnt read discs", "Disc drive issue mentioned"],
  ["doesn't read discs", "Disc drive issue mentioned"],
  ["wont read discs", "Disc drive issue mentioned"],
  ["won't read discs", "Disc drive issue mentioned"],
  ["hdmi issue", "HDMI issue mentioned"],
  ["hdmi fault", "HDMI issue mentioned"],
  ["overheating", "Overheating risk mentioned"],
];

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
    .replace(/\bdisk edition\b/g, "disc edition")
    .replace(/\bdisk\b/g, "disc")
    .replace(/\bblu ray\b/g, "bluray")
    .replace(/\bblu-ray\b/g, "bluray")
    .replace(/\s+/g, " ")
    .trim();
}

function getCombinedItemText(item) {
  return normalizeConsoleText(
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

  if (t.includes("ps5") || t.includes("playstation5")) {
    if (t.includes("digital")) return "ps5_digital";
    return "ps5_disc";
  }

  return "";
}

function isAccessoryCategory(item) {
  const categoryText = getCategoryText(item);
  return hasAny(categoryText, ACCESSORY_CATEGORY_TERMS);
}

function hasStrongConsoleUnitSignal(text) {
  const t = normalizeConsoleText(text);

  if (t.includes("ps5") || t.includes("playstation5")) {
    return hasAny(t, [
      "console",
      "gaming console",
      "main unit",
      "system",
      "complete",
      "bundle",
      "digital edition",
      "disc edition",
      "standard edition",
      "with controller",
      "controller included",
      "boxed",
      "original box",
      "complete in box",
    ]);
  }

  if (t.includes("xbox")) {
    return hasAny(t, [
      "console",
      "gaming console",
      "main unit",
      "system",
      "complete",
      "bundle",
      "boxed",
      "original box",
      "complete in box",
    ]);
  }

  if (t.includes("switch") || t.includes("nintendo")) {
    return hasAny(t, [
      "console",
      "tablet",
      "unit",
      "system",
      "bundle",
      "boxed",
      "complete in box",
      "joy cons",
      "joy-cons",
    ]);
  }

  return false;
}

function isHardAccessoryListing(text, item) {
  const t = normalizeConsoleText(text);

  if (isAccessoryCategory(item)) return true;

  if (hasAny(t, HARD_ACCESSORY_TERMS)) {
    if (!hasStrongConsoleUnitSignal(t)) {
      return true;
    }

    const ultraAccessoryOnly = hasAny(t, [
      "faceplate",
      "face plate",
      "shell only",
      "replacement shell",
      "replacement housing",
      "cover only",
      "skin only",
      "case only",
      "carry case",
      "media remote",
      "remote only",
      "headset",
      "charger",
      "charging dock",
      "charging stand",
      "dock only",
      "vertical stand",
      "base stand",
      "stand only",
      "hdmi cable",
      "disc drive only",
      "disc reader only",
      "fan only",
      "cooling fan",
      "playstation portal",
      "portal",
      "psvr",
      "vr2",
      "playstation vr",
      "empty box",
      "box only",
      "manual only",
    ]);

    if (ultraAccessoryOnly) return true;
  }

  if (
    t.includes("controller") &&
    !hasStrongConsoleUnitSignal(t) &&
    !t.includes("console")
  ) {
    return true;
  }

  return false;
}

function isSeverelyBadConsole(text) {
  const t = normalizeConsoleText(text);

  return hasAny(t, [
    "for parts",
    "for spares",
    "spares or repairs",
    "spares repairs",
    "parts only",
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
    "motherboard only",
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
      "parts only",
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
      "no returns",
      "untested",
      "doesnt read discs",
      "doesn't read discs",
      "wont read discs",
      "won't read discs",
      "hdmi issue",
      "overheating",
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
  if (hasAny(t, ["with game", "with games", "game included", "games included", "includes game", "includes games"])) return 1;

  const matchedNamedGames = PS5_GAME_TERMS.filter((term) => t.includes(term));
  if (matchedNamedGames.length) return Math.min(matchedNamedGames.length, 3);

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
      "extra controller",
      "second controller",
      "spare controller",
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

    if (hasAny(t, ["hdmi issue", "doesnt read discs", "doesn't read discs", "wont read discs", "won't read discs"])) {
      return 25;
    }

    return 12;
  }

  return 0;
}

function detectPs5Variant(text = "") {
  const t = normalizeConsoleText(text);

  const digitalSignals = [
    "digital edition",
    "digital console",
    "all digital",
    "cfi 1116b",
    "cfi 1216b",
  ];

  const discSignals = [
    "disc edition",
    "disc version",
    "disc drive",
    "standard edition",
    "cfi 1116a",
    "cfi 1216a",
    "bluray",
  ];

  const mentionsDigital = hasAny(t, digitalSignals);
  const mentionsDisc = hasAny(t, discSignals);

  if (mentionsDigital && !mentionsDisc) return "digital";
  if (mentionsDisc && !mentionsDigital) return "disc";

  if (t.includes("digital") && !t.includes("disc drive")) return "digital";

  return "disc";
}

function detectConsoleType(text = "", family = "") {
  const t = normalizeConsoleText(text);

  if (family.startsWith("ps5") || t.includes("ps5") || t.includes("playstation5")) {
    return detectPs5Variant(t);
  }

  const isDigital =
    hasAny(t, [
      "digital",
      "digital edition",
      "discless",
      "no disc",
      "cfi 1116b",
      "cfi 1216b",
    ]);

  const isDisc =
    hasAny(t, [
      "disc",
      "disc edition",
      "bluray",
      "standard edition",
      "cfi 1116a",
      "cfi 1216a",
    ]);

  if (isDigital && !isDisc) return "digital";
  if (isDisc && !isDigital) return "disc";
  return "unknown";
}

function matchesConsoleFamily(text, queryContext) {
  const t = normalizeConsoleText(text);
  const family = String(queryContext?.family || "");
  const consoleType = detectConsoleType(t, family);

  if (!family) return true;

  if (family === "ps5_disc") {
    const hasPs5 = t.includes("ps5") || t.includes("playstation5");
    if (!hasPs5) return false;
    return consoleType === "disc";
  }

  if (family === "ps5_digital") {
    const hasPs5 = t.includes("ps5") || t.includes("playstation5");
    if (!hasPs5) return false;
    return consoleType === "digital";
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

  if (family.startsWith("ps5") || t.includes("ps5") || t.includes("playstation5")) {
    bonus += extraControllerCount * 35;
    bonus += Math.min(includedGamesCount, 6) * 12;
    if (hasBox) bonus += 8;
    if (hasAccessories) bonus += 10;

    if (PS5_GAME_TERMS.some((term) => t.includes(term))) {
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

  for (const [needle, flag] of MINOR_WARNING_TERMS) {
    if (t.includes(needle) && !flags.includes(flag)) {
      flags.push(flag);
    }
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
    else if (flag === "No returns accepted") penalty += 9;
    else if (flag === "Untested listing") penalty += 10;
    else if (flag === "No controller included") penalty += 10;
    else if (flag === "Console-only listing") penalty += 6;
    else if (flag === "No box included") penalty += 2;
    else if (flag === "Condition may reduce resale appeal") penalty += 5;
    else if (flag === "Visible cosmetic wear mentioned") penalty += 4;
    else if (flag === "Specialist buyer wording") penalty += 5;
    else if (flag === "Disc drive issue mentioned") penalty += 18;
    else if (flag === "HDMI issue mentioned") penalty += 16;
    else if (flag === "Overheating risk mentioned") penalty += 14;
    else if (flag === "Bundle intent was searched, but extras look weak") penalty += 6;
  }

  return penalty;
}

function getDiscDigitalPricingBias(queryContext, text) {
  const family = String(queryContext?.family || "");
  const consoleType = detectConsoleType(text, family);

  if (family === "ps5_disc") {
    if (consoleType === "disc") return 18;
    return -18;
  }

  if (family === "ps5_digital") {
    if (consoleType === "digital") return -10;
    return 10;
  }

  if (consoleType === "disc") return 8;
  if (consoleType === "digital") return -6;
  return 0;
}

function scoreConsoleCandidate(item, queryContext) {
  const text = getCombinedItemText(item);

  if (!text) return -10;
  if (isHardAccessoryListing(text, item)) return -10;
  if (!hasStrongConsoleUnitSignal(text)) return -10;
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
  const consoleType = detectConsoleType(text, queryContext.family || "");

  if (queryContext.brand) {
    if (itemBrand === queryContext.brand) score += 1.2;
    else return -10;
  }

  if (matchesConsoleFamily(text, queryContext)) {
    score += 5.5;
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

  if (queryContext.family === "ps5_disc" && consoleType === "disc") score += 1;
  if (queryContext.family === "ps5_digital" && consoleType === "digital") score += 1;

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
            Math.min(warningPenalty, 12) -
            discDigitalBias
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
    baseline = roundMoney(baseline + 18);
    pricingMode = "PS5 disc median";
  } else if (queryContext.family === "ps5_digital") {
    baseline = roundMoney(Math.max(0, baseline - 10));
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
      normalizedQuery.includes("includes") ||
      normalizedQuery.includes("extra controller") ||
      normalizedQuery.includes("2 controllers") ||
      normalizedQuery.includes("two controllers");

    return {
      rawQuery,
      normalizedQuery,
      brand,
      family,
      allowDamaged,
      wantsBundle,
    };
  },

  buildSearchQuery(query = "") {
    const ctx = this.classifyQuery(query);

    if (ctx.family === "ps5_disc" || ctx.family === "ps5_digital") {
      return "ps5";
    }

    if (ctx.family === "xbox_series_x") {
      return "xbox series x";
    }

    if (ctx.family === "xbox_series_s") {
      return "xbox series s";
    }

    if (ctx.family === "switch_oled") {
      return "nintendo switch oled";
    }

    if (ctx.family === "switch_lite") {
      return "nintendo switch lite";
    }

    if (ctx.family === "switch_v2") {
      return "nintendo switch";
    }

    return String(query || "").trim();
  },

  expandSearchVariants(query = "") {
    const rawQuery = String(query || "").trim();
    const ctx = this.classifyQuery(rawQuery);

    if (ctx.family === "ps5_disc" || ctx.family === "ps5_digital") {
      return ["ps5"];
    }

    if (ctx.family === "xbox_series_x") {
      return ["xbox series x"];
    }

    if (ctx.family === "xbox_series_s") {
      return ["xbox series s"];
    }

    if (ctx.family === "switch_oled") {
      return ["nintendo switch oled"];
    }

    if (ctx.family === "switch_lite") {
      return ["nintendo switch lite"];
    }

    if (ctx.family === "switch_v2") {
      return ["nintendo switch"];
    }

    return [rawQuery].filter(Boolean);
  },

  matchesItem(item, queryContext) {
    const text = getCombinedItemText(item);

    if (!text) return false;
    if (isHardAccessoryListing(text, item)) return false;
    if (!hasStrongConsoleUnitSignal(text)) return false;
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
        bundleSignals.explicitBundleWords ||
        bundleSignals.hasAccessories;

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
