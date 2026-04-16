const EBAY_TOKEN_URL = "https://api.ebay.com/identity/v1/oauth2/token";
const EBAY_BROWSE_URL = "https://api.ebay.com/buy/browse/v1/item_summary/search";
const EBAY_SCOPE = "https://api.ebay.com/oauth/api_scope";
const EBAY_FINDING_URL = "https://svcs.ebay.com/services/search/FindingService/v1";

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
    totalBuyPrice: roundMoney(priceValue + shippingValue),
    condition: normaliseCondition(item?.condition),
    location: item?.itemLocation?.country || "GB",
    buyingOptions: Array.isArray(item?.buyingOptions)
      ? item.buyingOptions
      : [],
  };
}

function buildBrowseFilters({
  filterPriceMax,
  condition,
  freeShippingOnly,
}) {
  const filters = [];

  if (filterPriceMax && Number(filterPriceMax) > 0) {
    filters.push(`price:[..${Number(filterPriceMax)}]`);
  }

  if (freeShippingOnly) {
    filters.push("maxDeliveryCost:0");
  }

  if (condition && String(condition).trim()) {
    const clean = String(condition).trim().toUpperCase();

    const allowed = [
      "NEW",
      "USED",
      "CERTIFIED_REFURBISHED",
      "LIKE_NEW",
      "VERY_GOOD",
      "GOOD",
      "ACCEPTABLE",
      "NEW_OTHER",
      "FOR_PARTS_OR_NOT_WORKING",
    ];

    if (allowed.includes(clean)) {
      filters.push(`conditions:{${clean}}`);
    }
  }

  return filters;
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

  const filters = buildBrowseFilters({
    filterPriceMax,
    condition,
    freeShippingOnly,
  });

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
    throw new Error(
      data.errors?.[0]?.message || "Could not search eBay."
    );
  }

  const items = Array.isArray(data.itemSummaries) ? data.itemSummaries : [];
  return items.map(mapEbayItem);
}

function cleanSoldKeyword(title) {
  let keyword = String(title || "").toLowerCase();

  keyword = keyword
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/\([^)]*\)/g, " ")
    .replace(/\b(read description|see description|please read|free post|free postage|spares|repair|faulty|broken|parts only|for parts|not working)\b/g, " ")
    .replace(/\b(a\d{4})\b/g, " ")
    .replace(/\b(ee|o2|vodafone|three|tesco|sky|id|giffgaff)\b/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const tokens = keyword.split(" ").filter(Boolean);

  const keepers = [];
  const preferred = [
    "apple",
    "iphone",
    "ipad",
    "macbook",
    "samsung",
    "galaxy",
    "google",
    "pixel",
    "pro",
    "mini",
    "plus",
    "max",
    "ultra",
    "unlocked",
    "64gb",
    "128gb",
    "256gb",
    "512gb",
    "1tb",
  ];

  for (const token of tokens) {
    if (
      /^\d+gb$/.test(token) ||
      preferred.includes(token) ||
      /^iphone$/.test(token) ||
      /^ipad$/.test(token) ||
      /^pixel$/.test(token) ||
      /^galaxy$/.test(token) ||
      /^\d+$/.test(token)
    ) {
      keepers.push(token);
    } else if (
      token.length > 1 &&
      keepers.length < 6 &&
      !["the", "and", "with", "for"].includes(token)
    ) {
      keepers.push(token);
    }

    if (keepers.length >= 6) break;
  }

  return keepers.join(" ").trim();
}

function median(values) {
  if (!values.length) return 0;
  const copy = [...values].sort((a, b) => a - b);
  const middle = Math.floor(copy.length / 2);

  if (copy.length % 2 === 0) {
    return (copy[middle - 1] + copy[middle]) / 2;
  }

  return copy[middle];
}

function buildSoldComparablesUrl(appId, keyword) {
  const params = new URLSearchParams({
    "OPERATION-NAME": "findCompletedItems",
    "SERVICE-VERSION": "1.13.0",
    "SECURITY-APPNAME": appId,
    "RESPONSE-DATA-FORMAT": "JSON",
    "REST-PAYLOAD": "",
    keywords: keyword,
    "itemFilter(0).name": "SoldItemsOnly",
    "itemFilter(0).value": "true",
    "paginationInput.entriesPerPage": "20",
  });

  return `${EBAY_FINDING_URL}?${params.toString()}`;
}

export async function getSoldComparables(title) {
  const appId = process.env.EBAY_APP_ID || process.env.EBAY_CLIENT_ID;

  const debug = {
    hasAppId: Boolean(process.env.EBAY_APP_ID),
    hasClientId: Boolean(process.env.EBAY_CLIENT_ID),
    appIdUsed: appId || null,
    originalTitle: title || "",
  };

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
      confidenceLabel: "Low",
      keywordUsed: "",
      debug: {
        ...debug,
        stage: "missing_app_id",
        errorMessage: "No eBay App ID found.",
      },
    };
  }

  const keyword = cleanSoldKeyword(title);
  debug.keywordUsed = keyword;

  if (!keyword) {
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
      confidenceLabel: "Low",
      keywordUsed: "",
      debug: {
        ...debug,
        stage: "empty_keyword",
        errorMessage: "Could not build a sold-comps search keyword.",
      },
    };
  }

  const url = buildSoldComparablesUrl(appId, keyword);
  debug.endpoint = EBAY_FINDING_URL;
  debug.apiUrl = url;

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    });

    const rawText = await res.text();

    debug.httpStatus = res.status;
    debug.rawSnippet = rawText.slice(0, 500);

    if (!res.ok) {
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
        confidenceLabel: "Low",
        keywordUsed: keyword,
        debug: {
          ...debug,
          stage: "http_or_parse_failed",
          ack: "",
          errorMessage: `HTTP ${res.status}`,
        },
      };
    }

    let data;

    try {
      data = JSON.parse(rawText);
    } catch (error) {
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
        confidenceLabel: "Low",
        keywordUsed: keyword,
        debug: {
          ...debug,
          stage: "json_parse_failed",
          ack: "",
          errorMessage: error.message,
        },
      };
    }

    const response = data?.findCompletedItemsResponse?.[0] || {};
    const ack = response?.ack?.[0] || "";
    debug.ack = ack;

    const items = response?.searchResult?.[0]?.item || [];

    const soldPrices = items
      .map((item) =>
        Number(item?.sellingStatus?.[0]?.currentPrice?.[0]?.__value__ || 0)
      )
      .filter((value) => Number.isFinite(value) && value > 0)
      .map((value) => roundMoney(value));

    if (!soldPrices.length) {
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
        confidence: 15,
        confidenceLabel: "Low",
        keywordUsed: keyword,
        debug: {
          ...debug,
          stage: "no_results",
          errorMessage: "No sold comparables found.",
        },
      };
    }

    soldPrices.sort((a, b) => a - b);

    const avgSoldPrice = roundMoney(
      soldPrices.reduce((sum, value) => sum + value, 0) / soldPrices.length
    );
    const medianSoldPrice = roundMoney(median(soldPrices));
    const minSoldPrice = roundMoney(soldPrices[0]);
    const maxSoldPrice = roundMoney(soldPrices[soldPrices.length - 1]);

    const confidence = Math.min(95, 25 + soldPrices.length * 8);
    const confidenceLabel =
      confidence >= 75 ? "High" : confidence >= 45 ? "Medium" : "Low";

    return {
      connected: true,
      pricingMode: "Sold market data",
      compCount: soldPrices.length,
      soldCount: soldPrices.length,
      samplePrices: soldPrices.slice(0, 5),
      avgSoldPrice,
      medianSoldPrice,
      minSoldPrice,
      maxSoldPrice,
      confidence,
      confidenceLabel,
      keywordUsed: keyword,
      debug: {
        ...debug,
        stage: "success",
      },
    };
  } catch (error) {
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
      confidenceLabel: "Low",
      keywordUsed: keyword,
      debug: {
        ...debug,
        stage: "exception",
        errorMessage: error.message,
      },
    };
  }
}
