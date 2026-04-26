import { buildConsoleV2PricingModel } from "./consoleV2Pricing.js";
import {
  buildConsoleV2SearchQuery,
  classifyConsoleV2Query,
  expandConsoleV2SearchVariants,
} from "./consoleV2Query.js";
import { scoreConsoleV2Items } from "./consoleV2Scoring.js";

export function runConsoleV2Engine({
  query = "",
  marketItems = [],
  listingItems = [],
} = {}) {
  const queryContext = classifyConsoleV2Query(query);

  const searchQuery = buildConsoleV2SearchQuery(query);
  const searchVariants = expandConsoleV2SearchVariants(query);

  const scoredMarket = scoreConsoleV2Items(marketItems, queryContext);
  const scoredListings = scoreConsoleV2Items(listingItems, queryContext);

  const pricing = buildConsoleV2PricingModel(
    queryContext,
    marketItems,
    listingItems
  );

  return {
    query,
    queryContext,
    searchQuery,
    searchVariants,
    market: {
      totalAnalyzed: Array.isArray(marketItems) ? marketItems.length : 0,
      matchedCount: scoredMarket.length,
      items: scoredMarket,
    },
    listings: {
      totalAnalyzed: Array.isArray(listingItems) ? listingItems.length : 0,
      matchedCount: scoredListings.length,
      items: scoredListings,
    },
    pricing,
  };
}
