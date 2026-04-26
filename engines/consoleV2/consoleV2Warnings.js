import { detectBundleSignalsV2 } from "./consoleV2Bundle.js";
import { classifyConsoleV2Condition } from "./consoleV2Condition.js";
import { hasAny, normalizeConsoleText } from "./consoleV2Text.js";

export function buildConsoleV2WarningFlags(text = "", queryContext = {}) {
  const t = normalizeConsoleText(text);
  const family = String(queryContext?.family || "");
  const bundleSignals = detectBundleSignalsV2(t, family);
  const conditionState = classifyConsoleV2Condition(t);
  const flags = [];

  if (hasAny(t, ["read description", "read desc", "see description"])) {
    flags.push("Read description carefully");
  }

  if (hasAny(t, ["no returns", "returns not accepted"])) {
    flags.push("No returns accepted");
  }

  if (hasAny(t, ["untested"])) {
    flags.push("Untested listing");
  }

  if (conditionState === "minor_fault") {
    flags.push("Possible minor fault");
  }

  if (conditionState === "faulty_or_parts") {
    flags.push("Faulty or parts listing");
  }

  if (hasAny(t, ["scratches", "scratched", "heavy wear", "heavily used"])) {
    flags.push("Cosmetic wear mentioned");
  }

  if (hasAny(t, ["no controller", "without controller", "missing controller"])) {
    flags.push("No controller included");
  }

  if (hasAny(t, ["unboxed", "no box", "without box"])) {
    flags.push("No box included");
  }

  if (queryContext?.wantsBundle && bundleSignals.bundleType !== "bundle") {
    flags.push("Bundle intent searched, but extras look weak");
  }

  if (queryContext?.wantsConsoleOnly && bundleSignals.bundleType !== "console_only") {
    flags.push("Console-only intent searched, but listing may include extras");
  }

  if (
    family === "switch_v2" &&
    !hasAny(t, [
      "v2",
      "hac-001(-01)",
      "hac 001(-01)",
      "red box",
      "improved battery",
      "better battery",
    ])
  ) {
    flags.push("Switch version not confirmed");
  }

  return Array.from(new Set(flags));
}

export function calculateConsoleV2WarningPenalty(flags = []) {
  let penalty = 0;

  for (const flag of flags) {
    if (flag === "Read description carefully") penalty += 5;
    else if (flag === "No returns accepted") penalty += 4;
    else if (flag === "Untested listing") penalty += 6;
    else if (flag === "Possible minor fault") penalty += 12;
    else if (flag === "Faulty or parts listing") penalty += 30;
    else if (flag === "Cosmetic wear mentioned") penalty += 5;
    else if (flag === "No controller included") penalty += 10;
    else if (flag === "No box included") penalty += 2;
    else if (flag === "Bundle intent searched, but extras look weak") penalty += 4;
    else if (flag === "Console-only intent searched, but listing may include extras") penalty += 4;
    else if (flag === "Switch version not confirmed") penalty += 12;
  }

  return penalty;
}
