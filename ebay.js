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

function clamp(value, minValue, maxValue) {
  return Math.min(maxValue, Math.max(minValue, value));
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

function average(numbers) {
  if (!Array.isArray(numbers) || numbers.length === 0) return 0;
  const total = numbers.reduce((sum, n) => sum + Number(n || 0), 0);
  return roundMoney(total / numbers.length);
}

function median(numbers) {
  if (!Array.isArray(numbers) || numbers.length === 0) return 0;
  const sorted = [...numbers].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return roundMoney((sorted[mid - 1] + sorted[mid]) / 2);
  }

  return roundMoney(sorted[mid]);
}

function minValue(numbers) {
  if (!Array.isArray(numbers) || numbers.length === 0) return 0;
  return roundMoney(Math.min(...numbers));
}

function maxValue(numbers) {
  if (!Array.isArray(numbers) || numbers.length === 0) return 0;
  return roundMoney(Math.max(...numbers));
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
        rawText ||
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

function buildSoldKeywordFromText(text) {
  let keyword = cleanText(text);

  if (!keyword) return "";

  keyword = keyword
    .replace(/[()[\]{}]/g, " ")
    .replace(
      /\b(sim free|no offers|fast dispatch|delivery|posted|postage|read description)\b/gi,
      " "
    )
    .replace(/\s+/g, " ")
    .trim();

  if (keyword.length > 90) {
    keyword = keyword.slice(0, 90).trim();
  }

  return keyword;
}

function buildSoldKeywordFromItem(item) {
  return buildSoldKeywordFromText(item?.title || "");
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
      data?.errors?.[0]?.message ||
        rawText ||
        "Could not search eBay listings."
    );
  }

  const items = Array.isArray(data.itemSummaries) ? data.itemSummaries : [];
  return items.map(mapEbayItem);
}

export async function getSoldComparables({
  title = "",
  condition = "",
  entriesPerPage = 12,
} = {}) {
  const appId = getOptionalEnv("EBAY_APP_ID", "");
  const fallbackClientId = getOptionalEnv("EBAY_CLIENT_ID", "");
  const keyword = buildSoldKeywordFromText(title);

  const debug = {
    hasAppId: Boolean(appId),
    hasClientId: Boolean(fallbackClientId),
    appIdUsed: appId || fallbackClientId || "",
    keywordUsed: keyword,
    conditionInput: condition || "",
    endpoint: EBAY_FINDING_URL,
    stage: "init",
    httpStatus: null,
    ack: "",
    errorMessage: "",
    rawSnippet: "",
  };

  if (!appId && !fallbackClientId) {
    debug.stage = "missing_credentials";
    debug.errorMessage = "Missing EBAY_APP_ID and EBAY_CLIENT_ID";

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
      keywordUsed: keyword,
      debug,
    };
  }

  if (!keyword) {
    debug.stage = "missing_keyword";
    debug.errorMessage = "No keyword available for sold comps lookup";

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
      debug,
    };
  }

  const safeEntriesPerPage = clamp(Number(entriesPerPage || 12), 5, 20);
  const appIdToUse = appId || fallbackClientId;

  const params = new URLSearchParams({
    "OPERATION-NAME": "findCompletedItems",
    "SERVICE-VERSION": "1.13.0",
    "SECURITY-APPNAME": appIdToUse,
    "RESPONSE-DATA-FORMAT": "JSON",
    "REST-PAYLOAD": "true",
    keywords: keyword,
    "paginationInput.entriesPerPage": String(safeEntriesPerPage),
    "outputSelector(0)": "SellerInfo",
    "itemFilter(0).name": "SoldItemsOnly",
    "itemFilter(0).value": "true",
    "itemFilter(1).name": "LocatedIn",
    "itemFilter(1).value": "GB",
  });

  const conditionFilterValue = buildConditionFilterValue(condition);

  if (conditionFilterValue) {
    params.set("itemFilter(2).name", "Condition");
    params.set("itemFilter(2).value", conditionFilterValue);
  }

  try {
    debug.stage = "requesting";

    const res = await fetch(`${EBAY_FINDING_URL}?${params.toString()}`, {
      headers: {
        Accept: "application/json",
      },
    });

    const rawText = await res.text();
    const data = safeJsonParse(rawText);

    debug.httpStatus = res.status;
    debug.rawSnippet = String(rawText || "").slice(0, 500);

    if (!res.ok || !data) {
      debug.stage = "http_or_parse_failed";
      debug.errorMessage = !res.ok
        ? `HTTP ${res.status}`
        : "Could not parse JSON response";

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
        debug,
      };
    }

    const responseRoot =
      data?.findCompletedItemsResponse?.[0] ||
      data?.findCompletedItemsResponse ||
      {};

    debug.ack =
      responseRoot?.ack?.[0] ||
      responseRoot?.ack ||
      "";

    const errorMessage =
      responseRoot?.errorMessage?.[0]?.error?.[0]?.message?.[0] ||
      responseRoot?.errorMessage?.error?.[0]?.message?.[0] ||
      "";

    if (errorMessage) {
      debug.stage = "api_error";
      debug.errorMessage = errorMessage;
    }

    const searchResult =
      responseRoot?.searchResult?.[0] ||
      responseRoot?.searchResult ||
      {};

    const items = Array.isArray(searchResult?.item) ? searchResult.item : [];

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

    const compCount = prices.length;
    const avgSoldPrice = average(prices);
    const medianSoldPrice = median(prices);
    const minSoldPrice = minValue(prices);
    const maxSoldPrice = maxValue(prices);

    let confidence = 20;

    if (compCount >= 8) confidence += 35;
    else if (compCount >= 5) confidence += 25;
    else if (compCount >= 3) confidence += 15;
    else if (compCount >= 1) confidence += 8;

    if (conditionFilterValue) confidence += 8;
    if (keyword.split(" ").length >= 4) confidence += 8;

    confidence = clamp(confidence, 0, 99);

    let confidenceLabel = "Low";
    if (confidence >= 75) confidenceLabel = "High";
    else if (confidence >= 45) confidenceLabel = "Medium";

    debug.stage = compCount > 0 ? "success" : "no_comps_found";

    return {
      connected: compCount > 0,
      pricingMode: compCount > 0 ? "Sold comps model" : "Estimated fallback model",
      compCount,
      soldCount: compCount,
      samplePrices: prices,
      avgSoldPrice,
      medianSoldPrice,
      minSoldPrice,
      maxSoldPrice,
      confidence,
      confidenceLabel,
      keywordUsed: keyword,
      debug,
    };
  } catch (error) {
    debug.stage = "exception";
    debug.errorMessage = error?.message || "Unknown error";

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
      debug,
    };
  }
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
        const soldComp = await getSoldComparables({
          title: buildSoldKeywordFromItem(item),
          condition: item?.rawCondition || item?.condition || condition || "",
          entriesPerPage: 12,
        });

        return enrichListingWithSoldComp(item, soldComp);
      } catch (error) {
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
          debug: {
            stage: "wrapper_exception",
            errorMessage: error?.message || "Wrapper exception",
          },
        });
      }
    })
  );

  return withSoldComp;
}
