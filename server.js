import fetch from "node-fetch";

/**
 * FlipAI eBay Browse API (DEBUG + PRODUCTION SAFE)
 * - OAuth handling
 * - Full error visibility
 * - UK marketplace support
 */

// -----------------------------
// ENV CHECK
// -----------------------------
const EBAY_CLIENT_ID = process.env.EBAY_CLIENT_ID;
const EBAY_CLIENT_SECRET = process.env.EBAY_CLIENT_SECRET;

// -----------------------------
// TOKEN CACHE
// -----------------------------
let cachedToken = null;
let tokenExpiry = 0;

// -----------------------------
// GET OAUTH TOKEN (DEBUG VERSION)
// -----------------------------
async function getEbayAccessToken() {
  const now = Date.now();

  if (cachedToken && now < tokenExpiry) {
    return cachedToken;
  }

  if (!EBAY_CLIENT_ID || !EBAY_CLIENT_SECRET) {
    console.error("❌ Missing eBay credentials");
    throw new Error("Missing eBay CLIENT_ID or CLIENT_SECRET");
  }

  const auth = Buffer.from(
    `${EBAY_CLIENT_ID}:${EBAY_CLIENT_SECRET}`
  ).toString("base64");

  const res = await fetch(
    "https://api.ebay.com/identity/v1/oauth2/token",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${auth}`,
      },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        scope: "https://api.ebay.com/oauth/api_scope",
      }),
    }
  );

  const data = await res.json();

  console.log("🔑 TOKEN RESPONSE:", data);

  if (!data.access_token) {
    console.error("❌ TOKEN FAILED:", data);
    throw new Error("Failed to get eBay access token");
  }

  cachedToken = data.access_token;
  tokenExpiry = now + data.expires_in * 1000 - 60000;

  return cachedToken;
}

// -----------------------------
// CLEAN QUERY
// -----------------------------
function cleanQuery(query) {
  if (!query) return "";
  return query.replace(/[^a-z0-9\s]/gi, "").trim();
}

// -----------------------------
// MAIN SEARCH FUNCTION (DEBUG MODE)
// -----------------------------
export async function searchEbayListings({
  query,
  maxPrice,
  condition = "USED",
  limit = 20,
}) {
  try {
    const token = await getEbayAccessToken();

    const cleaned = cleanQuery(query);
    const finalQuery = cleaned.length ? cleaned : query;

    const url = new URL(
      "https://api.ebay.com/buy/browse/v1/item_summary/search"
    );

    url.searchParams.set("q", finalQuery);
    url.searchParams.set("limit", limit);

    // -----------------------------
    // FILTERS (SAFE FORMAT)
    // -----------------------------
    const filters = [];

    if (maxPrice) {
      filters.push(`price:[0..${maxPrice}]`);
    }

    if (condition) {
      filters.push(`conditions:{${condition.toUpperCase()}}`);
    }

    if (filters.length) {
      url.searchParams.set("filter", filters.join(","));
    }

    console.log("🌍 eBay Request URL:", url.toString());

    // -----------------------------
    // FETCH
    // -----------------------------
    const res = await fetch(url.toString(), {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "X-EBAY-C-MARKETPLACE-ID": "EBAY_GB",
      },
    });

    console.log("📡 eBay STATUS:", res.status);

    const data = await res.json();

    console.log("📦 eBay RAW RESPONSE:");
    console.log(JSON.stringify(data, null, 2));

    if (!res.ok) {
      console.error("❌ eBay API ERROR:", data);
      return [];
    }

    const items = data.itemSummaries || [];

    if (!items.length) {
      console.warn("⚠️ No items returned from eBay");
      return [];
    }

    return items.map((item) => ({
      title: item.title || "Unknown",
      price: item.price?.value ? Number(item.price.value) : 0,
      currency: item.price?.currency || "GBP",
      url: item.itemWebUrl || "",
      condition: item.condition || "Unknown",
      image: item.image?.imageUrl || "",
      location: item.itemLocation?.country || "UK",
    }));
  } catch (error) {
    console.error("🔥 eBay MODULE ERROR:", error.message);
    return [];
  }
}
