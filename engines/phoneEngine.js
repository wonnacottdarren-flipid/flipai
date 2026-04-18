import {
  baseEngine,
  normalizeText,
  roundMoney,
  median,
  percentile,
  removePriceOutliers,
  extractTotalPrice,
} from "./baseEngine.js";

const IPHONE_FAMILY_PATTERNS = [
  ["iphone_16_pro_max", ["iphone 16 pro max"]],
  ["iphone_16_pro", ["iphone 16 pro"]],
  ["iphone_16_plus", ["iphone 16 plus"]],
  ["iphone_16", ["iphone 16"]],
  ["iphone_15_pro_max", ["iphone 15 pro max"]],
  ["iphone_15_pro", ["iphone 15 pro"]],
  ["iphone_15_plus", ["iphone 15 plus"]],
  ["iphone_15", ["iphone 15"]],
  ["iphone_14_pro_max", ["iphone 14 pro max"]],
  ["iphone_14_pro", ["iphone 14 pro"]],
  ["iphone_14_plus", ["iphone 14 plus"]],
  ["iphone_14", ["iphone 14"]],
  ["iphone_13_pro_max", ["iphone 13 pro max"]],
  ["iphone_13_pro", ["iphone 13 pro"]],
  ["iphone_13_mini", ["iphone 13 mini"]],
  ["iphone_13", ["iphone 13"]],
  ["iphone_12_pro_max", ["iphone 12 pro max"]],
  ["iphone_12_pro", ["iphone 12 pro"]],
  ["iphone_12_mini", ["iphone 12 mini"]],
  ["iphone_12", ["iphone 12"]],
  ["iphone_11_pro_max", ["iphone 11 pro max"]],
  ["iphone_11_pro", ["iphone 11 pro"]],
  ["iphone_11", ["iphone 11"]],
  ["iphone_se_2022", ["iphone se 2022", "iphone se 3rd", "iphone se 3"]],
  ["iphone_se_2020", ["iphone se 2020", "iphone se 2nd", "iphone se 2"]],
  ["iphone_xr", ["iphone xr"]],
  ["iphone_xs_max", ["iphone xs max"]],
  ["iphone_xs", ["iphone xs"]],
  ["iphone_x", ["iphone x"]],
];

const SAMSUNG_FAMILY_PATTERNS = [
  ["galaxy_z_fold6", ["z fold6", "z fold 6", "galaxy z fold6", "galaxy z fold 6"]],
  ["galaxy_z_fold5", ["z fold5", "z fold 5", "galaxy z fold5", "galaxy z fold 5"]],
  ["galaxy_z_flip6", ["z flip6", "z flip 6", "galaxy z flip6", "galaxy z flip 6"]],
  ["galaxy_z_flip5", ["z flip5", "z flip 5", "galaxy z flip5", "galaxy z flip 5"]],
  ["galaxy_s24_ultra", ["s24 ultra", "galaxy s24 ultra"]],
  ["galaxy_s24_plus", ["s24 plus", "s24+", "galaxy s24 plus", "galaxy s24+"]],
  ["galaxy_s24", ["s24", "galaxy s24"]],
  ["galaxy_s23_ultra", ["s23 ultra", "galaxy s23 ultra"]],
  ["galaxy_s23_plus", ["s23 plus", "s23+", "galaxy s23 plus", "galaxy s23+"]],
  ["galaxy_s23_fe", ["s23 fe", "galaxy s23 fe"]],
  ["galaxy_s23", ["s23", "galaxy s23"]],
  ["galaxy_s22_ultra", ["s22 ultra", "galaxy s22 ultra"]],
  ["galaxy_s22_plus", ["s22 plus", "s22+", "galaxy s22 plus", "galaxy s22+"]],
  ["galaxy_s22", ["s22", "galaxy s22"]],
  ["galaxy_s21_ultra", ["s21 ultra", "galaxy s21 ultra"]],
  ["galaxy_s21_plus", ["s21 plus", "s21+", "galaxy s21 plus", "galaxy s21+"]],
  ["galaxy_s21_fe", ["s21 fe", "galaxy s21 fe"]],
  ["galaxy_s21", ["s21", "galaxy s21"]],
  ["galaxy_a55", ["a55", "galaxy a55"]],
  ["galaxy_a54", ["a54", "galaxy a54"]],
  ["galaxy_a35", ["a35", "galaxy a35"]],
  ["galaxy_a34", ["a34", "galaxy a34"]],
];

function hasAny(text, phrases = []) {
  return phrases.some((phrase) => text.includes(phrase));
}

function extractStorageGb(text) {
  const normalized = normalizeText(text);

  const tbMatch = normalized.match(/\b(1)\s*tb\b/);
  if (tbMatch) return 1024;

  const gbMatch = normalized.match(/\b(64|128|256|512|1024)\s*(gb|g)\b/);
  if (gbMatch) return Number(gbMatch[1]);

  return 0;
}

function parseIphoneFamily(text) {
  const haystack = normalizeText(text);
  for (const [slug, patterns] of IPHONE_FAMILY_PATTERNS) {
    if (patterns.some((pattern) => haystack.includes(pattern))) {
      return slug;
    }
  }
  return "";
}

function parseSamsungFamily(text) {
  const haystack = normalizeText(text);
  for (const [slug, patterns] of SAMSUNG_FAMILY_PATTERNS) {
    if (patterns.some((pattern) => haystack.includes(pattern))) {
      return slug;
    }
  }
  return "";
}

function detectPhoneBrand(text) {
  const haystack = normalizeText(text);

  if (haystack.includes("iphone")) return "iphone";
  if (haystack.includes("samsung") || haystack.includes("galaxy")) return "samsung";

  if (parseIphoneFamily(haystack)) return "iphone";
  if (parseSamsungFamily(haystack)) return "samsung";

  return "";
}

function parsePhoneFamily(text, brand) {
  if (brand === "iphone") return parseIphoneFamily(text);
  if (brand === "samsung") return parseSamsungFamily(text);

  const detected = detectPhoneBrand(text);
  if (detected === "iphone") return parseIphoneFamily(text);
  if (detected === "samsung") return parseSamsungFamily(text);

  return "";
}

function isAccessoryOnly(text) {
  return hasAny(text, [
    "case only",
    "cover only",
    "screen protector",
    "charger only",
    "cable only",
    "usb cable",
    "lightning cable",
    "type c cable",
    "box only",
    "empty box",
    "manual only",
    "sim tray",
    "camera lens protector",
    "tempered glass",
    "screen guard",
    "phone case",
    "back cover",
    "housing only",
    "rear housing",
    "lcd only",
    "screen only",
    "display only",
    "battery only",
    "motherboard only",
    "logic board",
  ]);
}

function isPartsOrFaulty(text) {
  return hasAny(text, [
    "for parts",
    "for spares",
    "spares or repairs",
    "spares/repairs",
    "not working",
    "faulty",
    "broken",
    "cracked badly",
    "dead",
    "won't turn on",
    "will not turn on",
    "no power",
    "water damaged",
    "burn in",
    "screen burn",
  ]);
}

function isSeverelyLocked(text) {
  return hasAny(text, [
    "icloud locked",
    "activation locked",
    "google locked",
    "frp locked",
    "mdm locked",
    "finance locked",
    "blacklisted",
    "blocked imei",
    "bad esn",
  ]);
}

function isNetworkLocked(text) {
  return hasAny(text, [
    "network locked",
    "locked to",
    "o2 locked",
    "ee locked",
    "vodafone locked",
    "three locked",
    "tesco locked",
    "virgin locked",
  ]);
}

function isExplicitlyUnlocked(text) {
  return hasAny(text, [
    "unlocked",
    "sim free",
    "factory unlocked",
    "open network",
  ]);
}

function scorePhoneCandidate(item, queryContext) {
  const text = normalizeText(
    [
      item?.title,
      item?.condition,
      item?.conditionDisplayName,
      item?.subtitle,
    ]
      .filter(Boolean)
      .join(" ")
  );

  if (!text) return -10;
  if (isAccessoryOnly(text)) return -10;
  if (isPartsOrFaulty(text)) return -10;
  if (isSeverelyLocked(text)) return -10;

  let score = 0;

  const itemBrand = detectPhoneBrand(text);
  const itemFamily = parsePhoneFamily(text, queryContext.brand);
  const itemStorageGb = extractStorageGb(text);

  if (queryContext.brand) {
    if (itemBrand === queryContext.brand) score += 1.5;
    else return -10;
  }

  if (queryContext.family) {
    if (itemFamily === queryContext.family) score += 5;
    else if (itemFamily && itemFamily !== queryContext.family) score -= 6;
    else score -= 1.5;
  }

  if (queryContext.storageGb > 0) {
    if (itemStorageGb === queryContext.storageGb) score += 1.5;
    else if (itemStorageGb > 0 && itemStorageGb !== queryContext.storageGb) score -= 2.5;
  }

  if (queryContext.wantsUnlocked) {
    if (isExplicitlyUnlocked(text)) score += 0.8;
    if (isNetworkLocked(text)) score -= 3;
  } else {
    if (isNetworkLocked(text)) score -= 1.5;
  }

  if (queryContext.brand === "iphone" && text.includes("iphone")) score += 0.5;
  if (queryContext.brand === "samsung" && (text.includes("samsung") || text.includes("galaxy"))) score += 0.5;

  return score;
}

function enrichPhoneCompPool(queryContext, items = []) {
  return (Array.isArray(items) ? items : [])
    .map((item) => ({
      item,
      total: extractTotalPrice(item),
      score: scorePhoneCandidate(item, queryContext),
    }))
    .filter((entry) => entry.total > 0 && entry.score > -5)
    .sort((a, b) => b.score - a.score);
}

function buildPhonePricingModel(queryContext, marketItems = [], listingItems = []) {
  const marketPool = enrichPhoneCompPool(queryContext, marketItems);
  const listingPool = enrichPhoneCompPool(queryContext, listingItems);

  const exactMarket = marketPool.filter((entry) => entry.score >= 6);
  const usableMarket =
    exactMarket.length >= 3
      ? exactMarket
      : marketPool.filter((entry) => entry.score >= 3);

  const exactListings = listingPool.filter((entry) => entry.score >= 6);
  const usableListings =
    exactListings.length >= 2
      ? exactListings
      : listingPool.filter((entry) => entry.score >= 3);

  let marketTotals = removePriceOutliers(
    (usableMarket.length ? usableMarket : marketPool).slice(0, 20).map((entry) => entry.total)
  );

  let listingTotals = removePriceOutliers(
    (usableListings.length ? usableListings : listingPool).slice(0, 14).map((entry) => entry.total)
  );

  if (marketTotals.length < 3 && listingTotals.length >= 2) {
    marketTotals = removePriceOutliers([...marketTotals, ...listingTotals]);
  }

  if (listingTotals.length < 2 && marketTotals.length >= 2) {
    listingTotals = marketTotals.slice(0, 12);
  }

  const marketMedian = median(marketTotals);
  const marketLow = percentile(marketTotals, 0.35);
  const listingMedian = median(listingTotals);

  let pricingMode = "Phone model median";
  let baseline = marketMedian || marketLow || listingMedian || 0;

  if (!marketMedian && listingMedian) pricingMode = "Phone listings fallback";
  if (!marketMedian && !listingMedian && marketLow) pricingMode = "Phone low-band fallback";

  let conservativeMultiplier = 0.94;

  if (queryContext.family && queryContext.storageGb > 0) conservativeMultiplier = 0.95;
  if (exactMarket.length >= 5) conservativeMultiplier = 0.96;

  const estimatedResale = roundMoney(baseline * conservativeMultiplier);

  const compCount = marketTotals.length;

  let confidence = 24;
  if (compCount >= 3) confidence = 55;
  if (compCount >= 5) confidence = 70;
  if (compCount >= 8) confidence = 84;

  if (exactMarket.length >= 3) confidence += 4;
  if (exactMarket.length >= 5) confidence += 4;
  if (exactListings.length >= 3) confidence += 3;
  if (queryContext.family) confidence += 2;
  if (queryContext.storageGb > 0) confidence += 2;

  confidence = Math.min(92, confidence);

  let confidenceLabel = "Low";
  if (confidence >= 80) confidenceLabel = "High";
  else if (confidence >= 55) confidenceLabel = "Medium";

  return {
    estimatedResale,
    compCount,
    confidence,
    confidenceLabel,
    pricingMode,
    marketMedian: roundMoney(marketMedian),
    marketLow: roundMoney(marketLow),
    listingMedian: roundMoney(listingMedian),
  };
}

export const phoneEngine = {
  ...baseEngine,
  id: "phone",

  detect(query = "") {
    const text = normalizeText(query);

    return (
      text.includes("iphone") ||
      text.includes("samsung") ||
      text.includes("galaxy")
    );
  },

  classifyQuery(query = "") {
    const rawQuery = String(query || "").trim();
    const normalizedQuery = normalizeText(rawQuery);
    const brand = detectPhoneBrand(normalizedQuery);
    const family = parsePhoneFamily(normalizedQuery, brand);
    const storageGb = extractStorageGb(normalizedQuery);
    const wantsUnlocked = isExplicitlyUnlocked(normalizedQuery);
    const wantsLocked = isNetworkLocked(normalizedQuery);

    return {
      rawQuery,
      normalizedQuery,
      brand,
      family,
      storageGb,
      wantsUnlocked,
      wantsLocked,
    };
  },

  expandSearchVariants(query = "") {
    const rawQuery = String(query || "").trim();
    const ctx = this.classifyQuery(rawQuery);
    const variants = [rawQuery];

    if (ctx.brand === "iphone" && ctx.family) {
      const niceFamily = ctx.family.replaceAll("_", " ");
      variants.push(niceFamily);
      if (ctx.storageGb > 0) {
        variants.push(`${niceFamily} ${ctx.storageGb}gb`);
      }
      if (ctx.wantsUnlocked) {
        variants.push(`${niceFamily} unlocked`);
      }
    }

    if (ctx.brand === "samsung" && ctx.family) {
      const niceFamily = ctx.family
        .replace("galaxy_", "galaxy ")
        .replaceAll("_", " ");
      variants.push(niceFamily);
      if (ctx.storageGb > 0) {
        variants.push(`${niceFamily} ${ctx.storageGb}gb`);
      }
      if (ctx.wantsUnlocked) {
        variants.push(`${niceFamily} unlocked`);
      }
    }

    return [...new Set(variants.filter(Boolean))];
  },

  matchesItem(item, queryContext) {
    const text = normalizeText(
      [
        item?.title,
        item?.condition,
        item?.conditionDisplayName,
        item?.subtitle,
      ]
        .filter(Boolean)
        .join(" ")
    );

    if (!text) return false;
    if (isAccessoryOnly(text)) return false;
    if (isPartsOrFaulty(text)) return false;
    if (isSeverelyLocked(text)) return false;

    const itemBrand = detectPhoneBrand(text);
    if (queryContext.brand && itemBrand !== queryContext.brand) return false;

    const itemFamily = parsePhoneFamily(text, queryContext.brand);
    if (queryContext.family && itemFamily && itemFamily !== queryContext.family) {
      return false;
    }

    const itemStorageGb = extractStorageGb(text);
    if (
      queryContext.storageGb > 0 &&
      itemStorageGb > 0 &&
      itemStorageGb !== queryContext.storageGb
    ) {
      return false;
    }

    if (queryContext.wantsUnlocked && isNetworkLocked(text)) {
      return false;
    }

    return true;
  },

  buildPricingModel({ queryContext, marketItems = [], listingItems = [] }) {
    return buildPhonePricingModel(queryContext, marketItems, listingItems);
  },
};
