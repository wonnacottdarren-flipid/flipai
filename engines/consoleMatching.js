import { normalizeText } from "./baseEngine.js";

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

const XBOX_GAME_TERMS = [
  "battlefield",
  "call of duty",
  "cod",
  "fifa",
  "fc 24",
  "fc24",
  "fc 25",
  "fc25",
  "forza",
  "halo",
  "gears",
  "gears of war",
  "starfield",
  "minecraft",
  "mindseye",
  "dying light",
  "grand theft auto",
  "gta",
  "tt isle of man",
  "ride on the edge",
  "everspace",
  "like a dragon",
  "ishin",
  "stellar edition",
  "adventure",
  "shoot em up",
  "shoot 'em up",
  "pegi",
];

const XBOX_CONSOLE_INTENT_TERMS = [
  "console",
  "1tb",
  "2tb",
  "512gb",
  "standard edition",
  "boxed",
  "box included",
  "original box",
  "complete in box",
  "no box",
  "unboxed",
  "with controller",
  "controller included",
  "includes controller",
  "bundle",
  "system",
  "home console",
  "video console",
  "carbon black",
  "galaxy black",
  "console only",
  "no controller",
  "without controller",
  "controller not included",
  "pad included",
  "pad not included",
];

const SWITCH_CONSOLE_INTENT_TERMS = [
  "console",
  "tablet",
  "32gb",
  "64gb",
  "boxed",
  "box included",
  "original box",
  "complete in box",
  "no box",
  "unboxed",
  "with joy cons",
  "with joy-con",
  "with joy-cons",
  "joy cons included",
  "joy-con included",
  "joy-cons included",
  "dock included",
  "with dock",
  "official dock",
  "charger included",
  "bundle",
  "system",
  "oled model",
  "switch oled",
  "switch lite",
  "nintendo switch console",
  "switch console",
  "hac-001",
  "hac 001",
  "hac-001(-01)",
  "hac 001(-01)",
  "hadh-001",
  "hadh 001",
  "hdh-001",
  "hdh 001",
];

const SWITCH_GAME_TERMS = [
  "mario kart",
  "mario wonder",
  "zelda",
  "pokemon",
  "animal crossing",
  "splatoon",
  "metroid",
  "kirby",
  "smash bros",
  "super smash",
  "luigis mansion",
  "luigi's mansion",
  "minecraft",
  "fifa",
  "fc 24",
  "fc24",
  "fc 25",
  "fc25",
  "pegi",
  "game card",
  "cartridge",
  "download code",
];

const SWITCH_PARTS_TERMS = [
  "replacement battery",
  "battery replacement",
  "battery for nintendo switch",
  "battery for switch",
  "hac-003",
  "hac 003",
  "replacement part",
  "replacement parts",
  "spare part",
  "spare parts",
  "repair part",
  "repair parts",
  "joy con rail",
  "joy-con rail",
  "rail replacement",
  "game card reader",
  "card reader replacement",
  "usb c port",
  "usb-c port",
  "charge port",
  "charging port",
  "lcd replacement",
  "digitizer",
  "touch screen replacement",
  "screen replacement",
  "replacement screen",
  "replacement lcd",
  "motherboard",
  "daughterboard",
  "speaker replacement",
  "fan replacement",
  "replacement fan",
  "housing replacement",
  "shell replacement",
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

function getCategoryText(item) {
  const categories = Array.isArray(item?.categories) ? item.categories : [];
  return normalizeConsoleText(
    categories
      .map((category) => category?.categoryName)
      .filter(Boolean)
      .join(" ")
  );
}

function isXboxOneFamilySignal(text = "") {
  const t = normalizeConsoleText(text);
  return hasAny(t, [
    "xbox one",
    "one x",
    "one s",
    "xbox one x",
    "xbox one s",
    "xboxone",
    "one console",
  ]);
}

function isXboxSeriesXSignal(text = "") {
  const t = normalizeConsoleText(text);

  if (hasAny(t, ["xbox series s", "series s"])) return false;
  if (isXboxOneFamilySignal(t)) return false;

  return hasAny(t, [
    "xbox series x",
    "series x",
    "microsoft series x",
    "microsoft xbox series x",
  ]);
}

function isXboxSeriesSSignal(text = "") {
  const t = normalizeConsoleText(text);

  if (isXboxOneFamilySignal(t)) return false;

  return hasAny(t, [
    "xbox series s",
    "series s",
    "microsoft series s",
    "microsoft xbox series s",
  ]);
}

function hasXboxConsoleIntent(text = "") {
  const t = normalizeConsoleText(text);

  if (!isXboxSeriesXSignal(t) && !isXboxSeriesSSignal(t)) return false;
  if (isXboxOneFamilySignal(t)) return false;

  if (
    t === "xbox series x" ||
    t === "microsoft xbox series x" ||
    t === "xbox series s" ||
    t === "microsoft xbox series s"
  ) {
    return true;
  }

  return hasAny(t, XBOX_CONSOLE_INTENT_TERMS);
}

function hasStrictXboxConsoleTitleSignals(text = "") {
  const t = normalizeConsoleText(text);

  return hasAny(t, [
    "console",
    "system",
    "1tb",
    "2tb",
    "512gb",
    "standard edition",
    "boxed",
    "box included",
    "original box",
    "complete in box",
    "no box",
    "unboxed",
    "with controller",
    "controller included",
    "includes controller",
    "pad included",
    "bundle",
    "console only",
    "no controller",
    "without controller",
    "controller not included",
    "pad not included",
    "carbon black",
    "galaxy black",
  ]);
}

function isSwitchOledSignal(text = "") {
  const t = normalizeConsoleText(text);
  return hasAny(t, ["switch oled", "nintendo switch oled", "oled model"]);
}

function isSwitchLiteSignal(text = "") {
  const t = normalizeConsoleText(text);
  return hasAny(t, ["switch lite", "nintendo switch lite"]);
}

function isSwitchFamilySignal(text = "") {
  const t = normalizeConsoleText(text);
  return t.includes("switch") || t.includes("nintendo switch");
}

function hasSwitchConsoleIntent(text = "", family = "") {
  const t = normalizeConsoleText(text);
  const fam = String(family || "");

  if (!isSwitchFamilySignal(t)) return false;

  if (fam === "switch_oled" && !isSwitchOledSignal(t)) return false;
  if (fam === "switch_lite" && !isSwitchLiteSignal(t)) return false;
  if (fam === "switch_v2" && (isSwitchOledSignal(t) || isSwitchLiteSignal(t))) return false;

  return hasAny(t, SWITCH_CONSOLE_INTENT_TERMS);
}

function hasStrictSwitchConsoleTitleSignals(text = "") {
  const t = normalizeConsoleText(text);

  return hasAny(t, [
    "console",
    "tablet",
    "32gb",
    "64gb",
    "boxed",
    "box included",
    "original box",
    "complete in box",
    "no box",
    "unboxed",
    "with joy cons",
    "with joy-con",
    "with joy-cons",
    "joy cons included",
    "joy-con included",
    "joy-cons included",
    "dock included",
    "with dock",
    "official dock",
    "charger included",
    "bundle",
    "system",
    "oled model",
    "switch oled",
    "switch lite",
    "nintendo switch console",
    "switch console",
    "hac-001",
    "hac 001",
    "hac-001(-01)",
    "hac 001(-01)",
    "hadh-001",
    "hadh 001",
    "hdh-001",
    "hdh 001",
  ]);
}

function isVideoGamesCategoryOnly(item) {
  const categoryText = getCategoryText(item);
  return hasAny(categoryText, ["video games"]) && !hasAny(categoryText, CONSOLE_CATEGORY_TERMS);
}

function isXboxGameListing(item, text = "") {
  const t = normalizeConsoleText(text);
  const titleText = getTitleText(item);
  const categoryText = getCategoryText(item);

  if (!(isXboxSeriesXSignal(t) || isXboxSeriesSSignal(t))) return false;
  if (hasXboxConsoleIntent(t)) return false;

  if (hasAny(categoryText, ["video games"]) && !hasAny(categoryText, ["video game consoles"])) {
    return true;
  }

  if (hasAny(titleText, XBOX_GAME_TERMS) || hasAny(t, XBOX_GAME_TERMS)) {
    return true;
  }

  if (
    hasAny(t, [
      "(microsoft xbox series x",
      "(microsoft xbox series s",
      "(xbox series x",
      "(xbox series s",
      "xbox series x)",
      "xbox series s)",
      "series x)",
      "series s)",
      "pegi",
      "free shipping save",
      "adventure",
      "shoot em up",
      "shoot 'em up",
      "stellar edition",
    ])
  ) {
    return true;
  }

  return false;
}

function isSwitchGameListing(item, text = "", family = "") {
  const t = normalizeConsoleText(text);
  const titleText = getTitleText(item);
  const categoryText = getCategoryText(item);
  const fam = String(family || parseConsoleFamily(`${titleText} ${t}`));

  if (!(fam === "switch_oled" || fam === "switch_lite" || fam === "switch_v2")) {
    return false;
  }

  if (hasSwitchConsoleIntent(`${titleText} ${t}`, fam)) return false;

  if (hasAny(categoryText, ["video games"]) && !hasAny(categoryText, ["video game consoles"])) {
    return true;
  }

  if (hasAny(titleText, SWITCH_GAME_TERMS) || hasAny(t, SWITCH_GAME_TERMS)) {
    return true;
  }

  if (
    hasAny(t, [
      "game card",
      "cartridge",
      "download code",
      "digital download",
      "pegi",
      "(nintendo switch",
      "nintendo switch)",
      "switch game",
    ])
  ) {
    return true;
  }

  return false;
}

function isSwitchPartsListing(item, text = "", family = "") {
  const combinedText = normalizeConsoleText(text);
  const titleText = getTitleText(item);
  const categoryText = getCategoryText(item);
  const fam = String(family || parseConsoleFamily(`${titleText} ${combinedText}`));
  const allText = normalizeConsoleText(`${titleText} ${combinedText} ${categoryText}`);

  if (!(fam === "switch_oled" || fam === "switch_lite" || fam === "switch_v2")) {
    return false;
  }

  if (!isSwitchFamilySignal(allText)) return false;

  const legitBatteryConsoleSignals = hasAny(allText, [
    "improved battery",
    "battery improved",
    "better battery",
    "extended battery",
    "extended battery edtn",
    "extended battery edition",
    "new battery model",
    "v2",
    "hac-001(-01)",
    "hac 001(-01)",
    "red box model",
    "revised model",
  ]);

  const hardPartSignal =
    hasAny(allText, SWITCH_PARTS_TERMS) ||
    (allText.includes("battery") &&
      hasAny(allText, [
        "replacement",
        "for nintendo switch",
        "for switch",
        "for switch console",
        "for nintendo switch console",
        "hac-003",
        "hac 003",
        "new",
      ])) ||
    (hasAny(categoryText, ["batteries"]) && allText.includes("switch")) ||
    (allText.includes("for nintendo switch") && !hasSwitchConsoleIntent(allText, fam)) ||
    (allText.includes("for switch console") && !hasSwitchConsoleIntent(allText, fam));

  if (hardPartSignal && !legitBatteryConsoleSignals) {
    return true;
  }

  return false;
}

function hasBaseConsoleIntent(text = "", family = "") {
  const t = normalizeConsoleText(text);
  const fam = String(family || "");

  if (fam === "xbox_series_x" || fam === "xbox_series_s") {
    return hasXboxConsoleIntent(t);
  }

  if (fam === "switch_oled" || fam === "switch_lite" || fam === "switch_v2") {
    return hasSwitchConsoleIntent(t, fam);
  }

  if (fam === "ps5_disc" || fam === "ps5_digital") {
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
    ]);
  }

  return hasAny(t, [
    "console",
    "system",
    "home console",
    "video console",
    "boxed",
    "with controller",
    "controller included",
    "1tb",
    "2tb",
    "512gb",
    "825gb",
    "32gb",
    "64gb",
    "dock included",
    "with dock",
    "joy cons included",
  ]);
}

function parseConsoleFamily(text) {
  const t = normalizeConsoleText(text);

  for (const [family, patterns] of CONSOLE_FAMILIES) {
    if (patterns.some((pattern) => t.includes(normalizeConsoleText(pattern)))) {
      if (family === "xbox_series_x" && isXboxOneFamilySignal(t)) continue;
      if (family === "xbox_series_s" && isXboxOneFamilySignal(t)) continue;
      return family;
    }
  }

  if (t.includes("ps5") || t.includes("playstation5")) {
    if (t.includes("digital")) return "ps5_digital";
    return "ps5_disc";
  }

  if (isXboxSeriesXSignal(t)) return "xbox_series_x";
  if (isXboxSeriesSSignal(t)) return "xbox_series_s";
  if (isSwitchOledSignal(t)) return "switch_oled";
  if (isSwitchLiteSignal(t)) return "switch_lite";
  if (isSwitchFamilySignal(t)) return "switch_v2";

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

function detectConsoleStorage(text = "", family = "") {
  const t = normalizeConsoleText(text);
  const fam = String(family || "");

  if (hasAny(t, ["2tb", "2 tb"])) return "2tb";
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
    "32gb",
    "64gb",
    "dock included",
    "with dock",
    "joy cons included",
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
      "32gb",
      "64gb",
      "dock included",
      "with dock",
      "joy cons included",
    ])
  ) {
    return true;
  }

  if (
    t === "ps5" ||
    t === "playstation5" ||
    t === "xbox series x" ||
    t === "xbox series s" ||
    t === "microsoft xbox series x" ||
    t === "microsoft xbox series s" ||
    t === "nintendo switch" ||
    t === "switch oled" ||
    t === "switch lite"
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
    (t.startsWith("xbox series x") ||
      t.startsWith("xbox series s") ||
      t.startsWith("microsoft xbox series x") ||
      t.startsWith("microsoft xbox series s")) &&
    !isXboxOneFamilySignal(t) &&
    hasXboxConsoleIntent(t)
  ) {
    return true;
  }

  if (
    (t.startsWith("nintendo switch") || t.startsWith("switch oled") || t.startsWith("switch lite")) &&
    hasAny(t, ["console", "32gb", "64gb", "hac-", "hadh-", "hdh-", "hdk-", "boxed", "joy con", "joy-cons", "joy cons", "dock"])
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

function isHardAccessoryListing(text, item) {
  const titleText = getTitleText(item);
  const combinedText = normalizeConsoleText(text);
  const family = parseConsoleFamily(`${titleText} ${combinedText}`);

  if (isSwitchPartsListing(item, `${titleText} ${combinedText}`, family)) return true;

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

function isStrictXboxMainConsoleListing(item, text = "", family = "") {
  const combinedText = normalizeConsoleText(text);
  const titleText = getTitleText(item);
  const categoryText = getCategoryText(item);
  const fam = String(family || parseConsoleFamily(`${titleText} ${combinedText}`));

  if (!(fam === "xbox_series_x" || fam === "xbox_series_s")) {
    return false;
  }

  if (isXboxOneFamilySignal(`${titleText} ${combinedText}`)) return false;
  if (isXboxGameListing(item, `${titleText} ${combinedText}`)) return false;
  if (isHardAccessoryListing(`${titleText} ${combinedText}`, item)) return false;
  if (isDigitalCodeOrMembership(item, `${titleText} ${combinedText}`)) return false;

  const hasCorrectFamilySignal =
    fam === "xbox_series_x"
      ? isXboxSeriesXSignal(`${titleText} ${combinedText}`)
      : isXboxSeriesSSignal(`${titleText} ${combinedText}`);

  if (!hasCorrectFamilySignal) return false;

  const titleHasStrictSignals = hasStrictXboxConsoleTitleSignals(titleText);
  const combinedHasStrictSignals = hasStrictXboxConsoleTitleSignals(`${titleText} ${combinedText}`);
  const inConsoleCategory = hasAny(categoryText, CONSOLE_CATEGORY_TERMS);

  if (!titleHasStrictSignals && !(inConsoleCategory && combinedHasStrictSignals)) {
    return false;
  }

  return true;
}

function isStrictSwitchMainConsoleListing(item, text = "", family = "") {
  const combinedText = normalizeConsoleText(text);
  const titleText = getTitleText(item);
  const categoryText = getCategoryText(item);
  const fam = String(family || parseConsoleFamily(`${titleText} ${combinedText}`));

  if (!(fam === "switch_oled" || fam === "switch_lite" || fam === "switch_v2")) {
    return false;
  }

  if (!isSwitchFamilySignal(`${titleText} ${combinedText}`)) return false;
  if (isSwitchPartsListing(item, `${titleText} ${combinedText}`, fam)) return false;
  if (isSwitchGameListing(item, `${titleText} ${combinedText}`, fam)) return false;
  if (isHardAccessoryListing(`${titleText} ${combinedText}`, item)) return false;
  if (isDigitalCodeOrMembership(item, `${titleText} ${combinedText}`)) return false;

  if (fam === "switch_oled" && !isSwitchOledSignal(`${titleText} ${combinedText}`)) return false;
  if (fam === "switch_lite" && !isSwitchLiteSignal(`${titleText} ${combinedText}`)) return false;
  if (
    fam === "switch_v2" &&
    (isSwitchOledSignal(`${titleText} ${combinedText}`) || isSwitchLiteSignal(`${titleText} ${combinedText}`))
  ) {
    return false;
  }

  const titleHasStrictSignals = hasStrictSwitchConsoleTitleSignals(titleText);
  const combinedHasStrictSignals = hasStrictSwitchConsoleTitleSignals(`${titleText} ${combinedText}`);
  const inConsoleCategory = hasAny(categoryText, CONSOLE_CATEGORY_TERMS);

  if (!titleHasStrictSignals && !(inConsoleCategory && combinedHasStrictSignals)) {
    return false;
  }

  return true;
}

function failsSharedConsoleGate(item, text = "", queryContext = {}) {
  const combined = normalizeConsoleText(text);
  const family = String(queryContext?.family || parseConsoleFamily(combined));

  if (family === "xbox_series_x" || family === "xbox_series_s") {
    return !isStrictXboxMainConsoleListing(item, combined, family);
  }

  if (family === "switch_oled" || family === "switch_lite" || family === "switch_v2") {
    return !isStrictSwitchMainConsoleListing(item, combined, family);
  }

  if (isVideoGamesCategoryOnly(item) && !hasBaseConsoleIntent(combined, family)) {
    return true;
  }

  if (isAccessoryCategory(item) && !hasBaseConsoleIntent(combined, family)) {
    return true;
  }

  return false;
}

function isClearlyNonConsole(item, text) {
  const combinedText = normalizeConsoleText(text);
  const titleText = getTitleText(item);
  const family = parseConsoleFamily(`${titleText} ${combinedText}`);

  if (isHardNonConsoleCategory(item)) return true;
  if (isSwitchPartsListing(item, `${titleText} ${combinedText}`, family)) return true;
  if (isDigitalCodeOrMembership(item, combinedText)) return true;
  if (
    failsSharedConsoleGate(item, `${titleText} ${combinedText}`, {
      family,
    })
  ) {
    return true;
  }

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

  if (isXboxGameListing(item, `${titleText} ${combinedText}`)) {
    return true;
  }

  if (isSwitchGameListing(item, `${titleText} ${combinedText}`)) {
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
    "disc drive",
    "with disc drive",
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
    "disc drive",
    "cfi 1116a",
    "cfi 1216a",
    "cfi-1116a",
    "cfi-1216a",
  ]);

  if (isDigital && !isDisc) return "digital";
  if (isDisc && !isDigital) return "disc";
  return "unknown";
}

export function matchesConsoleFamily(text, queryContext, item) {
  const t = normalizeConsoleText(text);
  const family = String(queryContext?.family || "");
  const consoleType = detectConsoleType(t, family);
  const titleText = getTitleText(item);
  const switchGeneration = detectSwitchGeneration(`${titleText} ${t}`);
  const queryStorage = String(queryContext?.storagePreference || "");
  const itemStorage = detectConsoleStorage(`${titleText} ${t}`, family);
  const xboxText = `${titleText} ${t}`;
  const switchText = `${titleText} ${t}`;

  if (isHardNonConsoleCategory(item)) return false;
  if (failsSharedConsoleGate(item, `${titleText} ${t}`, queryContext)) return false;

  if (!family) return true;

  if (family === "ps5_disc") {
    if (!isPs5Like(t)) return false;
    if (!isConsoleCategory(item) && !hasStrongConsoleSignals(titleText)) return false;
    if (isClearlyNonConsole(item, titleText || t)) return false;
    if (isHardAccessoryListing(titleText || t, item)) return false;
    if (consoleType === "digital") return false;
    if (isStorageMismatch(queryStorage, itemStorage, family)) return false;
    return true;
  }

  if (family === "ps5_digital") {
    if (!isPs5Like(t)) return false;
    if (!isConsoleCategory(item) && !hasStrongConsoleSignals(titleText)) return false;
    if (isClearlyNonConsole(item, titleText || t)) return false;
    if (isHardAccessoryListing(titleText || t, item)) return false;
    if (consoleType !== "digital") return false;
    if (isStorageMismatch(queryStorage, itemStorage, family)) return false;
    return true;
  }

  if (family === "xbox_series_x") {
    if (!isStrictXboxMainConsoleListing(item, xboxText, family)) return false;
    if (!isXboxSeriesXSignal(xboxText)) return false;
    if (isXboxSeriesSSignal(xboxText)) return false;
    if (isXboxOneFamilySignal(xboxText)) return false;
    if (isXboxGameListing(item, xboxText)) return false;
    if (isClearlyNonConsole(item, xboxText)) return false;
    if (isHardAccessoryListing(xboxText, item)) return false;
    if (isStorageMismatch(queryStorage, itemStorage, family)) return false;
    return true;
  }

  if (family === "xbox_series_s") {
    if (!isStrictXboxMainConsoleListing(item, xboxText, family)) return false;
    if (!isXboxSeriesSSignal(xboxText)) return false;
    if (isXboxSeriesXSignal(xboxText)) return false;
    if (isXboxOneFamilySignal(xboxText)) return false;
    if (isXboxGameListing(item, xboxText)) return false;
    if (isClearlyNonConsole(item, xboxText)) return false;
    if (isHardAccessoryListing(xboxText, item)) return false;
    if (isStorageMismatch(queryStorage, itemStorage, family)) return false;
    return true;
  }

  if (family === "switch_oled") {
    if (!isStrictSwitchMainConsoleListing(item, switchText, family)) return false;
    if (isIncompleteSwitchConsole(t, queryContext)) return false;
    if (!isConsoleCategory(item) && !hasSwitchConsoleIntent(switchText, family)) return false;
    if (isSwitchGameListing(item, switchText, family)) return false;
    if (isSwitchPartsListing(item, switchText, family)) return false;
    if (isHardAccessoryListing(titleText || t, item)) return false;
    return isSwitchOledSignal(switchText);
  }

  if (family === "switch_lite") {
    if (!isStrictSwitchMainConsoleListing(item, switchText, family)) return false;
    if (!isConsoleCategory(item) && !hasSwitchConsoleIntent(switchText, family)) return false;
    if (isSwitchGameListing(item, switchText, family)) return false;
    if (isSwitchPartsListing(item, switchText, family)) return false;
    if (isHardAccessoryListing(titleText || t, item)) return false;
    return isSwitchLiteSignal(switchText);
  }

  if (family === "switch_v2") {
    const hasSwitch = t.includes("switch") || t.includes("nintendo switch");
    const saysOled = t.includes("oled");
    const saysLite = t.includes("lite");

    if (!isStrictSwitchMainConsoleListing(item, switchText, family)) return false;
    if (isIncompleteSwitchConsole(t, queryContext)) return false;
    if (switchGeneration === "v1") return false;
    if (!isConsoleCategory(item) && !hasSwitchConsoleIntent(switchText, family)) return false;
    if (isSwitchGameListing(item, switchText, family)) return false;
    if (isSwitchPartsListing(item, switchText, family)) return false;

    return hasSwitch && !saysOled && !saysLite && !isHardAccessoryListing(titleText || t, item);
  }

  return true;
}
