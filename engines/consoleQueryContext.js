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

function detectConsoleBrand(text) {
  const t = normalizeConsoleText(text);

  if (t.includes("ps5") || t.includes("playstation5")) return "playstation";
  if (t.includes("xbox") || t.includes("series x") || t.includes("series s")) return "xbox";
  if (t.includes("switch") || t.includes("nintendo")) return "nintendo";

  return "";
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

function detectConsoleOnlyIntent(text = "") {
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

  const shouldSoftBundle =
    (family === "ps5_disc" ||
      family === "ps5_digital" ||
      family === "xbox_series_x" ||
      family === "xbox_series_s") &&
    wantsBundle;

  const context = {
    rawQuery,
    normalizedQuery,
    brand,
    family,
    allowDamaged,
    wantsBundle,
    wantsConsoleOnly,
    storagePreference,
  };

  if (shouldSoftBundle) {
    return {
      ...context,
      wantsBundle: false,
      originalWantsBundle: true,
    };
  }

  return context;
}
