import "dotenv/config";
import express from "express";
import path from "path";
import cors from "cors";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import { fileURLToPath } from "url";
import {
  enforceUsage,
  getUserById,
  incrementUsage,
  safeUser,
} from "./db.js";
import {
  loginHandler,
  logoutHandler,
  requireAuth,
  signupHandler,
} from "./auth.js";
import {
  createCheckoutSession,
  createPortalSession,
  stripeWebhookHandler,
} from "./stripe.js";
import { runAnalysis } from "./openai.js";
import { searchEbayListings, searchEbayMarketPool } from "./ebay.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const port = process.env.PORT || 3000;
const appUrl = process.env.APP_URL || `http://localhost:${port}`;
const JWT_SECRET = process.env.JWT_SECRET || "change_me";

function roundMoney(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function parseManualSoldPrices(input) {
  if (!input) return [];

  if (Array.isArray(input)) {
    return input
      .map((v) => Number(v))
      .filter((v) => Number.isFinite(v) && v > 0);
  }

  const text = String(input)
    .replace(/£/g, "")
    .replace(/\n/g, ",")
    .replace(/\r/g, ",")
    .trim();

  if (!text) return [];

  return text
    .split(",")
    .map((part) => Number(String(part).trim()))
    .filter((v) => Number.isFinite(v) && v > 0);
}

function getMedian(values) {
  if (!values.length) return 0;

  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return roundMoney((sorted[mid - 1] + sorted[mid]) / 2);
  }

  return roundMoney(sorted[mid]);
}

function getAverage(values) {
  if (!values.length) return 0;
  const total = values.reduce((sum, value) => sum + value, 0);
  return roundMoney(total / values.length);
}

function buildManualSoldComps(input) {
  const prices = parseManualSoldPrices(input);

  if (!prices.length) {
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
        source: "manual",
        reason: "No manual sold prices entered",
      },
    };
  }

  const avgSoldPrice = getAverage(prices);
  const medianSoldPrice = getMedian(prices);
  const minSoldPrice = roundMoney(Math.min(...prices));
  const maxSoldPrice = roundMoney(Math.max(...prices));

  let confidence = 35;
  if (prices.length >= 3) confidence = 55;
  if (prices.length >= 5) confidence = 72;
  if (prices.length >= 8) confidence = 86;
  if (prices.length >= 12) confidence = 94;

  let confidenceLabel = "Low";
  if (confidence >= 80) confidenceLabel = "High";
  else if (confidence >= 55) confidenceLabel = "Medium";

  return {
    connected: true,
    pricingMode: "Manual sold comps",
    compCount: prices.length,
    soldCount: prices.length,
    samplePrices: prices.slice(0, 12).map(roundMoney),
    avgSoldPrice,
    medianSoldPrice,
    minSoldPrice,
    maxSoldPrice,
    confidence,
    confidenceLabel,
    keywordUsed: "manual_entry",
    debug: {
      source: "manual",
      prices,
    },
  };
}

function getCompConfidenceAdjustment(soldComps) {
  if (!soldComps?.connected || !Number(soldComps.compCount || 0)) {
    return {
      multiplier: 1,
      reason: "no comps",
    };
  }

  const compCount = Number(soldComps.compCount || 0);
  const confidence = Number(soldComps.confidence || 0);

  let multiplier = 1;

  if (compCount <= 2) multiplier = 0.985;
  else if (compCount <= 4) multiplier = 0.9925;
  else if (compCount <= 6) multiplier = 0.9975;
  else multiplier = 1.0;

  if (confidence < 45) {
    multiplier -= 0.005;
  }

  if (multiplier > 1.0) multiplier = 1.0;
  if (multiplier < 0.975) multiplier = 0.975;

  return {
    multiplier: roundMoney(multiplier),
    reason: `compCount=${compCount}, confidence=${confidence}`,
  };
}

function calculateFlipMetrics({
  buyPrice,
  repairCost,
  condition,
  manualSoldPrices,
  goal,
}) {
  const buy = Number(buyPrice || 0);
  const repair = Number(repairCost || 0);
  const text = String(condition || "").toLowerCase();
  const goalText = String(goal || "").toLowerCase();

  const soldComps = buildManualSoldComps(manualSoldPrices);

  let estimatedResale = 0;
  let pricingMode = "Estimated fallback model";
  let confidenceAdjustment = null;

  if (soldComps.connected && soldComps.medianSoldPrice > 0) {
    const adjustment = getCompConfidenceAdjustment(soldComps);
    confidenceAdjustment = adjustment;

    estimatedResale = roundMoney(
      soldComps.medianSoldPrice * Number(adjustment.multiplier || 1)
    );

    pricingMode = "Manual sold comps";

    if (goalText.includes("fast")) {
      estimatedResale = roundMoney(estimatedResale * 0.985);
      pricingMode = "Manual sold comps (fast-sale adjusted)";
    } else if (goalText.includes("maximum")) {
      estimatedResale = roundMoney(estimatedResale * 1.02);
      pricingMode = "Manual sold comps (profit adjusted)";
    }

    estimatedResale = Math.max(0, estimatedResale);
  } else {
    let multiplier = 2.1;

    if (text.includes("excellent")) multiplier = 2.55;
    else if (text.includes("very good")) multiplier = 2.4;
    else if (text.includes("good")) multiplier = 2.3;
    else if (text.includes("light wear")) multiplier = 2.25;
    else if (text.includes("cracked")) multiplier = 2.0;
    else if (text.includes("fault")) multiplier = 1.7;
    else if (text.includes("parts")) multiplier = 1.4;

    if (text.includes("unlocked")) multiplier += 0.08;
    if (text.includes("boxed")) multiplier += 0.04;
    if (text.includes("fully working")) multiplier += 0.05;

    estimatedResale = roundMoney(buy * multiplier);

    if (goalText.includes("fast")) {
      estimatedResale = roundMoney(estimatedResale * 0.985);
      pricingMode = "Estimated fallback model (fast-sale adjusted)";
    } else if (goalText.includes("maximum")) {
      estimatedResale = roundMoney(estimatedResale * 1.02);
      pricingMode = "Estimated fallback model (profit adjusted)";
    }
  }

  const totalCost = roundMoney(buy + repair);
  const ebayFees = roundMoney(estimatedResale * 0.15);
  const profit = roundMoney(estimatedResale - totalCost - ebayFees);
  const marginPercent =
    estimatedResale > 0 ? roundMoney((profit / estimatedResale) * 100) : 0;

  let verdict = "AVOID ❌";

  if (profit >= 20 || marginPercent >= 18) {
    verdict = "GOOD DEAL ✅";
  } else if (profit >= 8 || marginPercent >= 9) {
    verdict = "OK DEAL ⚠️";
  } else if (profit >= 2 || marginPercent >= 4) {
    verdict = "MARGINAL 🤏";
  }

  return {
    estimatedResale: roundMoney(estimatedResale),
    totalCost,
    ebayFees,
    profit,
    marginPercent,
    verdict,
    pricingMode,
    soldComps,
    confidenceAdjustment,
  };
}

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractStorageTokens(text) {
  const matches = normalizeText(text).match(/\b(16|32|64|128|256|512|1024)\s?gb\b/g);
  return matches ? matches.map((m) => m.replace(/\s+/g, "")) : [];
}

function extractEssentialTokens(product) {
  const cleaned = normalizeText(product);
  const words = cleaned.split(" ").filter(Boolean);

  const stopWords = new Set([
    "the",
    "and",
    "for",
    "with",
    "used",
    "new",
    "good",
    "very",
    "excellent",
    "sale",
    "phone",
    "mobile",
    "smartphone",
    "black",
    "white",
    "blue",
    "red",
    "green",
    "pink",
    "purple",
    "grey",
    "gray",
    "silver",
    "gold",
    "boxed",
    "unboxed",
    "gb",
    "console",
    "camera",
    "vacuum",
    "hoover",
    "body",
    "kit",
  ]);

  return words
    .filter((word) => word.length >= 2 && !stopWords.has(word))
    .slice(0, 10);
}

function buildAutoCompSearchQuery(product, condition) {
  const productText = String(product || "").trim();
  const conditionText = String(condition || "").trim().toLowerCase();
  const essentialTokens = extractEssentialTokens(productText);
  const storageTokens = extractStorageTokens(productText);

  let query = essentialTokens.join(" ");

  if (!query) {
    query = productText;
  }

  if (storageTokens.length) {
    const storage = storageTokens[0];
    if (!query.toLowerCase().includes(storage.toLowerCase())) {
      query += ` ${storage}`;
    }
  }

  if (conditionText.includes("unlocked") && !query.toLowerCase().includes("unlocked")) {
    query += " unlocked";
  }

  if (
    (conditionText.includes("used") || conditionText.includes("fully working")) &&
    !query.toLowerCase().includes("used")
  ) {
    query += " used";
  }

  return query.trim();
}

function detectConditionBucket(text) {
  const value = normalizeText(text);

  const sparesTerms = [
    "spares",
    "repair",
    "faulty",
    "broken",
    "cracked",
    "parts",
    "not working",
    "damaged",
    "icloud locked",
    "network locked",
    "for parts",
    "for repair",
    "screen burn",
    "dead",
    "water damage",
  ];

  const refurbTerms = [
    "refurbished",
    "seller refurbished",
    "certified refurbished",
    "renewed",
  ];

  const newTerms = [
    "brand new",
    "sealed",
    "unopened",
    "new",
  ];

  if (sparesTerms.some((term) => value.includes(term))) {
    return "spares_repair";
  }

  if (refurbTerms.some((term) => value.includes(term))) {
    return "refurbished";
  }

  if (newTerms.some((term) => value.includes(term))) {
    return "new";
  }

  return "used";
}

function getItemBucket(item, fallbackText = "") {
  const title = String(item?.title || "");
  const condition = String(item?.condition || "");
  return detectConditionBucket(`${title} ${condition} ${fallbackText}`);
}

function isBadCompTitle(title) {
  const text = normalizeText(title);

  const banned = [
    "empty box",
    "box only",
    "case only",
    "cover only",
    "screen only",
    "housing only",
    "replacement box",
    "manual only",
    "charger only",
    "remote only",
    "dock only",
    "stand only",
    "filter only",
    "battery only",
    "head only",
    "attachment only",
    "wand only",
  ];

  return banned.some((term) => text.includes(term));
}

function isAccessoryOnlyTitle(text) {
  const value = normalizeText(text);

  const accessoryTerms = [
    "case only",
    "cover only",
    "screen protector",
    "tempered glass",
    "controller only",
    "remote only",
    "charger only",
    "cable only",
    "dock only",
    "stand only",
    "box only",
    "manual only",
    "battery only",
    "attachment only",
    "tool only",
    "filter only",
    "wand only",
    "head only",
    "accessories only",
    "for parts only",
  ];

  return accessoryTerms.some((term) => value.includes(term));
}

function detectProductCategory(text) {
  const value = normalizeText(text);

  if (value.includes("iphone")) return "iphone";

  if (
    value.includes("ps5") ||
    value.includes("playstation 5") ||
    value.includes("xbox series x") ||
    value.includes("xbox series s") ||
    value.includes("nintendo switch") ||
    value.includes("switch oled") ||
    value.includes("switch lite")
  ) {
    return "console";
  }

  if (
    value.includes("dyson v8") ||
    value.includes("dyson v10") ||
    value.includes("dyson v11") ||
    value.includes("dyson v12") ||
    value.includes("dyson v15") ||
    value.includes("dyson gen5")
  ) {
    return "dyson";
  }

  if (
    value.includes("canon eos") ||
    value.includes("nikon d") ||
    value.includes("sony a") ||
    value.includes("lumix") ||
    value.includes("fujifilm x") ||
    value.includes("camera") ||
    value.includes("lens")
  ) {
    return "camera";
  }

  return "generic";
}

function getIphoneModelFamily(text) {
  const value = normalizeText(text);

  if (value.includes("iphone se 2022") || value.includes("iphone se 3")) {
    return { number: "se", variant: "2022" };
  }

  if (value.includes("iphone se 2020") || value.includes("iphone se 2")) {
    return { number: "se", variant: "2020" };
  }

  const match = value.match(/\biphone\s+(\d{1,2})(?:\s+(pro max|pro|plus|mini))?\b/);
  if (!match) return null;

  return {
    number: match[1],
    variant: match[2] || "",
  };
}

function iphoneFamilyMatches(title, product) {
  const titleFamily = getIphoneModelFamily(title);
  const productFamily = getIphoneModelFamily(product);

  if (!productFamily) return true;
  if (!titleFamily) return false;

  if (titleFamily.number !== productFamily.number) {
    return false;
  }

  const wantedVariant = productFamily.variant;
  const gotVariant = titleFamily.variant;

  if (!wantedVariant && gotVariant) {
    return false;
  }

  if (wantedVariant && wantedVariant !== gotVariant) {
    return false;
  }

  return true;
}

function getConsoleFamily(text) {
  const value = normalizeText(text);

  if (value.includes("playstation 5") || value.includes("ps5")) {
    let edition = "unknown";
    if (value.includes("digital")) edition = "digital";
    else if (value.includes("disc") || value.includes("disk")) edition = "disc";
    return { family: "ps5", edition };
  }

  if (value.includes("xbox series x")) {
    return { family: "xbox_series_x", edition: "" };
  }

  if (value.includes("xbox series s")) {
    return { family: "xbox_series_s", edition: "" };
  }

  if (value.includes("switch oled")) {
    return { family: "switch_oled", edition: "" };
  }

  if (value.includes("switch lite")) {
    return { family: "switch_lite", edition: "" };
  }

  if (value.includes("nintendo switch") || value.includes(" switch ")) {
    return { family: "switch_standard", edition: "" };
  }

  return null;
}

function consoleFamilyMatches(title, product) {
  const wanted = getConsoleFamily(product);
  const got = getConsoleFamily(title);

  if (!wanted) return true;
  if (!got) return false;
  if (wanted.family !== got.family) return false;

  if (wanted.family === "ps5") {
    if (wanted.edition === "digital" && got.edition !== "digital") return false;
    if (wanted.edition === "disc" && got.edition !== "disc") return false;
  }

  return true;
}

function isConsoleBundleMismatch(title, product) {
  const t = normalizeText(title);
  const p = normalizeText(product);

  const titleHasBundle = t.includes("bundle");
  const productHasBundle = p.includes("bundle");

  if (productHasBundle !== titleHasBundle) return true;

  return false;
}

function isConsoleAccessoryOnly(title) {
  const t = normalizeText(title);

  const badTerms = [
    "controller only",
    "console not included",
    "for controller",
    "faceplate",
    "cover only",
    "dock only",
    "stand only",
    "remote only",
    "charger only",
    "cable only",
  ];

  return badTerms.some((term) => t.includes(term));
}

function getDysonFamily(text) {
  const value = normalizeText(text);

  const models = ["gen5", "v15", "v12", "v11", "v10", "v8", "v7", "dc62", "dc59"];
  for (const model of models) {
    if (value.includes(`dyson ${model}`) || value.includes(` ${model} `)) {
      return model;
    }
  }

  return null;
}

function getDysonListingType(text) {
  const value = normalizeText(text);

  if (
    value.includes("body only") ||
    value.includes("main body only") ||
    value.includes("motor unit only")
  ) {
    return "body_only";
  }

  if (
    value.includes("attachments only") ||
    value.includes("tools only") ||
    value.includes("wand only") ||
    value.includes("head only")
  ) {
    return "accessories_only";
  }

  return "full_kit";
}

function dysonFamilyMatches(title, product) {
  const wanted = getDysonFamily(product);
  const got = getDysonFamily(title);

  if (!wanted) return true;
  if (!got) return false;
  return wanted === got;
}

function dysonTypeMatches(title, product) {
  const wanted = getDysonListingType(product);
  const got = getDysonListingType(title);

  if (got === "accessories_only") return false;
  if (wanted === "body_only") return got === "body_only";
  if (wanted === "full_kit") return got === "full_kit";
  return true;
}

function getCameraFamily(text) {
  const value = normalizeText(text);

  const patterns = [
    /\bcanon eos\s+\d{2,4}d\b/,
    /\bcanon eos\s+r\d+\b/,
    /\bsony a\d{3,4}\b/,
    /\bnikon d\d{3,4}\b/,
    /\bnikon z\d{1,2}\b/,
    /\bfujifilm x[\w-]+\b/,
    /\blumix [\w-]+\b/,
  ];

  for (const pattern of patterns) {
    const match = value.match(pattern);
    if (match) return match[0];
  }

  return null;
}

function getCameraItemType(text) {
  const value = normalizeText(text);

  const hasLens = value.includes(" lens");
  const hasBody = value.includes(" body") || value.includes("body only");
  const hasKit = value.includes("kit") || value.includes("with lens");

  if (hasLens && !value.includes("camera")) return "lens_only";
  if (hasBody) return "body_only";
  if (hasKit) return "kit";
  return "camera_or_body";
}

function cameraFamilyMatches(title, product) {
  const wanted = getCameraFamily(product);
  const got = getCameraFamily(title);

  if (!wanted) return true;
  if (!got) return false;

  return got === wanted;
}

function cameraTypeMatches(title, product) {
  const wanted = getCameraItemType(product);
  const got = getCameraItemType(title);

  if (got === "lens_only") return false;
  if (wanted === "body_only") return got === "body_only" || got === "camera_or_body";
  if (wanted === "kit") return got === "kit";
  return got !== "lens_only";
}

function productCategorySpecificMatch(itemTitle, product, condition) {
  const category = detectProductCategory(`${product} ${condition}`);
  const title = normalizeText(itemTitle);
  const productText = normalizeText(product);

  if (isAccessoryOnlyTitle(title)) return false;

  if (category === "iphone") {
    if (!iphoneFamilyMatches(title, productText)) return false;
    return true;
  }

  if (category === "console") {
    if (!consoleFamilyMatches(title, productText)) return false;
    if (isConsoleAccessoryOnly(title)) return false;
    if (isConsoleBundleMismatch(title, productText)) return false;
    return true;
  }

  if (category === "dyson") {
    if (!dysonFamilyMatches(title, productText)) return false;
    if (!dysonTypeMatches(title, productText)) return false;
    return true;
  }

  if (category === "camera") {
    if (!cameraFamilyMatches(title, productText)) return false;
    if (!cameraTypeMatches(title, productText)) return false;
    return true;
  }

  return true;
}

function itemMatchesProduct(itemTitle, product, condition) {
  const title = normalizeText(itemTitle);
  const productText = normalizeText(product);
  const conditionText = normalizeText(condition);

  if (!title) return false;
  if (isBadCompTitle(title)) return false;

  if (!productCategorySpecificMatch(title, productText, conditionText)) {
    return false;
  }

  const productTokens = extractEssentialTokens(productText);
  const storageTokens = extractStorageTokens(productText);

  const matchedCoreTokens = productTokens.filter((token) => title.includes(token));
  const matchedStorageTokens = storageTokens.filter((token) =>
    title.includes(token.replace(/\s+/g, ""))
  );

  const requiresUnlocked =
    productText.includes("unlocked") || conditionText.includes("unlocked");

  if (requiresUnlocked && !title.includes("unlocked")) {
    return false;
  }

  if (storageTokens.length > 0 && matchedStorageTokens.length === 0) {
    return false;
  }

  if (productTokens.length >= 4 && matchedCoreTokens.length < 2) {
    return false;
  }

  if (productTokens.length >= 2 && matchedCoreTokens.length < 1) {
    return false;
  }

  return true;
}

function removePriceOutliers(prices) {
  if (prices.length <= 4) return [...prices].sort((a, b) => a - b);

  const sorted = [...prices].sort((a, b) => a - b);
  const q1Index = Math.floor((sorted.length - 1) * 0.25);
  const q3Index = Math.floor((sorted.length - 1) * 0.75);
  const q1 = sorted[q1Index];
  const q3 = sorted[q3Index];
  const iqr = q3 - q1;
  const minAllowed = q1 - iqr * 1.5;
  const maxAllowed = q3 + iqr * 1.5;

  const filtered = sorted.filter((price) => price >= minAllowed && price <= maxAllowed);
  return filtered.length >= 3 ? filtered : sorted;
}

function selectCompPrices(prices) {
  const cleaned = removePriceOutliers(prices);

  if (!cleaned.length) return [];

  const sorted = [...cleaned].sort((a, b) => a - b);

  if (sorted.length <= 5) {
    return sorted.map(roundMoney);
  }

  const start = Math.floor(sorted.length * 0.1);
  const end = Math.ceil(sorted.length * 0.55);
  const slice = sorted.slice(start, end);

  return (slice.length ? slice : sorted.slice(0, 6)).map(roundMoney);
}

function getBucketFallbackBuckets(targetBucket) {
  if (targetBucket === "used") return ["used", "refurbished"];
  if (targetBucket === "refurbished") return ["refurbished", "used"];
  if (targetBucket === "new") return ["new"];
  if (targetBucket === "spares_repair") return ["spares_repair"];
  return [targetBucket];
}

function filterItemsForExactSearch(items, product, condition) {
  return items.filter((item) =>
    itemMatchesProduct(item?.title || "", product, condition)
  );
}

function buildAutoCompsFromItems({ items, product, condition }) {
  const targetBucket = detectConditionBucket(`${product} ${condition}`);

  const matched = items.filter((item) =>
    itemMatchesProduct(item?.title || "", product, condition)
  );

  const sameBucket = matched.filter((item) => {
    const itemBucket = getItemBucket(item);
    return itemBucket === targetBucket;
  });

  let finalMatched = sameBucket;

  if (finalMatched.length < 3) {
    const allowedBuckets = getBucketFallbackBuckets(targetBucket);

    finalMatched = matched.filter((item) => {
      const bucket = getItemBucket(item);
      return allowedBuckets.includes(bucket);
    });
  }

  const priced = finalMatched
    .map((item) => ({
      title: String(item?.title || ""),
      price: roundMoney(Number(item?.price || 0)),
      shipping: roundMoney(Number(item?.shipping || 0)),
      total: roundMoney(Number(item?.price || 0) + Number(item?.shipping || 0)),
      condition: String(item?.condition || ""),
      url: item?.itemWebUrl || "",
      bucket: getItemBucket(item),
      itemId: item?.itemId || "",
    }))
    .filter((item) => item.total > 0);

  const totals = priced.map((item) => item.total);
  const selectedPrices = selectCompPrices(totals);

  let confidence = 25;
  if (selectedPrices.length >= 3) confidence = 50;
  if (selectedPrices.length >= 5) confidence = 68;
  if (selectedPrices.length >= 7) confidence = 82;
  if (selectedPrices.length >= 10) confidence = 92;

  if (sameBucket.length >= 3) {
    confidence += 8;
  }

  confidence = Math.min(95, confidence);

  let confidenceLabel = "Low";
  if (confidence >= 80) confidenceLabel = "High";
  else if (confidence >= 55) confidenceLabel = "Medium";

  return {
    pricingMode: "Auto comps estimate",
    targetBucket,
    searchCount: items.length,
    matchedCount: matched.length,
    bucketMatchedCount: sameBucket.length,
    compCount: selectedPrices.length,
    prices: selectedPrices,
    manualSoldPricesText: selectedPrices.join(", "),
    avgPrice: selectedPrices.length ? getAverage(selectedPrices) : 0,
    medianPrice: selectedPrices.length ? getMedian(selectedPrices) : 0,
    minPrice: selectedPrices.length ? roundMoney(Math.min(...selectedPrices)) : 0,
    maxPrice: selectedPrices.length ? roundMoney(Math.max(...selectedPrices)) : 0,
    confidence,
    confidenceLabel,
    matchedItemsPreview: priced.slice(0, 8),
  };
}

function buildConditionSignal(item) {
  const title = normalizeText(item?.title || "");
  const condition = normalizeText(item?.condition || "");
  const text = `${title} ${condition}`;

  let multiplier = 1;
  let repairCost = 0;

  if (text.includes("unlocked")) multiplier += 0.05;
  if (text.includes("excellent")) multiplier += 0.04;
  if (text.includes("very good")) multiplier += 0.03;
  if (text.includes("good")) multiplier += 0.015;
  if (text.includes("boxed")) multiplier += 0.01;
  if (text.includes("bundle")) multiplier += 0.02;
  if (text.includes("fully working")) multiplier += 0.025;
  if (text.includes("tested")) multiplier += 0.015;

  if (text.includes("91% battery")) multiplier += 0.03;
  else if (text.includes("90% battery")) multiplier += 0.025;
  else if (text.includes("89% battery")) multiplier += 0.02;
  else if (text.includes("88% battery")) multiplier += 0.015;

  if (text.includes("cracked")) {
    multiplier -= 0.12;
    repairCost += 18;
  }

  if (text.includes("faulty")) {
    multiplier -= 0.2;
    repairCost += 22;
  }

  if (text.includes("for repair") || text.includes("not working")) {
    multiplier -= 0.22;
    repairCost += 25;
  }

  if (text.includes("spares") || text.includes("parts")) {
    multiplier -= 0.25;
    repairCost += 15;
  }

  if (text.includes("locked")) {
    multiplier -= 0.14;
  }

  if (multiplier < 0.72) multiplier = 0.72;
  if (multiplier > 1.12) multiplier = 1.12;

  return {
    resaleMultiplier: roundMoney(multiplier),
    repairCost: roundMoney(repairCost),
  };
}

function buildLiveMarketSnapshot({ items, query, condition }) {
  const targetBucket = detectConditionBucket(`${query} ${condition}`);
  const exactItems = filterItemsForExactSearch(items, query, condition || "");

  const sameBucket = exactItems.filter((item) => {
    const bucket = getItemBucket(item, condition || "");
    return bucket === targetBucket;
  });

  let marketItems = sameBucket;

  if (marketItems.length < 4) {
    const allowedBuckets = getBucketFallbackBuckets(targetBucket);
    marketItems = exactItems.filter((item) => {
      const bucket = getItemBucket(item, condition || "");
      return allowedBuckets.includes(bucket);
    });
  }

  const priced = marketItems
    .map((item) => ({
      itemId: item?.itemId || "",
      title: item?.title || "",
      total: roundMoney(Number(item?.price || 0) + Number(item?.shipping || 0)),
      condition: item?.condition || "",
      itemWebUrl: item?.itemWebUrl || "",
      bucket: getItemBucket(item, condition || ""),
    }))
    .filter((item) => item.total > 0);

  const totals = priced.map((item) => item.total);
  const selectedPrices = selectCompPrices(totals);

  return {
    targetBucket,
    matchedCount: exactItems.length,
    bucketMatchedCount: sameBucket.length,
    marketItemCount: priced.length,
    selectedPrices,
    marketMedian: selectedPrices.length ? getMedian(selectedPrices) : 0,
    marketAverage: selectedPrices.length ? getAverage(selectedPrices) : 0,
    marketMin: selectedPrices.length ? roundMoney(Math.min(...selectedPrices)) : 0,
    marketMax: selectedPrices.length ? roundMoney(Math.max(...selectedPrices)) : 0,
    marketItemsPreview: priced.slice(0, 12),
  };
}

function buildItemLiveCompPrices(snapshot, itemIdToExclude) {
  const prices = snapshot.marketItemsPreview
    .filter((item) => item.itemId !== itemIdToExclude)
    .map((item) => item.total)
    .filter((value) => Number.isFinite(value) && value > 0);

  return selectCompPrices(prices);
}

function buildScannerMetricsFromLiveMarket(item, snapshot) {
  const itemPrice = Number(item?.price || 0);
  const shipping = Number(item?.shipping || 0);
  const totalBuyPrice = roundMoney(itemPrice + shipping);

  const compPrices = buildItemLiveCompPrices(snapshot, item?.itemId || "");
  const fallbackPrices =
    compPrices.length > 0 ? compPrices : snapshot.selectedPrices;

  const marketMedian = fallbackPrices.length ? getMedian(fallbackPrices) : 0;
  const marketAverage = fallbackPrices.length ? getAverage(fallbackPrices) : 0;

  const signal = buildConditionSignal(item);

  let conservativeBase = marketMedian || marketAverage || 0;
  if (!conservativeBase && totalBuyPrice > 0) {
    conservativeBase = roundMoney(totalBuyPrice * 1.18);
  }

  const estimatedResale = roundMoney(
    conservativeBase * Number(signal.resaleMultiplier || 1)
  );
  const ebayFees = roundMoney(estimatedResale * 0.15);
  const repairCost = roundMoney(signal.repairCost || 0);
  const estimatedProfit = roundMoney(
    estimatedResale - ebayFees - totalBuyPrice - repairCost
  );
  const marginPercent =
    estimatedResale > 0 ? roundMoney((estimatedProfit / estimatedResale) * 100) : 0;

  let verdict = "SKIP";
  if (estimatedProfit >= 18 || marginPercent >= 16) {
    verdict = "GOOD DEAL";
  } else if (estimatedProfit >= 4 || marginPercent >= 5) {
    verdict = "MARGINAL";
  }

  let risk = "High";
  if (verdict === "GOOD DEAL") risk = "Low";
  else if (verdict === "MARGINAL") risk = "Medium";

  const titleText = normalizeText(item?.title || "");
  if (
    titleText.includes("faulty") ||
    titleText.includes("spares") ||
    titleText.includes("parts") ||
    titleText.includes("not working")
  ) {
    risk = "High";
  }

  let score = 0;
  if (estimatedProfit > -5) {
    score = Math.min(
      99,
      Math.max(
        1,
        Math.round(
          estimatedProfit * 2.0 +
            marginPercent * 1.1 +
            (verdict === "GOOD DEAL" ? 12 : verdict === "MARGINAL" ? 5 : 0)
        )
      )
    );
  }

  return {
    estimatedResale,
    estimatedProfit,
    totalBuyPrice,
    ebayFees,
    repairCost,
    score,
    marginPercent,
    risk,
    verdict,
    marketMedian,
    marketAverage,
    compCount: fallbackPrices.length,
    compPrices: fallbackPrices,
    pricingMode: "Conservative live comps",
  };
}

function scoreDealCandidate(item, scanner) {
  const totalBuyPrice = Number(scanner?.totalBuyPrice || 0);
  const estimatedResale = Number(scanner?.estimatedResale || 0);
  const estimatedProfit = Number(scanner?.estimatedProfit || 0);
  const marginPercent = Number(scanner?.marginPercent || 0);
  const risk = String(scanner?.risk || "High");
  const title = String(item?.title || "").toLowerCase();
  const shipping = Number(item?.shipping || 0);

  const undervaluedAmount = roundMoney(estimatedResale - totalBuyPrice);
  const undervaluedPercent = estimatedResale > 0
    ? roundMoney((undervaluedAmount / estimatedResale) * 100)
    : 0;

  let riskPenalty = 0;
  if (risk === "High") riskPenalty = 6;
  else if (risk === "Medium") riskPenalty = 2;

  let shippingBonus = 0;
  if (shipping === 0) shippingBonus = 4;
  else if (shipping <= 3.99) shippingBonus = 2;

  let titleBonus = 0;
  if (title.includes("unlocked")) titleBonus += 4;
  if (title.includes("excellent")) titleBonus += 3;
  if (title.includes("very good")) titleBonus += 2;
  if (title.includes("boxed")) titleBonus += 1;
  if (title.includes("bundle")) titleBonus += 2;
  if (title.includes("fully working")) titleBonus += 2;

  let score =
    estimatedProfit * 2.1 +
    marginPercent * 1.1 +
    undervaluedPercent * 0.7 +
    shippingBonus +
    titleBonus -
    riskPenalty;

  if (!Number.isFinite(score)) score = 0;

  return {
    dealScore: roundMoney(score),
    undervaluedAmount,
    undervaluedPercent,
  };
}

function getDealReason(item, scanner, scored) {
  const reasons = [];
  const title = String(item?.title || "").toLowerCase();
  const shipping = Number(item?.shipping || 0);
  const profit = Number(scanner?.estimatedProfit || 0);
  const marginPercent = Number(scanner?.marginPercent || 0);
  const risk = String(scanner?.risk || "High");
  const compCount = Number(scanner?.compCount || 0);

  if (profit >= 18 || marginPercent >= 16) {
    reasons.push("strong estimated margin versus live market");
  } else if (profit >= 8 || marginPercent >= 8) {
    reasons.push("decent estimated margin versus live market");
  } else if (profit >= 2 || marginPercent >= 4) {
    reasons.push("small but workable live-market gap");
  }

  if (compCount >= 4) reasons.push("based on multiple close live comps");

  if (Number(scored?.undervaluedPercent || 0) >= 15) {
    reasons.push("priced well below conservative live market");
  } else if (Number(scored?.undervaluedPercent || 0) >= 8) {
    reasons.push("priced below conservative live market");
  }

  if (shipping === 0) reasons.push("free shipping helps margin");
  if (title.includes("unlocked")) reasons.push("unlocked stock usually resells better");
  if (title.includes("excellent")) reasons.push("strong condition wording may support resale");
  if (risk === "Low") reasons.push("lower risk profile");

  if (!reasons.length) {
    reasons.push("reasonable match with possible live-market spread");
  }

  return reasons.slice(0, 3).join(". ") + ".";
}

/* =========================
   REAL FLIPPER SANITY LAYER
   ========================= */

function isTrapListingTitle(title) {
  const text = normalizeText(title);

  const trapTerms = [
    "box only",
    "empty box",
    "for parts",
    "for repair",
    "untested",
    "icloud locked",
    "account locked",
    "network locked",
    "spares repair",
    "spares or repair",
    "activation locked",
    "mdm locked",
    "bad esn",
    "blocked imei",
    "not working",
  ];

  return trapTerms.some((term) => text.includes(term));
}

function getListingQualityScore(item) {
  const title = normalizeText(item?.title || "");
  let score = 0;

  if (title.includes("unlocked")) score += 2;
  if (title.includes("excellent")) score += 2;
  if (title.includes("very good")) score += 1;
  if (title.includes("fully working")) score += 2;
  if (title.includes("boxed")) score += 1;
  if (title.includes("tested")) score += 1;

  if (title.includes("read")) score -= 1;
  if (title.includes("see description")) score -= 1;
  if (title.includes("untested")) score -= 3;
  if (title.includes("faulty")) score -= 3;
  if (title.includes("spares")) score -= 3;
  if (title.includes("parts")) score -= 3;
  if (title.includes("cracked")) score -= 2;
  if (title.includes("locked")) score -= 3;

  return score;
}

function passesFlipperSanity(item, scanner) {
  const title = String(item?.title || "");
  const titleText = normalizeText(title);
  const profit = Number(scanner?.estimatedProfit || 0);
  const margin = Number(scanner?.marginPercent || 0);
  const compCount = Number(scanner?.compCount || 0);
  const buyPrice = Number(scanner?.totalBuyPrice || 0);
  const marketMedian = Number(scanner?.marketMedian || 0);
  const risk = String(scanner?.risk || "High");
  const qualityScore = getListingQualityScore(item);

  if (!titleText) return false;

  /* 1. Hard reject trap listings */
  if (isTrapListingTitle(title)) return false;
  if (isAccessoryOnlyTitle(title)) return false;

  /* 2. Weak comps = no confidence */
  if (compCount < 3) return false;

  /* 3. Real profit threshold */
  if (profit < 15 && margin < 10) return false;

  /* 4. Must be clearly under market */
  if (marketMedian > 0 && buyPrice > marketMedian * 0.9) return false;

  /* 5. Risk sanity */
  if (risk === "High" && profit < 22 && margin < 14) return false;

  /* 6. Listing quality sanity */
  if (qualityScore < -1) return false;

  /* 7. Extra caution for damaged/problem stock */
  if (
    (titleText.includes("faulty") ||
      titleText.includes("cracked") ||
      titleText.includes("spares") ||
      titleText.includes("parts")) &&
    profit < 25
  ) {
    return false;
  }

  return true;
}

function buildFindDealsResults({ items, query, condition }) {
  const snapshot = buildLiveMarketSnapshot({
    items,
    query,
    condition,
  });

  const exactItems = filterItemsForExactSearch(items, query, condition || "");

  const enriched = exactItems
    .map((item) => {
      const scanner = buildScannerMetricsFromLiveMarket(item, snapshot);
      const scored = scoreDealCandidate(item, scanner);
      const reason = getDealReason(item, scanner, scored);

      return {
        ...item,
        scanner,
        dealScore: scored.dealScore,
        undervaluedAmount: scored.undervaluedAmount,
        undervaluedPercent: scored.undervaluedPercent,
        reason,
        marketBucket: getItemBucket(item, condition || ""),
        sanityPassed: passesFlipperSanity(item, scanner),
        listingQualityScore: getListingQualityScore(item),
      };
    })
    .filter((item) => Number(item?.scanner?.estimatedResale || 0) > 0)
    .sort((a, b) => {
      return (
        Number(b.dealScore || 0) - Number(a.dealScore || 0) ||
        Number(b?.scanner?.estimatedProfit || 0) - Number(a?.scanner?.estimatedProfit || 0)
      );
    })
    .map((item, index) => {
      let finderLabel = "Worth checking";

      if (index === 0 && Number(item.dealScore || 0) > 24) {
        finderLabel = "Best deal";
      } else if (Number(item?.scanner?.estimatedProfit || 0) < 0) {
        finderLabel = "Skip";
      } else if (Number(item?.scanner?.estimatedProfit || 0) < 5) {
        finderLabel = "Tight margin";
      } else if (Number(item?.scanner?.estimatedProfit || 0) >= 18) {
        finderLabel = "Strong margin";
      }

      if (item.sanityPassed) {
        if (Number(item?.scanner?.estimatedProfit || 0) >= 25) {
          finderLabel = "Buy now";
        } else if (Number(item?.scanner?.estimatedProfit || 0) >= 18) {
          finderLabel = "Strong margin";
        } else {
          finderLabel = "Worth checking";
        }
      }

      return {
        ...item,
        finderLabel,
      };
    });

  return {
    snapshot,
    deals: enriched,
  };
}

function getUserFromCookie(req) {
  try {
    const token = req.cookies?.flipai_token;
    if (!token) return null;

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = getUserById(decoded.userId);

    return user || null;
  } catch {
    return null;
  }
}

app.post(
  "/api/stripe/webhook",
  express.raw({ type: "application/json" }),
  stripeWebhookHandler
);

app.use(cors({ origin: appUrl, credentials: true }));
app.use(cookieParser());
app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

app.post("/api/signup", signupHandler);
app.post("/api/login", loginHandler);
app.post("/api/logout", logoutHandler);

app.get("/api/me", requireAuth, (req, res) => {
  res.json({ user: safeUser(req.user) });
});

app.post("/api/create-checkout-session", requireAuth, async (req, res) => {
  try {
    const plan = String(req.body?.plan || "").toLowerCase();
    const url = await createCheckoutSession(req.user, plan);
    res.json({ url });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ error: error.message || "Could not create checkout session." });
  }
});

app.post("/api/create-portal-session", requireAuth, async (req, res) => {
  try {
    const url = await createPortalSession(req.user);
    res.json({ url });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ error: error.message || "Could not open billing portal." });
  }
});

app.post("/api/analyze", async (req, res) => {
  try {
    const user = getUserFromCookie(req);

    if (!user) {
      return res.status(401).json({
        error: "Please sign in to use FlipAI analysis.",
        locked: true,
      });
    }

    const allowedUser = enforceUsage(user);

    const {
      product,
      condition,
      buyPrice,
      repairCost,
      extras,
      goal,
      manualSoldPrices,
    } = req.body || {};

    if (!product || !condition) {
      return res.status(400).json({
        error: "Product name and condition are required.",
      });
    }

    const flipMetrics = calculateFlipMetrics({
      buyPrice,
      repairCost,
      condition,
      manualSoldPrices,
      goal,
    });

    const aiResult = await runAnalysis({
      product,
      condition,
      buyPrice,
      repairCost,
      extras,
      goal,
      manualSoldPrices,
      manualSoldComps: flipMetrics.soldComps,
      forcedEstimatedResale: flipMetrics.estimatedResale,
      pricingMode: flipMetrics.pricingMode,
    });

    const updatedUser = incrementUsage(allowedUser.id);

    return res.json({
      result: {
        ...aiResult,
        flipMetrics,
        manualSoldComps: flipMetrics.soldComps,
        locked: false,
      },
      user: safeUser(updatedUser),
    });
  } catch (error) {
    if (error.statusCode === 403) {
      return res.status(403).json({
        error: error.message,
        locked: true,
      });
    }

    console.error(error);
    return res.status(500).json({
      error: error.message || "Could not generate analysis.",
    });
  }
});

app.post("/api/auto-comps", async (req, res) => {
  try {
    const user = getUserFromCookie(req);

    if (!user) {
      return res.status(401).json({
        error: "Please sign in to auto-fill comps.",
      });
    }

    const { product, condition } = req.body || {};

    if (!product || !String(product).trim()) {
      return res.status(400).json({
        error: "Product is required.",
      });
    }

    const searchQuery = buildAutoCompSearchQuery(product, condition);

    const items = await searchEbayMarketPool({
      query: searchQuery,
      condition: "",
      limit: 50,
    });

    const autoComps = buildAutoCompsFromItems({
      items,
      product,
      condition,
    });

    if (!autoComps.compCount) {
      return res.status(404).json({
        error: "No strong matching live comps were found.",
        searchQuery,
        autoComps,
      });
    }

    return res.json({
      ok: true,
      searchQuery,
      autoComps,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      error: error.message || "Could not auto-fill comps.",
    });
  }
});

app.post("/api/search-ebay", async (req, res) => {
  try {
    const user = getUserFromCookie(req);

    if (!user) {
      return res.status(401).json({
        error: "Please sign in to search eBay.",
      });
    }

    const { query, limit, filterPriceMax, condition, freeShippingOnly } =
      req.body || {};

    if (!query || !String(query).trim()) {
      return res.status(400).json({
        error: "Search query is required.",
      });
    }

    const items = await searchEbayListings({
      query,
      limit,
      maxPrice: filterPriceMax,
      condition,
      freeShippingOnly,
    });

    const marketPool = await searchEbayMarketPool({
      query: buildAutoCompSearchQuery(query, condition || ""),
      condition: "",
      limit: 50,
    });

    const snapshot = buildLiveMarketSnapshot({
      items: marketPool,
      query,
      condition,
    });

    const exactItems = filterItemsForExactSearch(items, query, condition || "");

    const scannedItems = exactItems
      .map((item) => ({
        ...item,
        scanner: buildScannerMetricsFromLiveMarket(item, snapshot),
      }))
      .sort((a, b) => {
        return (
          Number(b?.scanner?.estimatedProfit || 0) -
          Number(a?.scanner?.estimatedProfit || 0)
        );
      })
      .map((item, index) => ({
        ...item,
        bestDeal: index === 0 && Number(item?.scanner?.estimatedProfit || 0) > 0,
      }));

    return res.json({
      items: scannedItems,
      marketSnapshot: snapshot,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      error: error.message || "Could not search eBay.",
    });
  }
});

app.post("/api/find-deals", async (req, res) => {
  try {
    const user = getUserFromCookie(req);

    if (!user) {
      return res.status(401).json({
        error: "Please sign in to find deals.",
      });
    }

    const {
      query,
      condition = "",
      filterPriceMax,
      freeShippingOnly = false,
      limit = 30,
      topN = 8,
    } = req.body || {};

    if (!query || !String(query).trim()) {
      return res.status(400).json({
        error: "Search query is required.",
      });
    }

    const items = await searchEbayListings({
      query,
      limit: Math.min(Number(limit || 30), 50),
      maxPrice: filterPriceMax,
      condition,
      freeShippingOnly,
    });

    const marketPool = await searchEbayMarketPool({
      query: buildAutoCompSearchQuery(query, condition || ""),
      condition: "",
      limit: 50,
    });

    const ranked = buildFindDealsResults({
      items: marketPool,
      query,
      condition,
    });

    const eligibleItemIds = new Set(items.map((item) => item.itemId));

    const rankedDeals = ranked.deals
      .filter((deal) => eligibleItemIds.has(deal.itemId))
      .filter((deal) => deal.sanityPassed === true);

    const finalDeals = rankedDeals.slice(
      0,
      Math.max(1, Math.min(Number(topN || 8), 12))
    );

    return res.json({
      ok: true,
      query,
      totalFetched: items.length,
      totalMatched: rankedDeals.length,
      marketSnapshot: ranked.snapshot,
      deals: finalDeals,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      error: error.message || "Could not find deals.",
    });
  }
});

app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(port, () => {
  console.log(`FlipAI running on ${appUrl}`);
});
