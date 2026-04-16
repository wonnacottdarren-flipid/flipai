import fetch from "node-fetch";

const EBAY_APP_ID = process.env.EBAY_APP_ID;

// Main function used by server.js
export async function searchEbayListings(query) {
  try {
    if (!EBAY_APP_ID) {
      console.error("Missing EBAY_APP_ID");
      return [];
    }

    const url =
      "https://svcs.ebay.com/services/search/FindingService/v1" +
      "?OPERATION-NAME=findCompletedItems" +
      "&SERVICE-VERSION=1.13.0" +
      `&SECURITY-APPNAME=${EBAY_APP_ID}` +
      "&RESPONSE-DATA-FORMAT=JSON" +
      "&REST-PAYLOAD" +
      `&keywords=${encodeURIComponent(query)}` +
      "&itemFilter(0).name=SoldItemsOnly" +
      "&itemFilter(0).value=true" +
      "&paginationInput.entriesPerPage=25";

    const res = await fetch(url);
    const data = await res.json();

    const items =
      data?.findCompletedItemsResponse?.[0]?.searchResult?.[0]?.item || [];

    if (!items.length) return [];

    const prices = items
      .map((item) => {
        const price =
          item?.sellingStatus?.[0]?.currentPrice?.[0]?.__value__;
        return price ? parseFloat(price) : null;
      })
      .filter((p) => p !== null);

    return prices;
  } catch (err) {
    console.error("eBay API error:", err);
    return [];
  }
}
