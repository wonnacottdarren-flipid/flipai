const EBAY_TOKEN_URL = "https://api.ebay.com/identity/v1/oauth2/token";
const EBAY_BROWSE_URL = "https://api.ebay.com/buy/browse/v1/item_summary/search";
const EBAY_FINDING_URL = "https://svcs.ebay.com/services/search/FindingService/v1";
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

function getOptionalEnv(name, fallback = "") {
  const value = process.env[name];
  return value ? String(value).trim() : fallback;
}

function roundMoney(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function buildBasicAuth(clientId, clientSecret) {
  return Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
}

function cleanText(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function median(numbers) {
  if (!Array.isArray(numbers) || !numbers.length) return 0;
  const sorted = [...numbers].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return roundMoney((sorted[mid - 1] + sorted[mid]) / 2);
  }

  return roundMoney(sorted[mid]);
}

function average(numbers) {
  if (!Array.isArray(numbers) || !numbers.length) return 0;
  const total = numbers.reduce((sum, n) => sum + Number(n || 0), 0);
  return roundMoney(total / numbers.length);
}

function min(numbers) {
  if (!Array.isArray(numbers) || !numbers.length) return 0;
  return roundMoney(Math.min(...numbers));
}

function max(numbers) {
  if (!Array.isArray(numbers) || !numbers.length) return 0;
  return roundMoney(Math.max(...numbers));
}

function clamp(value, minValue, maxValue) {
  return Math.min(maxValue, Math.max(minValue, value));
}

function normaliseCondition(condition) {
  const text = String(condition || "").toLowerCase();

  if (text.includes("new")) return "New";
  if (text.includes("used")) return "Used";
  if (text.includes("refurb")) return "Refurbished";
  return "Unknown";
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

  const rawText = await res.text();
  const data = safeJsonParse(rawText);

  if (!res.ok || !data) {
    throw new Error(
      data?.error_description ||
        data?.error ||
        "Could not get eBay access token."
    );
  }

  cachedToken = data.access_token;
  cachedTokenExpiresAt = now + Number(data.expires_in || 7200) * 1000;

  return cachedToken;
}

function mapEbayItem(item) {
  const priceValue = Number(item?.price?.value || 0);
  const shippingValue = Number(
    item?.shippingOptions?.[0]?.shippingCost?.value || 0
  );

  return {
    itemId: item?.itemId || "",
    legacyItemId: item?.legacyItemId || "",
    title: cleanText(item?.title || ""),
    itemWebUrl: item?.itemWebUrl || "",
    imageUrl:
      item?.image?.imageUrl ||
      item?.thumbnailImages?.[0]?.imageUrl ||
      "",
    price: roundMoney(priceValue),
    shipping: roundMoney(shippingValue),
    totalBuyPrice: roundMoney(priceValue + shippingValue),
    condition: normaliseCondition(item?.condition),
    rawCondition: item?.condition || "",
    location: item?.itemLocation?.country || "GB",
    buyingOptions: Array.isArray(item?.buyingOptions)
      ? item.buyingOptions
      : [],
  };
}

function buildSoldKeywordFromItem(item) {
  const title = cleanText(item?.title || "");
  if (!title) return "";

  let keyword = title
    .replace(/[()[\]{}]/g, " ")
    .replace(/\b(sim free|no offers|fast dispatch|delivery|posted|postage)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (keyword.length > 90) {
    keyword = keyword.slice(0, 90).trim();
  }

  return keyword;
}

function buildConditionFilterValue(condition) {
  const text = String(condition || "").toLowerCase();

  if (text.includes("new")) return "New";
  if (text.includes("refurb")) return "Manufacturer refurbished";
  if (text.includes("used")) return "Used";
  return "";
}

async function fetchBrowseListings({
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
    filters.push("maxDeliveryCost:0");
  }

  if (condition && String(condition).trim()) {
    const text = String(condition).trim().toLowerCase();

    if (text.includes("new")) {
      filters.push("conditions:{NEW}");
    } else if (text.includes("used")) {
      filters.push("conditions:{USED}");
    } else if (text.includes("refurb")) {
      filters.push(
        "conditions:{CERTIFIED_REFURBISHED|EXCELLENT_REFURBISHED|VERY_GOOD_REFURBISHED|GOOD_REFURBISHED}"
      );
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

  const rawText = await res.text();
  const data = safeJsonParse(rawText);

  if (!res.ok || !data) {
    throw new Error(
      data?.errors?.[0]?.message || "Could not search eBay listings."
    );
  }

  const items = Array.isArray(data.itemSummaries) ? data.itemSummaries : [];
  return items.map(mapEbayItem);
}

async function fetchSoldComparablesForItem(item, options = {}) {
  const appId = getOptionalEnv("EBAY_APP_ID", getOptionalEnv("EBAY_CLIENT_ID", ""));
  if (!appId) {
    return {
      connected: false,
      pricingMode: "Estimated fallback model",
      compCount: 0,
      soldCount: 0,
      samplePrices: [],
      avgSoldPrice: 0,
      medianSoldPrice: 0,
      minSoldPrice: 0,
      maxSoldPrice: 0,
      confidence: 0,
      confidenceLabel: "Not connected",
      keywordUsed: "",
    };
  }

  const keyword = buildSoldKeywordFromItem(item);
  if (!keyword) {
    return {
      connected: true,
      pricingMode: "Estimated fallback model",
      compCount: 0,
      soldCount: 0,
      samplePrices: [],
      avgSoldPrice: 0,
      medianSoldPrice: 0,
      minSoldPrice: 0,
      maxSoldPrice: 0,
      confidence: 10,
      confidenceLabel: "Low",
      keywordUsed: "",
    };
  }

  const entriesPerPage = clamp(Number(options.entriesPerPage || 12), 5, 20);
  const params = new URLSearchParams({
    "OPERATION-NAME": "findCompletedItems",
    "SERVICE-VERSION": "1.13.0",
    "SECURITY-APPNAME": appId,
    "RESPONSE-DATA-FORMAT": "JSON",
    "REST-PAYLOAD": "true",
    keywords: keyword,
    "paginationInput.entriesPerPage": String(entriesPerPage),
    "outputSelector(0)": "SellerInfo",
    "itemFilter(0).name": "SoldItemsOnly",
    "itemFilter(0).value": "true",
    "itemFilter(1).name": "LocatedIn",
    "itemFilter(1).value": "GB",
  });

  const conditionFilterValue = buildConditionFilterValue(
    item?.rawCondition || item?.condition
  );

  if (conditionFilterValue) {
    params.set("itemFilter(2).name", "Condition");
    params.set("itemFilter(2).value", conditionFilterValue);
  }

  const res = await fetch(`${EBAY_FINDING_URL}?${params.toString()}`, {
    headers: {
      Accept: "application/json",
    },
  });

  const rawText = await res.text();
  const data = safeJsonParse(rawText);

  if (!res.ok || !data) {
    return {
      connected: true,
      pricingMode: "Estimated fallback model",
      compCount: 0,
      soldCount: 0,
      samplePrices: [],
      avgSoldPrice: 0,
      medianSoldPrice: 0,
      minSoldPrice: 0,
      maxSoldPrice: 0,
      confidence: 15,
      confidenceLabel: "Low",
      keywordUsed: keyword,
    };
  }

  const responseRoot =
    data?.findCompletedItemsResponse?.[0] ||
    data?.findCompletedItemsResponse ||
    {};

  const searchResult =
    responseRoot?.searchResult?.[0] ||
    responseRoot?.searchResult ||
    {};

  const items = Array.isArray(searchResult?.item)
    ? searchResult.item
    : [];

  const prices = items
    .map((soldItem) => {
      const price = Number(
        soldItem?.sellingStatus?.[0]?.currentPrice?.[0]?.__value__ || 0
      );
      const shipping = Number(
        soldItem?.shippingInfo?.[0]?.shippingServiceCost?.[0]?.__value__ || 0
      );
      return roundMoney(price + shipping);
    })
    .filter((value) => value > 0);

  const sampleCount = prices.length;
  const avgSoldPrice = average(prices);
  const medianSoldPrice = median(prices);
  const minSoldPrice = min(prices);
  const maxSoldPrice = max(prices);

  let confidence = 20;

  if (sampleCount >= 8) confidence += 35;
  else if (sampleCount >= 5) confidence += 25;
  else if (sampleCount >= 3) confidence += 15;
  else if (sampleCount >= 1) confidence += 8;

  if (item?.condition && conditionFilterValue) {
    confidence += 8;
  }

  if (keyword.split(" ").length >= 4) {
    confidence += 8;
  }

  confidence = clamp(confidence, 0, 99);

  let confidenceLabel = "Low";
  if (confidence >= 75) confidenceLabel = "High";
  else if (confidence >= 45) confidenceLabel = "Medium";

  return {
    connected: true,
    pricingMode: sampleCount > 0 ? "Sold comps model" : "Estimated fallback model",
    compCount: sampleCount,
    soldCount: sampleCount,
    samplePrices: prices,
    avgSoldPrice,
    medianSoldPrice,
    minSoldPrice,
    maxSoldPrice,
    confidence,
    confidenceLabel,
    keywordUsed: keyword,
  };
}

function enrichListingWithSoldComp(item, soldComp) {
  return {
    ...item,
    soldComp,
  };
}

export async function searchEbayListings({
  query,
  limit = 10,
  filterPriceMax,
  condition,
  freeShippingOnly = false,
}) {
  const listings = await fetchBrowseListings({
    query,
    limit,
    filterPriceMax,
    condition,
    freeShippingOnly,
  });

  const withSoldComp = await Promise.all(
    listings.map(async (item) => {
      try {
        const soldComp = await fetchSoldComparablesForItem(item);
        return enrichListingWithSoldComp(item, soldComp);
      } catch {
        return enrichListingWithSoldComp(item, {
          connected: false,
          pricingMode: "Estimated fallback model",
          compCount: 0,
          soldCount: 0,
          samplePrices: [],
          avgSoldPrice: 0,
          medianSoldPrice: 0,
          minSoldPrice: 0,
          maxSoldPrice: 0,
          confidence: 0,
          confidenceLabel: "Not connected",
          keywordUsed: "",
        });
      }
    })
  );

  return withSoldComp;
}
