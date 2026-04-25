import { hasAny, normalizeConsoleText } from "./consoleItemText.js";
import { detectConsoleStorage } from "./consoleStorage.js";
import { detectConsoleType } from "./consoledetection.js";

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

function isPs5Like(text) {
  const t = normalizeConsoleText(text);
  return t.includes("ps5") || t.includes("playstation5");
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
