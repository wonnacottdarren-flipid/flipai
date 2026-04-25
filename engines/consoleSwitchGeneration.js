import { hasAny, normalizeConsoleText } from "./consoleItemText.js";

function isSwitchV2Signal(text = "") {
  const t = normalizeConsoleText(text);

  return hasAny(t, [
    "switch v2",
    "nintendo switch v2",
    "hac-001(-01)",
    "hac 001(-01)",
    "hac-001 01",
    "hac 001 01",
    "hac-001-01",
    "hac 001 01 model",
    "revised model",
    "improved battery",
    "better battery",
    "battery improved",
    "new battery model",
    "mariko",
    "red box model",
  ]);
}

function isSwitchV1Signal(text = "") {
  const t = normalizeConsoleText(text);

  const directSignals = [
    "switch v1",
    "nintendo switch v1",
    "unpatched switch",
    "unpatched v1",
    "first generation switch",
    "gen 1 switch",
    "generation 1 switch",
    "launch model",
    "day one switch",
    "switch one",
    "nintendo switch one",
    "switch 1",
    "nintendo switch 1",
    "gen1 switch",
    "generation1 switch",
    "first gen switch",
    "1st gen switch",
    "v1 console",
    "v1 model",
  ];

  if (hasAny(t, directSignals)) return true;

  const hasBaseHac001 =
    t.includes("hac-001 ") ||
    t.includes("hac 001 ") ||
    t.includes("hac-001)") ||
    t.includes("hac 001)") ||
    t.endsWith("hac-001") ||
    t.endsWith("hac 001") ||
    t.includes("model hac-001") ||
    t.includes("model hac 001");

  if (hasBaseHac001 && !isSwitchV2Signal(t)) return true;

  return false;
}

export function detectSwitchGeneration(text = "") {
  const t = normalizeConsoleText(text);

  if (isSwitchV2Signal(t)) return "v2";
  if (isSwitchV1Signal(t)) return "v1";
  return "unknown";
}
