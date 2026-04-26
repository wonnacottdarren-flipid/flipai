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

function detectDamagedPhoneIntent(rawQuery = "") {
  const q = normalizePhoneText(rawQuery);

  if (
    q.includes("screen lines") ||
    q.includes("screen line") ||
    q.includes("line on screen") ||
    q.includes("lines on screen") ||
    q.includes("green line") ||
    q.includes("green lines") ||
    q.includes("pink line") ||
    q.includes("pink lines") ||
    q.includes("display line") ||
    q.includes("display lines") ||
    q.includes("lcd line") ||
    q.includes("lcd lines") ||
    q.includes("vertical line") ||
    q.includes("vertical lines")
  ) {
    return "screen_lines";
  }

  if (
    q.includes("battery health") ||
    q.includes("battery service") ||
    q.includes("needs battery") ||
    q.includes("battery replacement") ||
    q.includes("poor battery") ||
    q.includes("battery fault") ||
    q.includes("battery issue")
  ) {
    return "battery";
  }

  if (
    q.includes("charging port") ||
    q.includes("charge port") ||
    q.includes("not charging") ||
    q.includes("charging issue") ||
    q.includes("charging fault")
  ) {
    return "charging";
  }

  if (q.includes("face id") || q.includes("faceid")) {
    return "face_id";
  }

  return "";
}

function buildDamagedPhoneVariants(niceFamily = "", ctx = {}, rawQuery = "") {
  const base = String(niceFamily || "").trim();
  const raw = String(rawQuery || "").trim();
  const intent = detectDamagedPhoneIntent(raw);

  const variants = [raw];

  if (!base) {
    return variants;
  }

  if (intent === "screen_lines") {
    variants.push(`${base} screen lines`);
    variants.push(`${base} screen line`);
    variants.push(`${base} green line`);
    variants.push(`${base} green lines`);
    variants.push(`${base} pink line`);
    variants.push(`${base} display line`);
    variants.push(`${base} display lines`);
    variants.push(`${base} line on screen`);
    variants.push(`${base} lines on screen`);
    variants.push(`${base} lcd line`);
    variants.push(`${base} faulty screen`);
    variants.push(`${base} screen fault`);

    if (ctx.storageGb > 0) {
      variants.push(`${base} ${ctx.storageGb}gb screen lines`);
      variants.push(`${base} ${ctx.storageGb}gb green line`);
      variants.push(`${base} ${ctx.storageGb}gb display line`);
    }

    variants.push(`${base} faulty`);
    variants.push(`${base} spares repair`);
    variants.push(`${base} spares or repair`);

    return variants;
  }

  if (intent === "battery") {
    variants.push(`${base} battery health`);
    variants.push(`${base} battery service`);
    variants.push(`${base} needs battery`);
    variants.push(`${base} battery replacement`);
    variants.push(`${base} poor battery`);
    variants.push(`${base} battery fault`);
    variants.push(`${base} faulty`);

    if (ctx.storageGb > 0) {
      variants.push(`${base} ${ctx.storageGb}gb battery health`);
      variants.push(`${base} ${ctx.storageGb}gb battery service`);
      variants.push(`${base} ${ctx.storageGb}gb needs battery`);
    }

    variants.push(`${base} spares repair`);
    variants.push(`${base} spares or repair`);

    return variants;
  }

  if (intent === "charging") {
    variants.push(`${base} charging port`);
    variants.push(`${base} charge port`);
    variants.push(`${base} not charging`);
    variants.push(`${base} charging issue`);
    variants.push(`${base} charging fault`);
    variants.push(`${base} faulty`);

    if (ctx.storageGb > 0) {
      variants.push(`${base} ${ctx.storageGb}gb charging port`);
      variants.push(`${base} ${ctx.storageGb}gb not charging`);
    }

    variants.push(`${base} spares repair`);
    variants.push(`${base} spares or repair`);

    return variants;
  }

  if (intent === "face_id") {
    variants.push(`${base} face id`);
    variants.push(`${base} faceid`);
    variants.push(`${base} face id fault`);
    variants.push(`${base} faulty face id`);
    variants.push(`${base} faulty`);

    if (ctx.storageGb > 0) {
      variants.push(`${base} ${ctx.storageGb}gb face id`);
      variants.push(`${base} ${ctx.storageGb}gb face id fault`);
    }

    variants.push(`${base} spares repair`);
    variants.push(`${base} spares or repair`);

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
      normalizedQuery.includes("screen line") ||
      normalizedQuery.includes("line on screen") ||
      normalizedQuery.includes("lines on screen") ||
      normalizedQuery.includes("display line") ||
      normalizedQuery.includes("display lines") ||
      normalizedQuery.includes("green line") ||
      normalizedQuery.includes("green lines") ||
      normalizedQuery.includes("pink line") ||
      normalizedQuery.includes("pink lines") ||
      normalizedQuery.includes("lcd") ||
      normalizedQuery.includes("oled fault") ||
      normalizedQuery.includes("battery service") ||
      normalizedQuery.includes("needs battery") ||
      normalizedQuery.includes("battery fault") ||
      normalizedQuery.includes("charging port") ||
      normalizedQuery.includes("charge port") ||
      normalizedQuery.includes("not charging") ||
      normalizedQuery.includes("face id") ||
      normalizedQuery.includes("faceid");

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
