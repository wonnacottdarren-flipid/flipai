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
      "disc version",
      "bluray edition",
      "blu ray edition",
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
  "console shell",
  "replacement fan",
  "housing only",
  "outer shell",
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
  "membership",
  "subscription",
  "nintendo switch online",
  "online expansion pack",
  "expansion pack",
  "online membership",
  "membership code",
  "digital download",
  "digital item",
  "digital only",
  "emailed code",
  "email delivery",
  "instant delivery",
  "account",
  "accounts",
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
  "won't turn on",
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
  ["heavily used", "Condition may reduce resale appeal"],
  ["lot of wear", "Condition may reduce resale appeal"],
  ["bad condition", "Condition may reduce resale appeal"],
  ["fair condition", "Condition may reduce resale appeal"],
  ["well used", "Condition may reduce resale appeal"],
  ["worn", "Condition may reduce resale appeal"],

  ["scratches", "Visible cosmetic wear mentioned"],
  ["scratched", "Visible cosmetic wear mentioned"],
  ["scratch", "Visible cosmetic wear mentioned"],
  ["scratched up", "Visible cosmetic wear mentioned"],
  ["heavy scratches", "Visible cosmetic wear mentioned"],
  ["wear scratch", "Visible cosmetic wear mentioned"],
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
    .replace(/\b1 tb\b/g, "1tb")
    .replace(/\b825 gb\b/g, "825gb")
    .replace(/\bseries\s*x\b/g, "series x")
    .replace(/\bseries\s*s\b/g, "series s")
    .replace(/\bjoy\s*cons\b/g, "joy cons")
    .replace(/\bjoy\s*con\b/g, "joy con")
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

function isSwitchV2Signal(text = "") {
  const t = normalizeConsoleText(text);

  return hasAny(t, [
    "switch v2",
    "nintendo switch v2",
    "hac-001(-01)",
    "hac 001(-01)",
    "hac-001 01",
    "hac 001 01",
    "hac-001-01",
    "hac 001 01 model",
    "revised model",
    "improved battery",
    "better battery",
    "battery improved",
    "new battery model",
    "mariko",
    "red box model",
  ]);
}

function isSwitchV1Signal(text = "") {
  const t = normalizeConsoleText(text);

  const directSignals = [
    "switch v1",
    "nintendo switch v1",
    "unpatched switch",
    "unpatched v1",
    "first generation switch",
    "gen 1 switch",
    "generation 1 switch",
    "launch model",
    "day one switch",
    "switch one",
    "nintendo switch one",
    "switch 1",
    "nintendo switch 1",
    "gen1 switch",
    "generation1 switch",
    "first gen switch",
    "1st gen switch",
    "v1 console",
    "v1 model",
  ];

  if (hasAny(t, directSignals)) return true;

  const hasBaseHac001 =
    t.includes("hac-001 ") ||
    t.includes("hac 001 ") ||
    t.includes("hac-001)") ||
    t.includes("hac 001)") ||
    t.endsWith("hac-001") ||
    t.endsWith("hac 001") ||
    t.includes("model hac-001") ||
    t.includes("model hac 001");

  if (hasBaseHac001 && !isSwitchV2Signal(t)) return true;

  return false;
}

function detectSwitchGeneration(text = "") {
  const t = normalizeConsoleText(text);

  if (isSwitchV2Signal(t)) return "v2";
  if (isSwitchV1Signal(t)) return "v1";
  return "unknown";
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
    "with controller",
    "controller included",
    "boxed",
    "xbox series x console",
    "xbox series s console",
    "nintendo switch console",
    "switch oled console",
    "switch lite console",
  ]);
}

function looksLikeMainConsoleTitle(text) {
  const t = normalizeConsoleText(text);

  if (
    hasAny(t, [
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
      "with controller",
      "controller included",
      "boxed",
      "xbox series x console",
      "xbox series s console",
      "nintendo switch console",
      "switch oled console",
      "switch lite console",
    ])
  ) {
    return true;
  }

  if (
    t === "ps5" ||
    t === "playstation5" ||
    t === "xbox series x" ||
    t === "xbox series s" ||
    t === "nintendo switch"
  ) {
    return true;
  }

  if (
    (t.startsWith("ps5 ") || t.startsWith("playstation5 ")) &&
    hasAny(t, ["console", "edition", "standard", "digital", "disc", "slim", "cfi"])
  ) {
    return true;
  }

  if (
    (t.startsWith("xbox series x") || t.startsWith("xbox series s")) &&
    hasAny(t, ["console", "1tb", "512gb", "boxed", "with controller"])
  ) {
    return true;
  }

  if (
    (t.startsWith("nintendo switch") || t.startsWith("switch oled") || t.startsWith("switch lite")) &&
    hasAny(t, ["console", "32gb", "64gb", "hac-", "hadh-", "hdk-", "boxed", "joy con", "joy-cons", "joy cons"])
  ) {
    return true;
  }

  return false;
}

function isObviousAccessoryTitle(titleText) {
  const t = normalizeConsoleText(titleText);

  if (looksLikeMainConsoleTitle(t)) return false;

  if (
    hasAny(t, [
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
      "cover plate",
      "side plate",
      "shell only",
      "replacement shell",
      "replacement housing",
      "cover only",
      "skin only",
      "controller only",
      "dualsense only",
      "dualshock only",
      "remote control",
      "thumb grip",
      "thumb grips",
      "mount only",
      "power cable only",
      "cable only",
      "joy con only",
      "joy-con only",
      "joy cons only",
      "joy-cons only",
    ])
  ) {
    return true;
  }

  if (
    t.includes("controller") &&
    !hasAny(t, [
      "with controller",
      "controller included",
      "2 controllers",
      "two controllers",
      "extra controller",
      "second controller",
      "console",
      "bundle",
      "boxed",
    ])
  ) {
    return true;
  }

  if (t.includes("dualsense") && !t.includes("console") && !t.includes("bundle")) {
    return true;
  }

  if (
    (t.includes("joy con") || t.includes("joy-cons") || t.includes("joy cons")) &&
    !t.includes("console") &&
    !t.includes("bundle")
  ) {
    return true;
  }

  return false;
}

function isHardAccessoryListing(text, item) {
  const titleText = getTitleText(item);
  const combinedText = normalizeConsoleText(text);

  if (looksLikeMainConsoleTitle(titleText)) return false;
  if (isObviousAccessoryTitle(titleText)) return true;

  if (isAccessoryCategory(item) && !hasStrongConsoleSignals(titleText)) {
    return true;
  }

  if (
    hasAny(combinedText, ACCESSORY_TERMS) &&
    !hasStrongConsoleSignals(titleText) &&
    !looksLikeMainConsoleTitle(titleText)
  ) {
    return true;
  }

  return false;
}

function isDigitalCodeOrMembership(item, text) {
  const titleText = getTitleText(item);
  const categoryText = getCategoryText(item);
  const combinedText = normalizeConsoleText(text);

  if (
    hasAny(titleText, [
      "membership",
      "subscription",
      "nintendo switch online",
      "online expansion pack",
      "expansion pack",
      "online membership",
      "membership code",
      "download code",
      "digital code",
      "digital download",
      "voucher",
      "gift card",
      "season pass",
      "dlc",
      "instant delivery",
      "email delivery",
      "emailed code",
      "12 month membership",
      "3 month membership",
    ])
  ) {
    return true;
  }

  if (
    hasAny(combinedText, [
      "membership",
      "subscription",
      "nintendo switch online",
      "online expansion pack",
      "expansion pack",
      "online membership",
      "membership code",
      "download code",
      "digital code",
      "digital download",
      "voucher",
      "gift card",
      "season pass",
      "dlc",
      "instant delivery",
      "email delivery",
      "emailed code",
    ])
  ) {
    return true;
  }

  if (
    hasAny(categoryText, [
      "video games",
      "strategy guides cheats",
      "strategy guides & cheats",
      "soundtracks",
    ]) &&
    !hasStrongConsoleSignals(titleText)
  ) {
    return true;
  }

  return false;
}

function isClearlyNonConsole(item, text) {
  const combinedText = normalizeConsoleText(text);
  const titleText = getTitleText(item);

  if (isDigitalCodeOrMembership(item, combinedText)) return true;

  if (looksLikeMainConsoleTitle(titleText)) return false;

  if (isNonConsoleCategory(item) && !hasStrongConsoleSignals(titleText)) return true;
  if (hasAny(titleText, NON_CONSOLE_TERMS)) return true;

  if (
    isPs5Like(combinedText) &&
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

function isIncompleteSwitchConsole(text, queryContext = {}) {
  const t = normalizeConsoleText(text);
  const family = String(queryContext?.family || "");

  if (!family.startsWith("switch")) return false;

  return hasAny(t, [
    "tablet only",
    "screen only",
    "main unit only",
    "console only",
    "no dock",
    "without dock",
    "missing dock",
    "dock not included",
    "dock missing",
    "no joy con",
    "no joy-cons",
    "no joy cons",
    "without joy con",
    "without joy-cons",
    "without joy cons",
    "missing joy con",
    "missing joy-cons",
    "missing joy cons",
    "joy cons not included",
    "joy-cons not included",
    "joy con not included",
    "hac-001 tablet only",
    "tablet unit only",
    "screen tablet only",
    "main tablet only",
    "switch tablet only",
    "switch screen only",
    "with docking station only",
    "docking station only",
    "console with docking station only",
    "tablet and dock only",
    "console and dock only",
    "dock + tablet only",
    "just tablet and dock",
    "only tablet and dock",
    "tablet with dock only",
    "main unit and dock only",
    "dock and charger only",
    "tablet plus dock only",
    "screen and dock only",
    "switch only no joy cons",
    "switch console only no joy cons",
    "switch only without joy cons",
    "switch without joy cons",
    "tablet + dock no joy cons",
    "no joy cons included",
    "no joy-con included",
    "joy cons missing",
    "joy-cons missing",
  ]);
}

function isSeverelyBadConsole(text, queryContext = {}) {
  const t = normalizeConsoleText(text);

  if (isIncompleteSwitchConsole(t, queryContext)) return true;

  return (
    hasAny(t, HARD_REJECT_TERMS) ||
    hasAny(t, [
      "hdmi fault",
      "no hdmi",
      "overheating issue",
      "heavy damage",
      "screen only",
      "tablet only",
      "main unit only",
    ])
  );
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
      "parts",
      "faulty",
      "broken",
      "not working",
      "no power",
      "wont turn on",
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
      "heavy damage",
      "screen only",
      "tablet only",
      "main unit only",
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
      "missing thumbstick",
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

function detectBundleSignals(text, family) {
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
      "case",
    ]) ? 1 : 0;

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
    if (hasAny(t, ["hdmi issue"])) return 25;
    if (hasAny(t, ["overheating"])) return 20;
    if (hasAny(t, ["missing thumbstick"])) return 12;
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
    t.includes("standard edition") ||
    t.includes("bluray")
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

function isGenericUnknownSwitchTitle(titleText = "") {
  const t = normalizeConsoleText(titleText);

  return (
    t === "nintendo switch" ||
    t === "switch console" ||
    t === "nintendo switch console" ||
    t === "nintendo switch 32gb console" ||
    t === "nintendo switch 32 gb console" ||
    t === "nintendo switch console 32gb" ||
    t === "nintendo switch console 32 gb"
  );
}

function getSwitchPricingBucket(item, queryContext) {
  const titleText = getTitleText(item);
  const text = getCombinedItemText(item);
  const generation = detectSwitchGeneration(`${titleText} ${text}`);
  const family = String(queryContext?.family || "");

  if (family === "switch_oled") return "oled";
  if (family === "switch_lite") return "lite";
  if (!family.startsWith("switch")) return "other";

  if (generation === "v2") return "switch_v2_confirmed";
  if (generation === "v1") return "switch_v1_confirmed";
  return "switch_unknown_standard";
}

function matchesConsoleFamily(text, queryContext, item) {
  const t = normalizeConsoleText(text);
  const family = String(queryContext?.family || "");
  const consoleType = detectConsoleType(t, family);
  const titleText = getTitleText(item);
  const switchGeneration = detectSwitchGeneration(`${titleText} ${t}`);

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
    return hasSeriesX && !saysSeriesS && !isHardAccessoryListing(titleText || t, item);
  }

  if (family === "xbox_series_s") {
    const hasSeriesS = t.includes("xbox series s") || t.includes("series s");
    const saysSeriesX = t.includes("xbox series x") || t.includes("series x");
    return hasSeriesS && !saysSeriesX && !isHardAccessoryListing(titleText || t, item);
  }

  if (family === "switch_oled") {
    if (isIncompleteSwitchConsole(t, queryContext)) return false;
    return t.includes("switch") && t.includes("oled") && !isHardAccessoryListing(titleText || t, item);
  }

  if (family === "switch_lite") {
    return t.includes("switch") && t.includes("lite") && !isHardAccessoryListing(titleText || t, item);
  }

  if (family === "switch_v2") {
    const hasSwitch = t.includes("switch") || t.includes("nintendo switch");
    const saysOled = t.includes("oled");
    const saysLite = t.includes("lite");

    if (isIncompleteSwitchConsole(t, queryContext)) return false;
    if (switchGeneration === "v1") return false;

    return hasSwitch && !saysOled && !saysLite && !isHardAccessoryListing(titleText || t, item);
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

function buildConsoleWarningFlags(text, queryContext, bundleSignals) {
  const t = normalizeConsoleText(text);
  const flags = [];

  for (const [needle, flag] of MINOR_WARNING_TERMS) {
    if (t.includes(needle) && !flags.includes(flag)) {
      flags.push(flag);
    }
  }

  if (queryContext?.wantsBundle && (!bundleSignals || bundleSignals.bundleType !== "bundle")) {
    flags.push("Bundle intent was searched, but extras look weak");
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
    else if (flag === "No controller included") penalty += 6;
    else if (flag === "Console-only listing") penalty += 3;
    else if (flag === "No box included") penalty += 1;
    else if (flag === "Condition may reduce resale appeal") penalty += 6;
    else if (flag === "Visible cosmetic wear mentioned") penalty += 4;
    else if (flag === "Specialist buyer wording") penalty += 3;
    else if (flag === "Disc drive issue mentioned") penalty += 11;
    else if (flag === "HDMI issue mentioned") penalty += 11;
    else if (flag === "Overheating risk mentioned") penalty += 10;
    else if (flag === "Bundle intent was searched, but extras look weak") penalty += 3;
    else if (flag === "Unknown Switch version") penalty += 5;
    else if (flag === "Generic Switch title") penalty += 3;
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
  if (bucket === "switch_unknown_standard") return 148;
  if (bucket === "switch_v1_confirmed") return 138;
  return 0;
}

function getSwitchBucketLowBandFloor(bucket = "") {
  if (bucket === "switch_v2_confirmed") return 155;
  if (bucket === "switch_unknown_standard") return 140;
  if (bucket === "switch_v1_confirmed") return 128;
  return 0;
}

function getMatchDebug(item, queryContext) {
  const titleText = getTitleText(item);
  const text = getCombinedItemText(item);
  const conditionState = classifyConsoleConditionState(text);
  const itemBrand = detectConsoleBrand(text);
  const familyMatch = matchesConsoleFamily(text, queryContext, item);
  const bundleSignals = detectBundleSignals(text, queryContext.family || "");
  const switchGeneration = detectSwitchGeneration(`${titleText} ${text}`);
  const switchPricingBucket = getSwitchPricingBucket(item, queryContext);

  const isRealBundle =
    bundleSignals.bundleType === "bundle" ||
    bundleSignals.extraControllerCount > 0 ||
    bundleSignals.includedGamesCount > 0 ||
    bundleSignals.explicitBundleWords ||
    bundleSignals.hasAccessories;

  if (!text) return { matched: false, reason: "empty_text" };
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
  if (!familyMatch) {
    return {
      matched: false,
      reason: `family_mismatch_${queryContext.family || "none"}`,
      consoleType: detectConsoleType(titleText || text, queryContext.family || ""),
      switchGeneration,
      switchPricingBucket,
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
    switchGeneration,
    switchPricingBucket,
  };
}

function scoreConsoleCandidate(item, queryContext) {
  const titleText = getTitleText(item);
  const text = getCombinedItemText(item);

  if (!text) return -10;
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
  if (conditionState === "minor_fault") score -= 1.5;
  if (conditionState === "faulty_or_parts") score -= 8;

  if (bundleType === "bundle") score += 1.25;
  if (bundleType === "boxed") score += 0.45;
  if (bundleType === "console_only") score -= 0.25;

  score += Math.min(bundleSignals.extraControllerCount, 2) * 0.55;
  score += Math.min(bundleSignals.includedGamesCount, 4) * 0.2;
  if (bundleSignals.hasAccessories) score += 0.25;
  if (bundleSignals.explicitBundleWords) score += 0.35;

  if (queryContext.family === "ps5_disc" && consoleType === "disc") score += 1.1;
  if (queryContext.family === "ps5_disc" && consoleType === "unknown") score += 1.0;
  if (queryContext.family === "ps5_digital" && consoleType === "digital") score += 1.2;

  const warningFlags = buildConsoleWarningFlags(text, queryContext, bundleSignals);

  if (queryContext.family === "switch_v2") {
    if (switchGeneration === "v2") score += 1.0;

    if (switchGeneration === "unknown") {
      score -= 0.9;
      if (!warningFlags.includes("Unknown Switch version")) {
        warningFlags.push("Unknown Switch version");
      }
    }

    if (isGenericUnknownSwitchTitle(titleText) && switchGeneration === "unknown") {
      score -= 0.6;
      if (!warningFlags.includes("Generic Switch title")) {
        warningFlags.push("Generic Switch title");
      }
    }
  }

  const warningPenalty = calculateWarningPenalty(warningFlags);
  score -= warningPenalty * 0.04;

  if (queryContext.family === "switch_lite") {
    if (hasAny(text, ["heavily used", "lot of wear", "well used"])) score -= 1.15;
    if (hasAny(text, ["scratch", "scratches", "scratched", "scratched up", "heavy scratches"])) score -= 0.65;
    if (hasAny(text, ["heavy wear", "cosmetic wear", "cosmetic marks", "worn"])) score -= 0.55;
  }

  if (queryContext.family === "switch_oled") {
    if (hasAny(text, ["heavily used", "lot of wear"])) score -= 0.75;
    if (hasAny(text, ["scratch", "scratches", "scratched", "scratched up", "heavy scratches"])) score -= 0.4;
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

      const warningFlags = buildConsoleWarningFlags(text, queryContext, bundleSignals);

      if (queryContext.family === "switch_v2") {
        const switchGeneration = detectSwitchGeneration(`${titleText} ${text}`);

        if (switchGeneration === "unknown" && !warningFlags.includes("Unknown Switch version")) {
          warningFlags.push("Unknown Switch version");
        }

        if (isGenericUnknownSwitchTitle(titleText) && switchGeneration === "unknown") {
          if (!warningFlags.includes("Generic Switch title")) {
            warningFlags.push("Generic Switch title");
          }
        }
      }

      const warningPenalty = calculateWarningPenalty(warningFlags);
      const discDigitalBias = getDiscDigitalPricingBias(queryContext, text);
      const matchDebug = getMatchDebug(item, queryContext);

      return {
        item,
        total: extractTotalPrice(item),
        adjustedTotal: roundMoney(
          extractTotalPrice(item) -
            bundleValueBonus * 0.55 +
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
        switchGeneration: detectSwitchGeneration(`${titleText} ${text}`),
        switchPricingBucket: getSwitchPricingBucket(item, queryContext),
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
      v2Market.slice(0, 24).map((entry) => entry.adjustedTotal).filter((value) => value > 0)
    );

    const unknownMarketTotals = removePriceOutliers(
      unknownMarket.slice(0, 24).map((entry) => entry.adjustedTotal).filter((value) => value > 0)
    );

    const v2ListingTotals = removePriceOutliers(
      v2Listings.slice(0, 16).map((entry) => entry.adjustedTotal).filter((value) => value > 0)
    );

    const unknownListingTotals = removePriceOutliers(
      unknownListings.slice(0, 16).map((entry) => entry.adjustedTotal).filter((value) => value > 0)
    );

    if (v2MarketTotals.length >= 3) {
      marketTotals = v2MarketTotals;
      listingTotals = v2ListingTotals.length ? v2ListingTotals : unknownListingTotals;

      baseline =
        median(v2MarketTotals) ||
        percentile(v2MarketTotals, 0.35) ||
        median(v2ListingTotals) ||
        0;

      baseline = Math.max(baseline, getSwitchBucketLowBandFloor("switch_v2_confirmed"));
      pricingMode = "Switch V2 confirmed median";
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
        [
          ...v2MarketTotals,
          ...unknownMarketTotals,
          ...v2ListingTotals,
          ...unknownListingTotals,
        ].filter((value) => value > 0)
      );

      marketTotals = fallbackCombined;
      listingTotals = fallbackCombined;

      baseline =
        median(fallbackCombined) ||
        percentile(fallbackCombined, 0.35) ||
        0;

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
      marketTotals = removePriceOutliers(
        [...marketTotals, ...listingTotals].filter((value) => value > 0)
      );
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
    if (pricingMode === "Switch V2 confirmed median") {
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

  if (exactMarket.length >= 3) confidence += 4;
  if (exactMarket.length >= 5) confidence += 4;
  if (exactListings.length >= 3) confidence += 3;
  if (queryContext.family) confidence += 2;

  if (
    pricingMode === "PS5 disc hard fallback" ||
    pricingMode === "PS5 digital hard fallback" ||
    pricingMode === "Console hard fallback" ||
    pricingMode === "Switch unknown hard fallback"
  ) {
    confidence = Math.min(confidence, 56);
  }

  if (queryContext.family === "switch_v2" && pricingMode !== "Switch V2 confirmed median") {
    confidence = Math.min(confidence, 74);
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
      familyHardFloor,
      familyLowBandFloor,
      baseline,
      multiplier: conservativeMultiplier,
      switchMarketV2Count: marketConditionPool.filter((entry) => entry.switchPricingBucket === "switch_v2_confirmed").length,
      switchMarketUnknownCount: marketConditionPool.filter((entry) => entry.switchPricingBucket === "switch_unknown_standard").length,
      switchListingV2Count: listingConditionPool.filter((entry) => entry.switchPricingBucket === "switch_v2_confirmed").length,
      switchListingUnknownCount: listingConditionPool.filter((entry) => entry.switchPricingBucket === "switch_unknown_standard").length,
    },
  };
}

function applyBundleValueToListing(queryContext, item, baseResale) {
  const titleText = getTitleText(item);
  const text = getCombinedItemText(item);
  const bundleSignals = detectBundleSignals(text, queryContext.family || "");
  const bundleValueBonus = estimateBundleValueBonus(queryContext, bundleSignals, text);
  const warningFlags = buildConsoleWarningFlags(text, queryContext, bundleSignals);
  const warningPenalty = calculateWarningPenalty(warningFlags);
  const discDigitalBias = getDiscDigitalPricingBias(queryContext, text);
  const switchGeneration = detectSwitchGeneration(`${titleText} ${text}`);

  let estimatedResale = Number(baseResale || 0) + bundleValueBonus * 0.75 + discDigitalBias;

  if (queryContext.family === "switch_v2") {
    if (switchGeneration === "v2") {
      estimatedResale += 5;
    } else if (switchGeneration === "unknown") {
      estimatedResale -= 7;

      if (isGenericUnknownSwitchTitle(titleText)) {
        estimatedResale -= 4;
      }
    }
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
      consoleType: detectConsoleType(getTitleText(item) || text, queryContext.family || ""),
      switchGeneration,
      switchPricingBucket: getSwitchPricingBucket(item, queryContext),
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
      normalizedQuery.includes("games included") ||
      normalizedQuery.includes("with 2 controllers") ||
      normalizedQuery.includes("with two controllers") ||
      normalizedQuery.includes("extra controller") ||
      normalizedQuery.includes("second controller") ||
      normalizedQuery.includes("spare controller") ||
      normalizedQuery.includes("job lot") ||
      normalizedQuery.includes("comes with");

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

    if (ctx.family === "ps5_disc" || ctx.family === "ps5_digital") return "ps5";
    if (ctx.family === "xbox_series_x") return "xbox series x";
    if (ctx.family === "xbox_series_s") return "xbox series s";
    if (ctx.family === "switch_oled") return "nintendo switch oled";
    if (ctx.family === "switch_lite") return "nintendo switch lite";
    if (ctx.family === "switch_v2") return "nintendo switch";

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
    const titleText = getTitleText(item);
    const text = getCombinedItemText(item);
    const conditionState = classifyConsoleConditionState(text);
    const repairCost = estimateConsoleRepairCost(queryContext, conditionState, text);
    const bundleSignals = detectBundleSignals(text, queryContext.family || "");
    const bundleValueBonus = estimateBundleValueBonus(queryContext, bundleSignals, text);
    const warningFlags = buildConsoleWarningFlags(text, queryContext, bundleSignals);

    if (queryContext.family === "switch_v2") {
      const switchGeneration = detectSwitchGeneration(`${titleText} ${text}`);

      if (switchGeneration === "unknown" && !warningFlags.includes("Unknown Switch version")) {
        warningFlags.push("Unknown Switch version");
      }

      if (isGenericUnknownSwitchTitle(titleText) && switchGeneration === "unknown") {
        if (!warningFlags.includes("Generic Switch title")) {
          warningFlags.push("Generic Switch title");
        }
      }
    }

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
