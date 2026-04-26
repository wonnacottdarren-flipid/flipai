import { CONSOLE_FAMILIES } from "./consoleV2Constants.js";
import { hasAny, normalizeConsoleText } from "./consoleV2Text.js";

export function detectConsoleBrand(text = "") {
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
  ]);
}

export function isXboxSeriesXSignal(text = "") {
  const t = normalizeConsoleText(text);

  if (isXboxOneFamilySignal(t)) return false;
  if (hasAny(t, ["xbox series s", "series s"])) return false;

  return hasAny(t, [
    "xbox series x",
    "series x",
    "microsoft xbox series x",
  ]);
}

export function isXboxSeriesSSignal(text = "") {
  const t = normalizeConsoleText(text);

  if (isXboxOneFamilySignal(t)) return false;

  return hasAny(t, [
    "xbox series s",
    "series s",
    "microsoft xbox series s",
  ]);
}

export function isSwitchOledSignal(text = "") {
  const t = normalizeConsoleText(text);

  return hasAny(t, [
    "switch oled",
    "nintendo switch oled",
    "oled model",
  ]);
}

export function isSwitchLiteSignal(text = "") {
  const t = normalizeConsoleText(text);

  return hasAny(t, [
    "switch lite",
    "nintendo switch lite",
  ]);
}

export function isSwitchFamilySignal(text = "") {
  const t = normalizeConsoleText(text);

  return t.includes("switch") || t.includes("nintendo switch");
}

export function parseConsoleFamily(text = "") {
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
