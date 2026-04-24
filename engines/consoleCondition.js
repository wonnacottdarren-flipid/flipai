import { hasAny, normalizeConsoleText } from "./consoleTextHelpers.js";
import { FAULTY_OR_PARTS_EXTRA_TERMS, HARD_REJECT_TERMS } from "./consoleConstants.js";

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

export function isSeverelyBadConsole(text, queryContext = {}) {
  const t = normalizeConsoleText(text);

  if (
    String(queryContext?.family || "").startsWith("switch") &&
    hasAny(t, [
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
    ])
  ) {
    return true;
  }

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
