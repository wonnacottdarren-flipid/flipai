import { baseEngine } from "./baseEngine.js";

import {
  normalizePhoneText,
  getPhoneCombinedItemText,
} from "./phoneV2Text.js";

import {
  classifyPhoneConditionState,
} from "./phoneV2Condition.js";

import {
  detectPhoneBrand,
  parsePhoneFamily,
  extractStorageGb,
} from "./phoneV2Families.js";

import {
  failsPhoneBaseGate,
  isExplicitlyUnlockedPhone,
  isNetworkLockedPhone,
  getPhoneFilterDebug,
} from "./phoneV2Filters.js";

import {
  buildPhoneV2PricingModel,
  estimatePhoneRepairCost,
} from "./phoneV2Pricing.js";

function shouldAllowDamagedListings(queryContext = {}) {
  return Boolean(queryContext?.allowDamaged);
}

function buildDamagedPhoneVariants(niceFamily = "", ctx = {}, rawQuery = "") {
  const base = String(niceFamily || "").trim();
  const raw = String(rawQuery || "").trim();

  const variants = [raw];

  if (!base) {
    return variants;
  }

  variants.push(`${base} faulty`);
  variants.push(`${base} spares repair`);
  variants.push(`${base} spares or repair`);
  variants.push(`${base} for parts`);
  variants.push(`${base} broken`);
  variants.push(`${base} damaged`);

  if (ctx.storageGb > 0) {
    variants.push(`${base} ${ctx.storageGb}gb faulty`);
    variants.push(`${base} ${ctx.storageGb}gb spares repair`);
    variants.push(`${base} ${ctx.storageGb}gb broken`);
  }

  if (ctx.wantsUnlocked) {
    variants.push(`${base} unlocked faulty`);
    variants.push(`${base} unlocked spares repair`);
  }

  return variants;
}

export const phoneV2Engine = {
  ...baseEngine,
  id: "phone_v2",

  detect(query = "") {
    const text = normalizePhoneText(query);

    return (
      text.includes("iphone") ||
      text.includes("samsung") ||
      text.includes("galaxy")
    );
  },

  classifyQuery(query = "") {
    const rawQuery = String(query || "").trim();
    const normalizedQuery = normalizePhoneText(rawQuery);
    const brand = detectPhoneBrand(normalizedQuery);
    const family = parsePhoneFamily(normalizedQuery, brand);
    const storageGb = extractStorageGb(normalizedQuery);
    const wantsUnlocked = isExplicitlyUnlockedPhone(normalizedQuery);
    const wantsLocked = isNetworkLockedPhone(normalizedQuery);

    const allowDamaged =
      normalizedQuery.includes("cracked") ||
      normalizedQuery.includes("faulty") ||
      normalizedQuery.includes("broken") ||
      normalizedQuery.includes("damaged") ||
      normalizedQuery.includes("for parts") ||
      normalizedQuery.includes("for spares") ||
      normalizedQuery.includes("spares") ||
      normalizedQuery.includes("repairs") ||
      normalizedQuery.includes("repair") ||
      normalizedQuery.includes("needs screen") ||
      normalizedQuery.includes("poor condition") ||
      normalizedQuery.includes("screen lines") ||
      normalizedQuery.includes("display lines") ||
      normalizedQuery.includes("green line") ||
      normalizedQuery.includes("pink line") ||
      normalizedQuery.includes("lcd") ||
      normalizedQuery.includes("oled fault");

    return {
      rawQuery,
      normalizedQuery,
      brand,
      family,
      storageGb,
      wantsUnlocked,
      wantsLocked,
      allowDamaged,
    };
  },

  expandSearchVariants(query = "") {
    const rawQuery = String(query || "").trim();
    const ctx = this.classifyQuery(rawQuery);
    const variants = [rawQuery];

    if (ctx.brand === "iphone" && ctx.family) {
      const niceFamily = ctx.family.replaceAll("_", " ");

      if (ctx.allowDamaged) {
        return [
          ...new Set(
            buildDamagedPhoneVariants(niceFamily, ctx, rawQuery).filter(Boolean)
          ),
        ];
      }

      variants.push(niceFamily);

      if (ctx.storageGb > 0) {
        variants.push(`${niceFamily} ${ctx.storageGb}gb`);
      }

      if (ctx.wantsUnlocked) {
        variants.push(`${niceFamily} unlocked`);
      }
    }

    if (ctx.brand === "samsung" && ctx.family) {
      const niceFamily = ctx.family
        .replace("galaxy_", "galaxy ")
        .replaceAll("_", " ");

      if (ctx.allowDamaged) {
        return [
          ...new Set(
            buildDamagedPhoneVariants(niceFamily, ctx, rawQuery).filter(Boolean)
          ),
        ];
      }

      variants.push(niceFamily);

      if (ctx.storageGb > 0) {
        variants.push(`${niceFamily} ${ctx.storageGb}gb`);
      }

      if (ctx.wantsUnlocked) {
        variants.push(`${niceFamily} unlocked`);
      }
    }

    return [...new Set(variants.filter(Boolean))];
  },

  matchesItem(item, queryContext) {
    return !failsPhoneBaseGate(item, queryContext);
  },

  buildPricingModel({ queryContext, marketItems = [], listingItems = [] }) {
    return buildPhoneV2PricingModel(queryContext, marketItems, listingItems);
  },

  classifyItem(item, queryContext) {
    const text = getPhoneCombinedItemText(item);
    const conditionState = classifyPhoneConditionState(text);
    const repairCost = estimatePhoneRepairCost(queryContext, conditionState, text);
    const debug = getPhoneFilterDebug(item, queryContext);

    return {
      conditionState,
      repairCost,
      debug,
      allowDamaged: shouldAllowDamagedListings(queryContext),
    };
  },
};
