// ps5ConsoleFilter.js

import { normalizeText } from "./baseEngine.js";

function textOf(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  return [
    value.title,
    value.subtitle,
    value.condition,
    value.category,
    value.description,
  ]
    .filter(Boolean)
    .join(" ");
}

function norm(value) {
  return normalizeText(textOf(value));
}

function hasAny(text, terms) {
  return terms.some((term) => text.includes(term));
}

function hasWord(text, word) {
  return new RegExp(`\\b${word}\\b`, "i").test(text);
}

const PS5_TERMS = [
  "ps5",
  "playstation 5",
  "play station 5",
  "sony ps5",
  "sony playstation 5",
];

const PS5_DISC_TERMS = [
  "ps5 disc",
  "ps5 disk",
  "playstation 5 disc",
  "playstation 5 disk",
  "disc edition",
  "disk edition",
  "disc version",
  "disk version",
  "standard edition",
  "cfi 1116a",
  "cfi 1216a",
  "cfi-1116a",
  "cfi-1216a",
];

const PS5_DIGITAL_TERMS = [
  "ps5 digital",
  "playstation 5 digital",
  "digital edition",
  "digital console",
  "cfi 1116b",
  "cfi 1216b",
  "cfi-1116b",
  "cfi-1216b",
];

const HARD_REJECT_TERMS = [
  "faulty",
  "fault",
  "for parts",
  "parts only",
  "spares",
  "spares or repair",
  "not working",
  "does not work",
  "doesn't work",
  "broken",
  "damaged",
  "repair only",
  "no power",
  "won't turn on",
  "wont turn on",
  "hdmi fault",
  "hdmi broken",
  "liquid damage",
  "water damage",
  "overheating",
  "over heats",
  "overheats",
  "banned console",
  "console banned",
  "account banned",
];

const HARD_ACCESSORY_TERMS = [
  "controller only",
  "pad only",
  "dualsense only",
  "game only",
  "games only",
  "box only",
  "empty box",
  "disc drive only",
  "drive only",
  "stand only",
  "charging dock",
  "charging station",
  "headset",
  "headphones",
  "cover plates",
  "face plates",
  "faceplate",
  "skins",
  "skin",
  "case only",
  "shell only",
  "hdmi cable only",
  "power cable only",
  "cable only",
  "camera only",
  "remote only",
  "media remote",
];

const ACCESSORY_CATEGORY_TERMS = [
  "controllers",
  "controller",
  "video games",
  "games",
  "accessories",
  "headsets",
  "cables",
  "chargers",
  "skins",
  "cases",
];

const BUNDLE_TERMS = [
  "bundle",
  "console bundle",
  "with controller",
  "controller included",
  "includes controller",
  "with pad",
  "with dualsense",
  "games included",
  "with games",
  "includes games",
  "with game",
  "boxed",
  "box included",
  "with box",
  "with cables",
  "cables included",
  "power cable",
  "hdmi cable",
  "complete set",
  "full set",
  "ready to play",
];

const CONSOLE_TERMS = [
  "console",
  "playstation 5 console",
  "ps5 console",
  "disc console",
  "digital console",
];

export function isPs5Like(input) {
  const text = norm(input);
  return hasAny(text, PS5_TERMS);
}

export function isHardPs5AccessoryText(input) {
  const text = norm(input);

  if (!isPs5Like(text)) return false;

  if (hasAny(text, HARD_ACCESSORY_TERMS)) return true;

  const saysController = hasAny(text, [
    "controller",
    "dualsense",
    "pad",
    "wireless controller",
  ]);

  const saysConsole = hasAny(text, CONSOLE_TERMS);

  if (saysController && !saysConsole && !hasAny(text, BUNDLE_TERMS)) {
    return true;
  }

  const saysGame = hasWord(text, "game") || hasWord(text, "games");
  if (saysGame && !saysConsole && !hasAny(text, BUNDLE_TERMS)) {
    return true;
  }

  const saysAccessory = hasAny(text, ACCESSORY_CATEGORY_TERMS);
  if (saysAccessory && !saysConsole && !hasAny(text, BUNDLE_TERMS)) {
    return true;
  }

  return false;
}

export function isHardPs5AccessoryListing(listing) {
  const text = norm(listing);
  return isHardPs5AccessoryText(text);
}

export function hasHardPs5Reject(input) {
  const text = norm(input);
  return hasAny(text, HARD_REJECT_TERMS);
}

export function detectPs5Variant(input) {
  const text = norm(input);

  if (!isPs5Like(text)) return null;

  if (hasAny(text, PS5_DIGITAL_TERMS)) {
    return "ps5_digital";
  }

  if (hasAny(text, PS5_DISC_TERMS)) {
    return "ps5_disc";
  }

  return "ps5_unknown";
}

export function isPs5BundleCandidate(input) {
  const text = norm(input);

  if (!isPs5Like(text)) return false;
  if (hasHardPs5Reject(text)) return false;
  if (isHardPs5AccessoryText(text)) return false;

  const hasConsoleSignal = hasAny(text, CONSOLE_TERMS) || hasAny(text, PS5_DISC_TERMS) || hasAny(text, PS5_DIGITAL_TERMS);
  const hasBundleSignal = hasAny(text, BUNDLE_TERMS);

  return hasConsoleSignal && hasBundleSignal;
}

export function detectConsoleType(input) {
  const text = norm(input);

  if (!isPs5Like(text)) return null;
  if (hasHardPs5Reject(text)) return null;
  if (isHardPs5AccessoryText(text)) return null;

  const variant = detectPs5Variant(text);

  if (isPs5BundleCandidate(text)) {
    return {
      family: "ps5",
      type: variant || "ps5_unknown",
      variant: variant || "ps5_unknown",
      isBundle: true,
      isConsole: true,
    };
  }

  if (hasAny(text, CONSOLE_TERMS) || variant === "ps5_disc" || variant === "ps5_digital") {
    return {
      family: "ps5",
      type: variant || "ps5_unknown",
      variant: variant || "ps5_unknown",
      isBundle: false,
      isConsole: true,
    };
  }

  return null;
}

export default {
  isPs5Like,
  isHardPs5AccessoryText,
  isHardPs5AccessoryListing,
  detectPs5Variant,
  detectConsoleType,
  isPs5BundleCandidate,
  hasHardPs5Reject,
};
