import { CONDITION_KEYWORDS } from "./consoleV2Constants.js";
import { hasAny, normalizeConsoleText } from "./consoleV2Text.js";

export function classifyConsoleV2Condition(text = "") {
  const t = normalizeConsoleText(text);

  if (hasAny(t, CONDITION_KEYWORDS.faulty)) {
    return "faulty_or_parts";
  }

  if (hasAny(t, CONDITION_KEYWORDS.minor)) {
    return "minor_fault";
  }

  return "clean_working";
}

export function isDamagedConsoleV2Condition(conditionState = "") {
  return conditionState === "minor_fault" || conditionState === "faulty_or_parts";
}

export function isSeverelyBadConsoleV2(text = "", queryContext = {}) {
  const t = normalizeConsoleText(text);
  const family = String(queryContext?.family || "");

  if (
    family.startsWith("switch") &&
    hasAny(t, [
      "tablet only",
      "screen only",
      "main unit only",
      "no joy cons",
      "no joy-cons",
      "missing joy cons",
      "missing joy-cons",
      "without joy cons",
      "without joy-cons",
    ])
  ) {
    return true;
  }

  return hasAny(t, [
    "for parts",
    "for spares",
    "spares or repairs",
    "parts only",
    "faulty",
    "broken",
    "not working",
    "no power",
    "wont turn on",
    "won't turn on",
    "will not turn on",
    "no hdmi",
    "hdmi fault",
    "water damaged",
    "motherboard fault",
    "blue light of death",
    "console banned",
    "account locked",
    "bricked",
    "dead console",
  ]);
}

export function shouldBlockConsoleV2Condition(text = "", queryContext = {}) {
  const conditionState = classifyConsoleV2Condition(text);

  if (queryContext?.allowDamaged) {
    return false;
  }

  if (isSeverelyBadConsoleV2(text, queryContext)) {
    return true;
  }

  return isDamagedConsoleV2Condition(conditionState);
}
