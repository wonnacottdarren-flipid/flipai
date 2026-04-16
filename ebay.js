import fetch from "node-fetch";

/**
 * FlipAI eBay module (FIXED + STABLE)
 * - Correct eBay Finding API format
 * - Proper itemFilter structure
 * - UK (GBP) support
 * - Better error handling
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
// 2. BUILD ITEM FILTERS (FIXED FORMAT)
// -----------------------------
function buildItemFilters({ maxPrice, condition, freeShippingOnly }) {
  const filters = [];
  let index = 0;

  if (maxPrice) {
    filters.push(`itemFilter(${index}).name=MaxPrice`);
    filters.push(`itemFilter(${index}).value=${maxPrice}`);
    filters.push(`itemFilter(${index}).paramName=Currency`);
    filters.push(`itemFilter(${index}).paramValue=GBP`);
    index++;
  }

  if (condition) {
    const conditionMap = {
      new: "1000",
      used: "3000",
      refurbished: "2000",
    };

    if (conditionMap[condition]) {
      filters.push(`itemFilter(${index}).name=Condition`);
      filters.push(`itemFilter(${index}).value=${conditionMap[condition]}`);
      index++;
    }
  }

  if (freeShippingOnly) {
    filters.push(`itemFilter(${index}).name=FreeShippingOnly`);
    filters.push(`itemFilter(${index}).value=true`);
    index++;
  }

  return filters;
}

// -----------------------------
// 3. MAIN SEARCH FUNCTION
// -----------------------------
export async function searchEbayListings({
  query,
  maxPrice,
  condition = "used",
  freeShippingOnly = false,
}) {
  try {
    if (!EBAY_APP_ID || EBAY_APP_ID === "YOUR_KEY") {
      throw new Error("Missing or invalid EBAY_APP_ID");
    }

    const cleanedQuery = cleanQuery(query);

    const url = new URL(
      "https://svcs.ebay.com/services/search/FindingService/v1"
    );

    // Required API params
    url.searchParams.set("OPERATION-NAME", "findItemsByKeywords");
    url.searchParams.set("SERVICE-VERSION", "1.0.0");
    url.searchParams.set("SECURITY-APPNAME", EBAY_APP_ID);
    url.searchParams.set("RESPONSE-DATA-FORMAT", "JSON");
    url.searchParams.set("REST-PAYLOAD", "true");

    // UK marketplace (important)
    url.searchParams.set("GLOBAL-ID", "EBAY-GB");

    // Search term
    url.searchParams.set("keywords", cleanedQuery || query);

    // Filters (FIXED)
    const filters = buildItemFilters({
      maxPrice,
      condition,
      freeShippingOnly,
    });

    filters.forEach((f) => {
      const [key, value] = f.split("=");
      url.searchParams.append(key, value);
    });

    // Pagination
    url.searchParams.set("paginationInput.entriesPerPage", "20");

    // -----------------------------
    // FETCH
    // -----------------------------
    const res = await fetch(url.toString());

    if (!res.ok) {
      throw new Error(`eBay API HTTP error: ${res.status}`);
    }

    const data = await res.json();

    const items =
      data?.findItemsByKeywordsResponse?.[0]?.searchResult?.[0]?.item || [];

    if (!items.length) return [];

    // -----------------------------
    // NORMALISE OUTPUT
    // -----------------------------
    return items.map((item) => ({
      title: item.title?.[0] || "Unknown",
      price: parseFloat(
        item.sellingStatus?.[0]?.currentPrice?.[0]?.__value__ || 0
      ),
      currency:
        item.sellingStatus?.[0]?.currentPrice?.[0]?.["@currencyId"] || "GBP",
      url: item.viewItemURL?.[0] || "",
      condition:
        item.condition?.[0]?.conditionDisplayName?.[0] || "Unknown",
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
