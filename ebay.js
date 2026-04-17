import fetch from "node-fetch";

const EBAY_APP_ID = process.env.EBAY_APP_ID;

// -----------------------------
// CLEAN QUERY (SMART VERSION)
// -----------------------------
function cleanQuery(query) {
  if (!query) return "";

  return query
    .toLowerCase()
    .replace(/[^a-z0-9\s]/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

// -----------------------------
// MAIN SEARCH FUNCTION
// -----------------------------
export async function searchEbayListings({
  query,
  maxPrice,
  condition = "used",
  freeShippingOnly = false,
}) {
  try {
    if (!EBAY_APP_ID) {
      throw new Error("Missing EBAY_APP_ID in .env");
    }

    const cleanedQuery = cleanQuery(query);

    const url = new URL("https://svcs.ebay.com/services/search/FindingService/v1");

    url.searchParams.append("OPERATION-NAME", "findItemsByKeywords");
    url.searchParams.append("SERVICE-VERSION", "1.0.0");
    url.searchParams.append("SECURITY-APPNAME", EBAY_APP_ID);
    url.searchParams.append("RESPONSE-DATA-FORMAT", "JSON");
    url.searchParams.append("REST-PAYLOAD", "true");

    // Use cleaned query but fallback if needed
    url.searchParams.append("keywords", cleanedQuery || query);

    // -----------------------------
    // CORRECT FILTER FORMAT
    // -----------------------------
    let i = 0;

    if (maxPrice) {
      url.searchParams.append(`itemFilter(${i}).name`, "MaxPrice");
      url.searchParams.append(`itemFilter(${i}).value`, maxPrice.toString());
      url.searchParams.append(`itemFilter(${i}).paramName`, "Currency");
      url.searchParams.append(`itemFilter(${i}).paramValue`, "GBP");
      i++;
    }

    const conditionMap = {
      new: "1000",
      used: "3000",
      refurbished: "2000",
    };

    if (conditionMap[condition]) {
      url.searchParams.append(`itemFilter(${i}).name`, "Condition");
      url.searchParams.append(`itemFilter(${i}).value`, conditionMap[condition]);
      i++;
    }

    if (freeShippingOnly) {
      url.searchParams.append(`itemFilter(${i}).name`, "FreeShippingOnly");
      url.searchParams.append(`itemFilter(${i}).value`, "true");
      i++;
    }

    url.searchParams.append("paginationInput.entriesPerPage", "20");

    console.log("🔍 eBay search:", cleanedQuery || query);

    // -----------------------------
    // FETCH
    // -----------------------------
    const res = await fetch(url.toString());
    const data = await res.json();

    let items =
      data?.findItemsByKeywordsResponse?.[0]?.searchResult?.[0]?.item || [];

    // -----------------------------
    // FALLBACK IF NO RESULTS
    // -----------------------------
    if (!items.length && cleanedQuery !== query) {
      console.log("⚠️ No results, retrying with original query...");

      url.searchParams.set("keywords", query);

      const retryRes = await fetch(url.toString());
      const retryData = await retryRes.json();

      items =
        retryData?.findItemsByKeywordsResponse?.[0]?.searchResult?.[0]?.item || [];
    }

    if (!items.length) {
      console.log("❌ No eBay results found");
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
