import { hasAny, normalizeAudioText } from "./audioV2Text.js";

function getCategoryTexts(item = {}) {
  const names = Array.isArray(item?.categories)
    ? item.categories.map((c) => c?.categoryName).filter(Boolean)
    : [];

  return names.map((name) => normalizeAudioText(name));
}

export function isAudioCategory(item = {}) {
  const texts = getCategoryTexts(item);

  return texts.some((t) =>
    hasAny(t, [
      "headphones",
      "headsets",
      "portable audio",
      "earbud",
      "earbuds",
      "earphones",
      "in-ear headphones",
      "over-ear headphones",
      "on-ear headphones",
      "sound & vision",
    ])
  );
}

export function isAccessoryCategory(item = {}) {
  const texts = getCategoryTexts(item);

  return texts.some((t) =>
    hasAny(t, [
      "cases",
      "covers",
      "chargers",
      "cables",
      "adapters",
      "replacement parts",
      "parts",
      "ear tips",
      "pads",
      "ear pads",
      "headbands",
      "accessories",
    ])
  );
}

export function hasHeadphoneSignals(text = "") {
  const t = normalizeAudioText(text);

  return hasAny(t, [
    "headphones",
    "earbuds",
    "earphones",
    "wireless",
    "bluetooth",
    "noise cancelling",
    "noise canceling",
    "anc",
    "airpods",
    "galaxy buds",
    "sony",
    "bose",
    "xm4",
    "xm5",
    "qc",
  ]);
}
