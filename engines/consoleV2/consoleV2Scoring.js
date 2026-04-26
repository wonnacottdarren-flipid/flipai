import { extractTotalPrice } from "../baseEngine.js";

function normalize(text = "") {
  return String(text).toLowerCase();
}

function hasAny(text = "", terms = []) {
  return terms.some((t) => text.includes(t));
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

// 🔥 IMPROVED BUNDLE DETECTION
function detectBundleType(text = "") {
  // Strong bundle signals
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

  // Medium signals (still treat as bundle)
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

export function scoreConsoleV2Items(items = [], queryContext = {}) {
  const results = [];

  for (const item of items) {
    const title = String(item?.title || "");
    const text = normalize(title);

    // 🚫 HARD FILTERS
    if (isGameListing(text)) continue;
    if (isAccessory(text)) continue;
    if (isFaulty(text)) continue;

    // 🚫 Block digital when searching disc
    if (
      queryContext?.family === "ps5_disc" &&
      text.includes("digital")
    ) {
      continue;
    }

    const total = extractTotalPrice(item);

    if (!total || total <= 0) continue;

    let score = 10;

    // Cheap junk penalty
    if (total < 150) score -= 5;

    // Weak title penalty
    if (title.length < 10) score -= 2;

    const bundleType = detectBundleType(text);
    const conditionState = detectCondition(text);

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
      warningFlags: [],
      warningPenalty: 0,
    });
  }

  return results;
}
