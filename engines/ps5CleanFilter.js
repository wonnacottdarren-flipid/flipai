// ps5CleanFilter.js

import { normalizeText } from "./baseEngine.js";

function norm(text) {
  return normalizeText(String(text || ""));
}

function hasAny(text, terms) {
  return terms.some(t => text.includes(t));
}

// --- CORE TERMS ---
const PS5_TERMS = ["ps5", "playstation 5"];

const CONSOLE_TERMS = [
  "console",
  "ps5 console",
  "playstation 5 console",
  "disc edition",
  "digital edition",
];

const BUNDLE_TERMS = [
  "bundle",
  "with controller",
  "controller included",
  "includes controller",
  "with games",
  "games included",
  "with cables",
  "cables included",
  "boxed",
  "box included",
];

const HARD_REJECT = [
  "faulty",
  "broken",
  "not working",
  "for parts",
  "spares",
];

const HARD_ONLY = [
  "controller only",
  "game only",
  "games only",
  "box only",
  "empty box",
  "disc drive only",
  "cable only",
  "headset only",
];

// --- MAIN FUNCTION ---
export function matchPs5Clean(text) {
  const t = norm(text);

  // 1. Must be PS5
  if (!hasAny(t, PS5_TERMS)) {
    return { matched: false, reason: "not_ps5" };
  }

  // 2. Hard reject (always kill)
  if (hasAny(t, HARD_REJECT)) {
    return { matched: false, reason: "faulty" };
  }

  // 3. Hard "only" reject
  if (hasAny(t, HARD_ONLY)) {
    return { matched: false, reason: "accessory_only" };
  }

  const hasConsole = hasAny(t, CONSOLE_TERMS);
  const hasBundle = hasAny(t, BUNDLE_TERMS);

  // 4. Bundle allowed
  if (hasBundle) {
    return {
      matched: true,
      type: "bundle",
      reason: "bundle_pass"
    };
  }

  // 5. Normal console
  if (hasConsole) {
    return {
      matched: true,
      type: "console",
      reason: "console_pass"
    };
  }

  // 6. Everything else = reject
  return { matched: false, reason: "weak_signal" };
}
