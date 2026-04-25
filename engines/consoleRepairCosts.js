import { hasAny, normalizeConsoleText } from "./consoleItemText.js";
import { hasFaultKeywordCombo } from "./consoleWarnings.js";

export function estimateConsoleRepairCost(queryContext, conditionState, text) {
  const t = normalizeConsoleText(text);
  const family = String(queryContext?.family || "");

  if (conditionState === "faulty_or_parts") {
    if (family.startsWith("ps5")) return 90;
    if (family.startsWith("xbox_series")) return 80;
    if (family.startsWith("switch")) return 65;
    return 75;
  }

  if (conditionState === "minor_fault") {
    if (hasAny(t, ["doesnt read discs", "doesn't read discs", "wont read discs", "won't read discs"])) {
      return 25;
    }
    if (hasAny(t, ["hdmi issue"])) return 25;
    if (hasAny(t, ["overheating"])) return 20;
    if (hasAny(t, ["missing thumbstick"])) return 12;
    if (hasFaultKeywordCombo(t)) return 20;
    return 10;
  }

  if (hasAny(t, ["no controller", "missing controller"])) {
    if (family.startsWith("ps5")) return 30;
    if (family.startsWith("xbox_series")) return 28;
    if (family.startsWith("switch")) return 35;
  }

  return 0;
}
