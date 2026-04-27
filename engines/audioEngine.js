import {
  baseEngine,
  normalizeText,
  roundMoney,
  median,
  percentile,
  removePriceOutliers,
  extractTotalPrice,
} from "./baseEngine.js";

import {
  detectAudioBrand,
  parseAudioFamily,
} from "./audioV2Families.js";

/* -------------------------
   SMALL HELPERS (KEPT)
------------------------- */

function squashSpaces(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function hasAny(text, phrases = []) {
  const rawHaystack = String(text || "");
  const haystack = squashSpaces(rawHaystack);

  return phrases.some((phrase) => {
    const rawNeedle = String(phrase || "");
    const needle = squashSpaces(rawNeedle);
    return rawHaystack.includes(rawNeedle) || haystack.includes(needle);
  });
}

/* -------------------------
   QUERY CONTEXT
------------------------- */

function wantsCompleteSetFromQuery(queryContext = {}) {
  const q = normalizeText(queryContext?.normalizedQuery || queryContext?.rawQuery || "");

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

function shouldAllowDamagedListings(queryContext) {
  const q = normalizeText(queryContext?.normalizedQuery || "");

  return hasAny(q, [
    "faulty",
    "broken",
    "damaged",
    "for parts",
    "for spares",
    "spares",
    "repairs",
    "not working",
  ]);
}

/* -------------------------
   ENGINE
------------------------- */

export const audioEngine = {
  ...baseEngine,
  id: "audio",

  detect(query = "") {
    const text = normalizeText(query);

    return (
      text.includes("airpods") ||
      text.includes("headphones") ||
      text.includes("earbuds") ||
      text.includes("earphones") ||
      text.includes("galaxy buds") ||
      text.includes("sony") ||
      text.includes("xm3") ||
      text.includes("xm4") ||
      text.includes("xm5") ||
      text.includes("bose") ||
      text.includes("qc")
    );
  },

  classifyQuery(query = "") {
    const rawQuery = String(query || "").trim();
    const normalizedQuery = normalizeText(rawQuery);

    const brand = detectAudioBrand(normalizedQuery);
    const family = parseAudioFamily(normalizedQuery, brand);

    const allowDamaged = shouldAllowDamagedListings({ normalizedQuery });
    const wantsCompleteSet = wantsCompleteSetFromQuery({ normalizedQuery, rawQuery });

    return {
      rawQuery,
      normalizedQuery,
      brand,
      family,
      allowDamaged,
      wantsCompleteSet,
    };
  },

  expandSearchVariants(query = "") {
    const rawQuery = String(query || "").trim();
    const ctx = this.classifyQuery(rawQuery);

    const variants = [rawQuery];

    if (ctx.family) {
      const niceFamily = ctx.family.replaceAll("_", " ");
      variants.push(niceFamily);

      if (ctx.brand === "apple") variants.push(`airpods ${niceFamily}`);
      if (ctx.brand === "sony") variants.push(`sony ${niceFamily}`);
      if (ctx.brand === "bose") variants.push(`bose ${niceFamily}`);
      if (ctx.brand === "samsung") variants.push(`galaxy ${niceFamily}`);
    }

    return [...new Set(variants.map((v) => String(v || "").trim()).filter(Boolean))];
  },

  matchesItem(item, queryContext) {
    const text = normalizeText(
      [
        item?.title,
        item?.condition,
        item?.conditionDisplayName,
        item?.subtitle,
      ]
        .filter(Boolean)
        .join(" ")
    );

    if (!text) return false;

    const itemBrand = detectAudioBrand(text);
    if (queryContext.brand && itemBrand !== queryContext.brand) return false;

    const itemFamily = parseAudioFamily(text, queryContext.brand);
    if (queryContext.family && itemFamily && itemFamily !== queryContext.family) {
      return false;
    }

    return true;
  },

  buildPricingModel() {
    return {
      estimatedResale: 0,
      compCount: 0,
      confidence: 0,
      confidenceLabel: "Low",
      pricingMode: "Not built yet",
    };
  },

  classifyItem() {
    return {
      conditionState: "unknown",
      repairCost: 0,
    };
  },
};
