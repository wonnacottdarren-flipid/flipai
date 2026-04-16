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
      item?.image?.imageUrl || item?.thumbnailImages?.[0]?.imageUrl || "",
    price: priceValue,
    shipping: shippingValue,
    totalBuyPrice: roundMoney(priceValue + shippingValue),
    condition: normaliseCondition(item?.condition),
    location: item?.itemLocation?.country || "GB",
    buyingOptions: Array.isArray(item?.buyingOptions) ? item.buyingOptions : [],
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

function cleanSoldKeyword(title) {
  if (!title) return "";

  let keyword = String(title).toLowerCase();

  keyword = keyword
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/\([^)]*\)/g, " ")
    .replace(
      /read description|see description|please read|free post|free postage/gi,
      " "
    )
    .replace(/spares|repair|faulty|broken|parts only|not working/gi, " ")
    .replace(/\b[a-z]\d{3,}\b/gi, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const words = keyword
    .split(" ")
    .filter(Boolean)
    .filter((word) => word.length > 1);

  return words.slice(0, 6).join(" ");
}

function pickFindingKeywords({ title, query }) {
  const fromTitle = cleanSoldKeyword(title);
  if (fromTitle) return fromTitle;

  const fromQuery = cleanSoldKeyword(query);
  if (fromQuery) return fromQuery;

  return "";
}

function getFindingAppId() {
  return (
    process.env.EBAY_APP_ID ||
    process.env.EBAY_CLIENT_ID ||
    process.env.EBAY_APPID ||
    ""
  );
}

function parseFindingPrice(value) {
  return roundMoney(Number(value || 0));
}

function extractFindingItems(json) {
  const response =
    json?.findCompletedItemsResponse?.[0]?.searchResult?.[0]?.item || [];

  if (!Array.isArray(response)) {
    return [];
  }

  return response.map((item) => {
    const price = parseFindingPrice(
      item?.sellingStatus?.[0]?.currentPrice?.[0]?.__value__
    );

    const shipping = parseFindingPrice(
      item?.shippingInfo?.[0]?.shippingServiceCost?.[0]?.__value__
    );

    const title = String(item?.title?.[0] || "").trim();
    const itemId = String(item?.itemId?.[0] || "").trim();
    const viewItemURL = String(item?.viewItemURL?.[0] || "").trim();

    return {
      itemId,
      title,
      viewItemURL,
      price,
      shipping,
      total: roundMoney(price + shipping),
    };
  });
}

function average(values) {
  if (!values.length) return 0;
  return roundMoney(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function median(values) {
  if (!values.length) return 0;

  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return roundMoney((sorted[mid - 1] + sorted[mid]) / 2);
  }

  return roundMoney(sorted[mid]);
}

function buildSoldCompsStats(items, debug = {}) {
  const totals = items
    .map((item) => Number(item.total || 0))
    .filter((value) => Number.isFinite(value) && value > 0);

  if (!totals.length) {
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
      keywordUsed: debug.keywordUsed || "",
      debug,
    };
  }

  const avgSoldPrice = average(totals);
  const medianSoldPrice = median(totals);
  const minSoldPrice = roundMoney(Math.min(...totals));
  const maxSoldPrice = roundMoney(Math.max(...totals));

  let confidence = 35;
  confidence += Math.min(40, totals.length * 6);

  if (totals.length >= 3) confidence += 10;
  if (totals.length >= 5) confidence += 10;

  confidence = Math.min(95, confidence);

  let confidenceLabel = "Low";
  if (confidence >= 70) confidenceLabel = "High";
  else if (confidence >= 45) confidenceLabel = "Medium";

  return {
    connected: true,
    pricingMode: "Sold market data",
    compCount: totals.length,
    soldCount: totals.length,
    samplePrices: totals.slice(0, 8),
    avgSoldPrice,
    medianSoldPrice,
    minSoldPrice,
    maxSoldPrice,
    confidence,
    confidenceLabel,
    keywordUsed: debug.keywordUsed || "",
    debug,
  };
}

export async function getSoldComparables({
  title,
  query,
  limit = 10,
  debug = false,
}) {
  const appId = getFindingAppId();
  const hasAppId = Boolean(appId);
  const hasClientId = Boolean(process.env.EBAY_CLIENT_ID);

  const keywordUsed = pickFindingKeywords({ title, query });

  const baseDebug = {
    hasAppId,
    hasClientId,
    appIdUsed: appId || "",
    originalTitle: { title, query },
    keywordUsed,
  };

  if (!hasAppId) {
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
      keywordUsed,
      debug: {
        ...baseDebug,
        stage: "missing_app_id",
        errorMessage:
          "EBAY_APP_ID or EBAY_CLIENT_ID is missing. Finding API cannot run.",
      },
    };
  }

  if (!keywordUsed) {
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
        ...baseDebug,
        stage: "empty_keyword",
        errorMessage: "Could not build a sold-comps search keyword.",
      },
    };
  }

  const params = new URLSearchParams({
    "OPERATION-NAME": "findCompletedItems",
    "SERVICE-VERSION": "1.13.0",
    "SECURITY-APPNAME": appId,
    "RESPONSE-DATA-FORMAT": "JSON",
    "REST-PAYLOAD": "true",
    keywords: keywordUsed,
    "paginationInput.entriesPerPage": String(
      Math.min(Math.max(Number(limit) || 10, 1), 25)
    ),
    "itemFilter(0).name": "SoldItemsOnly",
    "itemFilter(0).value": "true",
    "itemFilter(1).name": "LocatedIn",
    "itemFilter(1).value": "GB",
    "itemFilter(2).name": "Currency",
    "itemFilter(2).value": "GBP",
    sortOrder: "EndTimeSoonest",
  });

  const url = `${EBAY_FINDING_URL}?${params.toString()}`;

  try {
    const res = await fetch(url, {
      headers: {
        Accept: "application/json",
        "X-EBAY-SOA-GLOBAL-ID": "EBAY-GB",
      },
    });

    const text = await res.text();

    let json;
    try {
      json = JSON.parse(text);
    } catch {
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
        keywordUsed,
        debug: {
          ...baseDebug,
          endpoint: url,
          stage: "parse_failed",
          httpStatus: res.status,
          errorMessage: "Finding API response was not valid JSON.",
          rawSnippet: text.slice(0, 500),
        },
      };
    }

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
        keywordUsed,
        debug: {
          ...baseDebug,
          endpoint: url,
          stage: "http_error",
          httpStatus: res.status,
          errorMessage: `HTTP ${res.status}`,
          rawSnippet: text.slice(0, 500),
        },
      };
    }

    const ack = json?.findCompletedItemsResponse?.[0]?.ack?.[0] || "";
    const items = extractFindingItems(json);

    if (String(ack).toLowerCase() !== "success" && !items.length) {
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
        keywordUsed,
        debug: {
          ...baseDebug,
          endpoint: url,
          stage: "ack_not_success",
          ack,
          rawSnippet: text.slice(0, 500),
        },
      };
    }

    return buildSoldCompsStats(items, {
      ...baseDebug,
      endpoint: url,
      stage: "success",
      ack,
      sampleTitles: items.slice(0, 5).map((item) => item.title),
      debugEnabled: Boolean(debug),
    });
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
      keywordUsed,
      debug: {
        ...baseDebug,
        stage: "fetch_failed",
        errorMessage: error.message || "Unknown fetch error",
      },
    };
  }
}
