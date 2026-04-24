import { hasAny, normalizeConsoleText } from "./consoleTextHelpers.js";
import { CONSOLE_FAMILIES, CONSOLE_ONLY_QUERY_TERMS } from "./consoleConstants.js";

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

function detectPs5QueryFamily(text = "") {
  const t = normalizeConsoleText(text);

  if (!(t.includes("ps5") || t.includes("playstation5") || t.includes("playstation 5"))) {
    return "";
  }

  if (
    hasAny(t, [
      "digital",
      "digital edition",
      "discless",
      "no disc",
      "cfi 1116b",
      "cfi 1216b",
      "cfi-1116b",
      "cfi-1216b",
    ])
  ) {
    return "ps5_digital";
  }

  return "ps5_disc";
}

function parseConsoleFamily(text) {
  const t = normalizeConsoleText(text);
  const ps5Family = detectPs5QueryFamily(t);

  if (ps5Family) return ps5Family;

  for (const [family, patterns] of CONSOLE_FAMILIES) {
    if (patterns.some((pattern) => t.includes(normalizeConsoleText(pattern)))) {
      if (family === "xbox_series_x" && isXboxOneFamilySignal(t)) continue;
      if (family === "xbox_series_s" && isXboxOneFamilySignal(t)) continue;
      return family;
    }
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
      normalizedQuery.includes("console bundle") ||
      normalizedQuery.includes("with games") ||
      normalizedQuery.includes("games included") ||
      normalizedQuery.includes("with 2 controllers") ||
      normalizedQuery.includes("with two controllers") ||
      normalizedQuery.includes("extra controller") ||
      normalizedQuery.includes("second controller") ||
      normalizedQuery.includes("spare controller") ||
      normalizedQuery.includes("with controller") ||
      normalizedQuery.includes("controller included") ||
      normalizedQuery.includes("with cables") ||
      normalizedQuery.includes("cables included") ||
      normalizedQuery.includes("box and cables") ||
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
      "ps5 console bundle",
      "playstation 5 bundle",
      "playstation 5 console bundle",
      "ps5 with controller",
      "ps5 with games",
      "ps5 with cables",
      "ps5 boxed",
    ];
  }

  if (ctx.family === "ps5_digital") {
    return [
      "ps5",
      "ps5 digital",
      "playstation 5 digital",
      "digital edition ps5",
      "ps5 digital console",
      "ps5 digital bundle",
      "playstation 5 digital bundle",
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
