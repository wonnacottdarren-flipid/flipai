const EBAY_TOKEN_URL = "https://api.ebay.com/identity/v1/oauth2/token";
const EBAY_BROWSE_URL = "https://api.ebay.com/buy/browse/v1/item_summary/search";
const EBAY_SCOPE = "https://api.ebay.com/oauth/api_scope";

let cachedToken = null;
let cachedTokenExpiresAt = 0;

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not configured.`);
  }
  return value;
}

function buildBasicAuth(clientId, clientSecret) {
  return Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
}

async function getEbayAccessToken() {
  const now = Date.now();

  if (cachedToken && now < cachedTokenExpiresAt - 60_000) {
    return cachedToken;
  }

  const clientId = requireEnv("EBAY_CLIENT_ID");
  const clientSecret = requireEnv("EBAY_CLIENT_SECRET");

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    scope: EBAY_SCOPE,
  });

  const res = await fetch(EBAY_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${buildBasicAuth(clientId, clientSecret)}`,
    },
    body: body.toString(),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error_description || data.error || "Could not get eBay access token.");
  }

  cachedToken = data.access_token;
  cachedTokenExpiresAt = now + Number(data.expires_in || 7200) * 1000;

  return cachedToken;
}

function normaliseCondition(condition) {
  const text = String(condition || "").toLowerCase();

  if (text.includes("new")) return "New";
  if (text.includes("used")) return "Used";
  if (text.includes("refurb")) return "Refurbished";
  return "Unknown";
}

function mapEbayItem(item) {
  const priceValue = Number(item?.price?.value || 0);
  const shippingValue = Number(
    item?.shippingOptions?.[0]?.shippingCost?.value || 0
  );

  return {
    itemId: item?.itemId || "",
    title: item?.title || "",
    itemWebUrl: item?.itemWebUrl || "",
    imageUrl:
      item?.image?.imageUrl ||
      item?.thumbnailImages?.[0]?.imageUrl ||
      "",
    price: priceValue,
    shipping: shippingValue,
    totalBuyPrice: priceValue + shippingValue,
    condition: normaliseCondition(item?.condition),
    location: item?.itemLocation?.country || "GB",
    buyingOptions: Array.isArray(item?.buyingOptions)
      ? item.buyingOptions
      : [],
  };
}

export async function searchEbayListings({
  query,
  limit = 10,
  filterPriceMax,
  condition,
  freeShippingOnly = false,
}) {
  if (!query || !String(query).trim()) {
    throw new Error("Search query is required.");
  }

  const token = await getEbayAccessToken();
  const marketplaceId = process.env.EBAY_MARKETPLACE_ID || "EBAY_GB";

  const params = new URLSearchParams({
    q: String(query).trim(),
    limit: String(Math.min(Math.max(Number(limit) || 10, 1), 20)),
  });

  const filters = [];

  if (filterPriceMax && Number(filterPriceMax) > 0) {
    filters.push(`price:[..${Number(filterPriceMax)}]`);
  }

  if (freeShippingOnly) {
    filters.push("deliveryOptions:{SELLER_ARRANGED_LOCAL_PICKUP|SHIP_TO_HOME}");
  }

  if (condition && String(condition).trim()) {
    const clean = String(condition).trim();
    if (["NEW", "USED", "CERTIFIED_REFURBISHED", "LIKE_NEW", "VERY_GOOD", "GOOD", "ACCEPTABLE"].includes(clean)) {
      filters.push(`conditions:{${clean}}`);
    }
  }

  if (filters.length) {
    params.set("filter", filters.join(","));
  }

  const res = await fetch(`${EBAY_BROWSE_URL}?${params.toString()}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "X-EBAY-C-MARKETPLACE-ID": marketplaceId,
      Accept: "application/json",
    },
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.errors?.[0]?.message || "Could not search eBay.");
  }

  const items = Array.isArray(data.itemSummaries) ? data.itemSummaries : [];
  return items.map(mapEbayItem);
}
