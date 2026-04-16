import fetch from "node-fetch";

const EBAY_APP_ID = process.env.EBAY_APP_ID;

// -----------------------------
// CLEAN QUERY (SAFE VERSION)
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
// BUILD ITEM FILTERS (CORRECT FORMAT)
// -----------------------------
function buildItemFilters({ maxPrice, condition, freeShippingOnly }) {
  const filters = [];
  let i = 0;

  if (maxPrice) {
    filters.push(`itemFilter(${i}).name=MaxPrice`);
    filters.push(`itemFilter(${i}).value=${maxPrice}`);
    filters.push(`itemFilter(${i}).paramName=Currency`);
    filters.push(`itemFilter(${i}).paramValue=GBP`);
    i++;
  }

  if (condition) {
    const map = {
      new: "1000",
      used: "3000",
      refurbished: "2000",
    };

    if (map[condition]) {
      filters.push(`itemFilter(${i}).name=Condition`);
      filters.push(`itemFilter(${i}).value=${map[condition]}`);
      i++;
    }
  }

  if (freeShippingOnly) {
    filters.push(`itemFilter(${i}).name=FreeShippingOnly`);
    filters.push(`itemFilter(${i}).value=true`);
    i++;
  }

  return filters;
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
      throw new Error("Missing EBAY_APP_ID in environment variables");
    }

    const cleaned = cleanQuery(query);
    const finalQuery = cleaned.length ? cleaned : query;

    const url = new URL(
      "https://svcs.ebay.com/services/search/FindingService/v1"
    );

    // Required params
    url.searchParams.set("OPERATION-NAME", "findItemsByKeywords");
    url.searchParams.set("SERVICE-VERSION", "1.0.0");
    url.searchParams.set("SECURITY-APPNAME", EBAY_APP_ID);
    url.searchParams.set("RESPONSE-DATA-FORMAT", "JSON");
    url.searchParams.set("REST-PAYLOAD", "true");

    // UK marketplace
    url.searchParams.set("GLOBAL-ID", "EBAY-GB");

    // Search term
    url.searchParams.set("keywords", finalQuery);

    // Filters
    const filters = buildItemFilters({
      maxPrice,
      condition,
      freeShippingOnly,
    });

    filters.forEach((p) => {
      const [key, value] = p.split("=");
      url.searchParams.append(key, value);
    });

    // Pagination
    url.searchParams.set("paginationInput.entriesPerPage", "20");

    // -----------------------------
    // FETCH
    // -----------------------------
    const res = await fetch(url.toString());
    const data = await res.json();

    // DEBUG (keep this for now!)
    console.log("EBAY RESPONSE:");
    console.log(JSON.stringify(data, null, 2));

    // -----------------------------
    // SAFETY CHECKS
    // -----------------------------
    const response = data?.findItemsByKeywordsResponse?.[0];

    if (!response) return [];

    const items = response.searchResult?.[0]?.item || [];

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
