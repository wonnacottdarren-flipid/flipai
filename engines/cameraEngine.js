import {
  baseEngine,
  normalizeText,
  roundMoney,
  median,
  percentile,
  removePriceOutliers,
  extractTotalPrice,
} from "./baseEngine.js";

const CAMERA_FAMILIES = [
  [
    "sony_a6400_body",
    [
      "sony a6400",
      "sony alpha a6400",
      "alpha a6400",
      "ilce-6400",
      "ilce 6400",
      "a6400 body",
      "a6400 camera",
    ],
  ],
  [
    "canon_250d_body",
    [
      "canon eos 250d",
      "eos 250d",
      "canon 250d",
      "250d body",
      "rebel sl3",
      "sl3",
      "250d camera",
    ],
  ],
  [
    "gopro_hero_11",
    [
      "gopro hero 11",
      "gopro hero11",
      "go pro hero 11",
      "gopro 11",
      "hero 11 black",
      "hero11 black",
      "hero11",
    ],
  ],
];

const CAMERA_CATEGORY_TERMS = [
  "digital cameras",
  "cameras",
  "dslr cameras",
  "mirrorless cameras",
  "action cameras",
  "camcorders",
];

const ACCESSORY_CATEGORY_TERMS = [
  "camera accessories",
  "digital camera accessories",
  "camera cases bags and covers",
  "camera cases",
  "tripods and supports",
  "batteries",
  "chargers and docks",
  "lens caps",
  "straps",
  "memory cards",
];

const NON_CAMERA_CATEGORY_TERMS = [
  "camera manuals and guides",
  "instruction manuals",
  "books, comics & magazines",
  "camera drones",
  "binoculars & telescopes",
];

const HARD_REJECT_TERMS = [
  "for parts",
  "for spares",
  "spares or repairs",
  "spares repairs",
  "parts only",
  "faulty",
  "broken",
  "not working",
  "wont turn on",
  "won't turn on",
  "will not turn on",
  "no power",
  "water damaged",
  "impact damage",
  "cracked screen",
  "damaged sensor",
  "does not focus",
  "doesn't focus",
  "error code",
  "main board only",
  "body shell only",
];

const ACCESSORY_TERMS = [
  "charger only",
  "battery only",
  "strap only",
  "case only",
  "bag only",
  "manual only",
  "mount only",
  "tripod only",
  "gimbal only",
  "housing only",
  "cage only",
  "mic only",
  "microphone only",
  "light only",
  "lens cap",
  "rear cap",
  "front cap",
  "body cap",
  "eyecup",
  "hot shoe cover",
  "usb cable only",
  "dummy battery",
  "charger",
  "battery charger",
  "strap",
  "camera bag",
  "carry case",
  "tripod",
  "gimbal",
  "selfie stick",
  "floaty",
  "housing",
  "protective housing",
  "mount",
  "helmet mount",
  "chest mount",
  "bike mount",
  "accessory kit",
  "bundle of accessories",
  "memory card",
  "sd card",
];

const NON_CAMERA_TERMS = [
  "box only",
  "empty box",
  "manual only",
  "brochure",
  "leaflet",
  "dvd only",
  "software only",
  "service manual",
  "poster",
  "t-shirt",
  "hoodie",
  "mug",
  "sticker",
  "skin",
  "decal",
];

const LENS_TERMS = [
  "lens only",
  "kit lens",
  "18-55mm",
  "18 55mm",
  "16-50mm",
  "16 50mm",
  "24-70mm",
  "24 70mm",
  "70-200mm",
  "70 200mm",
  "50mm lens",
  "35mm lens",
  "85mm lens",
  "f/1.8",
  "f1.8",
  "f/2.8",
  "f2.8",
  "ef-s",
  "ef s",
  "rf-s",
  "rf s",
  "e-mount lens",
  "e mount lens",
  "lens bundle",
  "sigma lens",
  "tamron lens",
  "sony lens",
  "canon lens",
];

const MINOR_WARNING_TERMS = [
  ["read description", "Read description carefully"],
  ["read desc", "Read description carefully"],
  ["see description", "Read description carefully"],
  ["read caption", "Seller may have important notes in caption"],
  ["see caption", "Seller may have important notes in caption"],
  ["no returns", "No returns accepted"],
  ["untested", "Untested listing"],
  ["poor condition", "Condition may reduce resale appeal"],
  ["heavy wear", "Condition may reduce resale appeal"],
  ["bad condition", "Condition may reduce resale appeal"],
  ["fair condition", "Condition may reduce resale appeal"],
  ["worn", "Condition may reduce resale appeal"],
  ["scratches", "Visible cosmetic wear mentioned"],
  ["scratched", "Visible cosmetic wear mentioned"],
  ["marks", "Visible cosmetic wear mentioned"],
  ["missing battery", "Missing battery"],
  ["no battery", "Missing battery"],
  ["missing charger", "Missing charger"],
  ["no charger", "Missing charger"],
  ["body only", "Body-only listing"],
  ["camera only", "Body-only listing"],
  ["no lens", "Body-only listing"],
  ["without lens", "Body-only listing"],
  ["unboxed", "No box included"],
  ["no box", "No box included"],
  ["without box", "No box included"],
];

function hasAny(text, phrases = []) {
  return phrases.some((phrase) => text.includes(phrase));
}

function normalizeCameraText(value) {
  return normalizeText(String(value || ""))
    .replace(/\bgo\s*pro\b/g, "gopro")
    .replace(/\bhero\s*11\s*black\b/g, "hero11 black")
    .replace(/\bhero\s*11\b/g, "hero11")
    .replace(/\bilce\s*6400\b/g, "ilce-6400")
    .replace(/\b18\s*-\s*55mm\b/g, "18-55mm")
    .replace(/\b16\s*-\s*50mm\b/g, "16-50mm")
    .replace(/\b24\s*-\s*70mm\b/g, "24-70mm")
    .replace(/\b70\s*-\s*200mm\b/g, "70-200mm")
    .replace(/\s+/g, " ")
    .trim();
}

function getTitleText(item) {
  return normalizeCameraText([item?.title, item?.subtitle].filter(Boolean).join(" "));
}

function getCombinedItemText(item) {
  return normalizeCameraText(
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
}

function getCategoryText(item) {
  const categories = Array.isArray(item?.categories) ? item.categories : [];
  return normalizeCameraText(
    categories.map((category) => category?.categoryName).filter(Boolean).join(" ")
  );
}

function detectCameraBrand(text) {
  const t = normalizeCameraText(text);

  if (t.includes("sony") || t.includes("alpha") || t.includes("a6400") || t.includes("ilce-6400")) {
    return "sony";
  }
  if (t.includes("canon") || t.includes("eos 250d") || t.includes("250d") || t.includes("rebel sl3") || t.includes("sl3")) {
    return "canon";
  }
  if (t.includes("gopro") || t.includes("hero11")) {
    return "gopro";
  }

  return "";
}

function parseCameraFamily(text) {
  const t = normalizeCameraText(text);

  if (t.includes("a6400") || t.includes("alpha a6400") || t.includes("ilce-6400")) {
    return "sony_a6400_body";
  }

  if (t.includes("250d") || t.includes("eos 250d") || t.includes("rebel sl3") || t.includes("sl3")) {
    return "canon_250d_body";
  }

  if ((t.includes("gopro") && t.includes("11")) || t.includes("hero11")) {
    return "gopro_hero_11";
  }

  return "";
}

function isCameraCategory(item) {
  return hasAny(getCategoryText(item), CAMERA_CATEGORY_TERMS);
}

function isAccessoryCategory(item) {
  return hasAny(getCategoryText(item), ACCESSORY_CATEGORY_TERMS);
}

function isNonCameraCategory(item) {
  return hasAny(getCategoryText(item), NON_CAMERA_CATEGORY_TERMS);
}

function looksLikeLensOnlyTitle(titleText) {
  const t = normalizeCameraText(titleText);

  if (
    hasAny(t, [
      "lens only",
      "e mount lens",
      "e-mount lens",
      "rf-s lens",
      "rf s lens",
      "ef-s lens",
      "ef s lens",
    ])
  ) {
    return true;
  }

  if (
    hasAny(t, [
      "18-55mm",
      "16-50mm",
      "24-70mm",
      "70-200mm",
      "50mm lens",
      "35mm lens",
      "85mm lens",
      "f/1.8",
      "f1.8",
      "f/2.8",
      "f2.8",
    ]) &&
    !t.includes("body") &&
    !t.includes("camera")
  ) {
    return true;
  }

  return false;
}

function isObviousAccessoryTitle(titleText) {
  const t = normalizeCameraText(titleText);

  if (hasAny(t, ACCESSORY_TERMS)) return true;
  if (hasAny(t, NON_CAMERA_TERMS)) return true;
  if (looksLikeLensOnlyTitle(t)) return true;

  return false;
}

function looksLikeSonyA6400MainTitle(titleText) {
  const t = normalizeCameraText(titleText);
  if (!hasAny(t, ["a6400", "alpha a6400", "ilce-6400"])) return false;
  if (looksLikeLensOnlyTitle(t)) return false;
  if (isObviousAccessoryTitle(t)) return false;
  return true;
}

function looksLikeCanon250DMainTitle(titleText) {
  const t = normalizeCameraText(titleText);
  if (!hasAny(t, ["250d", "eos 250d", "rebel sl3", "sl3"])) return false;
  if (looksLikeLensOnlyTitle(t)) return false;
  if (isObviousAccessoryTitle(t)) return false;
  return true;
}

function looksLikeGoPro11MainTitle(titleText) {
  const t = normalizeCameraText(titleText);
  if (!hasAny(t, ["gopro", "hero11", "hero11 black", "gopro 11"])) return false;
  if (isObviousAccessoryTitle(t)) return false;
  return true;
}

function looksLikeMainCameraTitle(titleText, family = "") {
  if (family === "sony_a6400_body") return looksLikeSonyA6400MainTitle(titleText);
  if (family === "canon_250d_body") return looksLikeCanon250DMainTitle(titleText);
  if (family === "gopro_hero_11") return looksLikeGoPro11MainTitle(titleText);

  const t = normalizeCameraText(titleText);
  return t.includes("camera") && !isObviousAccessoryTitle(t) && !looksLikeLensOnlyTitle(t);
}

function isHardAccessoryListing(text, item, family = "") {
  const titleText = getTitleText(item);
  const combinedText = normalizeCameraText(text);

  if (looksLikeMainCameraTitle(titleText, family)) return false;
  if (isObviousAccessoryTitle(titleText)) return true;

  if (isAccessoryCategory(item)) {
    if (!looksLikeMainCameraTitle(titleText, family)) return true;
  }

  if (
    hasAny(combinedText, ACCESSORY_TERMS) &&
    !titleText.includes("camera") &&
    !titleText.includes("body") &&
    !looksLikeMainCameraTitle(titleText, family)
  ) {
    return true;
  }

  return false;
}

function isClearlyNonCamera(item, text, family = "") {
  const titleText = getTitleText(item);

  if (looksLikeMainCameraTitle(titleText, family)) return false;
  if (isNonCameraCategory(item)) return true;
  if (hasAny(titleText, NON_CAMERA_TERMS)) return true;

  if (family !== "gopro_hero_11" && looksLikeLensOnlyTitle(titleText)) return true;
  if (hasAny(titleText, LENS_TERMS) && !titleText.includes("body") && !titleText.includes("camera")) return true;

  return false;
}

function isSeverelyBadCamera(text) {
  return hasAny(normalizeCameraText(text), HARD_REJECT_TERMS);
}

function classifyCameraConditionState(text) {
  const t = normalizeCameraText(text);

  if (hasAny(t, HARD_REJECT_TERMS)) {
    return "faulty_or_parts";
  }

  if (
    hasAny(t, [
      "untested",
      "focus issue",
      "focus problem",
      "missing battery",
      "no battery",
      "missing charger",
      "no charger",
      "read description",
      "read caption",
    ])
  ) {
    return "minor_fault";
  }

  return "clean_working";
}

function shouldAllowDamagedCameras(queryContext) {
  const q = normalizeCameraText(queryContext?.normalizedQuery || "");

  return hasAny(q, [
    "faulty",
    "broken",
    "damaged",
    "for parts",
    "spares",
    "repairs",
    "no power",
  ]);
}

function isDamagedCameraConditionState(conditionState) {
  return conditionState === "minor_fault" || conditionState === "faulty_or_parts";
}

function detectIncludedExtras(text, family = "") {
  const t = normalizeCameraText(text);

  const includesBattery = hasAny(t, [
    "with battery",
    "battery included",
    "batteries included",
    "1 battery",
    "2 batteries",
    "two batteries",
    "extra battery",
    "spare battery",
  ]);

  const includesCharger = hasAny(t, [
    "with charger",
    "charger included",
    "usb charger",
    "dual charger",
  ]);

  const includesBox = hasAny(t, [
    "boxed",
    "box included",
    "original box",
    "complete in box",
  ]);

  const includesMounts = hasAny(t, [
    "with mount",
    "mounts included",
    "helmet mount",
    "chest mount",
    "accessory kit",
  ]);

  const hasLens =
    family !== "gopro_hero_11" &&
    (
      hasAny(t, [
        "with lens",
        "kit lens",
        "18-55mm",
        "16-50mm",
        "24-70mm",
        "70-200mm",
        "50mm lens",
        "35mm lens",
        "85mm lens",
      ]) ||
      (
        hasAny(t, ["ef-s", "ef s", "rf-s", "rf s", "e mount", "e-mount"]) &&
        t.includes("lens")
      )
    );

  let bundleType = "standard";
  if (includesBox) bundleType = "boxed";
  if (includesBattery || includesCharger || includesMounts || hasLens) bundleType = "bundle";

  return {
    bundleType,
    includesBattery,
    includesCharger,
    includesBox,
    includesMounts,
    hasLens,
  };
}

function estimateCameraRepairCost(queryContext, conditionState, text) {
  const t = normalizeCameraText(text);
  const family = String(queryContext?.family || "");

  if (conditionState === "faulty_or_parts") {
    if (family === "sony_a6400_body") return 95;
    if (family === "canon_250d_body") return 80;
    if (family === "gopro_hero_11") return 55;
    return 70;
  }

  if (conditionState === "minor_fault") {
    if (hasAny(t, ["missing battery", "no battery"])) return 20;
    if (hasAny(t, ["missing charger", "no charger"])) return 10;
    if (hasAny(t, ["untested"])) return 20;
    return 15;
  }

  return 0;
}

function matchesCameraFamily(text, queryContext, item) {
  const t = normalizeCameraText(text);
  const titleText = getTitleText(item);
  const family = String(queryContext?.family || "");

  if (!family) return true;

  if (family === "sony_a6400_body") {
    if (!hasAny(t, ["a6400", "alpha a6400", "ilce-6400"])) return false;
    if (isClearlyNonCamera(item, titleText || t, family)) return false;
    if (isHardAccessoryListing(titleText || t, item, family)) return false;
    if (looksLikeLensOnlyTitle(titleText)) return false;
    return true;
  }

  if (family === "canon_250d_body") {
    if (!hasAny(t, ["250d", "eos 250d", "rebel sl3", "sl3"])) return false;
    if (isClearlyNonCamera(item, titleText || t, family)) return false;
    if (isHardAccessoryListing(titleText || t, item, family)) return false;
    if (looksLikeLensOnlyTitle(titleText)) return false;
    return true;
  }

  if (family === "gopro_hero_11") {
    if (!hasAny(t, ["gopro", "hero11", "hero11 black", "gopro 11"])) return false;
    if (isClearlyNonCamera(item, titleText || t, family)) return false;
    if (isHardAccessoryListing(titleText || t, item, family)) return false;
    return true;
  }

  return true;
}

function estimateBundleValueBonus(queryContext, extras, text) {
  const family = String(queryContext?.family || "");
  const t = normalizeCameraText(text);

  let bonus = 0;

  if (family === "sony_a6400_body") {
    if (extras.includesBattery) bonus += 18;
    if (extras.includesCharger) bonus += 8;
    if (extras.includesBox) bonus += 12;
    if (extras.hasLens) bonus += 50;
  } else if (family === "canon_250d_body") {
    if (extras.includesBattery) bonus += 15;
    if (extras.includesCharger) bonus += 8;
    if (extras.includesBox) bonus += 10;
    if (extras.hasLens) bonus += 45;
  } else if (family === "gopro_hero_11") {
    if (extras.includesBattery) bonus += 15;
    if (extras.includesCharger) bonus += 8;
    if (extras.includesBox) bonus += 10;
    if (extras.includesMounts) bonus += 12;
  } else {
    if (extras.includesBattery) bonus += 12;
    if (extras.includesCharger) bonus += 6;
    if (extras.includesBox) bonus += 8;
  }

  if (t.includes("2 batteries") || t.includes("two batteries")) bonus += 10;
  if (t.includes("extra battery") || t.includes("spare battery")) bonus += 8;

  return roundMoney(bonus);
}

function buildCameraWarningFlags(text, queryContext, extras) {
  const t = normalizeCameraText(text);
  const flags = [];

  for (const [needle, flag] of MINOR_WARNING_TERMS) {
    if (t.includes(needle) && !flags.includes(flag)) {
      flags.push(flag);
    }
  }

  if (queryContext?.wantsBodyOnly && extras?.hasLens) {
    flags.push("Lens included despite body-only search");
  }

  return flags;
}

function calculateWarningPenalty(flags = []) {
  let penalty = 0;

  for (const flag of flags) {
    if (flag === "Read description carefully") penalty += 6;
    else if (flag === "Seller may have important notes in caption") penalty += 4;
    else if (flag === "No returns accepted") penalty += 6;
    else if (flag === "Untested listing") penalty += 8;
    else if (flag === "Condition may reduce resale appeal") penalty += 4;
    else if (flag === "Visible cosmetic wear mentioned") penalty += 3;
    else if (flag === "Missing battery") penalty += 5;
    else if (flag === "Missing charger") penalty += 3;
    else if (flag === "Body-only listing") penalty += 1;
    else if (flag === "No box included") penalty += 1;
    else if (flag === "Lens included despite body-only search") penalty += 6;
  }

  return penalty;
}

function getFamilyPricingBias(queryContext, text) {
  const family = String(queryContext?.family || "");
  const t = normalizeCameraText(text);

  if (family === "sony_a6400_body") {
    if (t.includes("body")) return 12;
    return 8;
  }

  if (family === "canon_250d_body") {
    if (t.includes("body")) return 10;
    return 6;
  }

  if (family === "gopro_hero_11") {
    if (t.includes("black")) return 8;
    return 5;
  }

  return 0;
}

function getMatchDebug(item, queryContext) {
  const titleText = getTitleText(item);
  const text = getCombinedItemText(item);
  const conditionState = classifyCameraConditionState(text);
  const itemBrand = detectCameraBrand(text);
  const familyMatch = matchesCameraFamily(text, queryContext, item);

  if (!text) return { matched: false, reason: "empty_text" };
  if (isHardAccessoryListing(text, item, queryContext.family || "")) return { matched: false, reason: "accessory_listing", title: titleText };
  if (isClearlyNonCamera(item, text, queryContext.family || "")) return { matched: false, reason: "non_camera_listing", title: titleText };
  if (isSeverelyBadCamera(text) && !queryContext.allowDamaged) {
    return { matched: false, reason: "severely_bad_camera_blocked", title: titleText };
  }
  if (!queryContext.allowDamaged && isDamagedCameraConditionState(conditionState)) {
    return { matched: false, reason: `condition_blocked_${conditionState}`, title: titleText };
  }
  if (queryContext.brand && itemBrand !== queryContext.brand) {
    return { matched: false, reason: `brand_mismatch_${itemBrand || "unknown"}`, title: titleText };
  }
  if (!familyMatch) {
    return {
      matched: false,
      reason: `family_mismatch_${queryContext.family || "none"}`,
      title: titleText,
    };
  }

  return {
    matched: true,
    reason: "matched",
    conditionState,
    title: titleText,
  };
}

function scoreCameraCandidate(item, queryContext) {
  const titleText = getTitleText(item);
  const text = getCombinedItemText(item);

  if (!text) return -10;
  if (isHardAccessoryListing(text, item, queryContext.family || "")) return -10;
  if (isClearlyNonCamera(item, text, queryContext.family || "")) return -10;
  if (isSeverelyBadCamera(text) && !shouldAllowDamagedCameras(queryContext)) return -10;

  const conditionState = classifyCameraConditionState(text);
  const allowDamaged = shouldAllowDamagedCameras(queryContext);

  if (!allowDamaged && isDamagedCameraConditionState(conditionState)) {
    return -10;
  }

  const itemBrand = detectCameraBrand(text);
  const extras = detectIncludedExtras(text, queryContext.family || "");

  let score = 0;

  if (queryContext.brand) {
    if (itemBrand === queryContext.brand) score += 1.2;
    else return -10;
  }

  if (matchesCameraFamily(text, queryContext, item)) {
    score += 5.4;
  } else {
    return -10;
  }

  if (isCameraCategory(item)) score += 1.2;
  if (looksLikeMainCameraTitle(titleText, queryContext.family || "")) score += 1.4;
  if (conditionState === "clean_working") score += 1.5;
  if (conditionState === "minor_fault") score -= 1.5;
  if (conditionState === "faulty_or_parts") score -= 8;

  if (extras.bundleType === "bundle") score += 0.9;
  if (extras.bundleType === "boxed") score += 0.35;

  const warningFlags = buildCameraWarningFlags(text, queryContext, extras);
  const warningPenalty = calculateWarningPenalty(warningFlags);

  return score - warningPenalty * 0.045;
}

function enrichCameraCompPool(queryContext, items = []) {
  return (Array.isArray(items) ? items : [])
    .map((item) => {
      const text = getCombinedItemText(item);
      const extras = detectIncludedExtras(text, queryContext.family || "");
      const bundleValueBonus = estimateBundleValueBonus(queryContext, extras, text);
      const warningFlags = buildCameraWarningFlags(text, queryContext, extras);
      const warningPenalty = calculateWarningPenalty(warningFlags);
      const familyBias = getFamilyPricingBias(queryContext, text);
      const matchDebug = getMatchDebug(item, queryContext);

      return {
        item,
        total: extractTotalPrice(item),
        adjustedTotal: roundMoney(
          extractTotalPrice(item) -
            bundleValueBonus +
            Math.min(warningPenalty, 8) -
            familyBias
        ),
        score: scoreCameraCandidate(item, queryContext),
        conditionState: classifyCameraConditionState(text),
        bundleType: extras.bundleType,
        extras,
        bundleValueBonus,
        warningFlags,
        warningPenalty,
        familyBias,
        matchDebug,
      };
    })
    .filter((entry) => entry.total > 0 && entry.score > -5)
    .sort((a, b) => b.score - a.score);
}

function buildCameraPricingModel(queryContext, marketItems = [], listingItems = []) {
  const allowDamaged = shouldAllowDamagedCameras(queryContext);

  const marketPool = enrichCameraCompPool(queryContext, marketItems);
  const listingPool = enrichCameraCompPool(queryContext, listingItems);

  let marketConditionPool = allowDamaged
    ? marketPool
    : marketPool.filter((entry) => entry.conditionState === "clean_working");

  let listingConditionPool = allowDamaged
    ? listingPool
    : listingPool.filter((entry) => entry.conditionState === "clean_working");

  if (!marketConditionPool.length && marketPool.length) marketConditionPool = marketPool;
  if (!listingConditionPool.length && listingPool.length) listingConditionPool = listingPool;

  const exactMarket = marketConditionPool.filter((entry) => entry.score >= 5.0);
  const usableMarket =
    exactMarket.length >= 3
      ? exactMarket
      : marketConditionPool.filter((entry) => entry.score >= 1.0);

  const exactListings = listingConditionPool.filter((entry) => entry.score >= 5.0);
  const usableListings =
    exactListings.length >= 2
      ? exactListings
      : listingConditionPool.filter((entry) => entry.score >= 1.0);

  let marketTotals = removePriceOutliers(
    (usableMarket.length ? usableMarket : marketConditionPool)
      .slice(0, 28)
      .map((entry) => entry.adjustedTotal)
      .filter((value) => value > 0)
  );

  let listingTotals = removePriceOutliers(
    (usableListings.length ? usableListings : listingConditionPool)
      .slice(0, 18)
      .map((entry) => entry.adjustedTotal)
      .filter((value) => value > 0)
  );

  if (marketTotals.length < 3 && listingTotals.length >= 2) {
    marketTotals = removePriceOutliers([...marketTotals, ...listingTotals].filter((value) => value > 0));
  }

  if (listingTotals.length < 2 && marketTotals.length >= 2) {
    listingTotals = marketTotals.slice(0, 12);
  }

  const marketMedian = median(marketTotals);
  const marketLow = percentile(marketTotals, 0.35);
  const listingMedian = median(listingTotals);

  let pricingMode = "Camera model median";
  let baseline = marketMedian || marketLow || listingMedian || 0;

  if (!marketMedian && listingMedian) pricingMode = "Camera listings fallback";
  if (!marketMedian && !listingMedian && marketLow) pricingMode = "Camera low-band fallback";

  if (!baseline && queryContext.family === "sony_a6400_body") {
    baseline = 520;
    pricingMode = "Sony a6400 hard fallback";
  } else if (!baseline && queryContext.family === "canon_250d_body") {
    baseline = 360;
    pricingMode = "Canon 250d hard fallback";
  } else if (!baseline && queryContext.family === "gopro_hero_11") {
    baseline = 220;
    pricingMode = "GoPro Hero 11 hard fallback";
  }

  let conservativeMultiplier = 0.955;
  if (exactMarket.length >= 5) conservativeMultiplier = 0.965;

  if (queryContext.family === "sony_a6400_body") {
    baseline = roundMoney(baseline + 12);
    pricingMode = pricingMode.includes("fallback") ? pricingMode : "Sony a6400 median";
  } else if (queryContext.family === "canon_250d_body") {
    baseline = roundMoney(baseline + 10);
    pricingMode = pricingMode.includes("fallback") ? pricingMode : "Canon 250d median";
  } else if (queryContext.family === "gopro_hero_11") {
    baseline = roundMoney(baseline + 8);
    pricingMode = pricingMode.includes("fallback") ? pricingMode : "GoPro Hero 11 median";
  }

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

  if (pricingMode.includes("hard fallback")) {
    confidence = Math.min(confidence, 46);
  }

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
    listingMedian: roundMoney(listingTotals.length ? listingMedian : 0),
    debug: {
      marketPoolSize: marketPool.length,
      listingPoolSize: listingPool.length,
      exactMarketCount: exactMarket.length,
      usableMarketCount: usableMarket.length,
      exactListingsCount: exactListings.length,
      usableListingsCount: usableListings.length,
    },
  };
}

function applyBundleValueToListing(queryContext, item, baseResale) {
  const text = getCombinedItemText(item);
  const extras = detectIncludedExtras(text, queryContext.family || "");
  const bundleValueBonus = estimateBundleValueBonus(queryContext, extras, text);
  const warningFlags = buildCameraWarningFlags(text, queryContext, extras);
  const warningPenalty = calculateWarningPenalty(warningFlags);
  const familyBias = getFamilyPricingBias(queryContext, text);

  return {
    bundleSignals: extras,
    bundleType: extras.bundleType,
    bundleValueBonus,
    warningFlags,
    warningScorePenalty: warningPenalty,
    estimatedResale: roundMoney(
      Number(baseResale || 0) + bundleValueBonus + familyBias
    ),
    debug: {
      familyBias,
      title: getTitleText(item),
    },
  };
}

export const cameraEngine = {
  ...baseEngine,
  id: "camera",

  detect(query = "") {
    const text = normalizeCameraText(query);

    return (
      text.includes("a6400") ||
      text.includes("250d") ||
      text.includes("rebel sl3") ||
      text.includes("sl3") ||
      text.includes("gopro") ||
      text.includes("hero11") ||
      text.includes("camera")
    );
  },

  classifyQuery(query = "") {
    const rawQuery = String(query || "").trim();
    const normalizedQuery = normalizeCameraText(rawQuery);
    const brand = detectCameraBrand(normalizedQuery);
    const family = parseCameraFamily(normalizedQuery);
    const allowDamaged = shouldAllowDamagedCameras({ normalizedQuery });

    const wantsBodyOnly =
      normalizedQuery.includes("body") ||
      normalizedQuery.includes("body only") ||
      normalizedQuery.includes("camera only") ||
      normalizedQuery.includes("no lens") ||
      normalizedQuery.includes("without lens");

    return {
      rawQuery,
      normalizedQuery,
      brand,
      family,
      allowDamaged,
      wantsBodyOnly,
    };
  },

  buildSearchQuery(query = "") {
    const ctx = this.classifyQuery(query);

    if (ctx.family === "sony_a6400_body") return "sony a6400";
    if (ctx.family === "canon_250d_body") return "canon eos 250d";
    if (ctx.family === "gopro_hero_11") return "gopro hero 11";

    return String(query || "").trim();
  },

  expandSearchVariants(query = "") {
    const rawQuery = String(query || "").trim();
    const ctx = this.classifyQuery(rawQuery);

    if (ctx.family === "sony_a6400_body") {
      return [
        "sony a6400",
        "sony a6400 body",
        "alpha a6400",
        "ilce-6400",
        "a6400 camera body",
      ];
    }

    if (ctx.family === "canon_250d_body") {
      return [
        "canon eos 250d",
        "canon eos 250d body",
        "canon 250d",
        "eos 250d body",
        "rebel sl3",
      ];
    }

    if (ctx.family === "gopro_hero_11") {
      return [
        "gopro hero 11",
        "gopro hero11",
        "hero 11 black",
        "gopro 11",
        "gopro hero 11 black",
      ];
    }

    return [rawQuery].filter(Boolean);
  },

  matchesItem(item, queryContext) {
    return getMatchDebug(item, queryContext).matched;
  },

  buildPricingModel({ queryContext, marketItems = [], listingItems = [] }) {
    return buildCameraPricingModel(queryContext, marketItems, listingItems);
  },

  classifyItem(item, queryContext) {
    const text = getCombinedItemText(item);
    const conditionState = classifyCameraConditionState(text);
    const repairCost = estimateCameraRepairCost(queryContext, conditionState, text);
    const extras = detectIncludedExtras(text, queryContext.family || "");
    const bundleValueBonus = estimateBundleValueBonus(queryContext, extras, text);
    const warningFlags = buildCameraWarningFlags(text, queryContext, extras);
    const warningScorePenalty = calculateWarningPenalty(warningFlags);
    const matchDebug = getMatchDebug(item, queryContext);

    return {
      conditionState,
      repairCost,
      bundleType: extras.bundleType,
      bundleSignals: extras,
      bundleValueBonus,
      warningFlags,
      warningScorePenalty,
      debug: matchDebug,
    };
  },

  adjustListingPricing({ queryContext, item, pricingModel }) {
    const baseResale = Number(pricingModel?.estimatedResale || 0);
    return applyBundleValueToListing(queryContext, item, baseResale);
  },
};
