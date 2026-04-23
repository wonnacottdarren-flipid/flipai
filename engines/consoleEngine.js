import { baseEngine } from "./baseEngine.js";
import {
  detectConsoleQuery,
  classifyConsoleQuery,
  buildConsoleSearchQuery,
  expandConsoleSearchVariants,
} from "./consoleFilters.js";
import {
  getMatchDebug,
  buildConsolePricingModel,
  classifyConsoleItem,
  applyBundleValueToListing,
} from "./consolePricing.js";

export const consoleEngine = {
  ...baseEngine,
  id: "console",

  detect(query = "") {
    return detectConsoleQuery(query);
  },

  classifyQuery(query = "") {
    return classifyConsoleQuery(query);
  },

  buildSearchQuery(query = "") {
    return buildConsoleSearchQuery(query);
  },

  expandSearchVariants(query = "") {
    return expandConsoleSearchVariants(query);
  },

  matchesItem(item, queryContext) {
    return getMatchDebug(item, queryContext).matched;
  },

  buildPricingModel({ queryContext, marketItems = [], listingItems = [] }) {
    return buildConsolePricingModel(queryContext, marketItems, listingItems);
  },

  classifyItem(item, queryContext) {
    return classifyConsoleItem(item, queryContext);
  },

  adjustListingPricing({ queryContext, item, pricingModel }) {
    const baseResale = Number(pricingModel?.estimatedResale || 0);
    return applyBundleValueToListing({ queryContext, item, baseResale });
  },
};
