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

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hasAny(text, phrases = []) {
  return phrases.some((phrase) => text.includes(phrase));
}

function isDysonMainUnitQuery(text) {
  return (
    text.includes("dyson") &&
    (
      text.includes("main unit") ||
      text.includes("main body") ||
      text.includes("body only") ||
      text.includes("motor unit") ||
      text.includes("bare unit") ||
      text.includes("unit only") ||
      text.includes("handheld unit") ||
      text.includes("body")
    )
  );
}

function isDysonOutsizeQuery(text) {
  return text.includes("dyson") && text.includes("outsize");
}

function isDysonPartsCategory(item) {
  const categories = Array.isArray(item?.categories) ? item.categories : [];
  return categories.some((category) =>
    normalizeText(category?.categoryName).includes("parts")
  );
}

function isDysonAccessoryOrPartsTitle(text) {
  return hasAny(text, [
    "parts",
    "spares",
    "attachment",
    "attachments",
    "tool only",
    "tools only",
    "battery only",
    "charger only",
    "filter only",
    "wand only",
    "head only",
    "battery",
    "charger",
    "dock",
    "wall dock",
    "filter",
    "filters",
    "wand",
    "pipe",
    "crevice",
    "brush",
    "roller",
    "roller head",
    "floor head",
    "motorhead",
    "motor head",
    "nozzle",
    "hose",
    "trigger",
    "bin only",
    "canister only",
  ]);
}

function isDysonMainUnitTitle(text) {
  return hasAny(text, [
    "main unit",
    "motor unit",
    "body only",
    "main body",
    "machine body",
    "body",
    "handheld unit",
    "main vacuum unit",
    "bare unit",
    "unit only",
  ]);
}

function isDysonFullVacTitle(text) {
  return hasAny(text, [
    "vacuum cleaner",
    "cordless vacuum",
    "stick vacuum",
    "complete vacuum",
    "full vacuum",
    "complete machine",
    "complete set",
    "full set",
  ]);
}

function matchesDysonVariantForEbay(query, item) {
  const searchText = normalizeText(query);
  if (!searchText.includes("dyson")) return true;

  const titleText = normalizeText(item?.title || "");
  const wantsV11 = searchText.includes("v11");
  const wantsOutsize = isDysonOutsizeQuery(searchText);
  const wantsMainUnit = isDysonMainUnitQuery(searchText);

  const titleHasV11 = titleText.includes("v11");
  const titleHasOutsize = titleText.includes("outsize");
  const titleIsMainUnit = isDysonMainUnitTitle(titleText);
  const titleIsParts = isDysonAccessoryOrPartsTitle(titleText);
  const titleIsFullMachine =
    isDysonFullVacTitle(titleText) || (!titleIsMainUnit && !titleIsParts);

  if (isDysonPartsCategory(item)) return false;
  if (titleIsParts) return false;
  if (wantsV11 && !titleHasV11) return false;

  if (wantsOutsize) {
    if (!titleHasOutsize) return false;
    if (titleIsMainUnit) return false;
    return titleIsFullMachine;
  }

  if (wantsMainUnit) {
    if (titleHasOutsize) return false;
    return titleIsMainUnit;
  }

  if (wantsV11) {
    if (titleHasOutsize) return false;
    if (titleIsMainUnit) return false;
    return titleIsFullMachine;
  }

  return true;
}

function scoreMainUnitCandidate(query, item) {
  const searchText = normalizeText(query);
  const titleText = normalizeText(item?.title || "");

  if (!isDysonMainUnitQuery(searchText)) {
    return 0;
  }

  let score = 0;

  if (titleText.includes("v11")) score += 3;
  if (titleText.includes("main unit")) score += 5;
  if (titleText.includes("main body")) score += 5;
  if (titleText.includes("motor unit")) score += 5;
  if (titleText.includes("body only")) score += 5;
  if (titleText.includes("bare unit")) score += 4;
  if (titleText.includes("unit only")) score += 4;
  if (titleText.includes("handheld unit")) score += 4;
  if (titleText.includes("body")) score += 2;

  if (titleText.includes("outsize")) score -= 8;
  if (isDysonAccessoryOrPartsTitle(titleText)) score -= 10;
  if (isDysonPartsCategory(item)) score -= 10;
  if (isDysonFullVacTitle(titleText)) score -= 8;

  return score;
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

function uniqueByItemId(items) {
  const seen = new Set();
  const output = [];

  for (const item of items) {
    const key = item?.itemId || `${item?.title || ""}-${item?.price || 0}`;
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(item);
  }

  return output;
}

function buildDysonSearchVariants(query) {
  const q = normalizeText(query);
  const variants = [String(query).trim()];

  const isDyson = q.includes("dyson");
  const isV11 = q.includes("v11");
  const isOutsize = isDysonOutsizeQuery(q);
  const isMainUnit = isDysonMainUnitQuery(q);

  if (!isDyson) {
    return variants;
  }

  if (isOutsize) {
    variants.push("dyson v11 outsize");
    variants.push("dyson outsize");
    variants.push("dyson outsize absolute");
    variants.push("dyson v11 outsize absolute");
  } else if (isMainUnit) {
    if (isV11) {
      variants.push("dyson v11 main unit");
      variants.push("dyson v11 main body");
      variants.push("dyson v11 motor unit");
      variants.push("dyson v11 body only");
      variants.push("dyson v11 unit only");
      variants.push("dyson v11 handheld unit");
      variants.push("dyson v11 bare unit");
      variants.push("dyson cordless v11 main body");
      variants.push("dyson cordless v11 motor unit");
      variants.push("dyson v11 body");
    } else {
      variants.push("dyson main unit");
      variants.push("dyson main body");
      variants.push("dyson motor unit");
      variants.push("dyson body only");
      variants.push("dyson unit only");
      variants.push("dyson bare unit");
    }
  } else if (isV11) {
    variants.push("dyson v11");
    variants.push("dyson v11 absolute");
    variants.push("dyson v11 cordless vacuum");
    variants.push("dyson cordless stick vacuum cleaner v11");
  }

  return [...new Set(variants.filter(Boolean))];
}

function isConsoleBundleIntent(text) {
  return hasAny(text, [
    "bundle",
    "with games",
    "with game",
    "games",
    "2 controllers",
    "two controllers",
    "with controller",
    "controllers",
    "job lot",
    "comes with",
    "includes",
    "plus games",
    "inc games",
    "includes games",
    "with extras",
    "extras",
  ]);
}

function buildConsoleBundleVariants(query, baseVariants = []) {
  const q = normalizeText(query);
  const variants = [...baseVariants];

  const add = (value) => {
    if (value && !variants.includes(value)) variants.push(value);
  };

  const wantsPs5 = q.includes("ps5") || q.includes("playstation 5") || q.includes("playstation5");
  const wantsDigital = q.includes("digital");
  const wantsDisc =
    q.includes("disc") ||
    q.includes("disk") ||
    q.includes("standard");
  const wantsSeriesX = q.includes("xbox series x") || q.includes("series x");
  const wantsSeriesS = q.includes("xbox series s") || q.includes("series s");
  const wantsSwitchOled = q.includes("switch oled") || q.includes("nintendo switch oled");
  const wantsSwitchLite = q.includes("switch lite");
  const wantsSwitch =
    q.includes("nintendo switch") || q.includes("switch");

  if (wantsPs5) {
    if (wantsDigital) {
      add("ps5 digital");
      add("playstation 5 digital");
      add("ps5 digital console");
      add("digital edition");
      add("ps5 digital bundle");
      add("ps5 digital with games");
      add("ps5");
      add("playstation 5");
    } else if (wantsDisc) {
      add("ps5 disc");
      add("ps5 disk");
      add("playstation 5 disc");
      add("playstation 5 disk");
      add("ps5 standard");
      add("playstation 5 standard");
      add("disc edition");
      add("disk edition");
      add("standard edition");
      add("ps5 console");
      add("ps5");
      add("playstation 5");
      add("playstation 5 console");
      add("ps5 disc bundle");
      add("ps5 disc with games");
      add("ps5 with controller");
    } else {
      add("ps5");
      add("playstation 5");
      add("ps5 console");
      add("playstation 5 console");
    }
  }

  if (wantsSeriesX) {
    add("xbox series x");
    add("series x");
  }

  if (wantsSeriesS) {
    add("xbox series s");
    add("series s");
  }

  if (wantsSwitchOled) {
    add("switch oled");
    add("nintendo switch oled");
  } else if (wantsSwitchLite) {
    add("switch lite");
    add("nintendo switch lite");
  } else if (wantsSwitch) {
    add("nintendo switch");
    add("switch console");
  }

  return [...new Set(variants.filter(Boolean))];
}

function buildSearchVariants(query) {
  const q = normalizeText(query);
  const variants = [String(query).trim()];

  if (q.includes("dyson")) {
    return buildDysonSearchVariants(query);
  }

  if (
    q.includes("ps5 disc") ||
    q.includes("ps5 disk") ||
    q.includes("playstation 5 disc") ||
    q.includes("playstation 5 disk")
  ) {
    variants.push("ps5 disc");
    variants.push("ps5 disk");
    variants.push("playstation 5 disc");
    variants.push("playstation 5 disk");
    variants.push("ps5 standard");
    variants.push("standard edition");
    variants.push("disc edition");
    variants.push("ps5 console");
    variants.push("playstation 5");
    variants.push("ps5");
  } else if (q.includes("ps5 digital") || q.includes("playstation 5 digital")) {
    variants.push("playstation 5 digital");
    variants.push("ps5 digital");
    variants.push("digital edition");
    variants.push("playstation 5");
    variants.push("ps5");
  } else if (q.includes("ps5") || q.includes("playstation 5")) {
    variants.push("playstation 5");
    variants.push("ps5");
    variants.push("ps5 console");
  }

  if (q.includes("xbox series x")) {
    variants.push("xbox series x");
    variants.push("series x");
  }

  if (q.includes("xbox series s")) {
    variants.push("xbox series s");
    variants.push("series s");
  }

  if (q.includes("canon eos")) {
    variants.push(String(query).trim());
  }

  const deduped = [...new Set(variants.filter(Boolean))];

  if (isConsoleBundleIntent(q) || q.includes("ps5") || q.includes("playstation 5")) {
    return buildConsoleBundleVariants(query, deduped);
  }

  return deduped;
}

function isConsoleCategory(item) {
  const categories = Array.isArray(item?.categories) ? item.categories : [];
  const categoryText = normalizeText(
    categories.map((c) => c?.categoryName).filter(Boolean).join(" ")
  );

  return hasAny(categoryText, [
    "video game consoles",
    "video games consoles",
    "consoles",
  ]);
}

function titleLooksLikeBundle(text) {
  const t = normalizeText(text);

  return hasAny(t, [
    "bundle",
    "with games",
    "with game",
    "games included",
    "game included",
    "2 controllers",
    "two controllers",
    "extra controller",
    "second controller",
    "spare controller",
    "comes with",
    "includes",
    "plus games",
    "inc games",
    "includes games",
    "job lot",
    "with extras",
    "extras included",
  ]);
}

function isAccessoryStyleTitle(text) {
  const t = normalizeText(text);

  const hasConsoleWords =
    t.includes("ps5") ||
    t.includes("playstation 5") ||
    t.includes("xbox series x") ||
    t.includes("xbox series s") ||
    t.includes("switch") ||
    t.includes("console");

  const explicitAccessoryOnly = hasAny(t, [
    "controller only",
    "dualsense only",
    "dualshock only",
    "joy con only",
    "joy-con only",
    "headset only",
    "dock only",
    "charger only",
    "power cable only",
    "cable only",
    "stand only",
    "faceplate",
    "shell only",
    "cover only",
    "skin only",
    "remote only",
    "disc drive only",
    "empty box",
    "box only",
  ]);

  if (explicitAccessoryOnly) return true;

  if (
    t.includes("controller") &&
    !hasConsoleWords
  ) {
    return true;
  }

  return false;
}

function filterConsoleBundleIntent(query, items = []) {
  const q = normalizeText(query);

  if (!isConsoleBundleIntent(q)) {
    return items;
  }

  const filtered = items.filter((item) => {
    const titleText = normalizeText(item?.title || "");
    const consoleCategory = isConsoleCategory(item);
    const bundleish = titleLooksLikeBundle(titleText);

    if (isAccessoryStyleTitle(titleText)) return false;
    if (!consoleCategory) return false;

    return bundleish;
  });

  return filtered.length ? filtered : items;
}

function isConsoleDiscDigitalSearch(text) {
  const q = normalizeText(text);
  return (
    q.includes("ps5 disc") ||
    q.includes("ps5 disk") ||
    q.includes("playstation 5 disc") ||
    q.includes("playstation 5 disk") ||
    q.includes("ps5 digital") ||
    q.includes("playstation 5 digital")
  );
}

async function searchWithFallbacks({
  query,
  maxPrice,
  condition,
  freeShippingOnly = false,
  limit = 20,
  fixedPriceOnly = true,
  allowConditionFallback = true,
}) {
  const variants = buildSearchVariants(query);
  const searchText = normalizeText(query);
  let combined = [];

  const shouldSearchAllVariants =
    isConsoleDiscDigitalSearch(searchText) ||
    searchText.includes("ps5") ||
    searchText.includes("playstation 5");

  for (let i = 0; i < variants.length; i += 1) {
    const variant = variants[i];

    const results = await browseSearch({
      query: variant,
      maxPrice,
      condition,
      freeShippingOnly,
      limit,
      fixedPriceOnly,
    });

    combined = uniqueByItemId([...combined, ...results]);

    if (!shouldSearchAllVariants && combined.length >= limit * 3) {
      break;
    }

    if (shouldSearchAllVariants && i >= 5 && combined.length >= limit * 2) {
      break;
    }
  }

  if (searchText.includes("dyson")) {
    combined = combined.filter((item) => matchesDysonVariantForEbay(searchText, item));

    if (isDysonMainUnitQuery(searchText)) {
      combined = combined
        .map((item) => ({
          item,
          score: scoreMainUnitCandidate(searchText, item),
        }))
        .filter((entry) => entry.score > 0)
        .sort((a, b) => b.score - a.score || (a.item.totalBuyPrice - b.item.totalBuyPrice))
        .map((entry) => entry.item);
    }
  }

  combined = filterConsoleBundleIntent(searchText, combined);
  combined = uniqueByItemId(combined);

  if (combined.length >= limit) {
    return combined.slice(0, limit);
  }

  if (combined.length > 0 && !allowConditionFallback) {
    return combined.slice(0, limit);
  }

  if (allowConditionFallback && condition) {
    let fallbackCombined = [...combined];

    for (let i = 0; i < variants.length; i += 1) {
      const variant = variants[i];

      const results = await browseSearch({
        query: variant,
        maxPrice,
        condition: "",
        freeShippingOnly,
        limit,
        fixedPriceOnly,
      });

      fallbackCombined = uniqueByItemId([...fallbackCombined, ...results]);

      if (!shouldSearchAllVariants && fallbackCombined.length >= limit * 3) {
        break;
      }

      if (shouldSearchAllVariants && i >= 5 && fallbackCombined.length >= limit * 2) {
        break;
      }
    }

    if (searchText.includes("dyson")) {
      fallbackCombined = fallbackCombined.filter((item) =>
        matchesDysonVariantForEbay(searchText, item)
      );

      if (isDysonMainUnitQuery(searchText)) {
        fallbackCombined = fallbackCombined
          .map((item) => ({
            item,
            score: scoreMainUnitCandidate(searchText, item),
          }))
          .filter((entry) => entry.score > 0)
          .sort((a, b) => b.score - a.score || (a.item.totalBuyPrice - b.item.totalBuyPrice))
          .map((entry) => entry.item);
      }
    }

    fallbackCombined = filterConsoleBundleIntent(searchText, fallbackCombined);
    fallbackCombined = uniqueByItemId(fallbackCombined);

    if (fallbackCombined.length > 0) {
      return fallbackCombined.slice(0, limit);
    }
  }

  return combined.slice(0, limit);
}

export async function searchEbayListings({
  query,
  maxPrice,
  condition,
  freeShippingOnly = false,
  limit = 20,
}) {
  return searchWithFallbacks({
    query,
    maxPrice,
    condition,
    freeShippingOnly,
    limit,
    fixedPriceOnly: true,
    allowConditionFallback: true,
  });
}

export async function searchEbayMarketPool({
  query,
  condition = "",
  limit = 50,
}) {
  return searchWithFallbacks({
    query,
    condition,
    limit: Math.min(Math.max(Number(limit) || 30, 1), 50),
    freeShippingOnly: false,
    fixedPriceOnly: true,
    allowConditionFallback: true,
  });
}
