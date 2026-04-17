import fetch from "node-fetch";

/**
 * FlipAI eBay module (DEBUG + FIXED)
 * - Uses COMPLETED listings (correct for comps)
 * - Logs raw response so we can debug
 * - Safe + stable
 */

const EBAY_APP_ID = process.env.EBAY_APP_ID;

// -----------------------------
// CLEAN QUERY
// -----------------------------
function cleanQuery(query) {
  if (!query) return "";

  return query
    .toLowerCase()
    .replace(/(ram|boxed)/g, "")
    .replace(/[^a-z0-9\s]/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

// -----------------------------
// MAIN FUNCTION
// -----------------------------
export async function searchEbayListings({
  query,
  maxPrice,
  condition = "",
  freeShippingOnly = false,
  limit = 20,
}) {
  try {
    if (!EBAY_APP_ID) {
      throw new Error("Missing EBAY_APP_ID in environment variables");
    }

    const cleanedQuery = cleanQuery(query);

    const url = new URL(
      "https://svcs.ebay.com/services/search/FindingService/v1"
    );

    // ✅ IMPORTANT: use COMPLETED items
    url.searchParams.append("OPERATION-NAME", "findCompletedItems");
    url.searchParams.append("SERVICE-VERSION", "1.0.0");
    url.searchParams.append("SECURITY-APPNAME", EBAY_APP_ID);
    url.searchParams.append("RESPONSE-DATA-FORMAT", "JSON");
    url.searchParams.append("REST-PAYLOAD", "true");

    url.searchParams.append("keywords", cleanedQuery || query);

    // -----------------------------
    // FILTERS (TEMP LIGHT)
    // -----------------------------
    let filterIndex = 0;

    if (maxPrice) {
      url.searchParams.append(`itemFilter(${filterIndex}).name`, "MaxPrice");
      url.searchParams.append(
        `itemFilter(${filterIndex}).value`,
        maxPrice.toString()
      );
      url.searchParams.append(
        `itemFilter(${filterIndex}).paramName`,
        "Currency"
      );
      url.searchParams.append(
        `itemFilter(${filterIndex}).paramValue`,
        "GBP"
      );
      filterIndex++;
    }

    // ⚠️ TEMP: DO NOT FILTER CONDITION YET (for debugging)

    // Pagination
    url.searchParams.append(
      "paginationInput.entriesPerPage",
      String(limit || 20)
    );

    // -----------------------------
    // FETCH
    // -----------------------------
    console.log("🔍 EBAY REQUEST URL:");
    console.log(url.toString());

    const res = await fetch(url.toString());
    const data = await res.json();

    // ✅ DEBUG OUTPUT
    console.log("📦 EBAY RAW RESPONSE:");
    console.log(JSON.stringify(data, null, 2));

    const items =
      data?.findCompletedItemsResponse?.[0]?.searchResult?.[0]?.item || [];

    console.log("✅ ITEMS FOUND:", items.length);

    if (!items.length) {
      return [];
    }

    // -----------------------------
    // NORMALISE
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
      shipping: parseFloat(
        item.shippingInfo?.[0]?.shippingServiceCost?.[0]?.__value__ || 0
      ),
      location: item.location?.[0] || "UK",
      image: item.galleryURL?.[0] || "",
    }));
  } catch (error) {
    console.error("❌ eBay API error:", error.message);
    return [];
  }
}
