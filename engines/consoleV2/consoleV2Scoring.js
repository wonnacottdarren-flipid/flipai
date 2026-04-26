import { extractTotalPrice } from "../baseEngine.js";

function normalize(text = "") {
  return String(text).toLowerCase();
}

function hasAny(text = "", terms = []) {
  return terms.some((t) => text.includes(t));
}

function isGameListing(text = "") {
  // 🔥 Must contain console to be valid
  if (!text.includes("console") && !text.includes("ps5 console")) {
    return true;
  }

  // 🔥 Block obvious games / releases
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

function detectBundleType(text = "") {
  if (
    hasAny(text, [
      "bundle",
      "with games",
      "with controller",
      "2 controllers",
      "includes controller",
      "extras",
    ])
  ) return "bundle";

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

    // 🚫 HARD BLOCKS
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

    // 🚫 Skip zero / junk prices
    if (!total || total <= 0) continue;

    let score = 10;

    // 🚫 Too cheap (junk / incomplete)
    if (total < 150) {
      score -= 5;
    }

    // 🚫 Weak titles
    if (title.length < 10) {
      score -= 2;
    }

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
