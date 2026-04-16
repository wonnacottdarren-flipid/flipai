import fetch from "node-fetch";

const EBAY_APP_ID = process.env.EBAY_APP_ID;

// =========================
// HELPERS
// =========================

function parsePrice(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function calculateFees(price) {
  // eBay UK approx 12.8% + £0.30
  return price * 0.128 + 0.3;
}

// =========================
// COMPS ENGINE (UPGRADED)
// =========================

function removeOutliers(prices) {
  if (prices.length < 5) return prices;

  const sorted = [...prices].sort((a, b) => a - b);

  const q1 = sorted[Math.floor(sorted.length * 0.25)];
  const q3 = sorted[Math.floor(sorted.length * 0.75)];
  const iqr = q3 - q1;

  const lower = q1 - 1.5 * iqr;
  const upper = q3 + 1.5 * iqr;

  return sorted.filter(p => p >= lower && p <= upper);
}

function getMedian(arr) {
  const sorted = [...arr].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

function estimateResale(price) {
  // Simple fallback estimate if no real comps
  return price * 1.35;
}

// =========================
// SCORING ENGINE
// =========================

function scoreDeal({ profit, cost }) {
  if (profit <= 0) return 20;
  if (profit > 40) return 90;
  if (profit > 25) return 75;
  if (profit > 10) return 60;
  return 40;
}

function getVerdict(profit) {
  if (profit > 25) return "GOOD";
  if (profit > 5) return "MARGINAL";
  return "SKIP";
}

function getRisk(profit) {
  if (profit > 25) return "Low";
  if (profit > 5) return "Medium";
  return "High";
}

// =========================
// MAIN SEARCH FUNCTION
// =========================

export async function searchEbay({
  query,
  condition,
  filterPriceMax,
  limit = 8,
  freeShippingOnly = false
}) {
  if (!EBAY_APP_ID) {
    throw new Error("Missing EBAY_APP_ID");
  }

  const url = `https://svcs.ebay.com/services/search/FindingService/v1
    ?OPERATION-NAME=findItemsByKeywords
    &SERVICE-VERSION=1.0.0
    &SECURITY-APPNAME=${EBAY_APP_ID}
    &RESPONSE-DATA-FORMAT=JSON
    &REST-PAYLOAD
    &keywords=${encodeURIComponent(query)}
    &paginationInput.entriesPerPage=${limit}
    &itemFilter(0).name=MaxPrice
    &itemFilter(0).value=${filterPriceMax || 1000}
    &itemFilter(1).name=Condition
    &itemFilter(1).value=${condition || "Used"}
  `.replace(/\s+/g, "");

  const res = await fetch(url);
  const data = await res.json();

  const items =
    data?.findItemsByKeywordsResponse?.[0]?.searchResult?.[0]?.item || [];

  const processed = items.map((item) => {
    const price = parsePrice(item?.sellingStatus?.[0]?.currentPrice?.[0]?.__value__);
    const shipping = parsePrice(
      item?.shippingInfo?.[0]?.shippingServiceCost?.[0]?.__value__
    );

    if (freeShippingOnly && shipping > 0) return null;

    const totalBuy = price + shipping;

    // =========================
    // COMPS ESTIMATE
    // =========================
    const estimatedResale = estimateResale(price);

    const fees = calculateFees(estimatedResale);
    const profit = estimatedResale - fees - totalBuy;

    const score = scoreDeal({ profit, cost: totalBuy });
    const verdict = getVerdict(profit);
    const risk = getRisk(profit);

    return {
      title: item.title?.[0] || "No title",
      price,
      shipping,
      itemWebUrl: item.viewItemURL?.[0] || "",
      condition: item.condition?.[0]?.conditionDisplayName?.[0] || "",

      scanner: {
        estimatedResale,
        estimatedProfit: profit,
        totalBuyPrice: totalBuy,
        ebayFees: fees,
        score,
        risk,
        verdict,
        repairCost: 0
      }
    };
  });

  // remove nulls (filtered items)
  const clean = processed.filter(Boolean);

  // mark best deal
  const best = [...clean].sort(
    (a, b) => b.scanner.estimatedProfit - a.scanner.estimatedProfit
  )[0];

  const final = clean.map((item) => ({
    ...item,
    bestDeal: item === best
  }));

  return {
    items: final
  };
}
