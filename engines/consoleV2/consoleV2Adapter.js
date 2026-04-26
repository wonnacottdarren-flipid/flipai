import { baseEngine, roundMoney } from "../baseEngine.js";
import {
  buildConsoleV2SearchQuery,
  classifyConsoleV2Query,
  expandConsoleV2SearchVariants,
} from "./consoleV2Query.js";
import { buildConsoleV2PricingModel } from "./consoleV2Pricing.js";
import { scoreConsoleV2Items } from "./consoleV2Scoring.js";

function normalize(text = "") {
  return String(text || "").toLowerCase().trim();
}

function isConsoleQuery(query = "") {
  const text = normalize(query);

  return (
    text.includes("ps5") ||
    text.includes("playstation 5") ||
    text.includes("playstation5") ||
    text.includes("xbox series x") ||
    text.includes("xbox series s") ||
    text.includes("series x") ||
    text.includes("series s") ||
    text.includes("nintendo switch") ||
    text.includes("switch oled") ||
    text.includes("switch lite")
  );
}

function getItemTitle(item = {}) {
  return String(item?.title || item?.name || item?.product || "").trim();
}

function getScoredEntry(item = {}, queryContext = {}) {
  const scored = scoreConsoleV2Items([item], queryContext);
  return scored[0] || null;
}

function getWarningPenalty(warningFlags = []) {
  if (!Array.isArray(warningFlags)) return 0;
  return warningFlags.length * 4;
}

export const consoleV2Adapter = {
  ...baseEngine,
  id: "console_v2",

  detect(query = "") {
    return isConsoleQuery(query);
  },

  classifyQuery(query = "") {
    return classifyConsoleV2Query(query);
  },

  buildSearchQuery(query = "") {
    return buildConsoleV2SearchQuery(query);
  },

  expandSearchVariants(query = "") {
    return expandConsoleV2SearchVariants(query);
  },

  matchesItem(item = {}, queryContext = {}) {
    const entry = getScoredEntry(item, queryContext);
    return Boolean(entry && entry.matched && entry.score > 0);
  },

  buildPricingModel({ queryContext = {}, marketItems = [], listingItems = [] } = {}) {
    return buildConsoleV2PricingModel(queryContext, marketItems, listingItems);
  },

  classifyItem(item = {}, queryContext = {}) {
    const entry = getScoredEntry(item, queryContext);
    const warningFlags = Array.isArray(entry?.warningFlags) ? entry.warningFlags : [];

    return {
      conditionState: entry?.conditionState || "unknown",
      repairCost: 0,
      bundleType: entry?.bundleType || "standard",
      bundleSignals: entry?.bundleSignals || {},
      bundleValueBonus: entry?.bundleType === "bundle" ? 12 : 0,
      warningFlags,
      warningScorePenalty: getWarningPenalty(warningFlags),
      debug: {
        matched: Boolean(entry && entry.matched),
        reason: entry ? "matched_v2_adapter" : "not_matched_v2_adapter",
        score: entry?.score || 0,
        title: getItemTitle(item),
        family: queryContext?.family || "",
      },
    };
  },

  adjustListingPricing({ queryContext = {}, item = {}, pricingModel = {} } = {}) {
    const entry = getScoredEntry(item, queryContext);
    const warningFlags = Array.isArray(entry?.warningFlags) ? entry.warningFlags : [];
    const warningScorePenalty = getWarningPenalty(warningFlags);

    const baseResale = Number(pricingModel?.estimatedResale || 0);
    const bundleType = entry?.bundleType || "standard";

    let bundleValueBonus = 0;
    if (bundleType === "bundle") bundleValueBonus = 12;
    if (bundleType === "boxed") bundleValueBonus = 5;
    if (bundleType === "console_only") bundleValueBonus = -20;

    const estimatedResale = roundMoney(
      Math.max(0, baseResale + bundleValueBonus - warningScorePenalty)
    );

    return {
      estimatedResale,
      bundleValueBonus: roundMoney(bundleValueBonus),
      warningFlags,
      warningScorePenalty,
      bundleSignals: entry?.bundleSignals || {},
      bundleType,
      debug: {
        adapter: "consoleV2Adapter",
        score: entry?.score || 0,
        title: getItemTitle(item),
        family: queryContext?.family || "",
      },
    };
  },
};

export default consoleV2Adapter;
