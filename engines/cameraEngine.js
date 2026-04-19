import {
  baseEngine,
  normalizeText,
  roundMoney,
  median,
  percentile,
  removePriceOutliers,
  extractTotalPrice,
} from "./baseEngine.js";

/* =========================
   CAMERA DETECTION
========================= */

function isCameraQuery(text) {
  const t = normalizeText(text);

  return (
    t.includes("sony") ||
    t.includes("canon") ||
    t.includes("nikon") ||
    t.includes("a6400") ||
    t.includes("a6000") ||
    t.includes("a6500") ||
    t.includes("a6600") ||
    t.includes("camera")
  );
}

/* =========================
   FAMILY DETECTION
========================= */

function parseCameraFamily(text) {
  const t = normalizeText(text);

  if (t.includes("a6400")) return "sony_a6400";
  if (t.includes("a6000")) return "sony_a6000";
  if (t.includes("a6500")) return "sony_a6500";
  if (t.includes("a6600")) return "sony_a6600";

  return "";
}

/* =========================
   ACCESSORY FILTER (FIXED)
========================= */

function isAccessoryListing(text) {
  const t = normalizeText(text);

  // HARD rejects
  if (
    t.includes("lens only") ||
    t.includes("camera bag") ||
    t.includes("strap") ||
    t.includes("battery") ||
    t.includes("charger") ||
    t.includes("tripod") ||
    t.includes("gimbal") ||
    t.includes("memory card") ||
    t.includes("sd card")
  ) {
    return true;
  }

  // 🔥 FIX: allow body only
  if (t.includes("body only")) {
    return false;
  }

  // Allow bundles (camera + lens)
  if (t.includes("camera") && t.includes("lens")) {
    return false;
  }

  // If just lens → reject
  if (t.includes("lens")) {
    return true;
  }

  return false;
}

/* =========================
   MATCH LOGIC
========================= */

function matchesCamera(item, queryContext) {
  const text = normalizeText(
    [
      item?.title,
      item?.subtitle,
      item?.description,
      item?.condition,
    ]
      .filter(Boolean)
      .join(" ")
  );

  if (!text) return false;

  if (isAccessoryListing(text)) return false;

  const family = queryContext.family;

  if (family && !text.includes(family.replace("sony_", "").replace("_", ""))) {
    return false;
  }

  return true;
}

/* =========================
   PRICING MODEL
========================= */

function buildCameraPricingModel(items = []) {
  const totals = removePriceOutliers(
    items.map((i) => extractTotalPrice(i)).filter((v) => v > 0)
  );

  const marketMedian = median(totals);
  const marketLow = percentile(totals, 0.35);

  let baseline = marketMedian || marketLow || 0;

  const estimatedResale = roundMoney(baseline * 0.95);

  const compCount = totals.length;

  let confidence = 25;
  if (compCount >= 3) confidence = 55;
  if (compCount >= 5) confidence = 70;
  if (compCount >= 8) confidence = 85;

  let confidenceLabel = "Low";
  if (confidence >= 80) confidenceLabel = "High";
  else if (confidence >= 55) confidenceLabel = "Medium";

  return {
    estimatedResale,
    compCount,
    confidence,
    confidenceLabel,
    pricingMode: "Camera market median",
    marketMedian,
    marketLow,
    listingMedian: 0,
  };
}

/* =========================
   EXPORT ENGINE
========================= */

export const cameraEngine = {
  ...baseEngine,
  id: "camera",

  detect(query = "") {
    return isCameraQuery(query);
  },

  classifyQuery(query = "") {
    const normalizedQuery = normalizeText(query);

    return {
      rawQuery: query,
      normalizedQuery,
      family: parseCameraFamily(query),
    };
  },

  buildSearchQuery(query = "") {
    return query;
  },

  expandSearchVariants(query = "") {
    const t = normalizeText(query);

    if (t.includes("a6400")) {
      return [
        "sony a6400",
        "sony a6400 body",
        "alpha a6400",
        "ilce-6400",
        "a6400 camera body",
      ];
    }

    return [query];
  },

  matchesItem(item, queryContext) {
    const result = matchesCamera(item, queryContext);

    console.log("CAMERA DEBUG:", {
      title: item?.title,
      matched: result,
    });

    return result;
  },

  buildPricingModel({ marketItems = [] }) {
    return buildCameraPricingModel(marketItems);
  },

  classifyItem() {
    return {
      repairCost: 0,
      bundleType: "standard",
      bundleSignals: {},
      bundleValueBonus: 0,
      warningFlags: [],
      warningScorePenalty: 0,
    };
  },

  adjustListingPricing({ pricingModel }) {
    return {
      estimatedResale: pricingModel?.estimatedResale || 0,
      bundleValueBonus: 0,
      warningFlags: [],
      warningScorePenalty: 0,
      bundleType: "standard",
      bundleSignals: {},
    };
  },
};
