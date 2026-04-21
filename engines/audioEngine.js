import {
  baseEngine,
  normalizeText,
  roundMoney,
  median,
  percentile,
  removePriceOutliers,
  extractTotalPrice,
} from "./baseEngine.js";

const AIRPODS_FAMILY_PATTERNS = [
  [
    "airpods_pro_2",
    [
      "airpods pro 2",
      "airpods pro 2nd",
      "airpods pro second generation",
      "airpods pro gen 2",
      "airpods pro generation 2",
      "airpods pro 2nd gen",
      "airpods pro 2nd generation",
      "airpods pro second gen",
      "airpods pro (2nd gen)",
      "airpods pro 2ndgen",
      "airpods pro 2 generation",
      "apple airpods pro 2",
      "apple airpods pro 2nd",
      "apple airpods pro second generation",
    ],
  ],
  ["airpods_pro", ["airpods pro"]],
  [
    "airpods_3",
    [
      "airpods 3",
      "airpods 3rd",
      "airpods third generation",
      "airpods gen 3",
      "airpods 3rd gen",
      "airpods 3rd generation",
    ],
  ],
  [
    "airpods_2",
    [
      "airpods 2",
      "airpods 2nd",
      "airpods second generation",
      "airpods gen 2",
      "airpods 2nd gen",
      "airpods 2nd generation",
    ],
  ],
  ["airpods_max", ["airpods max"]],
];

const SONY_FAMILY_PATTERNS = [
  ["sony_wh_1000xm5", ["wh-1000xm5", "wh1000xm5", "sony xm5", "sony wh xm5", "sony wh-1000xm5"]],
  ["sony_wh_1000xm4", ["wh-1000xm4", "wh1000xm4", "sony xm4", "sony wh xm4", "sony wh-1000xm4"]],
  ["sony_wh_1000xm3", ["wh-1000xm3", "wh1000xm3", "sony xm3", "sony wh xm3", "sony wh-1000xm3"]],
  ["sony_wf_1000xm5", ["wf-1000xm5", "wf1000xm5", "sony wf xm5", "sony wf-1000xm5"]],
  ["sony_wf_1000xm4", ["wf-1000xm4", "wf1000xm4", "sony wf xm4", "sony wf-1000xm4"]],
  ["sony_wf_1000xm3", ["wf-1000xm3", "wf1000xm3", "sony wf xm3", "sony wf-1000xm3"]],
];

const BOSE_FAMILY_PATTERNS = [
  ["bose_qc_ultra", ["qc ultra", "quietcomfort ultra", "bose ultra headphones", "bose qc ultra"]],
  ["bose_qc_45", ["qc45", "qc 45", "quietcomfort 45", "bose qc45"]],
  ["bose_qc_35_ii", ["qc35 ii", "qc 35 ii", "qc35ii", "quietcomfort 35 ii", "bose qc35 ii"]],
  ["bose_qc_35", ["qc35", "qc 35", "quietcomfort 35", "bose qc35"]],
  ["bose_700", ["bose 700", "noise cancelling 700", "nc 700"]],
  ["bose_qc_earbuds_2", ["qc earbuds ii", "qc earbuds 2", "quietcomfort earbuds ii", "quietcomfort earbuds 2"]],
  ["bose_qc_earbuds", ["qc earbuds", "quietcomfort earbuds"]],
];

const SAMSUNG_BUDS_PATTERNS = [
  ["galaxy_buds3_pro", ["galaxy buds3 pro", "galaxy buds 3 pro", "buds3 pro", "buds 3 pro"]],
  ["galaxy_buds3", ["galaxy buds3", "galaxy buds 3"]],
  ["galaxy_buds2_pro", ["galaxy buds2 pro", "galaxy buds 2 pro", "buds2 pro", "buds 2 pro"]],
  ["galaxy_buds2", ["galaxy buds2", "galaxy buds 2"]],
  ["galaxy_buds_pro", ["galaxy buds pro"]],
  ["galaxy_buds_live", ["galaxy buds live"]],
  ["galaxy_buds_plus", ["galaxy buds+", "galaxy buds plus"]],
  ["galaxy_buds_fe", ["galaxy buds fe"]],
];

function hasAny(text, phrases = []) {
  return phrases.some((phrase) => text.includes(phrase));
}

function parseFamilyFromPatterns(text, patterns = []) {
  const haystack = normalizeText(text);

  for (const [slug, phrases] of patterns) {
    if (phrases.some((phrase) => haystack.includes(phrase))) {
      return slug;
    }
  }

  return "";
}

function detectAudioBrand(text) {
  const haystack = normalizeText(text);

  if (haystack.includes("airpods") || haystack.includes("apple airpods")) return "apple";
  if (haystack.includes("sony")) return "sony";
  if (haystack.includes("bose")) return "bose";
  if (haystack.includes("samsung") || haystack.includes("galaxy buds")) return "samsung";

  if (parseFamilyFromPatterns(haystack, AIRPODS_FAMILY_PATTERNS)) return "apple";
  if (parseFamilyFromPatterns(haystack, SONY_FAMILY_PATTERNS)) return "sony";
  if (parseFamilyFromPatterns(haystack, BOSE_FAMILY_PATTERNS)) return "bose";
  if (parseFamilyFromPatterns(haystack, SAMSUNG_BUDS_PATTERNS)) return "samsung";

  return "";
}

function parseAudioFamily(text, brand = "") {
  const haystack = normalizeText(text);

  if (brand === "apple") return parseFamilyFromPatterns(haystack, AIRPODS_FAMILY_PATTERNS);
  if (brand === "sony") return parseFamilyFromPatterns(haystack, SONY_FAMILY_PATTERNS);
  if (brand === "bose") return parseFamilyFromPatterns(haystack, BOSE_FAMILY_PATTERNS);
  if (brand === "samsung") return parseFamilyFromPatterns(haystack, SAMSUNG_BUDS_PATTERNS);

  const detectedBrand = detectAudioBrand(haystack);
  if (detectedBrand === "apple") return parseFamilyFromPatterns(haystack, AIRPODS_FAMILY_PATTERNS);
  if (detectedBrand === "sony") return parseFamilyFromPatterns(haystack, SONY_FAMILY_PATTERNS);
  if (detectedBrand === "bose") return parseFamilyFromPatterns(haystack, BOSE_FAMILY_PATTERNS);
  if (detectedBrand === "samsung") return parseFamilyFromPatterns(haystack, SAMSUNG_BUDS_PATTERNS);

  return "";
}

function getCategoryTexts(item = {}) {
  const names = Array.isArray(item?.categories)
    ? item.categories.map((category) => category?.categoryName).filter(Boolean)
    : [];

  return names.map((name) => normalizeText(name));
}

function isAudioCategory(item = {}) {
  const categoryTexts = getCategoryTexts(item);

  return categoryTexts.some((text) =>
    hasAny(text, [
      "headphones",
      "headsets",
      "portable audio",
      "mp3 player accessories",
      "earbud",
      "earbuds",
      "in-ear headphones",
      "over-ear headphones",
      "on-ear headphones",
      "home headphones",
    ])
  );
}

function isAccessoryCategory(item = {}) {
  const categoryTexts = getCategoryTexts(item);

  return categoryTexts.some((text) =>
    hasAny(text, [
      "cases",
      "covers",
      "skins",
      "chargers",
      "cables",
      "adapters",
      "replacement parts",
      "parts",
      "ear tips",
      "tips",
      "pads",
      "ear pads",
      "headbands",
      "holder",
      "holders",
    ])
  );
}

function isAccessoryOnly(text) {
  return hasAny(text, [
    "case only",
    "charging case only",
    "magsafe case only",
    "usb c case only",
    "lightning case only",
    "case replacement",
    "replacement case",
    "replacement charger",
    "box only",
    "empty box",
    "manual only",
    "sleeve only",
    "ear tips only",
    "tips only",
    "ear pads only",
    "pads only",
    "headband only",
    "charging cable only",
    "usb cable only",
    "wire only",
    "cover only",
    "skin only",
    "charging dock only",
  ]);
}

function isPartialItem(text) {
  return hasAny(text, [
    "left only",
    "right only",
    "left side only",
    "right side only",
    "single ear",
    "one ear",
    "single bud",
    "one bud",
    "left bud only",
    "right bud only",
    "one headphone only",
    "single headphone",
    "replacement earbud",
    "replacement earbuds",
    "replacement bud",
    "replacement buds",
    "replacement left",
    "replacement right",
    "left replacement",
    "right replacement",
    "missing left",
    "missing right",
    "no left",
    "no right",
    "without left",
    "without right",
    "does not include left",
    "does not include right",
    "left airpod only",
    "right airpod only",
    "left ear only",
    "right ear only",
    "single airpod",
    "single earbud",
    "single earbud only",
    "single airpod only",
    "one airpod",
    "one airpod only",
    "one earbud",
    "one earbud only",
    "left earbud only",
    "right earbud only",
    "left earphone only",
    "right earphone only",
    "single piece",
  ]);
}

function looksLikeSingleSideEarbud(text) {
  const t = normalizeText(text);

  return hasAny(t, [
    "left earbud",
    "right earbud",
    "left ear bud",
    "right ear bud",
    "left earphone",
    "right earphone",
    "left earpiece",
    "right earpiece",
    "left piece",
    "right piece",
    "left pod",
    "right pod",
    "left side",
    "right side",
    "left ear",
    "right ear",
    "left unit",
    "right unit",
    "lhs only",
    "rhs only",
  ]);
}

function isBrokenOrFaulty(text) {
  return hasAny(text, [
    "for parts",
    "for spares",
    "spares or repairs",
    "spares/repairs",
    "not working",
    "faulty",
    "broken",
    "dead",
    "no power",
    "won't charge",
    "will not charge",
    "battery issue",
    "battery fault",
    "distorted sound",
    "sound issue",
    "not pairing",
    "pairing issue",
    "one side not working",
    "one ear not working",
    "speaker fault",
    "charging issue",
    "water damaged",
  ]);
}

function isDirtyListing(text) {
  return hasAny(text, [
    "replica",
    "fake",
    "counterfeit",
    "dummy",
    "display model only",
    "not genuine",
    "clone",
    "copy",
  ]);
}

function hasHeadphoneSignals(text) {
  return hasAny(text, [
    "headphones",
    "earbuds",
    "earphones",
    "wireless",
    "bluetooth",
    "noise cancelling",
    "noise canceling",
    "anc",
    "boxed",
    "fully working",
    "working order",
    "used",
    "airpods",
    "galaxy buds",
    "sony",
    "bose",
    "xm4",
    "xm5",
    "qc",
  ]);
}

function isOverlyGenericAudioTitle(text, queryContext) {
  const t = normalizeText(text);
  const family = String(queryContext?.family || "");

  if (!family) return false;

  const genericTitles = [
    "headphones",
    "earbuds",
    "wireless earbuds",
    "wireless headphones",
    "apple airpods",
    "sony headphones",
    "bose headphones",
    "samsung buds",
  ];

  return genericTitles.includes(t);
}

function shouldAllowDamagedListings(queryContext) {
  const q = normalizeText(queryContext?.normalizedQuery || "");

  return hasAny(q, [
    "faulty",
    "broken",
    "damaged",
    "for parts",
    "for spares",
    "spares",
    "repairs",
    "not working",
  ]);
}

function classifyAudioConditionState(text) {
  const t = normalizeText(text);

  if (
    hasAny(t, [
      "for parts",
      "for spares",
      "spares or repairs",
      "spares/repairs",
      "not working",
      "faulty",
      "broken",
      "dead",
      "no power",
      "won't charge",
      "will not charge",
      "battery issue",
      "battery fault",
      "distorted sound",
      "sound issue",
      "not pairing",
      "pairing issue",
      "speaker fault",
      "charging issue",
      "water damaged",
    ])
  ) {
    return "faulty_or_parts";
  }

  if (
    hasAny(t, [
      "heavy wear",
      "heavily worn",
      "poor condition",
      "bad condition",
      "fair condition",
      "deep scratches",
      "scratched heavily",
      "missing tips",
      "missing ear tips",
      "missing pads",
      "replacement pads needed",
    ])
  ) {
    return "minor_fault";
  }

  return "clean_working";
}

function isDamagedConditionState(conditionState) {
  return conditionState === "minor_fault" || conditionState === "faulty_or_parts";
}

function estimateAudioRepairCost(queryContext, conditionState, text) {
  const t = normalizeText(text);
  const family = String(queryContext?.family || "");
  const brand = String(queryContext?.brand || "");

  if (conditionState === "faulty_or_parts") {
    if (family.includes("airpods_max")) return 70;
    if (family.includes("xm5") || family.includes("qc_ultra")) return 65;
    if (brand === "apple") return 55;
    if (brand === "sony") return 50;
    if (brand === "bose") return 50;
    if (brand === "samsung") return 35;
    return 40;
  }

  if (conditionState === "minor_fault") {
    if (t.includes("missing ear tips") || t.includes("missing tips")) return 8;
    if (t.includes("missing pads") || t.includes("replacement pads needed")) return 15;
    return 12;
  }

  return 0;
}

function isEarbudFamily(queryContext = {}) {
  const family = String(queryContext?.family || "");

  return (
    family.startsWith("airpods_") ||
    family.startsWith("galaxy_buds") ||
    family.startsWith("sony_wf_") ||
    family.startsWith("bose_qc_earbuds")
  );
}

function looksLikeCaseOnlyListing(text) {
  const t = normalizeText(text);

  if (
    hasAny(t, [
      "charging case",
      "magsafe charging case",
      "wireless charging case",
      "usb c charging case",
      "lightning charging case",
      "case a2968",
      "case only",
      "charging case only",
    ])
  ) {
    if (
      !hasAny(t, [
        "with earbuds",
        "with buds",
        "with both earbuds",
        "left and right",
        "left & right",
        "full set",
        "complete set",
        "complete",
        "pair of earbuds",
        "both earbuds",
        "both buds",
        "earbuds included",
        "buds included",
        "includes earbuds",
        "includes buds",
        "2 earbuds",
        "two earbuds",
      ])
    ) {
      return true;
    }
  }

  return false;
}

function hasFullSetSignals(text) {
  const t = normalizeText(text);

  return hasAny(t, [
    "full set",
    "complete set",
    "complete",
    "complete pair",
    "pair",
    "both earbuds",
    "both buds",
    "left and right",
    "left & right",
    "with case",
    "with charging case",
    "earbuds and case",
    "buds and case",
    "includes case",
    "includes charging case",
    "earbuds included",
    "buds included",
    "includes earbuds",
    "includes buds",
    "2 earbuds",
    "two earbuds",
    "full working set",
    "boxed complete",
  ]);
}

function looksLikeIncompleteEarbudListing(text, queryContext = {}) {
  const t = normalizeText(text);

  if (!isEarbudFamily(queryContext)) return false;
  if (isAccessoryOnly(t)) return true;
  if (isPartialItem(t)) return true;
  if (looksLikeSingleSideEarbud(t)) return true;
  if (looksLikeCaseOnlyListing(t)) return true;

  if (
    hasAny(t, [
      "charging case",
      "magsafe charging case",
      "wireless charging case",
      "usb c charging case",
      "lightning charging case",
    ]) &&
    !hasFullSetSignals(t)
  ) {
    return true;
  }

  if (
    hasAny(t, [
      "replacement earbud",
      "replacement earbuds",
      "replacement bud",
      "replacement buds",
      "replacement airpod",
      "replacement airpods",
      "left replacement",
      "right replacement",
    ])
  ) {
    return true;
  }

  return false;
}

function getAudioPricingFloor(queryContext = {}) {
  const family = String(queryContext?.family || "");
  const brand = String(queryContext?.brand || "");

  if (family === "airpods_pro_2") return 70;
  if (family === "airpods_pro") return 55;
  if (family === "airpods_3") return 45;
  if (family === "airpods_2") return 30;
  if (family === "airpods_max") return 150;

  if (family === "sony_wf_1000xm5") return 70;
  if (family === "sony_wf_1000xm4") return 45;
  if (family === "sony_wf_1000xm3") return 30;

  if (family === "bose_qc_earbuds_2") return 65;
  if (family === "bose_qc_earbuds") return 40;

  if (family === "galaxy_buds3_pro") return 65;
  if (family === "galaxy_buds3") return 45;
  if (family === "galaxy_buds2_pro") return 45;
  if (family === "galaxy_buds2") return 28;
  if (family === "galaxy_buds_pro") return 30;
  if (family === "galaxy_buds_live") return 22;
  if (family === "galaxy_buds_plus") return 20;
  if (family === "galaxy_buds_fe") return 22;

  if (brand === "apple" && isEarbudFamily(queryContext)) return 30;
  return 0;
}

function scoreAudioCandidate(item, queryContext) {
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
  if (isPartialItem(text)) return -10;
  if (looksLikeSingleSideEarbud(text)) return -10;
  if (looksLikeCaseOnlyListing(text)) return -10;
  if (looksLikeIncompleteEarbudListing(text, queryContext)) return -10;
  if (isBrokenOrFaulty(text) && !shouldAllowDamagedListings(queryContext)) return -10;
  if (isDirtyListing(text)) return -10;

  const conditionState = classifyAudioConditionState(text);
  const allowDamaged = shouldAllowDamagedListings(queryContext);

  if (!allowDamaged && isDamagedConditionState(conditionState)) {
    return -10;
  }

  let score = 0;

  const itemBrand = detectAudioBrand(text);
  const itemFamily = parseAudioFamily(text, queryContext.brand);
  const titleText = normalizeText(item?.title || "");
  const inAudioCategory = isAudioCategory(item);
  const inAccessoryCategory = isAccessoryCategory(item);
  const isEarbuds = isEarbudFamily(queryContext);

  if (queryContext.brand) {
    if (itemBrand === queryContext.brand) score += 1.5;
    else return -10;
  }

  if (queryContext.family) {
    if (itemFamily === queryContext.family) score += 5;
    else if (itemFamily && itemFamily !== queryContext.family) score -= 6;
    else score -= 1.5;
  }

  if (conditionState === "clean_working") score += 1.5;
  if (conditionState === "minor_fault") score -= 2;
  if (conditionState === "faulty_or_parts") score -= 7;

  if (queryContext.brand === "apple" && text.includes("airpods")) score += 0.5;
  if (queryContext.brand === "sony" && text.includes("sony")) score += 0.5;
  if (queryContext.brand === "bose" && text.includes("bose")) score += 0.5;
  if (queryContext.brand === "samsung" && (text.includes("samsung") || text.includes("galaxy buds"))) score += 0.5;

  if (inAudioCategory) score += 2.5;
  else if (hasHeadphoneSignals(text)) score += 0.8;
  else score -= 3;

  if (inAccessoryCategory && !inAudioCategory) {
    score -= 3.5;
  }

  if (isOverlyGenericAudioTitle(titleText, queryContext) && !inAudioCategory) {
    score -= 4;
  }

  if (isEarbuds) {
    if (hasFullSetSignals(text)) score += 2.5;
    if (looksLikeCaseOnlyListing(text)) score -= 8;
    if (isPartialItem(text)) score -= 8;
    if (looksLikeSingleSideEarbud(text)) score -= 8;
    if (looksLikeIncompleteEarbudListing(text, queryContext)) score -= 8;
  }

  return score;
}

function enrichAudioCompPool(queryContext, items = []) {
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
        score: scoreAudioCandidate(item, queryContext),
        conditionState: classifyAudioConditionState(text),
      };
    })
    .filter((entry) => entry.total > 0 && entry.score > -5)
    .sort((a, b) => b.score - a.score);
}

function buildAudioPricingModel(queryContext, marketItems = [], listingItems = []) {
  const allowDamaged = shouldAllowDamagedListings(queryContext);

  const marketPool = enrichAudioCompPool(queryContext, marketItems);
  const listingPool = enrichAudioCompPool(queryContext, listingItems);

  const desiredConditionState = allowDamaged ? null : "clean_working";

  let marketConditionPool = desiredConditionState
    ? marketPool.filter((entry) => entry.conditionState === desiredConditionState)
    : marketPool;

  let listingConditionPool = desiredConditionState
    ? listingPool.filter((entry) => entry.conditionState === desiredConditionState)
    : listingPool;

  const pricingFloor = getAudioPricingFloor(queryContext);

  if (pricingFloor > 0) {
    const filteredMarketConditionPool = marketConditionPool.filter(
      (entry) => entry.total >= pricingFloor
    );
    const filteredListingConditionPool = listingConditionPool.filter(
      (entry) => entry.total >= pricingFloor
    );

    if (filteredMarketConditionPool.length >= 3) {
      marketConditionPool = filteredMarketConditionPool;
    }

    if (filteredListingConditionPool.length >= 2) {
      listingConditionPool = filteredListingConditionPool;
    }
  }

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

  let pricingMode = "Audio model median";
  let baseline = marketMedian || marketLow || listingMedian || 0;

  if (!marketMedian && listingMedian) pricingMode = "Audio listings fallback";
  if (!marketMedian && !listingMedian && marketLow) pricingMode = "Audio low-band fallback";

  let conservativeMultiplier = 0.94;

  if (queryContext.family) conservativeMultiplier = 0.95;
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

export const audioEngine = {
  ...baseEngine,
  id: "audio",

  detect(query = "") {
    const text = normalizeText(query);

    return (
      text.includes("airpods") ||
      text.includes("headphones") ||
      text.includes("earbuds") ||
      text.includes("earphones") ||
      text.includes("galaxy buds") ||
      text.includes("sony wh") ||
      text.includes("sony wf") ||
      text.includes("xm3") ||
      text.includes("xm4") ||
      text.includes("xm5") ||
      text.includes("bose") ||
      text.includes("qc45") ||
      text.includes("qc 45") ||
      text.includes("qc35") ||
      text.includes("qc 35") ||
      text.includes("qc ultra")
    );
  },

  classifyQuery(query = "") {
    const rawQuery = String(query || "").trim();
    const normalizedQuery = normalizeText(rawQuery);
    const brand = detectAudioBrand(normalizedQuery);
    const family = parseAudioFamily(normalizedQuery, brand);
    const allowDamaged = shouldAllowDamagedListings({ normalizedQuery });

    return {
      rawQuery,
      normalizedQuery,
      brand,
      family,
      allowDamaged,
    };
  },

  expandSearchVariants(query = "") {
    const rawQuery = String(query || "").trim();
    const ctx = this.classifyQuery(rawQuery);
    const normalized = normalizeText(rawQuery);
    const variants = [rawQuery];

    if (ctx.family === "airpods_pro_2") {
      variants.push("airpods pro 2");
      variants.push("airpods pro 2nd gen");
      variants.push("airpods pro 2nd generation");
      variants.push("airpods pro gen 2");
      variants.push("apple airpods pro 2");
    }

    if (ctx.family === "airpods_pro") {
      variants.push("airpods pro");
      variants.push("apple airpods pro");
    }

    if (ctx.family === "airpods_3") {
      variants.push("airpods 3");
      variants.push("airpods 3rd gen");
      variants.push("airpods 3rd generation");
    }

    if (ctx.family === "airpods_2") {
      variants.push("airpods 2");
      variants.push("airpods 2nd gen");
      variants.push("airpods 2nd generation");
    }

    if (ctx.family) {
      const niceFamily = ctx.family.replaceAll("_", " ");
      variants.push(niceFamily);

      if (ctx.brand === "apple" && !niceFamily.includes("airpods")) {
        variants.push(`airpods ${niceFamily}`);
      }

      if (ctx.brand === "sony" && !niceFamily.includes("sony")) {
        variants.push(`sony ${niceFamily}`);
      }

      if (ctx.brand === "bose" && !niceFamily.includes("bose")) {
        variants.push(`bose ${niceFamily}`);
      }

      if (ctx.brand === "samsung" && !niceFamily.includes("galaxy")) {
        variants.push(`galaxy ${niceFamily}`);
      }
    }

    if (normalized === "airpods pro 2") {
      variants.push("airpods pro 2nd gen");
      variants.push("airpods pro gen 2");
      variants.push("airpods pro 2nd generation");
    }

    return [...new Set(variants.map((v) => String(v || "").trim()).filter(Boolean))];
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
    if (isPartialItem(text)) return false;
    if (looksLikeSingleSideEarbud(text)) return false;
    if (looksLikeCaseOnlyListing(text)) return false;
    if (looksLikeIncompleteEarbudListing(text, queryContext)) return false;
    if (isDirtyListing(text)) return false;

    const conditionState = classifyAudioConditionState(text);
    const allowDamaged = Boolean(queryContext?.allowDamaged);

    if (!allowDamaged && isDamagedConditionState(conditionState)) {
      return false;
    }

    const itemBrand = detectAudioBrand(text);
    if (queryContext.brand && itemBrand !== queryContext.brand) return false;

    const itemFamily = parseAudioFamily(text, queryContext.brand);
    if (queryContext.family && itemFamily && itemFamily !== queryContext.family) {
      return false;
    }

    const inAudioCategory = isAudioCategory(item);
    const inAccessoryCategory = isAccessoryCategory(item);
    const isEarbuds = isEarbudFamily(queryContext);

    if (!inAudioCategory && !hasHeadphoneSignals(text)) {
      return false;
    }

    if (inAccessoryCategory && !inAudioCategory) {
      return false;
    }

    if (isOverlyGenericAudioTitle(item?.title || "", queryContext) && !inAudioCategory) {
      return false;
    }

    if (isEarbuds) {
      if (isPartialItem(text)) return false;
      if (looksLikeSingleSideEarbud(text)) return false;
      if (looksLikeCaseOnlyListing(text)) return false;
      if (looksLikeIncompleteEarbudListing(text, queryContext)) return false;
    }

    return true;
  },

  buildPricingModel({ queryContext, marketItems = [], listingItems = [] }) {
    return buildAudioPricingModel(queryContext, marketItems, listingItems);
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

    const conditionState = classifyAudioConditionState(text);
    const repairCost = estimateAudioRepairCost(queryContext, conditionState, text);

    return {
      conditionState,
      repairCost,
    };
  },
};
