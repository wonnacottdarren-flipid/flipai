import { hasAny, normalizeConsoleText } from "./consoleItemText.js";
import { detectConsoleStorage } from "./consoleStorage.js";

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

function isPs5Like(text) {
  const t = normalizeConsoleText(text);
  return t.includes("ps5") || t.includes("playstation5");
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

function detectPs5DiscShape(text = "") {
  const t = normalizeConsoleText(text);
  if (!isPs5Like(t)) return "unknown";
  if (t.includes("slim")) return "slim";
  return "standard";
}

function hasPs5DiscCustomStorageSignal(text = "") {
  const t = normalizeConsoleText(text);
  if (!isPs5Like(t)) return false;
  return hasAny(t, PS5_DISC_CUSTOM_STORAGE_TERMS);
}

function hasPs5DiscOddStorageWording(text = "") {
  const t = normalizeConsoleText(text);
  if (!isPs5Like(t)) return false;

  const storage = detectConsoleStorage(t, "ps5_disc");
  const shape = detectPs5DiscShape(t);

  if (storage === "2tb") return true;
  if (storage === "1tb" && shape !== "slim") return true;
  if (storage === "825gb" && shape === "slim") return true;

  return false;
}

function hasPs5DiscOddSlimVariant(text = "") {
  const t = normalizeConsoleText(text);
  if (!isPs5Like(t) || !t.includes("slim")) return false;

  const storage = detectConsoleStorage(t, "ps5_disc");

  if (storage === "2tb" || storage === "825gb" || storage === "512gb" || storage === "32gb" || storage === "64gb") {
    return true;
  }

  if (hasPs5DiscCustomStorageSignal(t)) return true;

  return false;
}

function hasPs5DiscConfirmedSpec(text = "") {
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

function hasPs5DiscVagueSpecSignal(text = "") {
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

export function buildConsoleWarningFlags(text, queryContext, bundleSignals) {
  const t = normalizeConsoleText(text);
  const flags = [];
  const family = String(queryContext?.family || "");
  const queryStorage = String(queryContext?.storagePreference || "");
  const itemStorage = detectConsoleStorage(t, family);

  for (const [needle, flag] of MINOR_WARNING_TERMS) {
    if (t.includes(needle) && !flags.includes(flag)) {
      flags.push(flag);
    }
  }

  if (queryContext?.wantsBundle && (!bundleSignals || bundleSignals.bundleType !== "bundle")) {
    flags.push("Bundle intent was searched, but extras look weak");
  }

  if (
    queryContext?.wantsConsoleOnly &&
    bundleSignals &&
    bundleSignals.bundleType !== "console_only"
  ) {
    flags.push("Console-only intent was searched, but extras look stronger than expected");
  }

  if (hasReadDescriptionSignal(t) && hasFaultKeywordCombo(t)) {
    flags.push("Description suggests a likely fault");
  }

  if (
    family === "ps5_digital" &&
    hasReadDescriptionSignal(t) &&
    !hasStrongCleanConditionSignal(t)
  ) {
    flags.push("PS5 digital listing needs manual verification");
  }

  if (family === "ps5_disc") {
    if (hasPs5DiscOddStorageWording(t)) {
      flags.push("Odd PS5 disc storage wording");
    }

    if (hasPs5DiscCustomStorageSignal(t)) {
      flags.push("Custom PS5 disc storage upgrade");
    }

    if (hasPs5DiscOddSlimVariant(t)) {
      flags.push("Odd PS5 slim storage variant");
    }

    if (hasPs5DiscVagueSpecSignal(t)) {
      flags.push("PS5 disc spec not confirmed");
    }
  }

  if (
    queryStorage &&
    queryStorage !== "unknown" &&
    (!itemStorage || itemStorage === "unknown") &&
    (family === "ps5_digital" || family === "xbox_series_x" || family === "xbox_series_s")
  ) {
    flags.push("Storage not confirmed");
  }

  return flags;
}

export function calculateWarningPenalty(flags = []) {
  let penalty = 0;

  for (const flag of flags) {
    if (flag === "Read description carefully") penalty += 5;
    else if (flag === "Seller may have important notes in caption") penalty += 3;
    else if (flag === "No returns accepted") penalty += 4;
    else if (flag === "Untested listing") penalty += 6;
    else if (flag === "No controller included") penalty += 10;
    else if (flag === "Console-only listing") penalty += 16;
    else if (flag === "No box included") penalty += 1;
    else if (flag === "Condition may reduce resale appeal") penalty += 6;
    else if (flag === "Visible cosmetic wear mentioned") penalty += 4;
    else if (flag === "Specialist buyer wording") penalty += 3;
    else if (flag === "Disc drive issue mentioned") penalty += 11;
    else if (flag === "HDMI issue mentioned") penalty += 11;
    else if (flag === "Overheating risk mentioned") penalty += 10;
    else if (flag === "Error wording mentioned") penalty += 12;
    else if (flag === "Issue wording mentioned") penalty += 10;
    else if (flag === "Stability issue mentioned") penalty += 12;
    else if (flag === "Boot or loading issue mentioned") penalty += 14;
    else if (flag === "Description suggests a likely fault") penalty += 16;
    else if (flag === "PS5 digital listing needs manual verification") penalty += 18;
    else if (flag === "Odd PS5 disc storage wording") penalty += 10;
    else if (flag === "Custom PS5 disc storage upgrade") penalty += 12;
    else if (flag === "Odd PS5 slim storage variant") penalty += 14;
    else if (flag === "PS5 disc spec not confirmed") penalty += 10;
    else if (flag === "Bundle intent was searched, but extras look weak") penalty += 3;
    else if (flag === "Console-only intent was searched, but extras look stronger than expected") penalty += 4;
    else if (flag === "Unknown Switch version") penalty += 7;
    else if (flag === "Generic Switch title") penalty += 5;
    else if (flag === "Storage not confirmed") penalty += 4;
  }

  return penalty;
}
