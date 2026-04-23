// consoleengine.ultrastrict.js

// --- Basic helpers ----------------------------------------------------------

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/’/g, "'")
    .replace(/[^a-z0-9+\-./& ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hasAny(text, phrases = []) {
  const t = normalizeText(text);
  return phrases.some((phrase) => t.includes(normalizeText(phrase)));
}

// --- Console families -------------------------------------------------------

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
    .replace(/\b2 tb\b/g, "2tb")
    .replace(/\b825 gb\b/g, "825gb")
    .replace(/\b512 gb\b/g, "512gb")
    .replace(/\b64 gb\b/g, "64gb")
    .replace(/\b32 gb\b/g, "32gb")
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

  if (t.includes("xbox") && t.includes("series x")) return "xbox_series_x";
  if (t.includes("xbox") && t.includes("series s")) return "xbox_series_s";
  if (t.includes("series x") && !t.includes("series s")) return "xbox_series_x";
  if (t.includes("series s") && !t.includes("series x")) return "xbox_series_s";

  if (t.includes("switch") || t.includes("nintendo switch")) return "switch_v2";

  return "";
}

// --- Categories & terms -----------------------------------------------------

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

const HARD_NON_CONSOLE_CATEGORY_TERMS = [
  "art",
  "art drawings",
  "drawings",
  "paintings",
  "prints",
  "posters",
  "canvas",
  "collectibles",
  "collectable card games",
  "trading card games",
  "coins",
  "stamps",
  "pottery",
  "ceramics",
  "antiques",
  "jewellery",
  "jewelry",
  "clothes shoes accessories",
  "fashion",
  "books",
  "magazines",
  "music",
  "records",
  "vinyl",
  "dolls bears",
  "toys",
  "model railways",
  "cameras photography",
  "mobile phones communication",
  "computers tablets networking",
  "home furniture diy",
  "health beauty",
  "sporting goods",
  "vehicle parts accessories",
  "pet supplies",
  "crafts",
];

const ACCESSORY_TERMS = [
  "controller only",
  "dualsense only",
  "dualshock only",
  "joy con only",
  "joy-con only",
  "joy cons only",
  "joy-cons only",
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
  "storage expansion card",
  "expansion card only",
  "ssd only",
  "internal ssd",
  "nvme",
  "memory card",
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
  "bricked",
  "dead console",
];

// --- Category helpers -------------------------------------------------------

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

function isHardNonConsoleCategory(item) {
  const categoryText = getCategoryText(item);
  return hasAny(categoryText, HARD_NON_CONSOLE_CATEGORY_TERMS) && !isConsoleCategory(item);
}

// --- Console title / signals ------------------------------------------------

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
    "2tb",
    "825gb",
    "512gb",
    "with controller",
    "controller included",
    "boxed",
    "xbox series x console",
    "xbox series s console",
    "nintendo switch console",
    "switch oled console",
    "switch lite console",
    "carbon black",
    "galaxy black",
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
      "2tb",
      "825gb",
      "512gb",
      "with controller",
      "controller included",
      "boxed",
      "xbox series x console",
      "xbox series s console",
      "nintendo switch console",
      "switch oled console",
      "switch lite console",
      "carbon black",
      "galaxy black",
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
    hasAny(t, ["console", "edition", "standard", "digital", "disc", "slim", "cfi", "825gb", "1tb"])
  ) {
    return true;
  }

  if (
    (t.startsWith("xbox series x") || t.startsWith("xbox series s")) &&
    hasAny(t, ["console", "1tb", "2tb", "512gb", "boxed", "with controller", "carbon black", "galaxy black"])
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

// --- Accessory detection ----------------------------------------------------

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
      "storage expansion card",
      "expansion card only",
      "ssd only",
      "nvme",
      "memory card",
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

function isAccessoryCategory(item) {
  const categoryText = getCategoryText(item);
  return hasAny(categoryText, ACCESSORY_CATEGORY_TERMS);
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

  if (
    hasAny(combinedText, [
      "console stand",
      "console dock",
      "console shell",
      "console cover",
      "console skin",
      "console mount",
      "console fan",
      "cooling stand",
      "cooling fan",
      "charging dock",
      "charging stand",
      "charging station",
    ]) &&
    !looksLikeMainConsoleTitle(titleText)
  ) {
    return true;
  }

  return false;
}

// --- Digital / membership detection ----------------------------------------

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

// --- Non-console detection --------------------------------------------------

function isPs5Like(text) {
  const t = normalizeConsoleText(text);
  return t.includes("ps5") || t.includes("playstation5");
}

function isClearlyNonConsole(item, text) {
  const combinedText = normalizeConsoleText(text);
  const titleText = getTitleText(item);

  if (isHardNonConsoleCategory(item)) return true;
  if (isDigitalCodeOrMembership(item, combinedText)) return true;

  if (looksLikeMainConsoleTitle(titleText) && isConsoleCategory(item)) return false;

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

  if (
    hasAny(combinedText, [
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
      "wall art",
      "canvas print",
    ]) &&
    !looksLikeMainConsoleTitle(titleText)
  ) {
    return true;
  }

  return false;
}

// --- Storage detection ------------------------------------------------------

function detectConsoleStorage(text = "", family = "") {
  const t = normalizeConsoleText(text);
  const fam = String(family || "");

  if (hasAny(t, ["2tb", "2 tb", "2000gb", "2000 gb"])) return "2tb";
  if (hasAny(t, ["1tb", "1 tb", "1000gb", "1000 gb"])) return "1tb";
  if (hasAny(t, ["825gb", "825 gb"])) return "825gb";
  if (hasAny(t, ["512gb", "512 gb"])) return "512gb";
  if (hasAny(t, ["64gb", "64 gb"])) return "64gb";
  if (hasAny(t, ["32gb", "32 gb"])) return "32gb";

  if (fam === "xbox_series_x" && t.includes("galaxy black")) return "2tb";
  if (fam === "xbox_series_s" && t.includes("carbon black")) return "1tb";

  return "unknown";
}

function isStorageMismatch(queryStorage = "", itemStorage = "", family = "") {
  const q = String(queryStorage || "");
  const i = String(itemStorage || "");
  const fam = String(family || "");

  if (!q || q === "unknown" || !i || i === "unknown") return false;
  if (q === i) return false;

  if (fam === "ps5_disc" || fam === "ps5_digital") {
    return q !== i;
  }

  if (fam === "xbox_series_x") {
    return q !== i;
  }

  if (fam === "xbox_series_s") {
    return q !== i;
  }

  return q !== i;
}

// --- Condition / damage detection ------------------------------------------

const FAULTY_OR_PARTS_EXTRA_TERMS = [
  "game error",
  "system error",
  "console error",
  "error code",
  "safe mode loop",
  "stuck in safe mode",
  "stuck on safe mode",
  "stuck on logo",
  "stuck on startup",
  "stuck on start up",
  "stuck on boot",
  "boot loop",
  "bootloop",
  "freezing",
  "freezes",
  "keeps freezing",
  "crashing",
  "crashes",
  "keeps crashing",
  "glitching",
  "glitches",
  "software issue",
  "system issue",
  "console issue",
  "gpu issue",
  "power issue",
  "overheats",
  "over heating",
  "wont load",
  "won't load",
  "not loading",
  "load issue",
  "corrupted",
  "corrupt data",
];

function hasReadDescriptionSignal(text = "") {
  const t = normalizeConsoleText(text);
  return hasAny(t, [
    "read description",
    "read desc",
    "see description",
    "read caption",
    "see caption",
  ]);
}

function hasFaultKeywordCombo(text = "") {
  const t = normalizeConsoleText(text);

  if (hasAny(t, FAULTY_OR_PARTS_EXTRA_TERMS)) return true;

  const hasErrorWord = hasAny(t, ["error", "issue", "problem", "fault"]);
  const hasSystemWord = hasAny(t, [
    "game",
    "system",
    "console",
    "software",
    "boot",
    "loading",
    "load",
    "startup",
    "start up",
    "safe mode",
    "logo",
  ]);

  if (hasErrorWord && hasSystemWord) return true;

  const hasReadDesc = hasReadDescriptionSignal(t);

  if (
    hasReadDesc &&
    hasAny(t, [
      "error",
      "issue",
      "problem",
      "fault",
      "freezing",
      "freezes",
      "crashing",
      "crashes",
      "glitching",
      "glitches",
      "stuck on",
      "safe mode",
      "wont load",
      "won't load",
      "not loading",
      "corrupted",
    ])
  ) {
    return true;
  }

  return false;
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
      "boot loop",
      "bootloop",
      "safe mode loop",
      "stuck in safe mode",
      "stuck on safe mode",
      "stuck on logo",
      "stuck on startup",
      "stuck on start up",
      "stuck on boot",
      "bricked",
      "dead console",
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
    ]) ||
    hasFaultKeywordCombo(t)
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
    "error",
    "issue",
    "problem",
  ]);
}

function isDamagedConsoleConditionState(conditionState) {
  return conditionState === "minor_fault" || conditionState === "faulty_or_parts";
}

// --- Console-only detection -------------------------------------------------

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

// --- Main Ultra-Strict matcher ---------------------------------------------

export function matchesConsoleUltraStrict(item, queryContext = {}) {
  const titleText = getTitleText(item);
  const combinedText = getCombinedItemText(item);
  const familyFromItem = parseConsoleFamily(titleText);
  const familyFromQuery = String(queryContext.family || "").trim();
  const itemStorage = detectConsoleStorage(combinedText, familyFromItem);
  const queryStorage = String(queryContext.storage || "").trim();

  // 1) Hard reject: obvious non-console / digital / merch
  if (isClearlyNonConsole(item, combinedText)) {
    return { matched: false, reason: "non_console_ultra_strict" };
  }

  // 2) Hard reject: accessories of any kind
  if (isHardAccessoryListing(combinedText, item)) {
    return { matched: false, reason: "accessory_listing_ultra_strict" };
  }

  // 3) Family must match exactly if query specifies one
  if (familyFromQuery && familyFromItem && familyFromQuery !== familyFromItem) {
    return { matched: false, reason: "family_mismatch_ultra_strict" };
  }

  if (familyFromQuery && !familyFromItem) {
    return { matched: false, reason: "no_family_detected_ultra_strict" };
  }

  // 4) Storage must match exactly if query specifies it
  if (isStorageMismatch(queryStorage, itemStorage, familyFromItem)) {
    return { matched: false, reason: "storage_mismatch_ultra_strict" };
  }

  // 5) Hard reject damaged consoles unless explicitly requested
  const conditionState = classifyConsoleConditionState(combinedText);
  if (isDamagedConsoleConditionState(conditionState) && !shouldAllowDamagedConsoles(queryContext)) {
    return { matched: false, reason: "damaged_console_ultra_strict" };
  }

  // 6) Optional: reject console-only unless allowed
  if (
    isHomeConsoleOnlyListing(combinedText, familyFromItem) &&
    !queryContext.allowConsoleOnly
  ) {
    return { matched: false, reason: "console_only_not_allowed_ultra_strict" };
  }

  // 7) Must look like a main console in title
  if (!looksLikeMainConsoleTitle(titleText)) {
    return { matched: false, reason: "title_not_strong_console_ultra_strict" };
  }

  return {
    matched: true,
    reason: "console_match_ultra_strict",
    family: familyFromItem || familyFromQuery || "",
    storage: itemStorage || queryStorage || "unknown",
    conditionState,
  };
}
