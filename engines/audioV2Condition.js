import { hasAny, normalizeAudioText } from "./audioV2Text.js";

export function shouldAllowDamagedAudioListings(queryContext = {}) {
  const q = normalizeAudioText(queryContext?.normalizedQuery || queryContext?.rawQuery || "");

  return hasAny(q, [
    "faulty",
    "broken",
    "damaged",
    "for parts",
    "for spares",
    "spares",
    "repairs",
    "spares repairs",
    "spares or repairs",
    "not working",
    "battery issue",
    "charging issue",
    "sound issue",
    "pairing issue",
  ]);
}

export function classifyAudioConditionState(text = "") {
  const t = normalizeAudioText(text);

  if (
    hasAny(t, [
      "for parts",
      "for spares",
      "spares or repairs",
      "spares repairs",
      "spares/repairs",
      "not working",
      "faulty",
      "broken",
      "dead",
      "no power",
      "won't charge",
      "wont charge",
      "will not charge",
      "battery issue",
      "battery fault",
      "distorted sound",
      "sound issue",
      "not pairing",
      "pairing issue",
      "one side not working",
      "one ear not working",
      "speaker fault",
      "charging issue",
      "water damaged",
    ])
  ) {
    return "faulty_or_parts";
  }

  if (
    hasAny(t, [
      "heavy wear",
      "heavily worn",
      "poor condition",
      "bad condition",
      "fair condition",
      "deep scratches",
      "scratched heavily",
      "missing tips",
      "missing ear tips",
      "missing pads",
      "replacement pads needed",
    ])
  ) {
    return "minor_fault";
  }

  return "clean_working";
}

export function isDamagedAudioConditionState(conditionState = "") {
  return conditionState === "minor_fault" || conditionState === "faulty_or_parts";
}

export function isEarbudAudioFamily(queryContext = {}) {
  const family = String(queryContext?.family || "");

  return (
    family.startsWith("airpods_") ||
    family.startsWith("galaxy_buds") ||
    family.startsWith("sony_wf_") ||
    family.startsWith("bose_qc_earbuds")
  );
}

export function estimateAudioRepairCost(queryContext = {}, conditionState = "", text = "") {
  const t = normalizeAudioText(text);
  const family = String(queryContext?.family || "");
  const brand = String(queryContext?.brand || "");

  if (conditionState === "faulty_or_parts") {
    if (family.includes("airpods_max")) return 70;
    if (family.includes("xm5") || family.includes("qc_ultra")) return 65;
    if (brand === "apple") return 55;
    if (brand === "sony") return 50;
    if (brand === "bose") return 50;
    if (brand === "samsung") return 35;
    return 40;
  }

  if (conditionState === "minor_fault") {
    if (hasAny(t, ["missing ear tips", "missing tips"])) return 8;
    if (hasAny(t, ["missing pads", "replacement pads needed"])) return 15;
    return 12;
  }

  return 0;
}
