import { hasAny, normalizeConsoleText } from "./consoleTextHelpers.js";
import { PS5_DISC_CUSTOM_STORAGE_TERMS } from "./consoleConstants.js";
import { detectConsoleType } from "./consoleDetection.js";
import {
  isPs5Like as ps5ModuleIsPs5Like,
  isHardPs5AccessoryText as ps5ModuleIsHardPs5AccessoryText,
} from "./ps5ConsoleFilter.js";

function normalizeForPs5Module(value = "") {
  return normalizeConsoleText(value)
    .replace(/\bplaystation5 console\b/g, "playstation 5 console")
    .replace(/\bplaystation5\b/g, "playstation 5");
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

  if (fam === "ps5_disc" || fam === "ps5_digital") return q !== i;
  if (fam === "xbox_series_x") return q !== i;
  if (fam === "xbox_series_s") return q !== i;

  return q !== i;
}

export function detectPs5DiscShape(text = "") {
  const t = normalizeConsoleText(text);
  if (!ps5ModuleIsPs5Like(normalizeForPs5Module(t))) return "unknown";
  if (t.includes("slim")) return "slim";
  return "standard";
}

export function hasPs5DiscCustomStorageSignal(text = "") {
  const t = normalizeConsoleText(text);
  if (!ps5ModuleIsPs5Like(normalizeForPs5Module(t))) return false;
  return hasAny(t, PS5_DISC_CUSTOM_STORAGE_TERMS);
}

export function hasPs5DiscOddStorageWording(text = "") {
  const t = normalizeConsoleText(text);
  if (!ps5ModuleIsPs5Like(normalizeForPs5Module(t))) return false;

  const storage = detectConsoleStorage(t, "ps5_disc");
  const shape = detectPs5DiscShape(t);

  if (storage === "2tb") return true;
  if (storage === "1tb" && shape !== "slim") return true;
  if (storage === "825gb" && shape === "slim") return true;

  return false;
}

export function hasPs5DiscOddSlimVariant(text = "") {
  const t = normalizeConsoleText(text);
  if (!ps5ModuleIsPs5Like(normalizeForPs5Module(t)) || !t.includes("slim")) return false;

  const storage = detectConsoleStorage(t, "ps5_disc");

  if (storage === "2tb" || storage === "825gb" || storage === "512gb" || storage === "32gb" || storage === "64gb") {
    return true;
  }

  if (hasPs5DiscCustomStorageSignal(t)) return true;

  return false;
}

export function hasPs5DiscConfirmedSpec(text = "") {
  const t = normalizeConsoleText(text);
  if (!ps5ModuleIsPs5Like(normalizeForPs5Module(t))) return false;

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
  if (!ps5ModuleIsPs5Like(normalizeForPs5Module(t))) return false;
  if (ps5ModuleIsHardPs5AccessoryText(normalizeForPs5Module(t))) return false;
  if (detectConsoleType(t, "ps5_disc") === "digital") return false;

  const looksLikeDisc =
    hasAny(t, [
      "disc edition",
      "disc version",
      "standard edition",
      "standard console",
      "bluray",
      "with disc drive",
      "ps5 console",
      "playstation5 console",
      "console",
    ]) || detectConsoleType(t, "ps5_disc") === "disc";

  if (!looksLikeDisc) return false;
  if (hasPs5DiscConfirmedSpec(t)) return false;

  return true;
}
