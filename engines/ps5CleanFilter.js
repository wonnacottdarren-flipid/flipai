import { normalizeText } from "./baseEngine.js";

function normalize(value) {
  return normalizeText(String(value || ""))
    .replace(/\bplaystation\s*5\b/g, "ps5")
    .replace(/\bps\s*5\b/g, "ps5")
    .replace(/\bdisk\b/g, "disc")
    .replace(/\s+/g, " ")
    .trim();
}

function getText(item) {
  return normalize(
    [
      item?.title,
      item?.subtitle,
      item?.description,
      item?.condition,
    ]
      .filter(Boolean)
      .join(" ")
  );
}

function hasAny(text, terms) {
  return terms.some((t) => text.includes(t));
}

function isPs5(text) {
  return text.includes("ps5");
}

function hasConsoleContext(text) {
  return hasAny(text, [
    "console",
    "system",
    "bundle",
    "with controller",
    "controller included",
    "with games",
    "games included",
    "with cables",
    "cables included",
    "boxed",
    "box included",
    "complete in box",
    "disc edition",
    "digital edition",
    "standard edition",
    "1tb",
    "825gb",
  ]);
}

function detectVariant(text) {
  if (hasAny(text, ["digital edition", "digital"])) return "digital";
  if (hasAny(text, ["disc edition", "disc", "standard edition"])) return "disc";
  return "unknown";
}

function isFaulty(text) {
  return hasAny(text, [
    "faulty",
    "not working",
    "for parts",
    "spares",
    "repairs",
    "broken",
    "no power",
    "won't turn on",
    "wont turn on",
  ]);
}

function isAccessoryOnly(text) {
  return hasAny(text, [
    "controller only",
    "dualsense only",
    "pad only",
    "remote only",
    "disc drive only",
    "drive only",
    "box only",
    "empty box",
    "manual only",
    "shell only",
    "case only",
  ]);
}

function isGameOnly(text) {
  return hasAny(text, [
    "ps5 game",
    "game only",
    "disc only",
    "no console",
    "steelbook",
  ]);
}

function isBundle(text) {
  return hasAny(text, [
    "bundle",
    "with controller",
    "controller included",
    "with games",
    "games included",
    "with cables",
    "cables included",
    "boxed",
    "box included",
    "with headset",
    "includes headset",
  ]);
}

export function matchPs5CleanListing(item, queryContext = {}) {
  const text = getText(item);

  if (!isPs5(text)) {
    return { matched: false, reason: "not_ps5", variant: "unknown", bundleType: "none" };
  }

  if (!hasConsoleContext(text)) {
    return { matched: false, reason: "no_console_context", variant: "unknown", bundleType: "none" };
  }

  if (isFaulty(text)) {
    return { matched: false, reason: "faulty_or_parts", variant: "unknown", bundleType: "none" };
  }

  if (isAccessoryOnly(text)) {
    return { matched: false, reason: "accessory_only", variant: "unknown", bundleType: "none" };
  }

  if (isGameOnly(text)) {
    return { matched: false, reason: "game_only", variant: "unknown", bundleType: "none" };
  }

  const variant = detectVariant(text);
  const bundle = isBundle(text);

  return {
    matched: true,
    reason: bundle ? "ps5_bundle" : "ps5_console",
    variant,
    bundleType: bundle ? "bundle" : "console_only",
  };
}
