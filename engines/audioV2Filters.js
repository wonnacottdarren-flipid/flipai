import { hasAny, normalizeAudioText } from "./audioV2Text.js";
import { isEarbudAudioFamily } from "./audioV2Condition.js";
import { isAudioCategory, isAccessoryCategory } from "./audioV2Categories.js";

/* ---------- BASIC FILTERS ---------- */

export function isAccessoryOnly(text = "") {
  const t = normalizeAudioText(text);

  return hasAny(t, [
    "case only",
    "charging case only",
    "case cradle only",
    "charging cradle only",
    "cradle only",
    "replacement case",
    "box only",
    "empty box",
    "manual only",
    "ear tips only",
    "tips only",
    "ear pads only",
    "charging cable only",
    "usb cable only",
  ]);
}

export function isPartialItem(text = "") {
  const t = normalizeAudioText(text);

  return hasAny(t, [
    "left only",
    "right only",
    "single ear",
    "one ear",
    "single bud",
    "one bud",
    "left bud only",
    "right bud only",
    "replacement earbud",
    "replacement bud",
    "missing left",
    "missing right",
    "left airpod only",
    "right airpod only",
  ]);
}

export function looksLikeSingleSideEarbud(text = "") {
  const t = normalizeAudioText(text);

  return hasAny(t, [
    "left only",
    "right only",
    "left earbud",
    "right earbud",
    "single bud",
    "single earbud",
    "left airpod",
    "right airpod",
  ]);
}

/* ---------- CASE / INCOMPLETE ---------- */

export function looksLikeCaseOnlyListing(text = "") {
  const t = normalizeAudioText(text);

  if (
    hasAny(t, [
      "charging case",
      "magsafe case",
      "wireless case",
      "usb c case",
      "case only",
      "charging case only",
    ])
  ) {
    if (
      !hasAny(t, [
        "with earbuds",
        "both earbuds",
        "full set",
        "complete set",
        "left and right",
      ])
    ) {
      return true;
    }
  }

  return false;
}

export function hasFullSetSignals(text = "") {
  const t = normalizeAudioText(text);

  return hasAny(t, [
    "full set",
    "complete set",
    "both earbuds",
    "both buds",
    "left and right",
    "with case",
    "includes case",
    "earbuds and case",
  ]);
}

export function looksLikeIncompleteEarbudListing(text = "", queryContext = {}, item = {}) {
  const t = normalizeAudioText(text);

  if (!isEarbudAudioFamily(queryContext)) return false;

  if (isAccessoryOnly(t)) return true;
  if (isPartialItem(t)) return true;
  if (looksLikeSingleSideEarbud(t)) return true;
  if (looksLikeCaseOnlyListing(t)) return true;

  if (
    hasAny(t, ["charging case"]) &&
    !hasFullSetSignals(t)
  ) {
    return true;
  }

  return false;
}

/* ---------- DIRTY / FAKE ---------- */

export function isDirtyListing(text = "") {
  const t = normalizeAudioText(text);

  return hasAny(t, [
    "replica",
    "fake",
    "counterfeit",
    "clone",
    "copy",
    "not genuine",
    "aaa quality",
    "1:1",
  ]);
}

/* ---------- SAMSUNG CLONES ---------- */

export function isGenericSamsungCloneListing(text = "", queryContext = {}) {
  const t = normalizeAudioText(text);
  const brand = String(queryContext?.brand || "");
  const family = String(queryContext?.family || "");

  if (brand !== "samsung" && !family.startsWith("galaxy_buds")) {
    return false;
  }

  if (
    hasAny(t, [
      "for samsung",
      "compatible with samsung",
      "wireless bluetooth earbuds",
      "buds for samsung",
    ]) &&
    !hasAny(t, [
      "samsung galaxy buds",
      "genuine samsung",
      "official samsung",
    ])
  ) {
    return true;
  }

  return false;
}

/* ---------- FINAL GATE ---------- */

export function failsAudioBaseFilters(text = "", item = {}, queryContext = {}) {
  const t = normalizeAudioText(text);

  if (!t) return true;

  if (isAccessoryOnly(t)) return true;
  if (isPartialItem(t)) return true;
  if (looksLikeSingleSideEarbud(t)) return true;
  if (looksLikeCaseOnlyListing(t)) return true;
  if (looksLikeIncompleteEarbudListing(t, queryContext, item)) return true;
  if (isDirtyListing(t)) return true;
  if (isGenericSamsungCloneListing(t, queryContext)) return true;

  const inAudio = isAudioCategory(item);
  const inAccessory = isAccessoryCategory(item);

  if (inAccessory && !inAudio) return true;

  return false;
}
