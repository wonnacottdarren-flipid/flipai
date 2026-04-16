import fetch from "node-fetch";

/**
 * FlipAI eBay module (FIXED + STABLE)
 * - Safe authentication
 * - Clean search queries
 * - Reliable fallback handling
 */

const EBAY_APP_ID = process.env.EBAY_APP_ID;

// -----------------------------
// 1. CLEAN SEARCH QUERY
// -----------------------------
function cleanQuery(query) {
  if (!query) return "";

  return query
    .toLowerCase()
    .replace(/iphone/g, "iphone")
    .replace(/gb|ram|unlocked|used|new|cracked|boxed/g, "")
    .replace(/[^a-z0-9\s]/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

// -----------------------------
// 2. MAIN SEARCH FUNCTION
// -----------------------------
export async function searchEbayListings({
  query,
  maxPrice,
  condition = "used",
  freeShippingOnly = false,
}) {
  try {
    if (!EBAY_APP_ID) {
      throw new Error("Missing EBAY_APP_ID in environment variables");
    }

    const cleanedQuery = cleanQuery(query);

    // Build eBay Finding API request
    const url = new URL("https://svcs.ebay.com/services/search/FindingService/v1");

    url.searchParams.append("OPERATION-NAME", "findItemsByKeywords");
    url.searchParams.append("SERVICE-VERSION", "1.0.0");
    url.searchParams.append("SECURITY-APPNAME", EBAY_APP_ID);
    url.searchParams.append("RESPONSE-DATA-FORMAT", "JSON");
    url.searchParams.append("REST-PAYLOAD", "true");

    url.searchParams.append("keywords", cleanedQuery || query);

    // Filters
    const itemFilter = [];

    if (maxPrice) {
      itemFilter.push({
        name: "MaxPrice",
        value: maxPrice.toString(),
        paramName: "Currency",
        paramValue: "GBP",
      });
    }

    if (condition) {
      const conditionMap = {
        new: "1000",
        used: "3000",
        refurbished: "2000",
      };

      if (conditionMap[condition]) {
        itemFilter.push({
          name: "Condition",
          value: conditionMap[condition],
        });
      }
    }

    if (freeShippingOnly) {
      itemFilter.push({
        name: "FreeShippingOnly",
        value: "true",
      });
    }

    if (itemFilter.length) {
      url.searchParams.append("itemFilter", JSON.stringify(itemFilter));
    }

    url.searchParams.append("paginationInput.entriesPerPage", "20");

    // -----------------------------
    // 3. FETCH DATA
    // -----------------------------
    const res = await fetch(url.toString());
    const data = await res.json();

    const items =
      data?.findItemsByKeywordsResponse?.[0]?.searchResult?.[0]?.item || [];

    if (!items.length) {
      return [];
    }

    // -----------------------------
    // 4. NORMALISE OUTPUT
    // -----------------------------
    return items.map((item) => ({
      title: item.title?.[0] || "Unknown",
      price: parseFloat(item.sellingStatus?.[0]?.currentPrice?.[0]?.__value__ || 0),
      currency: item.sellingStatus?.[0]?.currentPrice?.[0]?.["@currencyId"] || "GBP",
      url: item.viewItemURL?.[0] || "",
      condition: item.condition?.[0]?.conditionDisplayName?.[0] || "Unknown",
      shipping:
        item.shippingInfo?.[0]?.shippingServiceCost?.[0]?.__value__ || "0",
      location: item.location?.[0] || "UK",
      image: item.galleryURL?.[0] || "",
    }));
  } catch (error) {
    console.error("eBay API error:", error.message);
    return [];
  }
}
