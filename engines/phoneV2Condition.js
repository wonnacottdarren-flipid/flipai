import { normalizeText } from "./baseEngine.js";

export function normalizePhoneText(value = "") {
  return normalizeText(String(value || ""))
    .replace(/[&+]/g, " and ")
    .replace(/\bdoesnt\b/g, "doesn't")
    .replace(/\bwont\b/g, "won't")
    .replace(/\bcant\b/g, "can't")
    .replace(/\bscreen\s*lines\b/g, "screen lines")
    .replace(/\bdisplay\s*lines\b/g, "display lines")
    .replace(/\blines\s*on\s*screen\b/g, "lines on screen")
    .replace(/\blines\s*in\s*screen\b/g, "lines in screen")
    .replace(/\blines\s*only\b/g, "lines only")
    .replace(/\btouch\s*ok\b/g, "touch ok")
    .replace(/\btouch\s*works\b/g, "touch works")
    .replace(/\bface\s*id\b/g, "face id")
    .replace(/\btouch\s*id\b/g, "touch id")
    .replace(/\bicloud\s*locked\b/g, "icloud locked")
    .replace(/\bactivation\s*locked\b/g, "activation locked")
    .replace(/\s+/g, " ")
    .trim();
}

export function hasAnyPhoneTerm(text = "", terms = []) {
  const t = normalizePhoneText(text);
  return terms.some((term) => t.includes(normalizePhoneText(term)));
}

const CLEAN_WORKING_TERMS = [
  "fully working",
  "working perfectly",
  "works perfectly",
  "perfect working order",
  "tested and working",
  "fully tested",
  "excellent condition",
  "very good condition",
  "good condition",
  "great condition",
  "mint condition",
  "immaculate",
  "pristine",
  "no faults",
  "no issues",
  "everything works",
  "all working",
];

const SCREEN_DAMAGE_TERMS = [
  "screen lines",
  "display lines",
  "lines on screen",
  "lines in screen",
  "lines only",
  "green line",
  "green lines",
  "pink line",
  "pink lines",
  "white line",
  "white lines",
  "vertical line",
  "vertical lines",
  "horizontal line",
  "horizontal lines",
  "lcd lines",
  "oled lines",
  "screen bleeding",
  "lcd bleed",
  "lcd bleeding",
  "dead pixels",
  "black spot",
  "black spots",
  "screen burn",
  "burn in",
  "ghost touch",
  "touch ok",
  "touch works but",
  "display fault",
  "screen fault",
  "lcd fault",
  "oled fault",
  "lcd damage",
  "oled damage",
  "damaged screen",
  "cracked screen",
  "screen cracked",
  "broken screen",
  "screen broken",
  "replacement screen needed",
  "needs screen",
  "needs new screen",
];

const HARD_FAULT_TERMS = [
  "for parts",
  "for spares",
  "spares or repairs",
  "spares repairs",
  "parts only",
  "faulty",
  "broken",
  "not working",
  "doesn't work",
  "won't turn on",
  "will not turn on",
  "no power",
  "dead phone",
  "water damaged",
  "liquid damaged",
  "motherboard fault",
  "logic board fault",
  "board fault",
  "icloud locked",
  "activation locked",
  "blocked",
  "blacklisted",
  "reported lost",
  "reported stolen",
  "no imei",
  "repair required",
  "needs repair",
];

const MINOR_FAULT_TERMS = [
  "battery service",
  "battery needs replacing",
  "poor battery",
  "weak battery",
  "battery health low",
  "face id not working",
  "face id faulty",
  "touch id not working",
  "camera not working",
  "camera fault",
  "speaker fault",
  "speaker not working",
  "microphone fault",
  "mic fault",
  "charging port loose",
  "charging port fault",
  "no service",
  "signal issue",
  "wifi issue",
  "bluetooth issue",
];

const COSMETIC_WEAR_TERMS = [
  "scratches",
  "scratched",
  "scratch",
  "marks",
  "cosmetic marks",
  "cosmetic wear",
  "wear and tear",
  "used condition",
  "fair condition",
  "back cracked",
  "cracked back",
  "rear glass cracked",
  "back glass cracked",
];

export function hasPhoneScreenDamage(text = "") {
  const t = normalizePhoneText(text);

  if (hasAnyPhoneTerm(t, SCREEN_DAMAGE_TERMS)) return true;

  const hasLineWord = hasAnyPhoneTerm(t, [
    "line",
    "lines",
    "green line",
    "pink line",
    "white line",
    "vertical line",
    "horizontal line",
  ]);

  const hasScreenWord = hasAnyPhoneTerm(t, [
    "screen",
    "display",
    "lcd",
    "oled",
  ]);

  return hasLineWord && hasScreenWord;
}

export function hasHardPhoneFault(text = "") {
  return hasAnyPhoneTerm(text, HARD_FAULT_TERMS);
}

export function hasMinorPhoneFault(text = "") {
  return hasAnyPhoneTerm(text, MINOR_FAULT_TERMS);
}

export function hasCleanWorkingPhoneSignal(text = "") {
  return hasAnyPhoneTerm(text, CLEAN_WORKING_TERMS);
}

export function classifyPhoneConditionState(text = "") {
  const t = normalizePhoneText(text);

  if (!t) return "unknown";

  if (hasHardPhoneFault(t)) {
    return "faulty_or_parts";
  }

  if (hasPhoneScreenDamage(t)) {
    return "screen_damage";
  }

  if (hasMinorPhoneFault(t)) {
    return "minor_fault";
  }

  if (hasCleanWorkingPhoneSignal(t)) {
    return "clean_working";
  }

  if (hasAnyPhoneTerm(t, COSMETIC_WEAR_TERMS)) {
    return "cosmetic_wear";
  }

  return "clean_working";
}

export function isDamagedPhoneConditionState(conditionState = "") {
  return ["faulty_or_parts", "screen_damage", "minor_fault"].includes(
    String(conditionState || "")
  );
}

export function shouldAllowDamagedPhones(queryContext = {}) {
  const q = normalizePhoneText(
    queryContext?.normalizedQuery ||
      queryContext?.rawQuery ||
      queryContext?.query ||
      ""
  );

  return hasAnyPhoneTerm(q, [
    "faulty",
    "broken",
    "damaged",
    "for parts",
    "spares",
    "repairs",
    "screen damage",
    "cracked screen",
    "screen lines",
    "display lines",
    "green line",
    "pink line",
    "lcd",
    "oled fault",
    "battery issue",
    "face id not working",
    "not working",
  ]);
}

export function buildPhoneConditionDebug(text = "", queryContext = {}) {
  const normalizedText = normalizePhoneText(text);
  const conditionState = classifyPhoneConditionState(normalizedText);
  const allowDamaged = shouldAllowDamagedPhones(queryContext);

  return {
    normalizedText,
    conditionState,
    isDamaged: isDamagedPhoneConditionState(conditionState),
    allowDamaged,
    hasScreenDamage: hasPhoneScreenDamage(normalizedText),
    hasHardFault: hasHardPhoneFault(normalizedText),
    hasMinorFault: hasMinorPhoneFault(normalizedText),
    hasCleanSignal: hasCleanWorkingPhoneSignal(normalizedText),
  };
}
