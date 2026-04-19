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
  [
    "ps5_disc",
    [
      "ps5 disc",
      "ps5 disk",
      "playstation 5 disc",
      "playstation 5 disk",
      "ps5 standard",
      "playstation 5 standard",
      "standard edition",
      "disc edition",
      "disk edition",
      "cfi 1116a",
      "cfi 1216a",
      "cfi-1116a",
      "cfi-1216a",
      "cfi 10",
      "cfi-10",
      "cfi 11",
      "cfi-11",
      "cfi 12",
      "cfi-12",
    ],
  ],
  [
    "ps5_digital",
    [
      "ps5 digital",
      "playstation 5 digital",
      "digital edition",
      "digital console",
      "all digital",
      "discless",
      "disc less",
      "cfi 1116b",
      "cfi 1216b",
      "cfi-1116b",
      "cfi-1216b",
    ],
  ],
  ["xbox_series_x", ["xbox series x", "series x"]],
  ["xbox_series_s", ["xbox series s", "series s"]],
  ["switch_oled", ["switch oled", "nintendo switch oled", "oled model"]],
  ["switch_lite", ["switch lite", "nintendo switch lite"]],
  ["switch_v2", ["nintendo switch", "switch console"]],
];

const CONSOLE_CATEGORY_TERMS = [
  "video game consoles",
  "consoles",
  "home consoles",
  "game consoles",
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

const NON_CONSOLE_CATEGORY_TERMS = [
  "video game merchandise",
  "merchandise",
  "video games",
  "strategy guides cheats",
  "strategy guides & cheats",
  "soundtracks",
  "books, comics & magazines",
  "action figures",
  "toys to life products",
];

const ACCESSORY_TERMS = [
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
  "charger dock",
  "cooler",
  "cooling stand",
  "shell cover",
];

const NON_CONSOLE_TERMS = [
  "collector’s edition",
  "collector's edition",
  "collectors edition",
  "collector edition",
  "game not included",
  "no game",
  "without game",
  "disc only",
  "game only",
  "ps5 game",
  "playstation 5 game",
  "steelbook",
  "steel book",
  "art book",
  "artbook",
  "soundtrack",
  "figurine",
  "figure",
  "statue",
  "merchandise",
  "merch",
  "poster",
  "novelty",
  "keyring",
  "keychain",
  "mouse mat",
  "mousepad",
  "t shirt",
  "t-shirt",
  "hoodie",
  "lamp",
  "display stand",
  "display piece",
  "ornament",
  "vinyl",
  "sound track",
  "dlc",
  "download code",
  "digital code",
  "voucher",
  "gift card",
  "season pass",
  "wall art",
  "canvas print",
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
  "ea sports fc",
  "astro bot",
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

function hasAny(text, phrases = []) {
  return phrases.some((phrase) => text.includes(phrase));
}

function normalizeConsoleText(value) {
  return normalizeText(String(value || ""))
    .replace(/\bps\s*5\b/g, "ps5")
    .replace(/\bplaystation\s*5\b/g, "playstation5")
    .replace(/\bplaystation 5\b/g, "playstation5")
    .replace(/\bsony ps5\b/g, "ps5")
    .replace(/\bplaystation 5 console\b/g, "playstation5 console")
    .replace(/\bdisk edition\b/g, "disc edition")
    .replace(/\bdisk\b/g, "disc")
    .replace(/\bblu ray\b/g, "bluray")
    .replace(/\bblu-ray\b/g, "bluray")
    .replace(/\s+/g, " ")
    .trim();
}

function getTitleText(item) {
  return normalizeConsoleText([item?.title, item?.subtitle].filter(Boolean).join(" "));
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

function isPs5Like(text) {
  const t = normalizeConsoleText(text);
  return t.includes("ps5") || t.includes("playstation5");
}

function isConsoleCategory(item) {
  const categoryText = getCategoryText(item);
  return hasAny(categoryText, CONSOLE_CATEGORY_TERMS);
}

function isAccessoryCategory(item) {
  const categoryText = getCategoryText(item);
  return hasAny(categoryText, ACCESSORY_CATEGORY_TERMS);
}

function isNonConsoleCategory(item) {
  const categoryText = getCategoryText(item);
  return hasAny(categoryText, NON_CONSOLE_CATEGORY_TERMS);
}

function hasStrongConsoleSignals(text) {
  const t = normalizeConsoleText(text);

  return hasAny(t, [
    "console",
    "ps5 console",
    "playstation5 console",
    "disc edition",
    "digital edition",
    "standard edition",
    "standard console",
    "slim",
    "cfi-",
    "cfi ",
    "1tb",
    "825gb",
    "825 gb",
    "with controller",
    "controller included",
    "boxed",
  ]);
}

function hasBundleAllowance(text) {
  const t = normalizeConsoleText(text);

  return hasAny(t, [
    "with controller",
    "controller included",
    "2 controllers",
    "two controllers",
    "extra controller",
    "second controller",
    "spare controller",
    "with games",
    "games included",
    "bundle",
    "comes with",
    "includes",
  ]);
}

function looksLikeMainConsoleTitle(text) {
  const t = normalizeConsoleText(text);

  if (!isPs5Like(t)) return false;
  if (t.includes("console")) return true;
  if (t.includes("standard edition")) return true;
  if (t.includes("standard console")) return true;
  if (t.includes("disc edition")) return true;
  if (t.includes("digital edition")) return true;
  if (t.includes("slim")) return true;
  if (t.includes("cfi-") || t.includes("cfi ")) return true;
  if (t.includes("1tb") || t.includes("825gb") || t.includes("825 gb")) return true;

  return false;
}

function isHardAccessoryListing(text, item) {
  const t = normalizeConsoleText(text);
  const titleText = getTitleText(item);

  if (looksLikeMainConsoleTitle(titleText)) return false;

  if (isAccessoryCategory(item) && !hasStrongConsoleSignals(titleText)) return true;

  if (hasAny(titleText, ACCESSORY_TERMS)) {
    if (!hasStrongConsoleSignals(titleText) && !hasBundleAllowance(titleText)) {
      return true;
    }

    if (
      hasAny(titleText, [
        "faceplate",
        "face plate",
        "remote only",
        "media remote",
        "headset only",
        "charger only",
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
        "case only",
        "carry case",
      ])
    ) {
      return true;
    }
  }

  if (
    titleText.includes("controller") &&
    !hasAny(titleText, [
      "with controller",
      "controller included",
      "2 controllers",
      "two controllers",
      "extra controller",
      "second controller",
      "ps5 console",
      "playstation5 console",
      "console",
      "bundle",
    ])
  ) {
    return true;
  }

  if (
    t.includes("dualsense") &&
    !t.includes("console") &&
    !t.includes("bundle")
  ) {
    return true;
  }

  return false;
}

function isClearlyNonConsole(item, text) {
  const t = normalizeConsoleText(text);
  const titleText = getTitleText(item);

  if (looksLikeMainConsoleTitle(titleText)) return false;

  if (isNonConsoleCategory(item) && !hasStrongConsoleSignals(titleText)) return true;

  if (hasAny(titleText, NON_CONSOLE_TERMS)) return true;

  if (
    isPs5Like(t) &&
    hasAny(titleText, [
      "collector’s edition",
      "collector's edition",
      "collectors edition",
      "collector edition",
      "steelbook",
      "art book",
      "soundtrack",
      "no game",
      "game not included",
      "disc only",
      "game only",
    ])
  ) {
    return true;
  }

  return false;
}

function isSeverelyBadConsole(text) {
  const t = normalizeConsoleText(text);
  return hasAny(t, HARD_REJECT_TERMS) || hasAny(t, ["hdmi fault", "no hdmi", "overheating issue"]);
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
  if (matchedNamedGames.length) {
    return Math.min(matchedNamedGames.length, 3);
  }

  return 0;
}

function detectBundleSignals(text, family) {
  const t = normalizeConsoleText(text);
  const extraControllerCount = detectExtraControllerCount(t);
  const includedGamesCount = detectIncludedGamesCount(t);

  const hasBox = hasAny(t, ["boxed", "box included", "original box", "complete in box"]) ? 1 : 0;

  const hasAccessories = hasAny(t, [
    "with headset",
    "with charging station",
    "with dock",
    "with camera",
    "with media remote",
    "with accessories",
    "extras included",
    "with extra accessories",
    "plus headset",
    "plus accessories",
  ]) ? 1 : 0;

  const explicitBundleWords = hasAny(t, [
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
    if (hasAny(t, ["doesnt read discs", "doesn't read discs", "wont read discs", "won't read discs"])) {
      return 25;
    }

    if (hasAny(t, ["hdmi issue"])) {
      return 25;
    }

    if (hasAny(t, ["overheating"])) {
      return 20;
    }

    return 10;
  }

  if (hasAny(t, ["no controller", "missing controller"])) {
    if (family.startsWith("ps5")) return 30;
    if (family.startsWith("xbox_series")) return 28;
    if (family.startsWith("switch")) return 35;
  }

  return 0;
}

function detectPs5Variant(text = "") {
  const t = normalizeConsoleText(text);

  const digitalSignals = [
    "digital edition",
    "digital console",
    "all digital",
    "digital model",
    "discless",
    "disc less",
    "cfi 1116b",
    "cfi 1216b",
    "cfi-1116b",
    "cfi-1216b",
  ];

  const discSignals = [
    "disc edition",
    "disc version",
    "standard edition",
    "standard console",
    "bluray",
    "cfi 1116a",
    "cfi 1216a",
    "cfi-1116a",
    "cfi-1216a",
    "cfi 10",
    "cfi-10",
    "cfi 11",
    "cfi-11",
    "cfi 12",
    "cfi-12",
  ];

  const mentionsDigital = hasAny(t, digitalSignals);
  const mentionsDisc = hasAny(t, discSignals);

  if (mentionsDigital && !mentionsDisc) return "digital";
  if (mentionsDisc && !mentionsDigital) return "disc";

  if (
    t.includes("digital") &&
    !t.includes("disc drive") &&
    !t.includes("disc edition") &&
    !t.includes("standard edition")
  ) {
    return "digital";
  }

  if (
    t.includes("disc drive") ||
    t.includes("disc version") ||
    t.includes("disc edition") ||
    t.includes("standard edition")
  ) {
    return "disc";
  }

  return "unknown";
}

function detectConsoleType(text = "", family = "") {
  const t = normalizeConsoleText(text);

  if (family.startsWith("ps5") || isPs5Like(t)) {
    return detectPs5Variant(t);
  }

  const isDigital = hasAny(t, [
    "digital",
    "digital edition",
    "discless",
    "no disc",
    "cfi 1116b",
    "cfi 1216b",
    "cfi-1116b",
    "cfi-1216b",
  ]);

  const isDisc = hasAny(t, [
    "disc",
    "disc edition",
    "bluray",
    "standard edition",
    "cfi 1116a",
    "cfi 1216a",
    "cfi-1116a",
    "cfi-1216a",
  ]);

  if (isDigital && !isDisc) return "digital";
  if (isDisc && !isDigital) return "disc";
  return "unknown";
}

function matchesConsoleFamily(text, queryContext, item) {
  const t = normalizeConsoleText(text);
  const family = String(queryContext?.family || "");
  const consoleType = detectConsoleType(t, family);
  const titleText = getTitleText(item);

  if (!family) return true;

  if (family === "ps5_disc") {
    if (!isPs5Like(t)) return false;
    if (isClearlyNonConsole(item, titleText || t)) return false;
    if (isHardAccessoryListing(titleText || t, item)) return false;
    if (consoleType === "digital") return false;

    return true;
  }

  if (family === "ps5_digital") {
    if (!isPs5Like(t)) return false;
    if (isClearlyNonConsole(item, titleText || t)) return false;
    if (isHardAccessoryListing(titleText || t, item)) return false;
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
    if (PS5_GAME_TERMS.some((term) => t.includes(term))) bonus += 8;
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
    if (flag === "Read description carefully") penalty += 6;
    else if (flag === "Seller may have important notes in caption") penalty += 4;
    else if (flag === "No returns accepted") penalty += 6;
    else if (flag === "Untested listing") penalty += 7;
    else if (flag === "No controller included") penalty += 7;
    else if (flag === "Console-only listing") penalty += 4;
    else if (flag === "No box included") penalty += 1;
    else if (flag === "Condition may reduce resale appeal") penalty += 4;
    else if (flag === "Visible cosmetic wear mentioned") penalty += 3;
    else if (flag === "Specialist buyer wording") penalty += 4;
    else if (flag === "Disc drive issue mentioned") penalty += 14;
    else if (flag === "HDMI issue mentioned") penalty += 13;
    else if (flag === "Overheating risk mentioned") penalty += 12;
    else if (flag === "Bundle intent was searched, but extras look weak") penalty += 4;
  }

  return penalty;
}

function getDiscDigitalPricingBias(queryContext, text) {
  const family = String(queryContext?.family || "");
  const consoleType = detectConsoleType(text, family);

  if (family === "ps5_disc") {
    if (consoleType === "disc") return 16;
    if (consoleType === "unknown") return 10;
    return -24;
  }

  if (family === "ps5_digital") {
    if (consoleType === "digital") return -8;
    return 14;
  }

  if (consoleType === "disc") return 7;
  if (consoleType === "digital") return -5;
  return 0;
}

function getMatchDebug(item, queryContext) {
  const titleText = getTitleText(item);
  const text = getCombinedItemText(item);
  const conditionState = classifyConsoleConditionState(text);
  const itemBrand = detectConsoleBrand(text);
  const familyMatch = matchesConsoleFamily(text, queryContext, item);
  const bundleSignals = detectBundleSignals(text, queryContext.family || "");
  const isRealBundle =
    bundleSignals.bundleType === "bundle" ||
    bundleSignals.extraControllerCount > 0 ||
    bundleSignals.includedGamesCount > 0 ||
    bundleSignals.explicitBundleWords ||
    bundleSignals.hasAccessories;

  if (!text) return { matched: false, reason: "empty_text" };
  if (isHardAccessoryListing(text, item)) return { matched: false, reason: "accessory_listing" };
  if (isClearlyNonConsole(item, text)) return { matched: false, reason: "non_console_listing" };
  if (isSeverelyBadConsole(text) && !queryContext.allowDamaged) {
    return { matched: false, reason: "severely_bad_console_blocked" };
  }
  if (!queryContext.allowDamaged && isDamagedConsoleConditionState(conditionState)) {
    return { matched: false, reason: `condition_blocked_${conditionState}` };
  }
  if (queryContext.brand && itemBrand !== queryContext.brand) {
    return { matched: false, reason: `brand_mismatch_${itemBrand || "unknown"}` };
  }
  if (!familyMatch) {
    return {
      matched: false,
      reason: `family_mismatch_${queryContext.family || "none"}`,
      consoleType: detectConsoleType(titleText || text, queryContext.family || ""),
    };
  }
  if (queryContext.wantsBundle && !isRealBundle) {
    return { matched: false, reason: "bundle_required_but_not_detected" };
  }

  return {
    matched: true,
    reason: "matched",
    conditionState,
    bundleType: bundleSignals.bundleType,
    consoleType: detectConsoleType(titleText || text, queryContext.family || ""),
  };
}

function scoreConsoleCandidate(item, queryContext) {
  const titleText = getTitleText(item);
  const text = getCombinedItemText(item);

  if (!text) return -10;
  if (isHardAccessoryListing(text, item)) return -10;
  if (isClearlyNonConsole(item, text)) return -10;
  if (isSeverelyBadConsole(text) && !shouldAllowDamagedConsoles(queryContext)) return -10;

  const conditionState = classifyConsoleConditionState(text);
  const allowDamaged = shouldAllowDamagedConsoles(queryContext);

  if (!allowDamaged && isDamagedConsoleConditionState(conditionState)) {
    return -10;
  }

  const itemBrand = detectConsoleBrand(text);
  const bundleSignals = detectBundleSignals(text, queryContext.family || "");
  const bundleType = bundleSignals.bundleType;
  const consoleType = detectConsoleType(titleText || text, queryContext.family || "");

  let score = 0;

  if (queryContext.brand) {
    if (itemBrand === queryContext.brand) score += 1.2;
    else return -10;
  }

  if (matchesConsoleFamily(text, queryContext, item)) {
    score += 4.9;
  } else {
    return -10;
  }

  if (isConsoleCategory(item)) score += 1.3;
  if (conditionState === "clean_working") score += 1.5;
  if (conditionState === "minor_fault") score -= 1.5;
  if (conditionState === "faulty_or_parts") score -= 8;

  if (bundleType === "bundle") score += 1.25;
  if (bundleType === "boxed") score += 0.45;
  if (bundleType === "console_only") score -= 0.35;

  score += Math.min(bundleSignals.extraControllerCount, 2) * 0.55;
  score += Math.min(bundleSignals.includedGamesCount, 4) * 0.2;
  if (bundleSignals.hasAccessories) score += 0.2;
  if (bundleSignals.explicitBundleWords) score += 0.3;

  if (queryContext.family === "ps5_disc" && consoleType === "disc") score += 1.0;
  if (queryContext.family === "ps5_disc" && consoleType === "unknown") score += 0.9;
  if (queryContext.family === "ps5_digital" && consoleType === "digital") score += 1.2;

  const warningFlags = buildConsoleWarningFlags(text, queryContext, bundleSignals);
  const warningPenalty = calculateWarningPenalty(warningFlags);

  return score - warningPenalty * 0.045;
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
      const matchDebug = getMatchDebug(item, queryContext);

      return {
        item,
        total: extractTotalPrice(item),
        adjustedTotal: roundMoney(
          extractTotalPrice(item) -
            bundleValueBonus +
            Math.min(warningPenalty, 8) -
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
        matchDebug,
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
      : marketConditionPool.filter((entry) => entry.score >= 1.6);

  const exactListings = listingConditionPool.filter((entry) => entry.score >= 5.0);
  const usableListings =
    exactListings.length >= 2
      ? exactListings
      : listingConditionPool.filter((entry) => entry.score >= 1.6);

  let marketTotals = removePriceOutliers(
    (usableMarket.length ? usableMarket : marketConditionPool)
      .slice(0, 28)
      .map((entry) => entry.adjustedTotal)
      .filter((value) => value > 0)
  );

  let listingTotals = removePriceOutliers(
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

  const marketMedian = median(marketTotals);
  const marketLow = percentile(marketTotals, 0.35);
  const listingMedian = median(listingTotals);

  let pricingMode = "Console model median";
  let baseline = marketMedian || marketLow || listingMedian || 0;

  if (!marketMedian && listingMedian) pricingMode = "Console listings fallback";
  if (!marketMedian && !listingMedian && marketLow) pricingMode = "Console low-band fallback";

  if (!baseline && queryContext.family === "ps5_disc") {
    baseline = 405;
    pricingMode = "PS5 disc hard fallback";
  } else if (!baseline && queryContext.family === "ps5_digital") {
    baseline = 330;
    pricingMode = "PS5 digital hard fallback";
  }

  let conservativeMultiplier = 0.955;
  if (exactMarket.length >= 5) conservativeMultiplier = 0.965;

  if (queryContext.family === "ps5_disc") {
    baseline = roundMoney(baseline + 18);
    pricingMode = pricingMode.includes("fallback") ? pricingMode : "PS5 disc median";
  } else if (queryContext.family === "ps5_digital") {
    baseline = roundMoney(Math.max(0, baseline - 6));
    pricingMode = pricingMode.includes("fallback") ? pricingMode : "PS5 digital median";
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

  if (pricingMode === "PS5 disc hard fallback" || pricingMode === "PS5 digital hard fallback") {
    confidence = Math.min(confidence, 46);
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
    },
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
    debug: {
      discDigitalBias,
      consoleType: detectConsoleType(getTitleText(item) || text, queryContext.family || ""),
    },
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

    if (ctx.family === "ps5_disc") {
      return [
        "ps5",
        "playstation 5",
        "ps5 console",
        "sony ps5",
        "playstation 5 console",
        "ps5 disc",
        "ps5 standard",
        "ps5 bundle",
      ];
    }

    if (ctx.family === "ps5_digital") {
      return [
        "ps5",
        "ps5 digital",
        "playstation 5 digital",
        "digital edition ps5",
        "ps5 digital console",
      ];
    }

    if (ctx.family === "xbox_series_x") {
      return ["xbox series x", "series x", "xbox series x console"];
    }

    if (ctx.family === "xbox_series_s") {
      return ["xbox series s", "series s", "xbox series s console"];
    }

    if (ctx.family === "switch_oled") {
      return ["nintendo switch oled", "switch oled"];
    }

    if (ctx.family === "switch_lite") {
      return ["nintendo switch lite", "switch lite"];
    }

    if (ctx.family === "switch_v2") {
      return ["nintendo switch", "switch console"];
    }

    return [rawQuery].filter(Boolean);
  },

  matchesItem(item, queryContext) {
    return getMatchDebug(item, queryContext).matched;
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
  },

  adjustListingPricing({ queryContext, item, pricingModel }) {
    const baseResale = Number(pricingModel?.estimatedResale || 0);
    return applyBundleValueToListing(queryContext, item, baseResale);
  },
};
