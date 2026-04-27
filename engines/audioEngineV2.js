import { baseEngine, normalizeText } from "./baseEngine.js";

import { detectAudioBrand, parseAudioFamily } from "./audioV2Families.js";

import {
  failsAudioBaseFilters,
} from "./audioV2Filters.js";

/* -------------------- ENGINE -------------------- */

export const audioEngine = {
  ...baseEngine,
  id: "audio_v2",

  /* ---------- DETECT ---------- */

  detect(query = "") {
    const text = normalizeText(query);

    return (
      text.includes("airpods") ||
      text.includes("earbuds") ||
      text.includes("earphones") ||
      text.includes("headphones") ||
      text.includes("galaxy buds") ||
      text.includes("sony") ||
      text.includes("bose")
    );
  },

  /* ---------- QUERY ---------- */

  classifyQuery(query = "") {
    const rawQuery = String(query || "").trim();
    const normalizedQuery = normalizeText(rawQuery);

    const brand = detectAudioBrand(normalizedQuery);
    const family = parseAudioFamily(normalizedQuery, brand);

    return {
      rawQuery,
      normalizedQuery,
      brand,
      family,
    };
  },

  /* ---------- SEARCH VARIANTS ---------- */

  expandSearchVariants(query = "") {
    const raw = String(query || "").trim();
    const ctx = this.classifyQuery(raw);

    const variants = [raw];

    if (ctx.family) {
      const cleanFamily = ctx.family.replaceAll("_", " ");

      // Prevent duplication like "sony sony ..."
      if (!raw.toLowerCase().includes(cleanFamily)) {
        variants.push(cleanFamily);
      }

      if (ctx.brand && !raw.toLowerCase().includes(ctx.brand)) {
        variants.push(`${ctx.brand} ${cleanFamily}`);
      }
    }

    return [...new Set(variants)];
  },

  /* ---------- MATCH ---------- */

  matchesItem(item, queryContext) {
    const text = normalizeText(
      [
        item?.title,
        item?.condition,
        item?.conditionDisplayName,
      ]
        .filter(Boolean)
        .join(" ")
    );

    if (!text) return false;

    // 🔴 CORE FILTERS (THIS IS THE BIG STEP)
    if (failsAudioBaseFilters(text, item, queryContext)) {
      return false;
    }

    // Brand check
    const itemBrand = detectAudioBrand(text);
    if (queryContext.brand && itemBrand !== queryContext.brand) {
      return false;
    }

    // Family check
    const itemFamily = parseAudioFamily(text, queryContext.brand);
    if (queryContext.family && itemFamily && itemFamily !== queryContext.family) {
      return false;
    }

    return true;
  },

  /* ---------- PRICING (TEMP PLACEHOLDER) ---------- */

  buildPricingModel() {
    return {
      estimatedResale: 0,
      confidence: 0,
      confidenceLabel: "Low",
      compCount: 0,
    };
  },

  /* ---------- ITEM CLASSIFY ---------- */

  classifyItem() {
    return {
      conditionState: "unknown",
      repairCost: 0,
    };
  },
};
