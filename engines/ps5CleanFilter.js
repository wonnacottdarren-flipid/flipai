import { normalizeText } from "./baseEngine.js";

function normalize(value) {
  return normalizeText(String(value || ""))
    .replace(/\bplaystation\s*5\b/g, "playstation5")
    .replace(/\bps\s*5\b/g, "ps5")
    .replace(/\bdisk\b/g, "disc")
    .replace(/\b1 tb\b/g, "1tb")
    .replace(/\b2 tb\b/g, "2tb")
    .replace(/\b825 gb\b/g, "825gb")
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
      item?.conditionDisplayName,
      item?.itemCondition,
      item?.shortDescription,
    ]
      .filter(Boolean)
      .join(" ")
  );
}

function hasAny(text, terms) {
  return terms.some((term) => text.includes(term));
}

function isPs5(text) {
  return (
    text.includes("ps5") ||
    text.includes("playstation 5") ||
    text.includes("playstation5")
  );
}

function hasConsoleContext(text) {
  return hasAny(text, [
    "console",
    "system",
    "bundle",
    "disc edition",
    "digital edition",
    "standard edition",
    "disc version",
    "disc console",
    "digital console",
    "playstation5",
    "ps5",
    "cfi",
    "825gb",
    "1tb",
    "2tb",
    "ssd",
    "extra ssd",
    "extra 1tb ssd",
    "with ssd",
    "with 1tb ssd",
    "with controller",
    "controller included",
    "includes controller",
    "with 2 controllers",
    "with two controllers",
    "2 controllers",
    "two controllers",
    "extra controller",
    "second controller",
    "spare controller",
    "with games",
    "games included",
    "includes games",
    "with cables",
    "cables included",
    "boxed",
    "box included",
    "complete in box",
  ]);
}

function detectVariant(text) {
  if (
    hasAny(text, [
      "digital edition",
      "digital console",
      "all digital",
      "discless",
      "disc less",
      "cfi 1116b",
      "cfi 1216b",
      "cfi-1116b",
      "cfi-1216b",
    ])
  ) {
    return "digital";
  }

  if (
    hasAny(text, [
      "disc edition",
      "disc version",
      "disc console",
      "standard edition",
      "standard console",
      "with disc drive",
      "bluray",
      "blu ray",
      "blu-ray",
      "cfi 1116a",
      "cfi 1216a",
      "cfi-1116a",
      "cfi-1216a",
    ])
  ) {
    return "disc";
  }

  return "unknown";
}

function isFaulty(text) {
  return hasAny(text, [
    "faulty",
    "not working",
    "for parts",
    "for spares",
    "spares or repairs",
    "spares repairs",
    "parts only",
    "broken",
    "no power",
    "won't turn on",
    "wont turn on",
    "will not turn on",
    "repair required",
    "needs repair",
    "water damaged",
    "motherboard fault",
    "blue light of death",
    "console banned",
    "banned",
    "account locked",
    "bricked",
    "dead console",
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
    "faceplate only",
    "cover only",
    "skin only",
    "charger only",
    "stand only",
    "hdmi cable only",
    "power cable only",
  ]);
}

function isGameOnly(text) {
  return hasAny(text, [
    "ps5 game",
    "playstation5 game",
    "playstation 5 game",
    "game only",
    "disc only",
    "no console",
    "steelbook",
    "steel book",
  ]);
}

function isBundle(text) {
  return hasAny(text, [
    "bundle",
    "with controller",
    "controller included",
    "includes controller",
    "with 2 controllers",
    "with two controllers",
    "2 controllers",
    "two controllers",
    "extra controller",
    "second controller",
    "spare controller",
    "with games",
    "games included",
    "includes games",
    "with cables",
    "cables included",
    "boxed",
    "box included",
    "complete in box",
    "with headset",
    "includes headset",
    "extra 1tb ssd",
    "extra ssd",
    "with ssd",
    "with 1tb ssd",
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
