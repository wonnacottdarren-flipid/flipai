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

function getCategoryTexts(item = {}) {
  const names = Array.isArray(item?.categories)
    ? item.categories.map((category) => category?.categoryName).filter(Boolean)
    : [];

  return names.map((name) => normalizeText(name));
}

function isPhoneCategory(item = {}) {
  const categoryTexts = getCategoryTexts(item);

  return categoryTexts.some((text) =>
    hasAny(text, [
      "mobile & smart phones",
      "mobile phones",
      "smartphones",
      "cell phones",
      "cell phones & smartphones",
      "mobile phones & communication",
    ])
  );
}

function isAccessoryCategory(item = {}) {
  const categoryTexts = getCategoryTexts(item);

  return categoryTexts.some((text) =>
    hasAny(text, [
      "cases, covers & skins",
      "cases covers & skins",
      "mobile phone accessories",
      "phone accessories",
      "chargers & docks",
      "cables & adapters",
      "replacement parts",
      "parts",
      "screen protectors",
      "mounts & holders",
      "holders",
      "battery cases",
      "accessories",
    ])
  );
}

function isPartsCategory(item = {}) {
  const categoryTexts = getCategoryTexts(item);

  return categoryTexts.some((text) =>
    hasAny(text, [
      "replacement parts",
      "parts",
      "lcds",
      "digitizers",
      "screens",
      "batteries",
      "housing",
      "flex cables",
      "logic boards",
    ])
  );
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
    "replacement screen",
    "screen assembly",
    "battery replacement",
    "rear glass only",
    "front glass only",
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

function hasHandsetSignals(text) {
  return hasAny(text, [
    "smartphone",
    "mobile phone",
    "handset",
    "phone",
    "boxed",
    "original box",
    "battery health",
    "face id",
    "fully working",
    "working order",
    "used",
    "grade a",
    "grade b",
    "grade c",
    "sim free",
    "unlocked",
    "64gb",
    "128gb",
    "256gb",
    "512gb",
    "1tb",
  ]);
}

function isOverlyGenericPhoneTitle(text, queryContext) {
  const t = normalizeText(text);
  const family = String(queryContext?.family || "");

  if (!family) return false;

  const genericIphoneTitles = [
    "iphone",
    "apple iphone",
  ];

  const genericSamsungTitles = [
    "samsung",
    "samsung galaxy",
    "galaxy",
  ];

  if (queryContext.brand === "iphone" && genericIphoneTitles.includes(t)) return true;
  if (queryContext.brand === "samsung" && genericSamsungTitles.includes(t)) return true;

  if (
    family === "iphone_13" &&
    t === "iphone 13"
  ) {
    return false;
  }

  if (
    family === "iphone_12" &&
    t === "iphone 12"
  ) {
    return false;
  }

  if (
    family === "iphone_11" &&
    t === "iphone 11"
  ) {
    return false;
  }

  return false;
}

function classifyPhoneConditionState(text) {
  const t = normalizeText(text);

  if (
    hasAny(t, [
      "for parts",
      "for spares",
      "spares or repairs",
      "spares/repairs",
      "not working",
      "faulty",
      "dead",
      "won't turn on",
      "will not turn on",
      "no power",
      "water damaged",
      "boot loop",
      "bootloop",
      "stuck on logo",
      "motherboard fault",
      "board fault",
      "no display",
      "touch not working",
      "face id not working",
      "camera not working",
      "imei issue",
      "signal issue",
    ])
  ) {
    return "faulty_or_parts";
  }

  if (
    hasAny(t, [
      "cracked screen",
      "screen cracked",
      "cracked display",
      "display cracked",
      "broken screen",
      "needs screen",
      "screen replacement needed",
      "screen replacement required",
      "screen issue",
      "screen issues",
      "green line",
      "pink line",
      "black spot",
      "burn in",
      "screen burn",
      "lcd bleed",
      "dead pixels",
      "back cracked",
      "rear cracked",
      "front cracked",
      "glass cracked",
      "*cracked*",
    ])
  ) {
    return "screen_cracked";
  }

  if (
    hasAny(t, [
      "poor condition",
      "heavy wear",
      "heavily worn",
      "deep scratches",
      "scratches all over",
      "bad condition",
      "fair condition",
      "used fair",
      "used poor",
      "no s pen",
      "missing s pen",
      "no pen",
      "battery service",
      "battery health low",
    ])
  ) {
    return "minor_fault";
  }

  return "clean_working";
}

function shouldAllowDamagedListings(queryContext) {
  const q = normalizeText(queryContext?.normalizedQuery || "");

  return hasAny(q, [
    "cracked",
    "faulty",
    "broken",
    "damaged",
    "for parts",
    "for spares",
    "spares",
    "repairs",
    "needs screen",
    "poor condition",
  ]);
}

function isDamagedConditionState(conditionState) {
  return (
    conditionState === "minor_fault" ||
    conditionState === "screen_cracked" ||
    conditionState === "faulty_or_parts"
  );
}

function estimatePhoneRepairCost(queryContext, conditionState, text) {
  const t = normalizeText(text);
  const family = String(queryContext?.family || "");
  const brand = String(queryContext?.brand || "");

  if (conditionState === "faulty_or_parts") {
    if (brand === "iphone") return 120;
    if (brand === "samsung") return 110;
    return 100;
  }

  if (conditionState === "screen_cracked") {
    if (family.includes("ultra")) return 130;
    if (family.includes("pro_max")) return 120;
    if (family.includes("pro")) return 110;
    if (family.includes("plus")) return 105;
    if (family.includes("fold")) return 180;
    if (family.includes("flip")) return 140;
    if (brand === "iphone") return 100;
    if (brand === "samsung") return 95;
    return 90;
  }

  if (conditionState === "minor_fault") {
    if (t.includes("no s pen") || t.includes("missing s pen")) return 18;
    if (t.includes("battery service") || t.includes("battery health low")) return 35;
    return 20;
  }

  return 0;
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
  if (isSeverelyLocked(text)) return -10;
  if (isAccessoryCategory(item)) return -10;
  if (isPartsCategory(item)) return -10;

  const conditionState = classifyPhoneConditionState(text);
  const allowDamaged = shouldAllowDamagedListings(queryContext);

  if (!allowDamaged && isDamagedConditionState(conditionState)) {
    return -10;
  }

  let score = 0;

  const itemBrand = detectPhoneBrand(text);
  const itemFamily = parsePhoneFamily(text, queryContext.brand);
  const itemStorageGb = extractStorageGb(text);
  const titleText = normalizeText(item?.title || "");
  const inPhoneCategory = isPhoneCategory(item);

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
  } else if (isNetworkLocked(text)) {
    score -= 1.5;
  }

  if (conditionState === "clean_working") score += 1.5;
  if (conditionState === "minor_fault") score -= 1.5;
  if (conditionState === "screen_cracked") score -= 4.5;
  if (conditionState === "faulty_or_parts") score -= 8;

  if (queryContext.brand === "iphone" && text.includes("iphone")) score += 0.5;
  if (queryContext.brand === "samsung" && (text.includes("samsung") || text.includes("galaxy"))) score += 0.5;

  if (inPhoneCategory) score += 2.5;
  else if (hasHandsetSignals(text)) score += 0.8;
  else score -= 3;

  if (isOverlyGenericPhoneTitle(titleText, queryContext) && !inPhoneCategory) {
    score -= 4;
  }

  return score;
}

function enrichPhoneCompPool(queryContext, items = []) {
  return (Array.isArray(items) ? items : [])
    .map((item) => {
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

      return {
        item,
        total: extractTotalPrice(item),
        score: scorePhoneCandidate(item, queryContext),
        conditionState: classifyPhoneConditionState(text),
      };
    })
    .filter((entry) => entry.total > 0 && entry.score > -5)
    .sort((a, b) => b.score - a.score);
}

function buildPhonePricingModel(queryContext, marketItems = [], listingItems = []) {
  const allowDamaged = shouldAllowDamagedListings(queryContext);

  const marketPool = enrichPhoneCompPool(queryContext, marketItems);
  const listingPool = enrichPhoneCompPool(queryContext, listingItems);

  const desiredConditionState = allowDamaged ? null : "clean_working";

  const marketConditionPool = desiredConditionState
    ? marketPool.filter((entry) => entry.conditionState === desiredConditionState)
    : marketPool;

  const listingConditionPool = desiredConditionState
    ? listingPool.filter((entry) => entry.conditionState === desiredConditionState)
    : listingPool;

  const exactMarket = marketConditionPool.filter((entry) => entry.score >= 6);
  const usableMarket =
    exactMarket.length >= 3
      ? exactMarket
      : marketConditionPool.filter((entry) => entry.score >= 3);

  const exactListings = listingConditionPool.filter((entry) => entry.score >= 6);
  const usableListings =
    exactListings.length >= 2
      ? exactListings
      : listingConditionPool.filter((entry) => entry.score >= 3);

  let marketTotals = removePriceOutliers(
    (usableMarket.length ? usableMarket : marketConditionPool)
      .slice(0, 20)
      .map((entry) => entry.total)
  );

  let listingTotals = removePriceOutliers(
    (usableListings.length ? usableListings : listingConditionPool)
      .slice(0, 14)
      .map((entry) => entry.total)
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
    const allowDamaged = shouldAllowDamagedListings({ normalizedQuery });

    return {
      rawQuery,
      normalizedQuery,
      brand,
      family,
      storageGb,
      wantsUnlocked,
      wantsLocked,
      allowDamaged,
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
    if (isSeverelyLocked(text)) return false;
    if (isAccessoryCategory(item)) return false;
    if (isPartsCategory(item)) return false;

    const conditionState = classifyPhoneConditionState(text);
    const allowDamaged = Boolean(queryContext?.allowDamaged);

    if (!allowDamaged && isDamagedConditionState(conditionState)) {
      return false;
    }

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

    if (queryContext.wantsUnlocked && !isExplicitlyUnlocked(text)) {
      return false;
    }

    if (queryContext.wantsUnlocked && isNetworkLocked(text)) {
      return false;
    }

    const inPhoneCategory = isPhoneCategory(item);
    if (!inPhoneCategory && !hasHandsetSignals(text)) {
      return false;
    }

    if (isOverlyGenericPhoneTitle(item?.title || "", queryContext) && !inPhoneCategory) {
      return false;
    }

    return true;
  },

  buildPricingModel({ queryContext, marketItems = [], listingItems = [] }) {
    return buildPhonePricingModel(queryContext, marketItems, listingItems);
  },

  classifyItem(item, queryContext) {
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

    const conditionState = classifyPhoneConditionState(text);
    const repairCost = estimatePhoneRepairCost(queryContext, conditionState, text);

    return {
      conditionState,
      repairCost,
    };
  },
};
