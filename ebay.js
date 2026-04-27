const EBAY_TOKEN_URL = "https://api.ebay.com/identity/v1/oauth2/token";
const EBAY_BROWSE_URL = "https://api.ebay.com/buy/browse/v1/item_summary/search";
const EBAY_SCOPE = "https://api.ebay.com/oauth/api_scope";

const EBAY_REQUEST_TIMEOUT_MS = Number(process.env.EBAY_REQUEST_TIMEOUT_MS || 8000);
const EBAY_TOKEN_TIMEOUT_MS = Number(process.env.EBAY_TOKEN_TIMEOUT_MS || 8000);

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

/* =========================
   🔥 NEW: AUDIO VARIANTS
========================= */
function buildAudioSearchVariants(query) {
  const q = normalizeText(query);
  const variants = [String(query).trim()];

  const add = (v) => {
    if (v && !variants.includes(v)) variants.push(v);
  };

  // AirPods
  if (q.includes("airpods")) {
    add("apple airpods");
    add("airpods earbuds");
    add("apple airpods wireless earbuds");

    if (q.includes("pro")) {
      add("airpods pro");
      add("apple airpods pro");
      add("airpods pro earbuds");
      add("airpods pro wireless earbuds");
    }
  }

  // Samsung Buds
  if (q.includes("galaxy buds") || q.includes("samsung buds")) {
    add("samsung galaxy buds");
    add("galaxy buds earbuds");
    add("samsung earbuds");
  }

  // Sony WF (earbuds)
  if (q.includes("sony wf") || q.includes("wf-1000xm") || q.includes("wf1000xm")) {
    add("sony wf 1000xm4");
    add("sony wf 1000xm5");
    add("sony wireless earbuds");
  }

  // Sony WH (headphones)
  if (q.includes("sony wh") || q.includes("wh-1000xm") || q.includes("wh1000xm")) {
    add("sony wh 1000xm4");
    add("sony wh 1000xm5");
    add("sony headphones");
  }

  // Bose QC
  if (q.includes("bose") || q.includes("qc")) {
    add("bose quietcomfort");
    add("bose qc35");
    add("bose qc45");
    add("bose headphones");
  }

  return [...new Set(variants)];
}

/* =========================
   EXISTING CODE CONTINUES
========================= */

function createAbortSignal(timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error("Request timeout")), timeoutMs);
  return {
    signal: controller.signal,
    clear: () => clearTimeout(timer),
  };
}

async function safeReadJson(res) {
  const text = await res.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

async function fetchJsonWithTimeout(url, options = {}, timeoutMs = 8000) {
  const { signal, clear } = createAbortSignal(timeoutMs);

  try {
    const res = await fetch(url, { ...options, signal });
    const data = await safeReadJson(res);
    return { res, data };
  } catch (err) {
    if (err?.name === "AbortError") {
      throw new Error(`Request timed out after ${timeoutMs}ms`);
    }
    throw err;
  } finally {
    clear();
  }
}

/* =========================
   🔥 MODIFIED: buildSearchVariants ONLY
========================= */

function buildSearchVariants(query) {
  const q = normalizeText(query);

  // 🔥 AUDIO FIRST (SAFE + ISOLATED)
  if (
    q.includes("airpods") ||
    q.includes("buds") ||
    q.includes("earbuds") ||
    q.includes("headphones") ||
    q.includes("sony wf") ||
    q.includes("sony wh") ||
    q.includes("bose") ||
    q.includes("qc")
  ) {
    return buildAudioSearchVariants(query);
  }

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
    variants.push("ps5 disc", "ps5 disk", "playstation 5 disc", "playstation 5 disk");
    variants.push("ps5 standard", "standard edition", "disc edition", "ps5 console");
    variants.push("playstation 5", "ps5");
  } else if (q.includes("ps5 digital") || q.includes("playstation 5 digital")) {
    variants.push("playstation 5 digital", "ps5 digital", "digital edition");
    variants.push("playstation 5", "ps5");
  } else if (q.includes("ps5") || q.includes("playstation 5")) {
    variants.push("playstation 5", "ps5", "ps5 console");
  }

  if (q.includes("xbox series x")) {
    variants.push("xbox series x", "series x");
  }

  if (q.includes("xbox series s")) {
    variants.push("xbox series s", "series s");
  }

  return [...new Set(variants.filter(Boolean))];
}

/* =========================
   REST OF FILE UNCHANGED
========================= */

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
