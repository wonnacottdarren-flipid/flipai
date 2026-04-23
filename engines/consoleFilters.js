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

const PS5_DISC_CUSTOM_STORAGE_TERMS = [
  "upgraded ssd",
  "ssd upgrade",
  "storage upgrade",
  "upgraded storage",
  "expanded storage",
  "storage expanded",
  "extra ssd",
  "additional ssd",
  "added ssd",
  "ssd added",
  "internal ssd",
  "internal nvme",
  "nvme installed",
  "with ssd",
  "with 1tb ssd",
  "with 2tb ssd",
  "custom storage",
  "custom upgraded storage",
  "expanded nvme",
  "m2 ssd",
  "m.2 ssd",
  "sn850",
  "sn850x",
  "990 pro",
  "980 pro",
  "firecuda",
  "wd black",
  "seagate",
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

  ["game error", "Error wording mentioned"],
  ["system error", "Error wording mentioned"],
  ["error code", "Error wording mentioned"],
  ["console error", "Error wording mentioned"],
  ["software issue", "Issue wording mentioned"],
  ["system issue", "Issue wording mentioned"],
  ["console issue", "Issue wording mentioned"],
  ["freezing", "Stability issue mentioned"],
  ["freezes", "Stability issue mentioned"],
  ["crashing", "Stability issue mentioned"],
  ["crashes", "Stability issue mentioned"],
  ["glitching", "Stability issue mentioned"],
  ["glitches", "Stability issue mentioned"],
  ["stuck on", "Boot or loading issue mentioned"],
  ["safe mode", "Boot or loading issue mentioned"],
  ["wont load", "Boot or loading issue mentioned"],
  ["won't load", "Boot or loading issue mentioned"],
  ["not loading", "Boot or loading issue mentioned"],
  ["load issue", "Boot or loading issue mentioned"],
];

const CONSOLE_ONLY_QUERY_TERMS = [
  "console only",
  "unit only",
  "main unit only",
  "base unit only",
  "body only",
  "just console",
  "without controller",
  "missing controller",
  "no controller",
  "controller not included",
  "pad not included",
];

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

export function hasAny(text, phrases = []) {
  return phrases.some((phrase) => text.includes(phrase));
}

export function normalizeConsoleText(value) {
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

export function getTitleText(item) {
  return normalizeConsoleText([item?.title, item?.subtitle].filter(Boolean).join(" "));
}

export function getCombinedItemText(item) {
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

export function getCategoryText(item) {
  const categories = Array.isArray(item?.categories) ? item.categories : [];
  return normalizeConsoleText(
    categories
      .map((category) => category?.categoryName)
      .filter(Boolean)
      .join(" ")
  );
}

export function detectConsoleBrand(text) {
  const t = normalizeConsoleText(text);

  if (t.includes("ps5") || t.includes("playstation5")) return "playstation";
  if (t.includes("xbox") || t.includes("series x") || t.includes("series s")) return "xbox";
  if (t.includes("switch") || t.includes("nintendo")) return "nintendo";

  return "";
}

export function isXboxOneFamilySignal(text = "") {
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

export function isXboxSeriesXSignal(text = "") {
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

export function isXboxSeriesSSignal(text = "") {
  const t = normalizeConsoleText(text);

  if (isXboxOneFamilySignal(t)) return false;

  return hasAny(t, [
    "xbox series s",
    "series s",
    "microsoft series s",
    "microsoft xbox series s",
  ]);
}

export function hasXboxConsoleIntent(text = "", family = "") {
  const t = normalizeConsoleText(text);
  const fam = String(family || "");

  if (!isXboxSeriesXSignal(t) && !isXboxSeriesSSignal(t)) return false;

  if (fam === "xbox_series_x" && !isXboxSeriesXSignal(t)) return false;
  if (fam === "xbox_series_s" && !isXboxSeriesSSignal(t)) return false;
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

export function hasStrictXboxConsoleTitleSignals(text = "") {
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

export function isSwitchOledSignal(text = "") {
  const t = normalizeConsoleText(text);
  return hasAny(t, ["switch oled", "nintendo switch oled", "oled model"]);
}

export function isSwitchLiteSignal(text = "") {
  const t = normalizeConsoleText(text);
  return hasAny(t, ["switch lite", "nintendo switch lite"]);
}

export function isSwitchFamilySignal(text = "") {
  const t = normalizeConsoleText(text);
  return t.includes("switch") || t.includes("nintendo switch");
}

export function hasSwitchConsoleIntent(text = "", family = "") {
  const t = normalizeConsoleText(text);
  const fam = String(family || "");

  if (!isSwitchFamilySignal(t)) return false;

  if (fam === "switch_oled" && !isSwitchOledSignal(t)) return false;
  if (fam === "switch_lite" && !isSwitchLiteSignal(t)) return false;
  if (fam === "switch_v2" && (isSwitchOledSignal(t) || isSwitchLiteSignal(t))) return false;

  return hasAny(t, SWITCH_CONSOLE_INTENT_TERMS);
}

export function hasStrictSwitchConsoleTitleSignals(text = "") {
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

export function isVideoGamesCategoryOnly(item) {
  const categoryText = getCategoryText(item);
  return hasAny(categoryText, ["video games"]) && !hasAny(categoryText, CONSOLE_CATEGORY_TERMS);
}

export function isXboxGameListing(item, text = "") {
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

export function isSwitchGameListing(item, text = "", family = "") {
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

export function isSwitchPartsListing(item, text = "", family = "") {
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

export function hasBaseConsoleIntent(text = "", family = "") {
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

export function parseConsoleFamily(text) {
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

export function detectConsoleOnlyIntent(text = "") {
  const t = normalizeConsoleText(text);

  if (!hasAny(t, CONSOLE_ONLY_QUERY_TERMS)) {
    return false;
  }

  if (
    hasAny(t, [
      "bundle",
      "with games",
      "games included",
      "with 2 controllers",
      "with two controllers",
      "extra controller",
      "second controller",
      "spare controller",
      "job lot",
      "comes with",
    ])
  ) {
    return false;
  }

  return true;
}

export function isPs5Like(text) {
  const t = normalizeConsoleText(text);
  return t.includes("ps5") || t.includes("playstation5");
}

export function hasReadDescriptionSignal(text = "") {
  const t = normalizeConsoleText(text);
  return hasAny(t, [
    "read description",
    "read desc",
    "see description",
    "read caption",
    "see caption",
  ]);
}

export function hasStrongCleanConditionSignal(text = "") {
  const t = normalizeConsoleText(text);

  return hasAny(t, [
    "excellent condition",
    "very good condition",
    "great condition",
    "good condition",
    "fully working",
    "works perfectly",
    "working perfectly",
    "perfect working order",
    "tested and working",
    "fully tested",
    "mint condition",
    "immaculate",
    "pristine",
    "boxed complete",
  ]);
}

export function isSwitchV2Signal(text = "") {
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

export function isSwitchV1Signal(text = "") {
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

export function detectSwitchGeneration(text = "") {
  const t = normalizeConsoleText(text);

  if (isSwitchV2Signal(t)) return "v2";
  if (isSwitchV1Signal(t)) return "v1";
  return "unknown";
}

export function detectConsoleStorage(text = "", family = "") {
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

export function isStorageMismatch(queryStorage = "", itemStorage = "", family = "") {
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

export function isConsoleCategory(item) {
  const categoryText = getCategoryText(item);
  return hasAny(categoryText, CONSOLE_CATEGORY_TERMS);
}

export function isAccessoryCategory(item) {
  const categoryText = getCategoryText(item);
  return hasAny(categoryText, ACCESSORY_CATEGORY_TERMS);
}

export function isNonConsoleCategory(item) {
  const categoryText = getCategoryText(item);
  return hasAny(categoryText, NON_CONSOLE_CATEGORY_TERMS);
}

export function isHardNonConsoleCategory(item) {
  const categoryText = getCategoryText(item);
  return hasAny(categoryText, HARD_NON_CONSOLE_CATEGORY_TERMS) && !isConsoleCategory(item);
}

export function hasStrongConsoleSignals(text) {
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

export function looksLikeMainConsoleTitle(text) {
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

export function isObviousAccessoryTitle(titleText) {
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

export function isHardAccessoryListing(text, item) {
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

export function isDigitalCodeOrMembership(item, text) {
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

export function isStrictXboxMainConsoleListing(item, text = "", family = "") {
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

export function isStrictSwitchMainConsoleListing(item, text = "", family = "") {
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

export function failsSharedConsoleGate(item, text = "", queryContext = {}) {
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

export function isClearlyNonConsole(item, text) {
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

export function isIncompleteSwitchConsole(text, queryContext = {}) {
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

export function hasFaultKeywordCombo(text = "") {
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

export function detectPs5DiscShape(text = "") {
  const t = normalizeConsoleText(text);
  if (!isPs5Like(t)) return "unknown";
  if (t.includes("slim")) return "slim";
  return "standard";
}

export function hasPs5DiscCustomStorageSignal(text = "") {
  const t = normalizeConsoleText(text);
  if (!isPs5Like(t)) return false;
  return hasAny(t, PS5_DISC_CUSTOM_STORAGE_TERMS);
}

export function hasPs5DiscOddStorageWording(text = "") {
  const t = normalizeConsoleText(text);
  if (!isPs5Like(t)) return false;

  const storage = detectConsoleStorage(t, "ps5_disc");
  const shape = detectPs5DiscShape(t);

  if (storage === "2tb") return true;
  if (storage === "1tb" && shape !== "slim") return true;
  if (storage === "825gb" && shape === "slim") return true;

  return false;
}

export function hasPs5DiscOddSlimVariant(text = "") {
  const t = normalizeConsoleText(text);
  if (!isPs5Like(t) || !t.includes("slim")) return false;

  const storage = detectConsoleStorage(t, "ps5_disc");

  if (storage === "2tb" || storage === "825gb" || storage === "512gb" || storage === "32gb" || storage === "64gb") {
    return true;
  }

  if (hasPs5DiscCustomStorageSignal(t)) return true;

  return false;
}

export function hasPs5DiscConfirmedSpec(text = "") {
  const t = normalizeConsoleText(text);
  if (!isPs5Like(t)) return false;

  return hasAny(t, [
    "825gb",
    "1tb",
    "slim",
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
  ]);
}

export function hasPs5DiscVagueSpecSignal(text = "") {
  const t = normalizeConsoleText(text);
  if (!isPs5Like(t)) return false;
  if (detectConsoleType(t, "ps5_disc") === "digital") return false;

  const looksLikeDisc =
    hasAny(t, [
      "disc edition",
      "disc version",
      "standard edition",
      "standard console",
      "bluray",
      "disc drive",
      "with disc drive",
      "ps5 console",
      "playstation5 console",
      "console",
    ]) || detectConsoleType(t, "ps5_disc") === "disc";

  if (!looksLikeDisc) return false;
  if (hasPs5DiscConfirmedSpec(t)) return false;

  return true;
}

export function isSeverelyBadConsole(text, queryContext = {}) {
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
      "boot loop",
      "bootloop",
      "stuck in safe mode",
      "stuck on safe mode",
      "safe mode loop",
      "stuck on logo",
      "stuck on boot",
      "bricked",
      "dead console",
    ])
  );
}

export function classifyConsoleConditionState(text) {
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

export function shouldAllowDamagedConsoles(queryContext) {
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

export function isDamagedConsoleConditionState(conditionState) {
  return conditionState === "minor_fault" || conditionState === "faulty_or_parts";
}

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
  if (hasAny(t, ["with controller", "controller included", "pad included"])) return true;

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

export function detectPs5Variant(text = "") {
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

export function detectConsoleType(text = "", family = "") {
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

export function isGenericUnknownSwitchTitle(titleText = "") {
  const t = normalizeConsoleText(titleText);

  if (
    t === "nintendo switch" ||
    t === "switch console" ||
    t === "nintendo switch console" ||
    t === "nintendo switch 32gb console" ||
    t === "nintendo switch 32 gb console" ||
    t === "nintendo switch console 32gb" ||
    t === "nintendo switch console 32 gb" ||
    t === "nintendo switch bundle" ||
    t === "switch bundle" ||
    t === "32gb console" ||
    t === "32 gb console" ||
    t === "fortnite edition" ||
    t === "nintendo switch fortnite edition" ||
    t === "switch fortnite edition"
  ) {
    return true;
  }

  if (
    hasAny(t, [
      "nintendo switch console",
      "switch console",
      "nintendo switch bundle",
      "switch bundle",
      "32gb console",
      "32 gb console",
      "fortnite edition",
      "special edition",
    ]) &&
    !isSwitchV2Signal(t) &&
    !isSwitchV1Signal(t) &&
    !isSwitchOledSignal(t) &&
    !isSwitchLiteSignal(t)
  ) {
    return true;
  }

  return false;
}

export function hasRiskySwitchWording(text = "", family = "") {
  const t = normalizeConsoleText(text);
  const fam = String(family || "");

  if (!(fam === "switch_v2" || fam === "switch_oled" || fam === "switch_lite")) {
    return false;
  }

  const hasVagueCondition = hasAny(t, [
    "poor condition",
    "heavy wear",
    "heavily used",
    "lot of wear",
    "bad condition",
    "fair condition",
    "well used",
    "worn",
    "scratches",
    "scratched",
    "scratch",
    "scratched up",
    "heavy scratches",
    "wear scratch",
    "cosmetic marks",
    "cosmetic wear",
  ]);

  const hasUnclearDetailSignal = hasAny(t, [
    "untested",
    "see photos",
    "see photo",
    "see pictures",
    "see picture",
    "as seen",
    "as pictured",
    "unknown if working",
    "unknown condition",
  ]);

  if (hasReadDescriptionSignal(t)) return true;
  if (hasUnclearDetailSignal) return true;
  if (hasFaultKeywordCombo(t)) return true;
  if (hasVagueCondition && !hasStrongCleanConditionSignal(t)) return true;

  return false;
}

export function hasConfirmedCompleteSwitchV2Signals(text = "", family = "") {
  const t = normalizeConsoleText(text);
  const fam = String(family || "");

  if (fam !== "switch_v2") return false;
  if (detectSwitchGeneration(t) !== "v2") return false;

  let completenessSignals = 0;

  if (hasAny(t, ["console", "system", "nintendo switch console", "switch console"])) completenessSignals += 1;
  if (hasAny(t, ["dock included", "with dock", "official dock"])) completenessSignals += 1;
  if (
    hasAny(t, [
      "with joy cons",
      "with joy-con",
      "with joy-cons",
      "joy cons included",
      "joy-con included",
      "joy-cons included",
    ])
  ) {
    completenessSignals += 1;
  }
  if (hasAny(t, ["charger included", "boxed", "box included", "original box", "complete in box"])) {
    completenessSignals += 1;
  }

  return completenessSignals >= 2;
}

export function getNintendoSwitchRankingAdjustment(queryContext, item, text = "", bundleSignals = {}) {
  const family = String(queryContext?.family || "");
  const combinedText = normalizeConsoleText(text);
  const titleText = getTitleText(item);
  const switchGeneration = detectSwitchGeneration(`${titleText} ${combinedText}`);

  if (!(family === "switch_v2" || family === "switch_oled" || family === "switch_lite")) {
    return 0;
  }

  let adjustment = 0;

  if (family === "switch_v2") {
    if (switchGeneration === "v2") {
      adjustment -= 18;

      if (hasConfirmedCompleteSwitchV2Signals(`${titleText} ${combinedText}`, family)) {
        adjustment -= 8;
      }

      if (bundleSignals?.hasBox) adjustment -= 2;
      if (bundleSignals?.hasAccessories) adjustment -= 1;
    }

    if (switchGeneration === "unknown") {
      adjustment += 16;
    }

    if (switchGeneration === "unknown" && isGenericUnknownSwitchTitle(titleText)) {
      adjustment += 14;
    }
  }

  if (hasRiskySwitchWording(`${titleText} ${combinedText}`, family)) {
    adjustment += family === "switch_v2" ? 14 : 10;
  }

  return adjustment;
}

export function getSwitchPricingBucket(item, queryContext) {
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

export function detectConsoleQuery(query = "") {
  const text = normalizeConsoleText(query);

  return (
    text.includes("ps5") ||
    text.includes("playstation5") ||
    text.includes("playstation 5") ||
    text.includes("xbox series x") ||
    text.includes("xbox series s") ||
    text.includes("series x") ||
    text.includes("series s") ||
    text.includes("switch oled") ||
    text.includes("switch lite") ||
    text.includes("nintendo switch")
  );
}

export function classifyConsoleQuery(query = "") {
  const rawQuery = String(query || "").trim();
  const normalizedQuery = normalizeConsoleText(rawQuery);
  const brand = detectConsoleBrand(normalizedQuery);
  const family = parseConsoleFamily(normalizedQuery);
  const allowDamaged = shouldAllowDamagedConsoles({ normalizedQuery });
  const storagePreference = detectConsoleStorage(normalizedQuery, family);
  const wantsConsoleOnly = detectConsoleOnlyIntent(normalizedQuery);

  const wantsBundle =
    !wantsConsoleOnly &&
    (normalizedQuery.includes("bundle") ||
      normalizedQuery.includes("with games") ||
      normalizedQuery.includes("games included") ||
      normalizedQuery.includes("with 2 controllers") ||
      normalizedQuery.includes("with two controllers") ||
      normalizedQuery.includes("extra controller") ||
      normalizedQuery.includes("second controller") ||
      normalizedQuery.includes("spare controller") ||
      normalizedQuery.includes("job lot") ||
      normalizedQuery.includes("comes with"));

  return {
    rawQuery,
    normalizedQuery,
    brand,
    family,
    allowDamaged,
    wantsBundle,
    wantsConsoleOnly,
    storagePreference,
  };
}

export function buildConsoleSearchQuery(query = "") {
  const ctx = classifyConsoleQuery(query);

  if (ctx.wantsConsoleOnly) {
    if (ctx.family === "ps5_disc") return "ps5 console only";
    if (ctx.family === "ps5_digital") return "ps5 digital console only";
    if (ctx.family === "xbox_series_x") return "xbox series x console only";
    if (ctx.family === "xbox_series_s") return "xbox series s console only";
  }

  if (ctx.family === "ps5_disc" || ctx.family === "ps5_digital") return "ps5";
  if (ctx.family === "xbox_series_x") return "xbox series x";
  if (ctx.family === "xbox_series_s") return "xbox series s";
  if (ctx.family === "switch_oled") return "nintendo switch oled";
  if (ctx.family === "switch_lite") return "nintendo switch lite";
  if (ctx.family === "switch_v2") return "nintendo switch";

  return String(query || "").trim();
}

export function expandConsoleSearchVariants(query = "") {
  const rawQuery = String(query || "").trim();
  const ctx = classifyConsoleQuery(rawQuery);

  if (ctx.wantsConsoleOnly) {
    if (ctx.family === "ps5_disc") {
      return [
        "ps5 console only",
        "playstation 5 console only",
        "ps5 no controller",
        "ps5 without controller",
        "ps5 unit only",
        "ps5 main unit only",
        "ps5 body only",
      ];
    }

    if (ctx.family === "ps5_digital") {
      return [
        "ps5 digital console only",
        "playstation 5 digital console only",
        "ps5 digital no controller",
        "ps5 digital without controller",
        "digital edition ps5 console only",
      ];
    }

    if (ctx.family === "xbox_series_x") {
      return [
        "xbox series x console only",
        "xbox series x no controller",
        "xbox series x without controller",
        "xbox series x console",
        "microsoft xbox series x console",
      ];
    }

    if (ctx.family === "xbox_series_s") {
      return [
        "xbox series s console only",
        "xbox series s no controller",
        "xbox series s without controller",
        "xbox series s console",
        "microsoft xbox series s console",
      ];
    }
  }

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
    return [
      "xbox series x",
      "xbox series x console",
      "microsoft xbox series x",
      "microsoft xbox series x console",
      "series x console",
    ];
  }

  if (ctx.family === "xbox_series_s") {
    return [
      "xbox series s",
      "xbox series s console",
      "microsoft xbox series s",
      "microsoft xbox series s console",
      "series s console",
    ];
  }

  if (ctx.family === "switch_oled") {
    return [
      "nintendo switch oled",
      "switch oled",
      "nintendo switch oled console",
      "switch oled console",
    ];
  }

  if (ctx.family === "switch_lite") {
    return [
      "nintendo switch lite",
      "switch lite",
      "nintendo switch lite console",
      "switch lite console",
    ];
  }

  if (ctx.family === "switch_v2") {
    return [
      "nintendo switch",
      "nintendo switch console",
      "switch console",
      "nintendo switch v2",
      "red box nintendo switch",
    ];
  }

  return [rawQuery].filter(Boolean);
}
