import { extractTotalPrice } from "../baseEngine.js";
import { parseConsoleFamily } from "./consoleV2Family.js";

function normalize(text = "") {
  return String(text).toLowerCase();
}

function hasAny(text = "", terms = []) {
  return terms.some((t) => text.includes(t));
}

function isFamilyMismatch(text = "", queryFamily = "") {
  const family = String(queryFamily || "");
  const itemFamily = parseConsoleFamily(text);

  if (!family || !itemFamily) return false;

  if (family === itemFamily) return false;

  if (family === "switch_v2" && (itemFamily === "switch_oled" || itemFamily === "switch_lite")) {
    return true;
  }

  if (family === "switch_oled" && itemFamily !== "switch_oled") {
    return true;
  }

  if (family === "switch_lite" && itemFamily !== "switch_lite") {
    return true;
  }

  if (family.startsWith("xbox_series") && itemFamily !== family) {
    return true;
  }

  if (family.startsWith("ps5") && itemFamily !== family) {
    return true;
  }

  return false;
}

// 🚫 BLOCK NON-CONSOLES
function isGameListing(text = "") {
  if (!text.includes("console")) return true;

  if (
    hasAny(text, [
      "pre-order",
      "pre order",
      "release on",
      "ps5 game",
      "playstation game",
      "ea sports",
      "fifa",
      "fc ",
      "call of duty",
      "spiderman",
      "disc only",
      "game only",
    ])
  ) return true;

  return false;
}

function isAccessory(text = "") {
  return hasAny(text, [
    "controller only",
    "dualsense",
    "charging dock",
    "charging station",
    "headset",
    "stand",
    "cooling fan",
    "faceplate",
    "cover plate",
    "remote",
    "cable only",
  ]);
}

function isFaulty(text = "") {
  return hasAny(text, [
    "box only",
    "empty box",
    "no console",
    "for parts",
    "spares",
    "repair",
    "faulty",
    "not working",
  ]);
}

function isMissingController(text = "") {
  return hasAny(text, [
    "no pad",
    "no controller",
    "without controller",
    "missing controller",
    "controller not included",
    "pad not included",
    "no dualsense",
    "without dualsense",
  ]);
}

// 🔥 IMPROVED BUNDLE DETECTION
function detectBundleType(text = "") {
  if (isMissingController(text)) {
    return "console_only";
  }

  if (
    hasAny(text, [
      "bundle",
      "with games",
      "includes games",
      "games included",
      "with controller",
      "includes controller",
      "controller included",
      "2 controllers",
      "two controllers",
      "extra controller",
      "with accessories",
      "includes accessories",
      "accessories included",
      "with extras",
      "extras included",
      "charging dock",
      "charging station",
    ])
  ) {
    return "bundle";
  }

  if (
    hasAny(text, [
      "controller and",
      "controller +",
      "plus controller",
      "plus games",
      "plus extras",
      "+ controller",
      "+ games",
      "+ extras",
    ])
  ) {
    return "bundle";
  }

  if (hasAny(text, ["boxed", "complete in box"])) return "boxed";

  return "standard";
}

function detectCondition(text = "") {
  if (hasAny(text, ["brand new", "sealed"])) return "new";
  if (hasAny(text, ["very good", "excellent"])) return "clean_working";
  if (hasAny(text, ["good"])) return "used_working";
  return "unknown";
}

function getWarningFlags(text = "") {
  const warnings = [];

  if (isMissingController(text)) {
    warnings.push("No controller included");
  }

  if (hasAny(text, ["read description", "see description"])) {
    warnings.push("Read description carefully");
  }

  if (hasAny(text, ["scratches", "scratched", "worn", "heavy wear"])) {
    warnings.push("Cosmetic wear mentioned");
  }

  if (hasAny(text, ["low firmware", "jailbreak", "modded"])) {
    warnings.push("Specialist buyer wording");
  }

  if (hasAny(text, ["extra ssd", "upgraded ssd", "plus extra 1tb ssd"])) {
    warnings.push("Storage upgrade needs checking");
  }

  return warnings;
}

function getRankingScore(text = "", title = "", total = 0, bundleType = "", conditionState = "") {
  let score = 10;

  if (hasAny(text, ["disc edition", "disc version", "825gb", "1tb", "slim"])) score += 1.4;
  if (hasAny(text, ["sony playstation 5", "playstation 5", "ps5"])) score += 0.8;
  if (hasAny(text, ["console and controller", "with controller", "controller included"])) score += 0.7;
  if (bundleType === "bundle") score += 0.6;
  if (bundleType === "boxed") score += 0.4;
  if (bundleType === "console_only") score -= 2.4;

  if (conditionState === "new") score += 1.2;
  if (conditionState === "clean_working") score += 0.9;
  if (conditionState === "used_working") score += 0.4;

  if (isMissingController(text)) score -= 2.6;
  if (hasAny(text, ["low firmware", "jailbreak", "modded"])) score -= 2.4;
  if (hasAny(text, ["read description", "see description"])) score -= 1.4;
  if (hasAny(text, ["scratches", "scratched", "worn", "heavy wear"])) score -= 0.8;
  if (hasAny(text, ["extra ssd", "upgraded ssd", "plus extra 1tb ssd"])) score -= 1.2;

  if (total < 150) score -= 5;
  else if (total < 230) score -= 1.6;
  else if (total >= 280 && total <= 380) score += 0.8;
  else if (total > 430) score -= 0.9;

  if (title.length < 10) score -= 2;

  return Math.round(score * 100) / 100;
}

export function scoreConsoleV2Items(items = [], queryContext = {}) {
  const results = [];

  for (const item of items) {
    const title = String(item?.title || "");
    const text = normalize(title);

    // 🚫 HARD FILTERS
    if (isGameListing(text)) continue;
    if (isAccessory(text)) continue;
    if (isFaulty(text)) continue;
    if (isFamilyMismatch(text, queryContext?.family || "")) continue;

    // 🚫 Block digital when searching disc
    if (
      queryContext?.family === "ps5_disc" &&
      text.includes("digital")
    ) {
      continue;
    }

    const total = extractTotalPrice(item);

    if (!total || total <= 0) continue;

    const bundleType = detectBundleType(text);
    const conditionState = detectCondition(text);
    const warningFlags = getWarningFlags(text);
    const score = getRankingScore(text, title, total, bundleType, conditionState);

    results.push({
      item,
      titleText: title,
      total,
      score,
      matched: score > 0,
      family: queryContext?.family || "",
      conditionState,
      bundleType,
      bundleSignals: {},
      warningFlags,
      warningPenalty: warningFlags.length,
    });
  }

  return results.sort((a, b) => b.score - a.score);
}
