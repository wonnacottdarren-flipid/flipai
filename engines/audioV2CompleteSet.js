import { hasAny, normalizeAudioText } from "./audioV2Text.js";
import { isAudioCategory, isAccessoryCategory } from "./audioV2Categories.js";
import {
  isAccessoryOnly,
  isPartialItem,
  looksLikeSingleSideEarbud,
  looksLikeCaseOnlyListing,
  isGenericSamsungCloneListing,
} from "./audioV2Filters.js";

export function wantsCompleteSetFromQuery(queryContext = {}) {
  const q = normalizeAudioText(queryContext?.normalizedQuery || queryContext?.rawQuery || "");

  return hasAny(q, [
    "complete",
    "complete set",
    "full set",
    "boxed complete",
    "with case",
    "with charging case",
    "pair",
    "both buds",
    "both earbuds",
  ]);
}

export function hasFullSetSignals(text = "") {
  const t = normalizeAudioText(text);

  return hasAny(t, [
    "full set",
    "complete set",
    "complete pair",
    "pair of earbuds",
    "both earbuds",
    "both buds",
    "left and right",
    "left & right",
    "with case",
    "with charging case",
    "earbuds and case",
    "buds and case",
    "includes case",
    "includes charging case",
    "earbuds included",
    "buds included",
    "includes earbuds",
    "includes buds",
    "2 earbuds",
    "two earbuds",
    "full working set",
    "boxed complete",
  ]);
}

export function hasAirpodsCompleteConfidenceSignals(text = "") {
  const t = normalizeAudioText(text);

  const hasOfficialOrFamilySignal = hasAny(t, [
    "airpods",
    "airpods pro 2",
    "airpods pro 2nd",
    "airpods pro second generation",
    "airpods pro gen 2",
    "airpods pro 2nd gen",
    "airpods pro 2nd generation",
    "apple airpods pro 2",
    "airpods pro",
    "airpods 3",
    "airpods 2",
    "a2698",
    "a2699",
    "a2700",
    "a3047",
    "a3048",
    "a2968",
  ]);

  if (!hasOfficialOrFamilySignal) return false;

  return (
    hasFullSetSignals(t) ||
    hasAny(t, [
      "with case",
      "with charging case",
      "charging case",
      "magsafe case",
      "lightning case",
      "usb-c case",
      "usb c case",
      "wireless charging case",
      "case included",
      "includes case",
      "earbuds and case",
      "buds and case",
      "a2698+a2699",
      "a2698 a2699",
      "a2698+a2699+a2700",
      "a2698 a2699 a2700",
      "a3047+a3048",
      "a3047 a3048",
      "a3047+a3048+a2968",
      "a3047 a3048 a2968",
      "a2698 + a2699",
      "a3047 + a3048",
      "boxed",
      "with box",
      "box and case",
      "complete",
      "complete set",
      "full set",
      "left and right",
      "left & right",
      "both buds",
      "both earbuds",
      "a2700",
      "a2968",
      "used",
      "fully working",
      "working order",
      "tested",
      "good condition",
      "excellent condition",
      "genuine apple",
      "genuine",
      "apple",
      "in-ear",
      "wireless",
      "bluetooth",
      "noise cancelling",
      "noise canceling",
    ])
  );
}

export function looksLikeLikelyCompleteAirpodsListing(text = "", queryContext = {}, item = {}) {
  const t = normalizeAudioText(text);
  const family = String(queryContext?.family || "");
  const wantsCompleteSet = Boolean(queryContext?.wantsCompleteSet);

  if (!wantsCompleteSet) return false;
  if (!family.startsWith("airpods_")) return false;
  if (!hasAny(t, ["airpods"])) return false;

  if (isAccessoryOnly(t)) return false;
  if (isPartialItem(t)) return false;
  if (looksLikeSingleSideEarbud(t)) return false;
  if (looksLikeCaseOnlyListing(t)) return false;

  const inAudioCategory = isAudioCategory(item);
  const inAccessoryCategory = isAccessoryCategory(item);

  if (inAccessoryCategory && !inAudioCategory) return false;
  if (!hasAirpodsCompleteConfidenceSignals(t)) return false;

  return true;
}

export function hasSamsungOfficialSignals(text = "") {
  const t = normalizeAudioText(text);

  return hasAny(t, [
    "samsung galaxy buds",
    "galaxy buds 2 pro",
    "galaxy buds 3 pro",
    "galaxy buds 3",
    "galaxy buds 2",
    "galaxy buds pro",
    "galaxy buds live",
    "galaxy buds plus",
    "galaxy buds fe",
    "sm-r510",
    "sm-r530",
    "sm-r630",
    "official samsung",
    "genuine samsung",
  ]);
}

export function hasSamsungStrongCompleteSignals(text = "") {
  const t = normalizeAudioText(text);

  return hasAny(t, [
    "with the box",
    "with box",
    "boxed",
    "boxed complete",
    "box included",
    "includes box",
    "with case",
    "with charging case",
    "case included",
    "includes case",
    "complete",
    "complete set",
    "full set",
    "full working set",
    "earbuds and case",
    "buds and case",
    "both earbuds",
    "both buds",
    "left and right",
    "left & right",
  ]);
}

export function hasSamsungCompleteConfidenceSignals(text = "") {
  const t = normalizeAudioText(text);

  const hasOfficialOrModelSignal =
    hasSamsungOfficialSignals(t) ||
    hasAny(t, [
      "buds2 pro",
      "buds 2 pro",
      "buds3 pro",
      "buds 3 pro",
      "buds2",
      "buds 2",
      "buds3",
      "buds 3",
      "buds pro",
      "buds live",
      "buds plus",
      "buds fe",
    ]);

  if (!hasOfficialOrModelSignal) return false;
  if (hasSamsungStrongCompleteSignals(t)) return true;

  return hasAny(t, [
    "earbuds",
    "wireless earbuds",
    "wireless earphones",
    "bluetooth earbuds",
    "bluetooth earphones",
    "used",
    "fully working",
    "working order",
    "tested",
    "good condition",
    "vgc",
    "excellent condition",
    "genuine samsung",
    "official samsung",
    "sm-r510",
    "sm-r530",
    "sm-r630",
  ]);
}

export function looksLikeLikelyCompleteSamsungListing(text = "", queryContext = {}, item = {}) {
  const t = normalizeAudioText(text);
  const family = String(queryContext?.family || "");
  const wantsCompleteSet = Boolean(queryContext?.wantsCompleteSet);

  if (!wantsCompleteSet) return false;
  if (!family.startsWith("galaxy_buds")) return false;

  if (
    !hasSamsungOfficialSignals(t) &&
    !hasAny(t, [
      "buds2 pro",
      "buds 2 pro",
      "buds3 pro",
      "buds 3 pro",
      "buds2",
      "buds 2",
      "buds3",
      "buds 3",
    ])
  ) {
    return false;
  }

  if (isAccessoryOnly(t)) return false;
  if (isPartialItem(t)) return false;
  if (looksLikeSingleSideEarbud(t)) return false;
  if (looksLikeCaseOnlyListing(t)) return false;
  if (isGenericSamsungCloneListing(t, queryContext)) return false;

  const inAudioCategory = isAudioCategory(item);
  const inAccessoryCategory = isAccessoryCategory(item);

  if (inAccessoryCategory && !inAudioCategory) return false;
  if (!inAudioCategory && !hasSamsungOfficialSignals(t)) return false;
  if (!hasSamsungStrongCompleteSignals(t) && !hasSamsungCompleteConfidenceSignals(t)) return false;

  return true;
}

export function looksLikeLikelyCompleteSonyListing(text = "", queryContext = {}, item = {}) {
  const t = normalizeAudioText(text);
  const family = String(queryContext?.family || "");
  const wantsCompleteSet = Boolean(queryContext?.wantsCompleteSet);

  if (!wantsCompleteSet) return false;
  if (family !== "sony_wf_1000xm4") return false;

  if (!hasAny(t, ["wf-1000xm4"])) return false;

  if (
    !hasAny(t, [
      "sony",
      "earbuds",
      "wireless",
      "bluetooth",
      "noise cancelling",
      "noise canceling",
    ])
  ) {
    return false;
  }

  if (isAccessoryOnly(t)) return false;
  if (isPartialItem(t)) return false;
  if (looksLikeSingleSideEarbud(t)) return false;
  if (looksLikeCaseOnlyListing(t)) return false;

  const inAudioCategory = isAudioCategory(item);
  const inAccessoryCategory = isAccessoryCategory(item);

  if (inAccessoryCategory && !inAudioCategory) return false;

  return true;
}

export function hasStrongCompleteSignals(text = "", queryContext = {}, item = {}) {
  const t = normalizeAudioText(text);
  const wantsCompleteSet = Boolean(queryContext?.wantsCompleteSet);

  if (!wantsCompleteSet) return true;
  if (hasFullSetSignals(t)) return true;

  if (
    hasAny(t, [
      "complete",
      "complete set",
      "full set",
      "boxed complete",
      "with case",
      "with charging case",
      "both buds",
      "both earbuds",
      "left and right",
      "left & right",
      "boxed",
      "box and case",
      "with box",
    ])
  ) {
    return true;
  }

  const family = String(queryContext?.family || "");
  const inAudioCategory = isAudioCategory(item);
  const inAccessoryCategory = isAccessoryCategory(item);

  if (inAccessoryCategory && !inAudioCategory) return false;

  if (
    family.startsWith("sony_wf_") &&
    hasAny(t, [
      "sony wf-1000xm4 earbuds and case",
      "wf-1000xm4 earbuds and case",
      "sony wf 1000xm4 earbuds and case",
      "wf 1000xm4 earbuds and case",
      "sony wf-1000xm4 box and case",
      "sony wf 1000xm4 box and case",
    ])
  ) {
    return true;
  }

  if (family.startsWith("airpods_")) {
    return looksLikeLikelyCompleteAirpodsListing(t, queryContext, item);
  }

  if (family.startsWith("galaxy_buds")) {
    return looksLikeLikelyCompleteSamsungListing(t, queryContext, item);
  }

  return false;
}
