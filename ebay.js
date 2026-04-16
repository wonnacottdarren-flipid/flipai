import fetch from "node-fetch";

const EBAY_APP_ID = process.env.EBAY_APP_ID;

// 🔥 MAIN FUNCTION
export async function searchEbayListings(query) {
  try {
    if (!EBAY_APP_ID) {
      console.error("Missing EBAY_APP_ID");
      return [];
    }

    // ✅ CLEAN THE USER INPUT
    const cleanedQuery = cleanSearchQuery(query);
    console.log("Original:", query);
    console.log("Cleaned:", cleanedQuery);

    // 🔥 First attempt
    let prices = await fetchEbay(cleanedQuery);

    // 🔥 Fallback (even simpler)
    if (!prices.length) {
      const fallback = cleanedQuery.split(" ").slice(0, 2).join(" ");
      console.log("Fallback search:", fallback);
      prices = await fetchEbay(fallback);
    }

    return prices;
  } catch (err) {
    console.error("eBay API error:", err);
    return [];
  }
}

// 🔥 QUERY CLEANER (THIS IS THE MAGIC)
function cleanSearchQuery(query) {
  let q = query.toLowerCase();

  // Remove useless words
  const removeWords = [
    "navy", "blue", "black", "white", "red", "green",
    "good", "excellent", "poor", "condition",
    "used", "new", "unlocked", "locked",
    "battery", "health", "%", "percent",
    "fully", "working", "grade", "refurbished",
    "with", "box", "charger", "cable"
  ];

  removeWords.forEach(word => {
    q = q.replace(new RegExp(`\\b${word}\\b`, "g"), "");
  });

  // Extract important parts
  const brandMatch = q.match(/iphone|samsung|ipad|macbook/);
  const modelMatch = q.match(/\b\d{1,2}\b/); // 12, 13, etc
  const storageMatch = q.match(/\b(64gb|128gb|256gb|512gb)\b/);
  const extraMatch = q.match(/mini|pro|max|plus/);

  let finalQuery = [];

  if (brandMatch) finalQuery.push(brandMatch[0]);
  if (modelMatch) finalQuery.push(modelMatch[0]);
  if (extraMatch) finalQuery.push(extraMatch[0]);
  if (storageMatch) finalQuery.push(storageMatch[0]);

  // fallback if nothing matched
  if (!finalQuery.length) {
    return q.split(" ").slice(0, 3).join(" ");
  }

  return finalQuery.join(" ");
}

// 🔥 EBAY FETCH
async function fetchEbay(query) {
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

  return items
    .map((item) => {
      const price =
        item?.sellingStatus?.[0]?.currentPrice?.[0]?.__value__;
      return price ? parseFloat(price) : null;
    })
    .filter((p) => p !== null);
}
