function normalize(text = "") {
  return String(text).toLowerCase();
}

function hasAny(text = "", terms = []) {
  return terms.some((t) => text.includes(t));
}

function isHardBlocked(item = {}) {
  const text = normalize(item?.title || "");

  // ❌ Block games
  if (
    hasAny(text, [
      "ps5 game",
      "playstation game",
      "ea sports",
      "fifa",
      "fc 24",
      "fc 25",
      "call of duty",
      "spiderman",
      "game only",
      "disc only",
    ])
  ) {
    return true;
  }

  // ❌ Block accessories
  if (
    hasAny(text, [
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
    ])
  ) {
    return true;
  }

  // ❌ Block box-only / parts
  if (
    hasAny(text, [
      "box only",
      "empty box",
      "no console",
      "for parts",
      "spares",
      "repair",
      "faulty",
      "not working",
    ])
  ) {
    return true;
  }

  return false;
}

function detectBundleType(item = {}) {
  const text = normalize(item?.title || "");

  if (
    hasAny(text, [
      "bundle",
      "with games",
      "with controller",
      "2 controllers",
      "includes controller",
      "extras",
    ])
  ) {
    return "bundle";
  }

  if (
    hasAny(text, [
      "boxed",
      "complete in box",
    ])
  ) {
    return "boxed";
  }

  return "standard";
}

function detectCondition(item = {}) {
  const text = normalize(
    `${item?.title || ""} ${item?.condition || ""}`
  );

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

    // 🚫 HARD BLOCK FIRST
    if (isHardBlocked(item)) continue;

    let score = 10;

    // ❌ Price sanity (PS5 shouldn't be £100)
    const total = Number(item?.total || 0);
    if (total > 0 && total < 150) {
      score -= 5;
    }

    // ❌ Weak titles
    if (title.length < 10) {
      score -= 2;
    }

    const bundleType = detectBundleType(item);
    const conditionState = detectCondition(item);

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
