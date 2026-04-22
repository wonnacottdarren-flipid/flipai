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

function squashSpaces(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function hasAny(text, phrases = []) {
  const rawHaystack = String(text || "");
  const haystack = squashSpaces(rawHaystack);

  return phrases.some((phrase) => {
    const rawNeedle = String(phrase || "");
    const needle = squashSpaces(rawNeedle);
    return rawHaystack.includes(rawNeedle) || haystack.includes(needle);
  });
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

function wantsCompleteSetFromQuery(queryContext = {}) {
  const q = normalizeText(queryContext?.normalizedQuery || queryContext?.rawQuery || "");

  return hasAny(q, [
    "complete",
    "complete set",
    "full set",
    "boxed complete",
    "with case",
    "with charging case",
    "pair",
    "both buds",
    "both earbuds",
  ]);
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
      "headsets & earpieces",
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
      "parts & accessories",
      "ear tips",
      "tips",
      "pads",
      "ear pads",
      "headbands",
      "holder",
      "holders",
      "two-way radio parts & accessories",
    ])
  );
}

function hasSamsungOfficialSignals(text) {
  const t = normalizeText(text);

  return hasAny(t, [
    "samsung galaxy buds",
    "galaxy buds2 pro",
    "galaxy buds 2 pro",
    "galaxy buds3 pro",
    "galaxy buds 3 pro",
    "galaxy buds3",
    "galaxy buds 3",
    "galaxy buds2",
    "galaxy buds 2",
    "galaxy buds pro",
    "galaxy buds live",
    "galaxy buds plus",
    "galaxy buds fe",
    "sm-r510",
    "sm-r530",
    "sm-r630",
    "official samsung",
    "genuine samsung",
  ]);
}

function hasSuspiciousMobileAccessoryCategories(item = {}) {
  const categoryTexts = getCategoryTexts(item);

  const hasSuspicious = categoryTexts.some((text) =>
    hasAny(text, [
      "radio communication equipment",
      "mobile phones & communication",
      "parts & accessories",
      "two-way radio parts & accessories",
      "facility maintenance & safety",
      "business office & industrial",
      "surveillance & alarm equipment",
    ])
  );

  const hasStrongAudioCategory = categoryTexts.some((text) =>
    hasAny(text, [
      "portable audio",
      "sound & vision",
      "headphones",
      "headsets",
    ])
  );

  return hasSuspicious && !hasStrongAudioCategory;
}

function isAccessoryOnly(text) {
  return hasAny(text, [
    "case only",
    "charging case only",
    "case cradle only",
    "charging cradle only",
    "cradle only",
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
    "left airpod replacement",
    "right airpod replacement",
    "left earbud replacement",
    "right earbud replacement",
  ]);
}

function looksLikeSingleSideEarbud(text) {
  const t = normalizeText(text);

  return hasAny(t, [
    "(left)",
    "(right)",
    "[left]",
    "[right]",
    "left only",
    "right only",
    "left side only",
    "right side only",
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
    "replacement earbud",
    "replacement earbuds",
    "replacement bud",
    "replacement buds",
    "replacement left",
    "replacement right",
    "left replacement",
    "right replacement",
    "earbud replacement",
    "single bud",
    "single earbud",
    "single airpod",
    "left airpod replacement",
    "right airpod replacement",
    "left airpod",
    "right airpod",
    "left airpod gen",
    "right airpod gen",
    "left earbud replacement",
    "right earbud replacement",
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
    "best quality",
    "high quality",
    "premium quality",
    "aaa quality",
    "1:1",
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

function isNonUkListing(item = {}) {
  const raw = String(item?.location || "").trim().toUpperCase();
  if (!raw) return false;

  const allowed = ["GB", "UK", "UNITED KINGDOM"];
  return !allowed.includes(raw);
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
      "case cradle",
      "charging cradle",
      "case a2968",
      "case only",
      "charging case only",
      "case cradle only",
      "charging cradle only",
      "cradle only",
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
    "complete pair",
    "pair of earbuds",
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

function hasAirpodsCaseSignals(text) {
  const t = normalizeText(text);

  return hasAny(t, [
    "with case",
    "with charging case",
    "charging case",
    "magsafe case",
    "lightning case",
    "usb-c case",
    "usb c case",
    "wireless charging case",
    "case included",
    "includes case",
    "earbuds and case",
    "buds and case",
  ]);
}

function hasAirpodsPairedModelSignals(text) {
  const t = normalizeText(text);

  return hasAny(t, [
    "a2698+a2699",
    "a2698 a2699",
    "a2698+a2699+a2700",
    "a2698 a2699 a2700",
    "a3047+a3048",
    "a3047 a3048",
    "a3047+a3048+a2968",
    "a3047 a3048 a2968",
    "a2698 + a2699",
    "a3047 + a3048",
  ]);
}

function hasAirpodsCompleteConfidenceSignals(text) {
  const t = normalizeText(text);

  return (
    hasFullSetSignals(t) ||
    hasAirpodsCaseSignals(t) ||
    hasAirpodsPairedModelSignals(t) ||
    hasAny(t, [
      "boxed",
      "with box",
      "box and case",
      "complete",
      "complete set",
      "full set",
      "left and right",
      "left & right",
      "both buds",
      "both earbuds",
      "a2700",
      "a2968",
    ])
  );
}

function looksLikeLikelyCompleteAirpodsListing(text, queryContext = {}, item = {}) {
  const t = normalizeText(text);
  const family = String(queryContext?.family || "");
  const wantsCompleteSet = Boolean(queryContext?.wantsCompleteSet);

  if (!wantsCompleteSet) return false;
  if (!family.startsWith("airpods_")) return false;

  if (!hasAny(t, ["airpods"])) return false;
  if (isAccessoryOnly(t)) return false;
  if (isPartialItem(t)) return false;
  if (looksLikeSingleSideEarbud(t)) return false;
  if (looksLikeCaseOnlyListing(t)) return false;

  const inAudioCategory = isAudioCategory(item);
  const inAccessoryCategory = isAccessoryCategory(item);

  if (inAccessoryCategory && !inAudioCategory) return false;
  if (!hasAirpodsCompleteConfidenceSignals(t)) return false;

  return true;
}

function hasSamsungStrongCompleteSignals(text) {
  const t = normalizeText(text);

  return hasAny(t, [
    "with the box",
    "with box",
    "boxed",
    "boxed complete",
    "box included",
    "includes box",
    "with case",
    "with charging case",
    "case included",
    "includes case",
    "complete",
    "complete set",
    "full set",
    "full working set",
    "earbuds and case",
    "buds and case",
    "both earbuds",
    "both buds",
    "left and right",
    "left & right",
  ]);
}

function looksLikeLikelyCompleteSamsungListing(text, queryContext = {}, item = {}) {
  const t = normalizeText(text);
  const family = String(queryContext?.family || "");
  const wantsCompleteSet = Boolean(queryContext?.wantsCompleteSet);

  if (!wantsCompleteSet) return false;
  if (!family.startsWith("galaxy_buds")) return false;

  if (!hasSamsungOfficialSignals(t) && !hasAny(t, ["buds2 pro", "buds 2 pro", "buds3 pro", "buds 3 pro"])) {
    return false;
  }

  if (isAccessoryOnly(t)) return false;
  if (isPartialItem(t)) return false;
  if (looksLikeSingleSideEarbud(t)) return false;
  if (looksLikeCaseOnlyListing(t)) return false;
  if (isGenericSamsungCloneListing(t, queryContext)) return false;
  if (looksLikeSuspiciousSamsungBudsListing(item, queryContext, t)) return false;

  const inAudioCategory = isAudioCategory(item);
  const inAccessoryCategory = isAccessoryCategory(item);

  if (inAccessoryCategory && !inAudioCategory) return false;
  if (!inAudioCategory && !hasSamsungOfficialSignals(t)) return false;

  if (!hasSamsungStrongCompleteSignals(t)) return false;

  return true;
}

function hasStrongCompleteSignals(text, queryContext = {}, item = {}) {
  const t = normalizeText(text);
  const wantsCompleteSet = Boolean(queryContext?.wantsCompleteSet);

  if (!wantsCompleteSet) {
    return true;
  }

  if (hasFullSetSignals(t)) return true;

  if (
    hasAny(t, [
      "complete",
      "complete set",
      "full set",
      "boxed complete",
      "with case",
      "with charging case",
      "both buds",
      "both earbuds",
      "left and right",
      "left & right",
      "boxed",
      "box and case",
      "with box",
    ])
  ) {
    return true;
  }

  const family = String(queryContext?.family || "");
  const inAudioCategory = isAudioCategory(item);
  const inAccessoryCategory = isAccessoryCategory(item);

  if (inAccessoryCategory && !inAudioCategory) {
    return false;
  }

  if (family.startsWith("sony_wf_")) {
    if (
      hasAny(t, [
        "sony wf-1000xm4 earbuds and case",
        "wf-1000xm4 earbuds and case",
        "sony wf 1000xm4 earbuds and case",
        "wf 1000xm4 earbuds and case",
        "sony wf-1000xm4 box and case",
        "sony wf 1000xm4 box and case",
      ])
    ) {
      return true;
    }
  }

  if (family.startsWith("airpods_")) {
    if (looksLikeLikelyCompleteAirpodsListing(t, queryContext, item)) {
      return true;
    }
  }

  if (family.startsWith("galaxy_buds")) {
    if (looksLikeLikelyCompleteSamsungListing(t, queryContext, item)) {
      return true;
    }
  }

  return false;
}

function looksLikeLikelyCompleteSonyListing(text, queryContext = {}, item = {}) {
  const t = normalizeText(text);
  const family = String(queryContext?.family || "");
  const wantsCompleteSet = Boolean(queryContext?.wantsCompleteSet);

  if (!wantsCompleteSet) return false;
  if (family !== "sony_wf_1000xm4") return false;

  if (!hasAny(t, ["wf-1000xm4", "wf1000xm4"])) return false;
  if (!hasAny(t, ["sony", "earbuds", "wireless", "bluetooth", "noise cancelling", "noise canceling"])) {
    return false;
  }

  if (isAccessoryOnly(t)) return false;
  if (isPartialItem(t)) return false;
  if (looksLikeSingleSideEarbud(t)) return false;
  if (looksLikeCaseOnlyListing(t)) return false;
  if (isSonyAccessoryListing(t, queryContext)) return false;

  const inAudioCategory = isAudioCategory(item);
  const inAccessoryCategory = isAccessoryCategory(item);

  if (inAccessoryCategory && !inAudioCategory) return false;

  return true;
}

function getSamsungCheapNewThreshold(family = "") {
  if (family === "galaxy_buds3_pro") return 55;
  if (family === "galaxy_buds3") return 40;
  if (family === "galaxy_buds2_pro") return 42;
  if (family === "galaxy_buds2") return 28;
  if (family === "galaxy_buds_pro") return 32;
  if (family === "galaxy_buds_fe") return 28;
  if (family === "galaxy_buds_live") return 24;
  if (family === "galaxy_buds_plus") return 22;
  return 0;
}

function looksLikeSuspiciousSamsungBudsListing(item = {}, queryContext = {}, text = "") {
  const family = String(queryContext?.family || "");
  if (!family.startsWith("galaxy_buds")) return false;

  const t = normalizeText(text);
  const total = Number(extractTotalPrice(item) || 0);
  const cheapNewThreshold = getSamsungCheapNewThreshold(family);
  const looksNew = hasAny(t, ["brand new", "new", "sealed", "unopened", "unused"]);
  const suspiciousCategoryMix = hasSuspiciousMobileAccessoryCategories(item);
  const officialSignals = hasSamsungOfficialSignals(t);
  const genericWirelessTitle = hasAny(t, [
    "true wireless earbuds",
    "bluetooth headphones",
    "wireless earbuds",
    "wireless bluetooth earbuds",
    "wireless bluetooth earphones",
  ]);

  if (looksNew && cheapNewThreshold > 0 && total > 0 && total < cheapNewThreshold) {
    return true;
  }

  if (suspiciousCategoryMix && genericWirelessTitle && !officialSignals) {
    return true;
  }

  if (suspiciousCategoryMix && looksNew && cheapNewThreshold > 0 && total > 0 && total < cheapNewThreshold + 8) {
    return true;
  }

  return false;
}

function looksLikeSuspiciouslyCheapPremiumAudio(item, queryContext = {}, text = "") {
  const family = String(queryContext?.family || "");
  const total = Number(extractTotalPrice(item) || 0);
  const t = normalizeText(text);

  if (!total || total <= 0) return false;

  if (family === "airpods_pro_2") {
    const looksTooCheapNew =
      hasAny(t, ["brand new", "new", "sealed", "with box", "boxed"]) && total < 55;
    const looksTooCheapAny = total < 35;

    if (looksTooCheapNew || looksTooCheapAny) {
      return true;
    }
  }

  if (family === "airpods_pro") {
    const looksTooCheapNew =
      hasAny(t, ["brand new", "new", "sealed", "with box", "boxed"]) && total < 45;
    const looksTooCheapAny = total < 28;

    if (looksTooCheapNew || looksTooCheapAny) {
      return true;
    }
  }

  return false;
}

function looksLikeIncompleteEarbudListing(text, queryContext = {}, item = {}) {
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
      "case cradle",
      "charging cradle",
    ]) &&
    !hasFullSetSignals(t) &&
    !hasStrongCompleteSignals(t, queryContext, item)
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
      "left airpod replacement",
      "right airpod replacement",
      "left earbud replacement",
      "right earbud replacement",
    ])
  ) {
    return true;
  }

  if (queryContext?.wantsCompleteSet) {
    const strongComplete = hasStrongCompleteSignals(t, queryContext, item);
    const likelyCompleteSony = looksLikeLikelyCompleteSonyListing(t, queryContext, item);
    const likelyCompleteAirpods = looksLikeLikelyCompleteAirpodsListing(t, queryContext, item);
    const likelyCompleteSamsung = looksLikeLikelyCompleteSamsungListing(t, queryContext, item);

    if (!strongComplete && !likelyCompleteSony && !likelyCompleteAirpods && !likelyCompleteSamsung) {
      return true;
    }
  }

  return false;
}

function isGenericSamsungCloneListing(text, queryContext = {}) {
  const t = normalizeText(text);
  const brand = String(queryContext?.brand || "");
  const family = String(queryContext?.family || "");

  if (brand !== "samsung" && !family.startsWith("galaxy_buds")) {
    return false;
  }

  const genericCloneSignals = [
    "for samsung galaxy",
    "for samsung",
    "for galaxy",
    "compatible with samsung",
    "compatible with galaxy",
    "wireless bluetooth earbuds",
    "wireless bluetooth earphones",
    "wireless earbud",
    "wireless earphone",
    "best quality",
    "high quality",
    "premium quality",
    "aaa quality",
    "bliss anit-noise",
    "anit-noise",
    "3color",
    "3 color",
    "earphones for samsung",
    "buds for samsung",
  ];

  const officialSignals = [
    "samsung galaxy buds",
    "galaxy buds2 pro",
    "galaxy buds 2 pro",
    "galaxy buds3 pro",
    "galaxy buds 3 pro",
    "galaxy buds3",
    "galaxy buds 3",
    "sm-r510",
    "sm-r530",
    "sm-r630",
    "official samsung",
    "genuine samsung",
  ];

  const hasGenericCloneSignal = hasAny(t, genericCloneSignals);
  const hasOfficialSignal = hasAny(t, officialSignals);

  if (hasGenericCloneSignal && !hasOfficialSignal) {
    return true;
  }

  if (
    hasAny(t, [
      "buds 2 pro for samsung",
      "buds2pro for samsung",
      "buds 3 pro for samsung",
      "buds3 pro for samsung",
      "buds 3 for samsung",
      "buds3 for samsung",
    ])
  ) {
    return true;
  }

  return false;
}

function isSonyAccessoryListing(text, queryContext = {}) {
  const t = normalizeText(text);
  const family = String(queryContext?.family || "");
  const brand = String(queryContext?.brand || "");

  const isSonyEarbudQuery =
    brand === "sony" &&
    (family.startsWith("sony_wf_") || t.includes("wf-1000xm") || t.includes("wf1000xm"));

  if (!isSonyEarbudQuery) return false;

  if (looksLikeSingleSideEarbud(t)) return true;
  if (looksLikeCaseOnlyListing(t)) return true;

  if (
    hasAny(t, [
      "ear tips",
      "ear tip",
      "foam tips",
      "foam tip",
      "replacement tips",
      "replacement tip",
      "silicone tips",
      "silicone tip",
      "memory foam tips",
      "memory foam tip",
      "anti-slip replacement ear tips",
      "anti slip replacement ear tips",
      "buds tips",
      "earbud tips",
      "tip set",
      "tips set",
      "tips for sony",
    ])
  ) {
    return true;
  }

  if (
    hasAny(t, [
      "battery",
      "batteries",
      "battery replacement",
      "replacement battery",
      "case battery",
      "charging case battery",
      "zenipower",
      "z55h",
      "cp1254",
    ])
  ) {
    return true;
  }

  if (
    hasAny(t, [
      "case only",
      "replacement case",
      "case replacement",
      "charging case replacement",
      "charging case only",
      "changing case",
      "case cradle only",
      "charging cradle only",
      "cradle only",
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
  if (family === "sony_wf_1000xm4") return queryContext?.wantsCompleteSet ? 50 : 45;
  if (family === "sony_wf_1000xm3") return 30;

  if (family === "bose_qc_earbuds_2") return 65;
  if (family === "bose_qc_earbuds") return 40;

  if (family === "galaxy_buds3_pro") return 75;
  if (family === "galaxy_buds3") return 52;
  if (family === "galaxy_buds2_pro") return queryContext?.wantsCompleteSet ? 45 : 55;
  if (family === "galaxy_buds2") return 32;
  if (family === "galaxy_buds_pro") return 36;
  if (family === "galaxy_buds_live") return 24;
  if (family === "galaxy_buds_plus") return 22;
  if (family === "galaxy_buds_fe") return 26;

  if (brand === "apple" && isEarbudFamily(queryContext)) return 30;
  return 0;
}

function getAudioResaleMultiplier(queryContext = {}, exactMarketCount = 0) {
  const family = String(queryContext?.family || "");
  const brand = String(queryContext?.brand || "");

  let multiplier = 0.94;

  if (family) multiplier = 0.95;
  if (exactMarketCount >= 5) multiplier = 0.96;

  if (brand === "samsung" && family.startsWith("galaxy_buds")) {
    multiplier = 0.98;
    if (exactMarketCount >= 5) multiplier = 0.99;
  }

  if (brand === "sony" && family === "sony_wf_1000xm4" && queryContext?.wantsCompleteSet) {
    multiplier = 0.97;
    if (exactMarketCount >= 5) multiplier = 0.98;
  }

  return multiplier;
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
  if (isNonUkListing(item)) return -10;
  if (isAccessoryOnly(text)) return -10;
  if (isPartialItem(text)) return -10;
  if (looksLikeSingleSideEarbud(text)) return -10;
  if (looksLikeCaseOnlyListing(text)) return -10;
  if (looksLikeIncompleteEarbudListing(text, queryContext, item)) return -10;
  if (isSonyAccessoryListing(text, queryContext)) return -10;
  if (isGenericSamsungCloneListing(text, queryContext)) return -10;
  if (looksLikeSuspiciousSamsungBudsListing(item, queryContext, text)) return -10;
  if (isBrokenOrFaulty(text) && !shouldAllowDamagedListings(queryContext)) return -10;
  if (isDirtyListing(text)) return -10;
  if (looksLikeSuspiciouslyCheapPremiumAudio(item, queryContext, text)) return -10;

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
    if (looksLikeIncompleteEarbudListing(text, queryContext, item)) score -= 8;
  }

  if (queryContext.wantsCompleteSet) {
    if (hasStrongCompleteSignals(text, queryContext, item)) {
      score += 3.5;
    } else if (looksLikeLikelyCompleteSonyListing(text, queryContext, item)) {
      score += 1.5;
    } else if (looksLikeLikelyCompleteAirpodsListing(text, queryContext, item)) {
      score += 2.5;
    } else if (looksLikeLikelyCompleteSamsungListing(text, queryContext, item)) {
      score += 2.5;
    } else {
      score -= 2;
    }
  }

  if (queryContext.family === "sony_wf_1000xm4") {
    if (hasFullSetSignals(text)) score += 2;
    if (text.includes("wf-1000xm4") || text.includes("wf1000xm4")) score += 1.5;
    if (text.includes("battery")) score -= 8;
    if (text.includes("ear tips") || text.includes("foam tips")) score -= 8;

    if (queryContext.wantsCompleteSet) {
      if (
        hasAny(text, [
          "complete",
          "complete set",
          "full set",
          "boxed complete",
          "with charging case",
          "both earbuds",
          "both buds",
          "left and right",
          "left & right",
          "boxed",
          "with box",
        ])
      ) {
        score += 4;
      } else if (looksLikeLikelyCompleteSonyListing(text, queryContext, item)) {
        score += 2;
      } else {
        score -= 2;
      }

      if (looksLikeCaseOnlyListing(text)) score -= 10;
    }
  }

  if (queryContext.family === "galaxy_buds3_pro" || queryContext.family === "galaxy_buds2_pro") {
    if (hasAny(text, ["sm-r630", "sm-r510", "genuine samsung", "official samsung"])) score += 1.5;
    if (looksLikeCaseOnlyListing(text)) score -= 12;
    if (hasAny(text, ["case cradle only", "charging cradle only", "cradle only"])) score -= 12;
    if (looksLikeSuspiciousSamsungBudsListing(item, queryContext, text)) score -= 16;
    if (looksLikeLikelyCompleteSamsungListing(text, queryContext, item)) score += 2;
  }

  if (queryContext.family === "airpods_pro_2") {
    if (looksLikeSuspiciouslyCheapPremiumAudio(item, queryContext, text)) score -= 12;
    if (
      hasAny(text, [
        "left airpod replacement",
        "right airpod replacement",
        "left airpod",
        "right airpod",
      ])
    ) {
      score -= 16;
    }
    if (looksLikeLikelyCompleteAirpodsListing(text, queryContext, item)) {
      score += 2;
    }
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
        fullSet:
          hasStrongCompleteSignals(text, queryContext, item) ||
          looksLikeLikelyCompleteSonyListing(text, queryContext, item) ||
          looksLikeLikelyCompleteAirpodsListing(text, queryContext, item) ||
          looksLikeLikelyCompleteSamsungListing(text, queryContext, item),
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

  if (queryContext?.wantsCompleteSet) {
    const strictMarketFullSet = marketConditionPool.filter((entry) => entry.fullSet);
    const strictListingFullSet = listingConditionPool.filter((entry) => entry.fullSet);

    if (strictMarketFullSet.length >= 3) {
      marketConditionPool = strictMarketFullSet;
    }

    if (strictListingFullSet.length >= 2) {
      listingConditionPool = strictListingFullSet;
    }
  }

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

  const conservativeMultiplier = getAudioResaleMultiplier(queryContext, exactMarket.length);
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
  if (queryContext.wantsCompleteSet && exactMarket.length >= 3) confidence += 2;

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
    const wantsCompleteSet = wantsCompleteSetFromQuery({ normalizedQuery, rawQuery });

    return {
      rawQuery,
      normalizedQuery,
      brand,
      family,
      allowDamaged,
      wantsCompleteSet,
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
      if (ctx.wantsCompleteSet) {
        variants.push("airpods pro 2 complete");
        variants.push("airpods pro 2 full set");
        variants.push("apple airpods pro 2 with case");
        variants.push("airpods pro 2 magsafe case");
        variants.push("airpods pro 2 a2698 a2699 a2700");
      }
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

    if (ctx.family === "galaxy_buds2_pro") {
      variants.push("galaxy buds2 pro");
      variants.push("galaxy buds 2 pro");
      variants.push("samsung galaxy buds2 pro");
      variants.push("samsung galaxy buds 2 pro");
      variants.push("buds2 pro");
      variants.push("buds 2 pro");
      if (ctx.wantsCompleteSet) {
        variants.push("galaxy buds 2 pro complete");
        variants.push("galaxy buds2 pro complete");
        variants.push("galaxy buds 2 pro full set");
        variants.push("samsung galaxy buds 2 pro with case");
        variants.push("samsung galaxy buds 2 pro with box");
        variants.push("galaxy buds 2 pro sm-r510");
      }
    }

    if (ctx.family === "galaxy_buds3_pro") {
      variants.push("galaxy buds3 pro");
      variants.push("galaxy buds 3 pro");
      variants.push("samsung galaxy buds3 pro");
      variants.push("samsung galaxy buds 3 pro");
      variants.push("buds3 pro");
      variants.push("buds 3 pro");
      if (ctx.wantsCompleteSet) {
        variants.push("galaxy buds 3 pro complete");
        variants.push("galaxy buds3 pro complete");
        variants.push("galaxy buds 3 pro full set");
        variants.push("samsung galaxy buds 3 pro with case");
        variants.push("samsung galaxy buds 3 pro with box");
        variants.push("galaxy buds 3 pro sm-r630");
      }
    }

    if (ctx.family === "galaxy_buds3") {
      variants.push("galaxy buds3");
      variants.push("galaxy buds 3");
      variants.push("samsung galaxy buds3");
      variants.push("samsung galaxy buds 3");
      variants.push("buds3");
      variants.push("buds 3");
    }

    if (ctx.family === "galaxy_buds2") {
      variants.push("galaxy buds2");
      variants.push("galaxy buds 2");
      variants.push("samsung galaxy buds2");
      variants.push("samsung galaxy buds 2");
      variants.push("buds2");
      variants.push("buds 2");
    }

    if (ctx.family === "galaxy_buds_pro") {
      variants.push("galaxy buds pro");
      variants.push("samsung galaxy buds pro");
    }

    if (ctx.family === "galaxy_buds_live") {
      variants.push("galaxy buds live");
      variants.push("samsung galaxy buds live");
    }

    if (ctx.family === "galaxy_buds_plus") {
      variants.push("galaxy buds plus");
      variants.push("galaxy buds+");
      variants.push("samsung galaxy buds plus");
    }

    if (ctx.family === "galaxy_buds_fe") {
      variants.push("galaxy buds fe");
      variants.push("samsung galaxy buds fe");
    }

    if (ctx.family === "sony_wf_1000xm4") {
      variants.push("sony wf-1000xm4");
      variants.push("sony wf 1000xm4");
      variants.push("wf-1000xm4");
      variants.push("wf1000xm4");
      variants.push("sony wf-1000xm4 earbuds");
      if (ctx.wantsCompleteSet) {
        variants.push("sony wf-1000xm4 complete");
        variants.push("sony wf-1000xm4 full set");
        variants.push("sony wf-1000xm4 complete set");
        variants.push("sony wf-1000xm4 with charging case");
        variants.push("sony wf-1000xm4 boxed");
      }
    }

    if (ctx.family === "sony_wf_1000xm5") {
      variants.push("sony wf-1000xm5");
      variants.push("sony wf 1000xm5");
      variants.push("wf-1000xm5");
      variants.push("wf1000xm5");
    }

    if (ctx.family === "sony_wf_1000xm3") {
      variants.push("sony wf-1000xm3");
      variants.push("sony wf 1000xm3");
      variants.push("wf-1000xm3");
      variants.push("wf1000xm3");
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
    if (isNonUkListing(item)) return false;
    if (isAccessoryOnly(text)) return false;
    if (isPartialItem(text)) return false;
    if (looksLikeSingleSideEarbud(text)) return false;
    if (looksLikeCaseOnlyListing(text)) return false;
    if (looksLikeIncompleteEarbudListing(text, queryContext, item)) return false;
    if (isSonyAccessoryListing(text, queryContext)) return false;
    if (isGenericSamsungCloneListing(text, queryContext)) return false;
    if (looksLikeSuspiciousSamsungBudsListing(item, queryContext, text)) return false;
    if (isDirtyListing(text)) return false;
    if (looksLikeSuspiciouslyCheapPremiumAudio(item, queryContext, text)) return false;

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
      if (looksLikeIncompleteEarbudListing(text, queryContext, item)) return false;
    }

    if (queryContext.family === "sony_wf_1000xm4") {
      if (text.includes("battery")) return false;
      if (text.includes("ear tips") || text.includes("foam tips")) return false;
      if (text.includes("charging case only")) return false;
      if (text.includes("compatible") && !text.includes("sony")) return false;
    }

    if (
      queryContext.family === "galaxy_buds3_pro" ||
      queryContext.family === "galaxy_buds2_pro" ||
      queryContext.family === "galaxy_buds3" ||
      queryContext.family === "galaxy_buds2"
    ) {
      if (looksLikeCaseOnlyListing(text)) return false;
      if (hasAny(text, ["case cradle only", "charging cradle only", "cradle only"])) return false;
      if (looksLikeSuspiciousSamsungBudsListing(item, queryContext, text)) return false;
    }

    if (queryContext.family === "airpods_pro_2") {
      if (looksLikeSuspiciouslyCheapPremiumAudio(item, queryContext, text)) return false;
      if (
        hasAny(text, [
          "left airpod replacement",
          "right airpod replacement",
          "left airpod",
          "right airpod",
        ])
      ) {
        return false;
      }
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
