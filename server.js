import "dotenv/config";
import express from "express";
import path from "path";
import cors from "cors";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import { fileURLToPath } from "url";

import {
  getUserById,
  safeUser,
} from "./db.js";

import {
  loginHandler,
  logoutHandler,
  signupHandler,
} from "./auth.js";

import {
  createCheckoutSession,
  createPortalSession,
  stripeWebhookHandler,
} from "./stripe.js";

import { runAnalysis } from "./openai.js";
import { searchEbayListings, searchEbayMarketPool } from "./ebay.js";
import * as engineRegistry from "./engines/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;
const appUrl = process.env.APP_URL || `http://localhost:${port}`;
const JWT_SECRET = process.env.JWT_SECRET || "change_me";

const EBAY_AFFILIATE_ENABLED =
  String(process.env.EBAY_AFFILIATE_ENABLED || "").trim().toLowerCase() === "true";
const EBAY_CAMPAIGN_ID = String(process.env.EBAY_CAMPAIGN_ID || "").trim();

app.use(cors({ origin: appUrl, credentials: true }));
app.use(cookieParser());
app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

function normalizeText(value) {
  return String(value || "").toLowerCase().trim();
}

function roundMoney(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function median(values) {
  const nums = values
    .map((v) => Number(v || 0))
    .filter((v) => Number.isFinite(v) && v > 0)
    .sort((a, b) => a - b);

  if (!nums.length) return 0;

  const mid = Math.floor(nums.length / 2);
  return nums.length % 2 === 0
    ? roundMoney((nums[mid - 1] + nums[mid]) / 2)
    : roundMoney(nums[mid]);
}

function average(values) {
  const nums = values
    .map((v) => Number(v || 0))
    .filter((v) => Number.isFinite(v) && v > 0);

  if (!nums.length) return 0;
  return roundMoney(nums.reduce((sum, v) => sum + v, 0) / nums.length);
}

function percentile(values, p) {
  const nums = values
    .map((v) => Number(v || 0))
    .filter((v) => Number.isFinite(v) && v > 0)
    .sort((a, b) => a - b);

  if (!nums.length) return 0;
  if (nums.length === 1) return roundMoney(nums[0]);

  const index = (nums.length - 1) * p;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);

  if (lower === upper) return roundMoney(nums[lower]);

  const weight = index - lower;
  return roundMoney(nums[lower] * (1 - weight) + nums[upper] * weight);
}

function removePriceOutliers(values = []) {
  const nums = values
    .map((v) => Number(v || 0))
    .filter((v) => Number.isFinite(v) && v > 0)
    .sort((a, b) => a - b);

  if (nums.length <= 4) return nums;

  const q1 = percentile(nums, 0.25);
  const q3 = percentile(nums, 0.75);
  const iqr = q3 - q1;

  if (!Number.isFinite(iqr) || iqr <= 0) return nums;

  const lower = q1 - iqr * 1.5;
  const upper = q3 + iqr * 1.5;

  const filtered = nums.filter((v) => v >= lower && v <= upper);
  return filtered.length >= Math.max(3, Math.floor(nums.length * 0.5))
    ? filtered
    : nums;
}

function extractNumericPrice(item) {
  return roundMoney(
    Number(
      item?.price?.value ??
        item?.currentPrice?.value ??
        item?.sellingStatus?.currentPrice?.value ??
        item?.price ??
        0
    ) || 0
  );
}

function extractNumericShipping(item) {
  return roundMoney(
    Number(
      item?.shippingOptions?.[0]?.shippingCost?.value ??
        item?.shippingCost?.value ??
        item?.shipping ??
        0
    ) || 0
  );
}

function extractItemTitle(item) {
  return String(item?.title || item?.name || item?.product || "").trim();
}

function extractTotalPrice(item) {
  return roundMoney(extractNumericPrice(item) + extractNumericShipping(item));
}

function extractItemUrl(item) {
  return String(
    item?.originalUrl ||
      item?.itemWebUrl ||
      item?.viewItemURL ||
      item?.url ||
      item?.link ||
      ""
  ).trim();
}

function buildAffiliateUrl(rawUrl) {
  const cleanUrl = String(rawUrl || "").trim();
  if (!cleanUrl) return "";
  return cleanUrl;
}

function decorateItemWithAffiliate(item = {}) {
  const originalUrl = extractItemUrl(item);
  const affiliateUrl = buildAffiliateUrl(originalUrl);

  return {
    ...item,
    originalUrl,
    affiliateUrl,
    url: originalUrl,
  };
}

function itemMatchesCondition(item, conditionText) {
  const wanted = normalizeText(conditionText).trim();
  if (!wanted) return true;

  const haystack = normalizeText(
    [
      item?.condition,
      item?.conditionDisplayName,
      item?.itemCondition,
      item?.subtitle,
      item?.title,
    ]
      .filter(Boolean)
      .join(" ")
  );

  return haystack.includes(wanted);
}

function itemMatchesPrice(item, filterPriceMax) {
  const max = Number(filterPriceMax || 0);
  if (!max || max <= 0) return true;

  const total = extractNumericPrice(item) + extractNumericShipping(item);
  return total <= max;
}

function itemMatchesFreeShipping(item, freeShippingOnly) {
  if (!freeShippingOnly) return true;
  return extractNumericShipping(item) <= 0;
}

function buildAutoCompsFromItems(items = []) {
  const prices = items
    .map((item) => extractNumericPrice(item))
    .filter((v) => Number.isFinite(v) && v > 0);

  const cleanedPrices = removePriceOutliers(prices);

  const compCount = cleanedPrices.length;
  const avgSoldPrice = average(cleanedPrices);
  const medianSoldPrice = median(cleanedPrices);
  const minSoldPrice = compCount ? roundMoney(Math.min(...cleanedPrices)) : 0;
  const maxSoldPrice = compCount ? roundMoney(Math.max(...cleanedPrices)) : 0;

  let confidence = 18;
  if (compCount >= 3) confidence = 44;
  if (compCount >= 5) confidence = 58;
  if (compCount >= 8) confidence = 72;
  if (compCount >= 12) confidence = 82;
  if (compCount >= 16) confidence = 88;

  let confidenceLabel = "Low";
  if (confidence >= 80) confidenceLabel = "High";
  else if (confidence >= 55) confidenceLabel = "Medium";

  return {
    pricingMode: "Auto comps estimate",
    compCount,
    confidence,
    confidenceLabel,
    avgSoldPrice,
    medianSoldPrice,
    minSoldPrice,
    maxSoldPrice,
    samplePrices: cleanedPrices.slice(0, 12),
    manualSoldPricesText: cleanedPrices.join(", "),
  };
}

function buildBestOfferGuidance(item, scanner) {
  const hasBestOffer =
    Array.isArray(item?.buyingOptions) &&
    item.buyingOptions.includes("BEST_OFFER");

  if (!hasBestOffer) return null;

  const askPrice = Number(scanner?.totalBuyPrice || 0);
  const resale = Number(scanner?.estimatedResale || 0);
  const repairCost = Number(scanner?.repairCost || 0);

  if (!askPrice || !resale) return null;

  const suggestedOffer = roundMoney(Math.min(askPrice * 0.9, askPrice));
  const aggressiveOffer = roundMoney(Math.min(askPrice * 0.82, askPrice));

  let maxSafeOffer = roundMoney(resale * 0.7);
  if (maxSafeOffer > askPrice) {
    maxSafeOffer = askPrice;
  }

  function calcProfit(offer) {
    const fees = roundMoney(resale * 0.15);
    return roundMoney(resale - fees - offer - repairCost);
  }

  return {
    hasBestOffer: true,
    askPrice,
    suggestedOffer,
    aggressiveOffer,
    maxSafeOffer,
    profitAtSuggested: calcProfit(suggestedOffer),
    profitAtAggressive: calcProfit(aggressiveOffer),
    profitAtMaxSafe: calcProfit(maxSafeOffer),
  };
}

function getUserFromCookie(req) {
  try {
    const token = req.cookies?.flipai_token;
    if (!token) return null;
    const decoded = jwt.verify(token, JWT_SECRET);
    return getUserById(decoded.userId);
  } catch {
    return null;
  }
}

function createGenericPricingModel(items = []) {
  const totals = removePriceOutliers(
    (Array.isArray(items) ? items : [])
      .map((item) => extractTotalPrice(item))
      .filter((v) => Number.isFinite(v) && v > 0)
  );

  const marketMedian = median(totals);
  const marketLow = percentile(totals, 0.35);

  let baseline = marketMedian || marketLow || 0;
  const estimatedResale = roundMoney(baseline * 0.95);

  const compCount = totals.length;
  let confidence = 16;
  if (compCount >= 3) confidence = 42;
  if (compCount >= 5) confidence = 56;
  if (compCount >= 8) confidence = 70;
  if (compCount >= 12) confidence = 82;

  confidence = Math.min(90, confidence);

  let confidenceLabel = "Low";
  if (confidence >= 80) confidenceLabel = "High";
  else if (confidence >= 55) confidenceLabel = "Medium";

  return {
    estimatedResale,
    compCount,
    confidence,
    confidenceLabel,
    pricingMode: "Generic market median",
    marketMedian,
    marketLow,
    listingMedian: 0,
  };
}

function resolveEngineForQuery(query) {
  try {
    if (typeof engineRegistry.detectEngineForQuery === "function") {
      return engineRegistry.detectEngineForQuery(query);
    }

    if (typeof engineRegistry.getEngineForQuery === "function") {
      return engineRegistry.getEngineForQuery(query);
    }

    if (typeof engineRegistry.detectEngine === "function") {
      return engineRegistry.detectEngine(query);
    }

    if (
      engineRegistry.default &&
      typeof engineRegistry.default.detectEngineForQuery === "function"
    ) {
      return engineRegistry.default.detectEngineForQuery(query);
    }

    if (
      engineRegistry.default &&
      typeof engineRegistry.default.getEngineForQuery === "function"
    ) {
      return engineRegistry.default.getEngineForQuery(query);
    }

    if (
      engineRegistry.default &&
      typeof engineRegistry.default.detectEngine === "function"
    ) {
      return engineRegistry.default.detectEngine(query);
    }

    const possibleEngines = Object.values(engineRegistry).filter(
      (value) =>
        value &&
        typeof value === "object" &&
        typeof value.detect === "function"
    );

    for (const engine of possibleEngines) {
      try {
        if (engine.detect(query)) {
          return engine;
        }
      } catch {
        // ignore engine errors and keep checking
      }
    }

    return null;
  } catch {
    return null;
  }
}

function getEngineSearchQuery(engine, rawQuery) {
  const query = String(rawQuery || "").trim();

  if (!engine) return query;

  if (typeof engine.buildSearchQuery === "function") {
    const built = String(engine.buildSearchQuery(query) || "").trim();
    if (built) return built;
  }

  if (typeof engine.expandSearchVariants === "function") {
    const variants = engine.expandSearchVariants(query);
    if (Array.isArray(variants) && variants.length > 0) {
      const first = String(variants[0] || "").trim();
      if (first) return first;
    }
  }

  return query;
}

function getEngineSearchVariants(engine, rawQuery) {
  const query = String(rawQuery || "").trim();

  if (!engine) return [query].filter(Boolean);

  if (typeof engine.expandSearchVariants === "function") {
    const variants = engine.expandSearchVariants(query);
    if (Array.isArray(variants) && variants.length) {
      return [...new Set(variants.map((v) => String(v || "").trim()).filter(Boolean))];
    }
  }

  const single = getEngineSearchQuery(engine, query);
  return [single].filter(Boolean);
}

function dedupeItems(items = []) {
  const seen = new Set();
  const out = [];

  for (const item of Array.isArray(items) ? items : []) {
    const key =
      item?.itemId ||
      item?.legacyItemId ||
      item?.originalUrl ||
      item?.itemWebUrl ||
      item?.viewItemURL ||
      item?.link ||
      `${extractItemTitle(item)}::${extractTotalPrice(item)}`;

    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }

  return out;
}

function limitVariantsForFindDeals(variants = [], query = "") {
  const clean = Array.isArray(variants)
    ? [...new Set(variants.map((v) => String(v || "").trim()).filter(Boolean))]
    : [];

  const normalizedQuery = normalizeText(query);

  if (!clean.length) return [];

  if (normalizedQuery.includes("dyson") && normalizedQuery.includes("main unit")) {
    return clean.slice(0, 4);
  }

  if (normalizedQuery.includes("dyson") && normalizedQuery.includes("main body")) {
    return clean.slice(0, 4);
  }

  if (
    normalizedQuery.includes("ps5") ||
    normalizedQuery.includes("playstation 5") ||
    normalizedQuery.includes("xbox") ||
    normalizedQuery.includes("switch")
  ) {
    return clean.slice(0, 5);
  }

  return clean.slice(0, 4);
}

async function fetchListingsAcrossVariants({
  engine,
  query,
  condition = "",
  filterPriceMax = 0,
  freeShippingOnly = false,
  limit = 30,
  maxVariants = null,
}) {
  let variants = getEngineSearchVariants(engine, query);

  if (Number.isFinite(maxVariants) && maxVariants > 0) {
    variants = variants.slice(0, maxVariants);
  }

  const resultsPerVariant = Math.max(limit, 20);
  const cap = Math.max(limit * 2, 60);

  let merged = [];

  for (const variant of variants) {
    const items = await searchEbayListings({
      query: variant,
      maxPrice: filterPriceMax,
      condition,
      freeShippingOnly,
      limit: resultsPerVariant,
    }).catch(() => []);

    merged = dedupeItems([...merged, ...(Array.isArray(items) ? items : [])]);

    if (merged.length >= cap) {
      break;
    }
  }

  return {
    searchQuery: variants[0] || String(query || "").trim(),
    searchVariants: variants,
    items: merged.slice(0, cap),
  };
}

async function fetchMarketAcrossVariants({
  engine,
  query,
  condition = "",
  limit = 50,
  maxVariants = null,
}) {
  let variants = getEngineSearchVariants(engine, query);

  if (Number.isFinite(maxVariants) && maxVariants > 0) {
    variants = variants.slice(0, maxVariants);
  }

  const resultsPerVariant = Math.max(limit, 20);
  const cap = Math.max(limit * 2, 50);

  let merged = [];

  for (const variant of variants) {
    const items = await searchEbayMarketPool({
      query: variant,
      condition,
      limit: resultsPerVariant,
    }).catch(() => []);

    merged = dedupeItems([...merged, ...(Array.isArray(items) ? items : [])]);

    if (merged.length >= cap) {
      break;
    }
  }

  return {
    searchQuery: variants[0] || String(query || "").trim(),
    searchVariants: variants,
    items: merged.slice(0, cap),
  };
}

function getDealBucketPriority(label = "") {
  const normalized = String(label || "").toLowerCase();
  if (normalized.includes("buy")) return 3;
  if (normalized.includes("offer")) return 2;
  if (normalized.includes("tight")) return 1;
  return 0;
}

function getLowCompPenalty(compCount = 0) {
  const count = Number(compCount || 0);

  if (count >= 14) return 0;
  if (count >= 10) return 8;
  if (count >= 8) return 16;
  if (count >= 6) return 28;
  if (count >= 4) return 42;
  if (count >= 3) return 58;
  if (count >= 2) return 78;
  if (count >= 1) return 95;
  return 120;
}

function getConfidencePenalty(confidence = 0) {
  const value = Number(confidence || 0);

  if (value >= 80) return 0;
  if (value >= 70) return 5;
  if (value >= 55) return 12;
  if (value >= 45) return 22;
  return 36;
}

function getSwitchListingPenalty(queryContext = {}, item = {}, classifiedItem = {}, adjustedItem = {}) {
  const q = normalizeText(queryContext?.rawQuery || queryContext?.normalizedQuery || "");
  const title = normalizeText(item?.title || "");
  const rawText = normalizeText(
    [
      item?.title,
      item?.subtitle,
      item?.condition,
      item?.conditionDisplayName,
      item?.itemCondition,
      item?.shortDescription,
      item?.description,
    ]
      .filter(Boolean)
      .join(" ")
  );

  const isSwitchQuery = q.includes("switch");
  if (!isSwitchQuery) return 0;

  let penalty = 0;

  const bundleType =
    adjustedItem?.bundleType ||
    classifiedItem?.bundleType ||
    "";

  if (!title.includes("v2") && !title.includes("hac-001(-01)") && !title.includes("hac 001(-01)")) {
    penalty += 8;
  }

  if (
    rawText.includes("v1") ||
    rawText.includes("hac-001 ") ||
    rawText.includes("unpatched") ||
    rawText.includes("patched") ||
    rawText.includes("first generation") ||
    rawText.includes("gen 1")
  ) {
    penalty += 16;
  }

  if (
    rawText.includes("tablet only") ||
    rawText.includes("screen only") ||
    rawText.includes("main unit only") ||
    rawText.includes("console only") ||
    rawText.includes("no dock") ||
    rawText.includes("without dock") ||
    rawText.includes("missing dock") ||
    rawText.includes("dock not included") ||
    rawText.includes("no joy con") ||
    rawText.includes("no joy-cons") ||
    rawText.includes("no joy cons") ||
    rawText.includes("without joy con") ||
    rawText.includes("without joy-cons") ||
    rawText.includes("without joy cons") ||
    rawText.includes("missing joy con") ||
    rawText.includes("missing joy-cons") ||
    rawText.includes("missing joy cons") ||
    rawText.includes("joy cons not included") ||
    rawText.includes("joy-cons not included")
  ) {
    penalty += 100;
  }

  if (bundleType === "console_only") {
    penalty += 45;
  }

  return penalty;
}

function buildDealReasonBreakdown({
  title,
  pricingMode,
  confidence,
  confidenceLabel,
  compCount,
  marginPercent,
  undervaluedAmount,
  undervaluedPercent,
  estimatedProfit,
  estimatedResale,
  totalBuyPrice,
  ebayFees,
  risk,
  verdict,
  finderLabel,
  bundleValueBonus = 0,
  repairCost = 0,
  warningFlags = [],
  warningScorePenalty = 0,
  offerOpportunity = false,
  offerOpportunityType = "",
  offerProfit = 0,
  offerPrice = 0,
}) {
  const bullets = [];
  const label = String(finderLabel || "").toLowerCase();

  if (label.includes("buy")) {
    bullets.push(
      `Strong enough to consider at the current total cost, with about £${roundMoney(estimatedProfit).toFixed(2)} projected profit.`
    );
  } else if (label.includes("offer")) {
    bullets.push(
      "Better as an offer play than a straight buy. Try to improve the entry price before moving."
    );
  } else if (label.includes("tight")) {
    bullets.push(
      "Borderline setup. This only makes sense if condition checks and comps still hold up after review."
    );
  }

  bullets.push(
    `Total buy cost is about £${roundMoney(totalBuyPrice).toFixed(2)} against an estimated resale of £${roundMoney(estimatedResale).toFixed(2)}.`
  );

  if (compCount > 0) {
    bullets.push(
      `${Number(compCount || 0)} comp${Number(compCount || 0) === 1 ? "" : "s"} support this estimate using ${pricingMode || "market pricing"}.`
    );
  } else {
    bullets.push("Comp support is limited here, so this needs extra manual verification.");
  }

  if (undervaluedAmount > 0) {
    bullets.push(
      `Current price sits about £${roundMoney(undervaluedAmount).toFixed(2)} (${roundMoney(undervaluedPercent).toFixed(2)}%) below the modelled resale level.`
    );
  }

  if (bundleValueBonus > 0) {
    bullets.push(
      `Included extras added a bundle value boost of about £${roundMoney(bundleValueBonus).toFixed(2)}.`
    );
  }

  if (repairCost > 0) {
    bullets.push(
      `Repair or replacement allowance of £${roundMoney(repairCost).toFixed(2)} has already been factored in.`
    );
  }

  if (offerOpportunity) {
    bullets.push(
      `Best route is likely ${offerOpportunityType} around £${roundMoney(offerPrice).toFixed(2)}, with projected profit near £${roundMoney(offerProfit).toFixed(2)}.`
    );
  }

  if (marginPercent >= 25) {
    bullets.push("Margin profile looks strong for a flip candidate.");
  } else if (marginPercent >= 15) {
    bullets.push("Margin is workable if the item condition matches expectations.");
  } else {
    bullets.push("Margin is thinner here, so there is less room for mistakes.");
  }

  if (confidence >= 80) {
    bullets.push("Confidence is high because the matching comp pool looks stronger.");
  } else if (confidence >= 55) {
    bullets.push("Confidence is medium with decent comp support.");
  } else {
    bullets.push("Confidence is lower here, so manual checking matters more.");
  }

  if (warningFlags.length) {
    bullets.push(
      `${warningFlags.length} warning${warningFlags.length > 1 ? "s were" : " was"} detected, so ranking was reduced.`
    );
  }

  if (risk === "Low") {
    bullets.push("Risk is lower because the projected profit clears the buffer comfortably.");
  } else if (risk === "Medium") {
    bullets.push("Risk is moderate because the deal works, but without huge room for error.");
  } else {
    bullets.push("Risk is higher because the setup leaves less room for pricing or condition mistakes.");
  }

  return {
    pricingMode,
    confidence,
    confidenceLabel,
    compCount,
    marginPercent: roundMoney(marginPercent),
    undervaluedAmount: roundMoney(undervaluedAmount),
    undervaluedPercent: roundMoney(undervaluedPercent),
    estimatedProfit: roundMoney(estimatedProfit),
    estimatedResale: roundMoney(estimatedResale),
    totalBuyPrice: roundMoney(totalBuyPrice),
    ebayFees: roundMoney(ebayFees),
    repairCost: roundMoney(repairCost),
    bundleValueBonus: roundMoney(bundleValueBonus),
    warningFlags,
    warningScorePenalty,
    risk,
    verdict,
    finderLabel,
    offerOpportunity,
    offerOpportunityType,
    offerProfit: roundMoney(offerProfit),
    offerPrice: roundMoney(offerPrice),
    bullets,
    title: String(title || "").trim(),
  };
}

function buildReasonText({
  finderLabel,
  estimatedProfit,
  estimatedResale,
  totalBuyPrice,
  compCount,
  confidenceLabel,
  offerOpportunity = false,
  offerPrice = 0,
  offerProfit = 0,
}) {
  const label = String(finderLabel || "").toLowerCase();

  if (label.includes("buy")) {
    return `Looks strong enough to review as a buy now. Estimated resale is around £${roundMoney(estimatedResale).toFixed(2)} against about £${roundMoney(totalBuyPrice).toFixed(2)} total cost, leaving roughly £${roundMoney(estimatedProfit).toFixed(2)} projected profit.`;
  }

  if (label.includes("offer")) {
    return `Better as an offer play than a straight buy. Try targeting around £${roundMoney(offerPrice).toFixed(2)} where projected profit is about £${roundMoney(offerProfit).toFixed(2)}.`;
  }

  if (label.includes("tight")) {
    return "This is only a tight check. Profit is thinner here, so verify condition and comps before buying.";
  }

  if (offerOpportunity) {
    return `This only becomes interesting through negotiation, roughly around £${roundMoney(offerPrice).toFixed(2)} for about £${roundMoney(offerProfit).toFixed(2)} projected profit.`;
  }

  return `Estimated profit is about £${roundMoney(estimatedProfit).toFixed(2)} with ${Number(compCount || 0)} comps and ${confidenceLabel || "Low"} confidence.`;
}

function getTightClassificationThresholds(queryContext = {}) {
  const normalized = normalizeText(
    queryContext?.rawQuery || queryContext?.normalizedQuery || ""
  );

  const isPhone =
    normalized.includes("iphone") ||
    normalized.includes("samsung") ||
    normalized.includes("galaxy") ||
    normalized.includes("pixel");

  const isConsole =
    normalized.includes("ps5") ||
    normalized.includes("playstation 5") ||
    normalized.includes("xbox") ||
    normalized.includes("switch");

  const isAudio =
    normalized.includes("airpods") ||
    normalized.includes("earbuds") ||
    normalized.includes("earphones") ||
    normalized.includes("headphones") ||
    normalized.includes("galaxy buds") ||
    normalized.includes("sony wf") ||
    normalized.includes("sony wh") ||
    normalized.includes("wf-1000xm") ||
    normalized.includes("wh-1000xm") ||
    normalized.includes("xm3") ||
    normalized.includes("xm4") ||
    normalized.includes("xm5") ||
    normalized.includes("bose") ||
    normalized.includes("qc45") ||
    normalized.includes("qc 45") ||
    normalized.includes("qc35") ||
    normalized.includes("qc 35") ||
    normalized.includes("qc ultra");

  const isSonyWfXm4 =
    normalized.includes("sony wf-1000xm4") ||
    normalized.includes("sony wf 1000xm4") ||
    normalized.includes("wf-1000xm4") ||
    normalized.includes("wf1000xm4");

  if (isSonyWfXm4) {
    return {
      strongAskProfit: 16,
      strongAskMargin: 12,
      solidAskProfit: 11,
      solidAskMargin: 7,
      strongOfferProfit: 16,
      strongOfferMarginFloor: 6,
      tightAskProfit: 6,
      tightAskMargin: 3,
      tightOfferProfit: 10,
      minCompStrong: 5,
      minCompHealthy: 4,
      minCompTight: 2,
    };
  }

  if (isAudio) {
    return {
      strongAskProfit: 20,
      strongAskMargin: 13,
      solidAskProfit: 14,
      solidAskMargin: 8,
      strongOfferProfit: 18,
      strongOfferMarginFloor: 6,
      tightAskProfit: 7,
      tightAskMargin: 4,
      tightOfferProfit: 11,
      minCompStrong: 5,
      minCompHealthy: 4,
      minCompTight: 2,
    };
  }

  if (isPhone) {
    return {
      strongAskProfit: 32,
      strongAskMargin: 18,
      solidAskProfit: 24,
      solidAskMargin: 12,
      strongOfferProfit: 26,
      strongOfferMarginFloor: 8,
      tightAskProfit: 10,
      tightAskMargin: 6,
      tightOfferProfit: 16,
      minCompStrong: 6,
      minCompHealthy: 5,
      minCompTight: 3,
    };
  }

  if (isConsole) {
    return {
      strongAskProfit: 40,
      strongAskMargin: 18,
      solidAskProfit: 30,
      solidAskMargin: 12,
      strongOfferProfit: 26,
      strongOfferMarginFloor: 8,
      tightAskProfit: 12,
      tightAskMargin: 6,
      tightOfferProfit: 18,
      minCompStrong: 6,
      minCompHealthy: 5,
      minCompTight: 3,
    };
  }

  return {
    strongAskProfit: 34,
    strongAskMargin: 16,
    solidAskProfit: 26,
    solidAskMargin: 11,
    strongOfferProfit: 24,
    strongOfferMarginFloor: 8,
    tightAskProfit: 10,
    tightAskMargin: 5,
    tightOfferProfit: 16,
    minCompStrong: 5,
    minCompHealthy: 4,
    minCompTight: 2,
  };
}

function evaluateDeal({
  item,
  pricingModel,
  queryContext,
  engine,
}) {
  const title = extractItemTitle(item);
  const price = extractNumericPrice(item);
  const shipping = extractNumericShipping(item);
  const total = roundMoney(price + shipping);
  const originalUrl = extractItemUrl(item);
  const affiliateUrl = buildAffiliateUrl(originalUrl);

  const classified =
    engine && typeof engine.classifyItem === "function"
      ? engine.classifyItem(item, queryContext)
      : {};

  const repairCost = roundMoney(classified?.repairCost || 0);

  const adjusted =
    engine && typeof engine.adjustListingPricing === "function"
      ? engine.adjustListingPricing({
          queryContext,
          item,
          pricingModel,
          classifiedItem: classified,
        })
      : {
          estimatedResale: roundMoney(pricingModel?.estimatedResale || 0),
          bundleValueBonus: 0,
          warningFlags: [],
          warningScorePenalty: 0,
          bundleSignals: classified?.bundleSignals || {},
          bundleType: classified?.bundleType || "standard",
        };

  const estimatedResale = roundMoney(
    adjusted?.estimatedResale ?? pricingModel?.estimatedResale ?? 0
  );

  const ebayFees = roundMoney(estimatedResale * 0.15);
  const estimatedProfit = roundMoney(
    estimatedResale - ebayFees - total - repairCost
  );
  const marginPercent =
    total > 0 ? roundMoney((estimatedProfit / total) * 100) : 0;

  const bestOffer = buildBestOfferGuidance(item, {
    totalBuyPrice: total,
    estimatedResale,
    repairCost,
  });

  let offerOpportunity = false;
  let offerOpportunityType = "";
  let offerPrice = 0;
  let offerProfit = 0;

  if (bestOffer?.hasBestOffer) {
    const suggestedProfit = Number(bestOffer?.profitAtSuggested || 0);
    const aggressiveProfit = Number(bestOffer?.profitAtAggressive || 0);
    const maxSafeProfit = Number(bestOffer?.profitAtMaxSafe || 0);

    if (suggestedProfit >= 18) {
      offerOpportunity = true;
      offerOpportunityType = "suggested offer";
      offerPrice = Number(bestOffer.suggestedOffer || 0);
      offerProfit = suggestedProfit;
    } else if (aggressiveProfit >= 18) {
      offerOpportunity = true;
      offerOpportunityType = "aggressive offer";
      offerPrice = Number(bestOffer.aggressiveOffer || 0);
      offerProfit = aggressiveProfit;
    } else if (maxSafeProfit >= 18) {
      offerOpportunity = true;
      offerOpportunityType = "max safe offer";
      offerPrice = Number(bestOffer.maxSafeOffer || 0);
      offerProfit = maxSafeProfit;
    }
  }

  const warningFlags = Array.isArray(adjusted?.warningFlags)
    ? adjusted.warningFlags
    : Array.isArray(classified?.warningFlags)
      ? classified.warningFlags
      : [];

  const baseWarningPenalty = Number(
    adjusted?.warningScorePenalty ??
      classified?.warningScorePenalty ??
      0
  ) || 0;

  const compCount = Number(pricingModel?.compCount || 0);
  const confidence = Number(pricingModel?.confidence || 0);
  const confidenceLabel = pricingModel?.confidenceLabel || "Low";

  const undervaluedAmount = roundMoney(Math.max(0, estimatedResale - total));
  const undervaluedPercent =
    total > 0 ? roundMoney((undervaluedAmount / total) * 100) : 0;

  const thresholds = getTightClassificationThresholds(queryContext);

  const askIsHealthy =
    estimatedProfit >= thresholds.solidAskProfit &&
    marginPercent >= thresholds.solidAskMargin;

  const askIsStrong =
    estimatedProfit >= thresholds.strongAskProfit &&
    marginPercent >= thresholds.strongAskMargin;

  const askIsBorderline =
    estimatedProfit >= thresholds.tightAskProfit &&
    marginPercent >= thresholds.tightAskMargin;

  const offerBeatsAskClearly =
    offerOpportunity &&
    offerProfit >= estimatedProfit + 10;

  const offerIsStrong =
    offerOpportunity &&
    offerProfit >= thresholds.strongOfferProfit &&
    marginPercent >= thresholds.strongOfferMarginFloor;

  const offerIsBorderline =
    offerOpportunity &&
    offerProfit >= thresholds.tightOfferProfit;

  const dataSupportStrong =
    compCount >= thresholds.minCompStrong && confidence >= 70;

  const dataSupportHealthy =
    compCount >= thresholds.minCompHealthy && confidence >= 58;

  const dataSupportTight =
    compCount >= thresholds.minCompTight || confidence >= 45;

  const warningsAreLight = warningFlags.length <= 1;
  const warningsAreAcceptable = warningFlags.length <= 2;

  let finderLabel = "Skip";
  let verdict = "SKIP";
  let risk = "High";

  if (
    askIsStrong &&
    warningsAreLight &&
    dataSupportStrong
  ) {
    finderLabel = "Buy";
    verdict = "BUY NOW";
    risk = estimatedProfit >= thresholds.strongAskProfit + 12 ? "Low" : "Medium";
  } else if (
    askIsHealthy &&
    warningsAreAcceptable &&
    dataSupportHealthy &&
    estimatedProfit >= Math.max(26, thresholds.solidAskProfit)
  ) {
    finderLabel = "Buy";
    verdict = "BUY";
    risk = estimatedProfit >= Math.max(34, thresholds.solidAskProfit + 8) ? "Low" : "Medium";
  } else if (
    offerIsStrong &&
    offerBeatsAskClearly &&
    warningsAreAcceptable &&
    dataSupportHealthy &&
    (
      estimatedProfit < thresholds.solidAskProfit ||
      marginPercent < thresholds.solidAskMargin
    )
  ) {
    finderLabel = "Offer";
    verdict = "OFFER TARGET";
    risk = offerProfit >= 30 ? "Medium" : "High";
  } else if (
    (askIsBorderline || offerIsBorderline) &&
    warningsAreAcceptable &&
    dataSupportTight &&
    estimatedProfit >= 10
  ) {
    finderLabel = "Tight";
    verdict = "TIGHT CHECK";
    risk = "High";
  }

  const bucketPriority = getDealBucketPriority(finderLabel);

  const rawCompContribution = Math.min(Math.max(0, compCount), 14) * 1.1;
  const rawConfidenceContribution = Math.max(0, confidence) * 0.12;

  const scoreBeforePenalty = roundMoney(
    bucketPriority * 38 +
      Math.max(0, estimatedProfit) * 1.55 +
      Math.max(0, offerProfit) * 0.95 +
      Math.max(0, marginPercent) * 0.55 +
      Math.max(0, undervaluedPercent) * 0.16 +
      rawConfidenceContribution +
      rawCompContribution
  );

  const lowCompPenalty = getLowCompPenalty(compCount);
  const confidencePenalty = getConfidencePenalty(confidence);
  const thinMarginPenalty = marginPercent < 10 ? 12 : marginPercent < 14 ? 6 : 0;
  const switchPenalty = getSwitchListingPenalty(queryContext, item, classified, adjusted);

  const finalPenalty = roundMoney(
    baseWarningPenalty +
      lowCompPenalty +
      confidencePenalty +
      thinMarginPenalty +
      switchPenalty
  );

  let score = roundMoney(Math.max(0, scoreBeforePenalty - finalPenalty));

  if (finderLabel === "Buy" && compCount < thresholds.minCompHealthy) {
    finderLabel = "Tight";
    verdict = "TIGHT CHECK";
    risk = "High";
  }

  if (finderLabel === "Buy" && estimatedProfit < Math.max(26, thresholds.solidAskProfit)) {
    finderLabel = "Tight";
    verdict = "TIGHT CHECK";
    risk = "High";
  }

  if (finderLabel === "Buy" && marginPercent < thresholds.solidAskMargin) {
    finderLabel = "Tight";
    verdict = "TIGHT CHECK";
    risk = "High";
  }

  if (finderLabel === "Buy" && compCount <= 3) {
    finderLabel = "Tight";
    verdict = "TIGHT CHECK";
    risk = "High";
  }

  if (finderLabel === "Tight" && estimatedProfit < 8 && offerProfit < thresholds.tightOfferProfit) {
    finderLabel = "Skip";
    verdict = "SKIP";
    risk = "High";
  }

  score = roundMoney(Math.max(0, score));

  const scanner = {
    totalBuyPrice: total,
    estimatedResale,
    repairCost,
    estimatedProfit,
    ebayFees,
    marginPercent,
    verdict,
    risk,
    score,
    rawScore: scoreBeforePenalty,
    warningScorePenalty: finalPenalty,
    compCount,
    confidence,
    confidenceLabel,
    pricingMode: pricingModel?.pricingMode || "Market median",
    offerOpportunity,
    offerOpportunityType,
    offerPrice: roundMoney(offerPrice),
    offerProfit: roundMoney(offerProfit),
  };

  const reasonBreakdown = buildDealReasonBreakdown({
    title,
    pricingMode: scanner.pricingMode,
    confidence: scanner.confidence,
    confidenceLabel: scanner.confidenceLabel,
    compCount: scanner.compCount,
    marginPercent: scanner.marginPercent,
    undervaluedAmount,
    undervaluedPercent,
    estimatedProfit,
    estimatedResale,
    totalBuyPrice: total,
    ebayFees,
    repairCost,
    bundleValueBonus: roundMoney(adjusted?.bundleValueBonus || 0),
    warningFlags,
    warningScorePenalty: finalPenalty,
    risk,
    verdict,
    finderLabel,
    offerOpportunity,
    offerOpportunityType,
    offerProfit,
    offerPrice,
  });

  return {
    ...item,
    title,
    price,
    shipping,
    scanner,
    bestOffer,
    estimatedProfit,
    dealScore: score,
    rawDealScore: scoreBeforePenalty,
    warningFlags,
    warningScorePenalty: finalPenalty,
    undervaluedAmount,
    undervaluedPercent,
    finderLabel,
    reason: buildReasonText({
      finderLabel,
      estimatedProfit,
      estimatedResale,
      totalBuyPrice: total,
      compCount,
      confidenceLabel,
      offerOpportunity,
      offerPrice,
      offerProfit,
    }),
    reasonBreakdown,
    originalUrl,
    affiliateUrl,
    url: originalUrl,
    bundleType: adjusted?.bundleType || classified?.bundleType || "",
    bundleSignals: adjusted?.bundleSignals || classified?.bundleSignals || {},
    bundleValueBonus: roundMoney(adjusted?.bundleValueBonus || 0),
    offerOpportunity,
    offerOpportunityType,
    offerPrice: roundMoney(offerPrice),
    offerProfit: roundMoney(offerProfit),
  };
}

function sortDealsForFindDeals(deals = [], queryContext = {}) {
  const wantsBundle = Boolean(queryContext?.wantsBundle);

  const sorted = [...deals].sort((a, b) => {
    if (wantsBundle) {
      const aBundle = a?.bundleType === "bundle" ? 1 : 0;
      const bBundle = b?.bundleType === "bundle" ? 1 : 0;

      if (bBundle !== aBundle) {
        return bBundle - aBundle;
      }
    }

    const bucketDiff =
      getDealBucketPriority(b?.finderLabel) - getDealBucketPriority(a?.finderLabel);
    if (bucketDiff !== 0) {
      return bucketDiff;
    }

    const scoreDiff = Number(b?.dealScore || 0) - Number(a?.dealScore || 0);
    if (scoreDiff !== 0) {
      return scoreDiff;
    }

    const profitDiff =
      Number(b?.scanner?.estimatedProfit || b?.estimatedProfit || 0) -
      Number(a?.scanner?.estimatedProfit || a?.estimatedProfit || 0);
    if (profitDiff !== 0) {
      return profitDiff;
    }

    const offerProfitDiff =
      Number(b?.scanner?.offerProfit || b?.offerProfit || 0) -
      Number(a?.scanner?.offerProfit || a?.offerProfit || 0);
    if (offerProfitDiff !== 0) {
      return offerProfitDiff;
    }

    return (
      Number(b?.scanner?.confidence || 0) -
      Number(a?.scanner?.confidence || 0)
    );
  });

  return sorted;
}

function applyBundlePreferenceFallback(deals = [], queryContext = {}) {
  if (!queryContext?.wantsBundle) {
    return sortDealsForFindDeals(deals, queryContext);
  }

  const bundleDeals = deals.filter((deal) => deal?.bundleType === "bundle");
  if (bundleDeals.length > 0) {
    return sortDealsForFindDeals(bundleDeals, queryContext);
  }

  return sortDealsForFindDeals(deals, queryContext);
}

function filterDealsForOutput(deals = [], includeTightDeals = false) {
  return deals.filter((item) => {
    const label = String(item?.finderLabel || "").toLowerCase();
    const compCount = Number(item?.scanner?.compCount || 0);
    const confidence = Number(item?.scanner?.confidence || 0);
    const warningCount = Array.isArray(item?.warningFlags) ? item.warningFlags.length : 0;
    const score = Number(item?.dealScore || 0);
    const estimatedProfit = Number(item?.scanner?.estimatedProfit || item?.estimatedProfit || 0);
    const marginPercent = Number(item?.scanner?.marginPercent || item?.marginPercent || 0);
    const offerProfit = Number(item?.offerProfit || item?.scanner?.offerProfit || 0);

    const titleText = normalizeText(
      item?.title ||
      item?.scanner?.title ||
      ""
    );

    const isAudio =
      titleText.includes("airpods") ||
      titleText.includes("earbuds") ||
      titleText.includes("earphones") ||
      titleText.includes("headphones") ||
      titleText.includes("galaxy buds") ||
      titleText.includes("sony wf") ||
      titleText.includes("sony wh") ||
      titleText.includes("wf-1000xm") ||
      titleText.includes("wh-1000xm") ||
      titleText.includes("xm3") ||
      titleText.includes("xm4") ||
      titleText.includes("xm5") ||
      titleText.includes("bose") ||
      titleText.includes("qc45") ||
      titleText.includes("qc 45") ||
      titleText.includes("qc35") ||
      titleText.includes("qc 35") ||
      titleText.includes("qc ultra");

    if (label.includes("buy")) {
      if (isAudio) {
        return (
          estimatedProfit >= 11 &&
          marginPercent >= 7 &&
          score >= 95 &&
          warningCount <= 2 &&
          compCount >= 4 &&
          confidence >= 58
        );
      }

      return (
        estimatedProfit >= 26 &&
        marginPercent >= 12 &&
        score >= 105 &&
        warningCount <= 2 &&
        compCount >= 5 &&
        confidence >= 58
      );
    }

    if (label.includes("offer")) {
      if (isAudio) {
        return (
          offerProfit >= 14 &&
          score >= 78 &&
          warningCount <= 2 &&
          compCount >= 4 &&
          confidence >= 58
        );
      }

      return (
        offerProfit >= 22 &&
        score >= 82 &&
        warningCount <= 2 &&
        compCount >= 5 &&
        confidence >= 58
      );
    }

    if (includeTightDeals && label.includes("tight")) {
      if (isAudio) {
        return (
          (
            (estimatedProfit >= 6 && marginPercent >= 4) ||
            offerProfit >= 10
          ) &&
          score >= 48 &&
          warningCount <= 2 &&
          (compCount >= 2 || confidence >= 45)
        );
      }

      return (
        (
          (estimatedProfit >= 10 && marginPercent >= 6) ||
          offerProfit >= 16
        ) &&
        score >= 52 &&
        warningCount <= 2 &&
        (compCount >= 3 || confidence >= 45)
      );
    }

    return false;
  });
}

function applyEmergencyDealFallback(deals = [], includeTightDeals = false) {
  return deals.filter((item) => {
    const label = String(item?.finderLabel || "").toLowerCase();
    const compCount = Number(item?.scanner?.compCount || 0);
    const confidence = Number(item?.scanner?.confidence || 0);
    const warningCount = Array.isArray(item?.warningFlags) ? item.warningFlags.length : 0;
    const score = Number(item?.dealScore || 0);
    const estimatedProfit = Number(item?.scanner?.estimatedProfit || item?.estimatedProfit || 0);
    const marginPercent = Number(item?.scanner?.marginPercent || item?.marginPercent || 0);
    const offerProfit = Number(item?.offerProfit || item?.scanner?.offerProfit || 0);

    const titleText = normalizeText(
      item?.title ||
      item?.scanner?.title ||
      ""
    );

    const isAudio =
      titleText.includes("airpods") ||
      titleText.includes("earbuds") ||
      titleText.includes("earphones") ||
      titleText.includes("headphones") ||
      titleText.includes("galaxy buds") ||
      titleText.includes("sony wf") ||
      titleText.includes("sony wh") ||
      titleText.includes("wf-1000xm") ||
      titleText.includes("wh-1000xm") ||
      titleText.includes("xm3") ||
      titleText.includes("xm4") ||
      titleText.includes("xm5") ||
      titleText.includes("bose") ||
      titleText.includes("qc45") ||
      titleText.includes("qc 45") ||
      titleText.includes("qc35") ||
      titleText.includes("qc 35") ||
      titleText.includes("qc ultra");

    if (label.includes("buy")) {
      if (isAudio) {
        return (
          estimatedProfit >= 8 &&
          marginPercent >= 5 &&
          score >= 72 &&
          warningCount <= 2 &&
          compCount >= 2
        );
      }

      return (
        estimatedProfit >= 20 &&
        marginPercent >= 9 &&
        score >= 74 &&
        warningCount <= 2 &&
        compCount >= 3
      );
    }

    if (label.includes("offer")) {
      if (isAudio) {
        return (
          offerProfit >= 11 &&
          score >= 62 &&
          warningCount <= 2 &&
          compCount >= 2
        );
      }

      return (
        offerProfit >= 18 &&
        score >= 66 &&
        warningCount <= 2 &&
        compCount >= 3
      );
    }

    if (includeTightDeals && label.includes("tight")) {
      if (isAudio) {
        return (
          (
            (estimatedProfit >= 4 && marginPercent >= 2.5) ||
            offerProfit >= 7
          ) &&
          score >= 38 &&
          warningCount <= 2 &&
          (compCount >= 1 || confidence >= 35)
        );
      }

      return (
        (
          (estimatedProfit >= 6 && marginPercent >= 4) ||
          offerProfit >= 12
        ) &&
        score >= 40 &&
        warningCount <= 2 &&
        (compCount >= 1 || confidence >= 35)
      );
    }

    return false;
  });
}

app.get("/api/me", (req, res) => {
  try {
    const user = getUserFromCookie(req);

    if (!user) {
      return res.status(401).json({ error: "Not signed in." });
    }

    return res.json({ user: safeUser(user) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to load user." });
  }
});

app.post("/api/search-ebay", async (req, res) => {
  try {
    const user = getUserFromCookie(req);
    if (!user) {
      return res.status(401).json({ error: "Please sign in." });
    }

    const {
      query,
      condition = "",
      filterPriceMax = 0,
      limit = 8,
      freeShippingOnly = false,
    } = req.body || {};

    if (!query) {
      return res.status(400).json({ error: "Search query required." });
    }

    const engine = resolveEngineForQuery(query);
    const queryContext =
      engine && typeof engine.classifyQuery === "function"
        ? engine.classifyQuery(query)
        : { rawQuery: query, normalizedQuery: normalizeText(query) };

    const fetched = await fetchListingsAcrossVariants({
      engine,
      query,
      condition,
      filterPriceMax,
      freeShippingOnly,
      limit,
    });

    let filtered = Array.isArray(fetched.items) ? fetched.items : [];

    filtered = filtered.filter((item) => itemMatchesCondition(item, condition));
    filtered = filtered.filter((item) => itemMatchesPrice(item, filterPriceMax));
    filtered = filtered.filter((item) => itemMatchesFreeShipping(item, freeShippingOnly));

    if (engine && typeof engine.matchesItem === "function") {
      filtered = filtered.filter((item) => engine.matchesItem(item, queryContext));
    }

    const decoratedItems = filtered
      .slice(0, Number(limit || 8))
      .map((item) => decorateItemWithAffiliate(item));

    return res.json({
      ok: true,
      searchQuery: fetched.searchQuery,
      searchVariants: fetched.searchVariants,
      affiliateEnabled: Boolean(EBAY_AFFILIATE_ENABLED && EBAY_CAMPAIGN_ID),
      items: decoratedItems,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Could not search eBay." });
  }
});

app.post("/api/auto-comps", async (req, res) => {
  try {
    const user = getUserFromCookie(req);
    if (!user) {
      return res.status(401).json({ error: "Please sign in." });
    }

    const { product = "", condition = "" } = req.body || {};

    if (!product.trim()) {
      return res.status(400).json({ error: "Product is required." });
    }

    const rawSearchQuery = [product, condition].filter(Boolean).join(" ").trim();
    const engine = resolveEngineForQuery(rawSearchQuery);
    const queryContext =
      engine && typeof engine.classifyQuery === "function"
        ? engine.classifyQuery(rawSearchQuery)
        : { rawQuery: rawSearchQuery, normalizedQuery: normalizeText(rawSearchQuery) };

    const fetched = await fetchMarketAcrossVariants({
      engine,
      query: rawSearchQuery,
      condition,
      limit: 24,
    });

    let filtered = Array.isArray(fetched.items) ? fetched.items : [];

    if (condition.trim()) {
      filtered = filtered.filter((item) => itemMatchesCondition(item, condition));
    }

    if (engine && typeof engine.matchesItem === "function") {
      filtered = filtered.filter((item) => engine.matchesItem(item, queryContext));
    }

    const autoComps = buildAutoCompsFromItems(filtered);

    return res.json({
      ok: true,
      searchQuery: fetched.searchQuery,
      searchVariants: fetched.searchVariants,
      autoComps,
      itemsUsed: filtered.length,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Could not auto-fill comps." });
  }
});

app.post("/api/find-deals", async (req, res) => {
  try {
    const user = getUserFromCookie(req);
    if (!user) {
      return res.status(401).json({ error: "Please sign in." });
    }

    const {
      query,
      condition = "",
      filterPriceMax = 0,
      limit = 30,
      topN = 8,
      freeShippingOnly = false,
      includeTightDeals = false,
    } = req.body || {};

    if (!query) {
      return res.status(400).json({ error: "Search query required." });
    }

    const engine = resolveEngineForQuery(query);
    const queryContext =
      engine && typeof engine.classifyQuery === "function"
        ? engine.classifyQuery(query)
        : { rawQuery: query, normalizedQuery: normalizeText(query) };

    const allVariants = getEngineSearchVariants(engine, query);
    const findDealsVariants = limitVariantsForFindDeals(allVariants, query);
    const variantCountForFindDeals = Math.max(1, findDealsVariants.length);

    const listingMaxVariants = variantCountForFindDeals;
    const marketMaxVariants = Math.min(3, variantCountForFindDeals);

    const listingLimit = Math.min(Math.max(Number(limit || 30), 20), 24);
    const marketLimit = 24;

    const [fetchedListings, fetchedMarket] = await Promise.all([
      fetchListingsAcrossVariants({
        engine,
        query,
        condition,
        filterPriceMax,
        freeShippingOnly,
        limit: listingLimit,
        maxVariants: listingMaxVariants,
      }),
      fetchMarketAcrossVariants({
        engine,
        query,
        condition,
        limit: marketLimit,
        maxVariants: marketMaxVariants,
      }),
    ]);

    const fetchedListingsCount = Array.isArray(fetchedListings.items) ? fetchedListings.items.length : 0;
    const fetchedMarketCount = Array.isArray(fetchedMarket.items) ? fetchedMarket.items.length : 0;

    let cleanListings = Array.isArray(fetchedListings.items) ? fetchedListings.items : [];
    let cleanMarket = Array.isArray(fetchedMarket.items) ? fetchedMarket.items : [];

    const listingsBeforeBasicFilters = cleanListings.length;
    const marketBeforeBasicFilters = cleanMarket.length;

    cleanListings = cleanListings.filter((item) => itemMatchesCondition(item, condition));
    cleanListings = cleanListings.filter((item) => itemMatchesPrice(item, filterPriceMax));
    cleanListings = cleanListings.filter((item) =>
      itemMatchesFreeShipping(item, freeShippingOnly)
    );

    if (condition.trim()) {
      cleanMarket = cleanMarket.filter((item) => itemMatchesCondition(item, condition));
    }

    const listingsAfterBasicFilters = cleanListings.length;
    const marketAfterBasicFilters = cleanMarket.length;

    if (engine && typeof engine.matchesItem === "function") {
      cleanListings = cleanListings.filter((item) => engine.matchesItem(item, queryContext));
      cleanMarket = cleanMarket.filter((item) => engine.matchesItem(item, queryContext));
    }

    const listingsAfterEngineMatch = cleanListings.length;
    const marketAfterEngineMatch = cleanMarket.length;

    console.log("=== DEBUG: PIPELINE START ===");
    console.log("Query:", query);
    console.log("Search Variants:", fetchedListings.searchVariants);
    console.log("Fetched Listings:", fetchedListingsCount);
    console.log("Fetched Market:", fetchedMarketCount);
    console.log("Listings Before Basic Filters:", listingsBeforeBasicFilters);
    console.log("Listings After Basic Filters:", listingsAfterBasicFilters);
    console.log("Listings After Engine Match:", listingsAfterEngineMatch);
    console.log("Market Before Basic Filters:", marketBeforeBasicFilters);
    console.log("Market After Basic Filters:", marketAfterBasicFilters);
    console.log("Market After Engine Match:", marketAfterEngineMatch);

    const pricingModel =
      engine && typeof engine.buildPricingModel === "function"
        ? engine.buildPricingModel({
            queryContext,
            marketItems: cleanMarket,
            listingItems: cleanListings,
          })
        : createGenericPricingModel(cleanMarket);

    console.log("Pricing Model:", pricingModel);

    const evaluatedDeals = cleanListings.map((item) =>
      evaluateDeal({
        item,
        pricingModel,
        queryContext,
        engine,
      })
    );

    console.log("Evaluated Deals:", evaluatedDeals.length);
    console.log("Top 5 Evaluated:");
    evaluatedDeals.slice(0, 5).forEach((d, i) => {
      console.log(`#${i + 1}`, {
        title: d.title,
        price: d.price,
        shipping: d.shipping,
        total: d.scanner?.totalBuyPrice,
        resale: d.scanner?.estimatedResale,
        profit: d.scanner?.estimatedProfit,
        margin: d.scanner?.marginPercent,
        score: d.dealScore,
        label: d.finderLabel,
        confidence: d.scanner?.confidence,
        compCount: d.scanner?.compCount,
        warnings: d.warningFlags,
      });
    });

    const strictDeals = filterDealsForOutput(evaluatedDeals, Boolean(includeTightDeals));
    console.log("After STRICT filter:", strictDeals.length);

    const fallbackDeals = applyEmergencyDealFallback(evaluatedDeals, Boolean(includeTightDeals));
    console.log("After FALLBACK filter:", fallbackDeals.length);

    let deals = strictDeals.length ? strictDeals : fallbackDeals;

    const preferredDeals = applyBundlePreferenceFallback(deals, queryContext);
    const finalDeals = preferredDeals
      .slice(0, Number(topN || 8))
      .map((deal, index) => ({
        ...deal,
        bestDeal: index === 0,
      }));

    return res.json({
      ok: true,
      searchQuery: fetchedListings.searchQuery,
      searchVariants: fetchedListings.searchVariants,
      affiliateEnabled: Boolean(EBAY_AFFILIATE_ENABLED && EBAY_CAMPAIGN_ID),
      includeTightDeals: Boolean(includeTightDeals),
      deals: finalDeals,
      totalFetched: fetchedListingsCount,
      totalMatched: listingsAfterEngineMatch,
      totalQualifiedDeals: preferredDeals.length,
      pipeline: {
        fetchedListings: fetchedListingsCount,
        fetchedMarket: fetchedMarketCount,
        listingsBeforeBasicFilters,
        listingsAfterBasicFilters,
        listingsAfterEngineMatch,
        marketBeforeBasicFilters,
        marketAfterBasicFilters,
        marketAfterEngineMatch,
        evaluatedDeals: evaluatedDeals.length,
        strictDeals: strictDeals.length,
        fallbackDeals: fallbackDeals.length,
        finalDeals: finalDeals.length,
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to find deals" });
  }
});

app.post("/api/signup", signupHandler);
app.post("/api/login", loginHandler);
app.post("/api/logout", logoutHandler);

app.post("/api/analyze", runAnalysis);

app.post("/api/create-checkout-session", async (req, res) => {
  try {
    const maybeResponse = await createCheckoutSession(req, res);
    if (!res.headersSent && maybeResponse !== undefined) {
      return res.json(maybeResponse);
    }
  } catch (firstErr) {
    try {
      const user = getUserFromCookie(req);
      if (!user) {
        return res.status(401).json({ error: "Please sign in." });
      }

      const maybeResponse = await createCheckoutSession({
        plan: req.body?.plan,
        user,
        appUrl,
        req,
        res,
      });

      if (!res.headersSent && maybeResponse !== undefined) {
        return res.json(maybeResponse);
      }

      if (!res.headersSent) {
        return res.status(500).json({ error: "Could not start checkout." });
      }
    } catch (err) {
      console.error(firstErr);
      console.error(err);
      if (!res.headersSent) {
        return res.status(500).json({ error: "Could not start checkout." });
      }
    }
  }
});

app.post("/api/create-portal-session", async (req, res) => {
  try {
    const maybeResponse = await createPortalSession(req, res);
    if (!res.headersSent && maybeResponse !== undefined) {
      return res.json(maybeResponse);
    }
  } catch (firstErr) {
    try {
      const user = getUserFromCookie(req);
      if (!user) {
        return res.status(401).json({ error: "Please sign in." });
      }

      const maybeResponse = await createPortalSession({
        user,
        appUrl,
        req,
        res,
      });

      if (!res.headersSent && maybeResponse !== undefined) {
        return res.json(maybeResponse);
      }

      if (!res.headersSent) {
        return res.status(500).json({ error: "Could not open billing portal." });
      }
    } catch (err) {
      console.error(firstErr);
      console.error(err);
      if (!res.headersSent) {
        return res.status(500).json({ error: "Could not open billing portal." });
      }
    }
  }
});

app.post(
  "/api/stripe/webhook",
  express.raw({ type: "application/json" }),
  stripeWebhookHandler
);

app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(port, () => {
  console.log(`FlipAI running on ${appUrl}`);
});
