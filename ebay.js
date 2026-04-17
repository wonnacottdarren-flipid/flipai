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

function roundMoney(value) {
  return Math.round(Number(value || 0) * 100) / 100;
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
    throw new Error(
      data.error_description || data.error || "Could not get eBay access token."
    );
  }

  cachedToken = data.access_token;
  cachedTokenExpiresAt = now + Number(data.expires_in || 7200) * 1000;

  return cachedToken;
}

function normaliseCondition(condition) {
  const text = String(condition || "").toLowerCase();

  if (text.includes("certified refurbished")) return "Certified Refurbished";
  if (text.includes("refurbished")) return "Refurbished";
  if (text.includes("like new")) return "Like New";
  if (text.includes("very good")) return "Very Good";
  if (text.includes("good")) return "Good";
  if (text.includes("acceptable")) return "Acceptable";
  if (text.includes("new")) return "New";
  if (text.includes("used")) return "Used";

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
      item?.image?.imageUrl || item?.thumbnailImages?.[0]?.imageUrl || "",
    price: roundMoney(priceValue),
    shipping: roundMoney(shippingValue),
    totalBuyPrice: roundMoney(priceValue + shippingValue),
    condition: normaliseCondition(item?.condition),
    location: item?.itemLocation?.country || "GB",
    buyingOptions: Array.isArray(item?.buyingOptions) ? item.buyingOptions : [],
    itemOriginDate: item?.itemOriginDate || "",
    categories: Array.isArray(item?.categories) ? item.categories : [],
  };
}

function buildFilterString({
  maxPrice,
  condition,
  freeShippingOnly,
  fixedPriceOnly = true,
}) {
  const filters = [];

  if (fixedPriceOnly) {
    filters.push("buyingOptions:{FIXED_PRICE}");
  }

  if (maxPrice && Number(maxPrice) > 0) {
    filters.push(`price:[..${Number(maxPrice)}]`);
  }

  if (condition && String(condition).trim()) {
    const clean = String(condition).trim().toUpperCase();

    if (
      [
        "NEW",
        "USED",
        "CERTIFIED_REFURBISHED",
        "LIKE_NEW",
        "VERY_GOOD",
        "GOOD",
        "ACCEPTABLE",
      ].includes(clean)
    ) {
      filters.push(`conditions:{${clean}}`);
    }
  }

  if (freeShippingOnly) {
    filters.push("deliveryOptions:{SELLER_ARRANGED_LOCAL_PICKUP|SHIP_TO_HOME}");
  }

  return filters.join(",");
}

async function browseSearch({
  query,
  maxPrice,
  condition,
  freeShippingOnly = false,
  limit = 20,
  fixedPriceOnly = true,
}) {
  if (!query || !String(query).trim()) {
    throw new Error("Search query is required.");
  }

  const token = await getEbayAccessToken();
  const marketplaceId = process.env.EBAY_MARKETPLACE_ID || "EBAY_GB";

  const params = new URLSearchParams({
    q: String(query).trim(),
    limit: String(Math.min(Math.max(Number(limit) || 10, 1), 50)),
  });

  const filter = buildFilterString({
    maxPrice,
    condition,
    freeShippingOnly,
    fixedPriceOnly,
  });

  if (filter) {
    params.set("filter", filter);
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

  let items = Array.isArray(data.itemSummaries) ? data.itemSummaries : [];
  items = items.map(mapEbayItem);

  if (freeShippingOnly) {
    items = items.filter((item) => Number(item.shipping || 0) === 0);
  }

  return items;
}

export async function searchEbayListings({
  query,
  maxPrice,
  condition,
  freeShippingOnly = false,
  limit = 20,
}) {
  return browseSearch({
    query,
    maxPrice,
    condition,
    freeShippingOnly,
    limit,
    fixedPriceOnly: true,
  });
}

export async function searchEbayMarketPool({
  query,
  condition = "",
  limit = 50,
}) {
  return browseSearch({
    query,
    condition,
    limit: Math.min(Math.max(Number(limit) || 30, 1), 50),
    freeShippingOnly: false,
    fixedPriceOnly: true,
  });
}
