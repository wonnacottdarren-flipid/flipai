import {
  roundMoney,
  median,
  percentile,
  removePriceOutliers,
  extractTotalPrice,
} from "./baseEngine.js";

import {
  getPhoneTitleText,
  getPhoneCombinedItemText,
} from "./phoneV2Text.js";

import {
  classifyPhoneConditionState,
  shouldAllowDamagedPhones,
} from "./phoneV2Condition.js";

import {
  detectPhoneBrand,
  parsePhoneFamily,
  extractStorageGb,
} from "./phoneV2Families.js";

import {
  failsPhoneBaseGate,
  isPhoneCategory,
  isNetworkLockedPhone,
  isExplicitlyUnlockedPhone,
  hasPhoneHandsetSignals,
  detectPhoneFaultIntent,
  matchesPhoneFaultIntent,
} from "./phoneV2Filters.js";

function estimatePhoneRepairCost(queryContext = {}, conditionState = "", text = "") {
  const t = getPhoneCombinedItemText({ title: text });
  const family = String(queryContext?.family || "");
  const brand = String(queryContext?.brand || "");

  if (conditionState === "faulty_or_parts") {
    if (
      t.includes("icloud locked") ||
      t.includes("activation locked") ||
      t.includes("blacklisted") ||
      t.includes("blocked imei") ||
      t.includes("water damaged") ||
      t.includes("liquid damage") ||
      t.includes("motherboard") ||
      t.includes("logic board") ||
      t.includes("no power") ||
      t.includes("dead")
    ) {
      if (brand === "iphone") return 95;
      if (brand === "samsung") return 78;
      return 85;
    }

    if (
      t.includes("screen lines") ||
      t.includes("green line") ||
      t.includes("pink line") ||
      t.includes("line on screen") ||
      t.includes("lines on screen") ||
      t.includes("lcd line") ||
      t.includes("display line")
    ) {
      if (family.includes("ultra")) return 82;
      if (family.includes("pro_max")) return 85;
      if (family.includes("pro")) return 78;
      if (family.includes("plus")) return 75;
      if (family.includes("fold")) return 140;
      if (family.includes("flip")) return 110;
      if (brand === "iphone") return 72;
      if (brand === "samsung") return 58;
      return 65;
    }

    if (
      t.includes("cracked screen") ||
      t.includes("screen cracked") ||
      t.includes("broken screen") ||
      t.includes("damaged screen") ||
      t.includes("lcd damaged")
    ) {
      if (family.includes("ultra")) return 85;
      if (family.includes("pro_max")) return 90;
      if (family.includes("pro")) return 82;
      if (family.includes("plus")) return 78;
      if (family.includes("fold")) return 150;
      if (family.includes("flip")) return 115;
      if (brand === "iphone") return 75;
      if (brand === "samsung") return 62;
      return 68;
    }

    if (
      t.includes("battery service") ||
      t.includes("battery health low") ||
      t.includes("needs battery") ||
      t.includes("battery needs replacing") ||
      t.includes("poor battery")
    ) {
      if (brand === "iphone") return 38;
      if (brand === "samsung") return 28;
      return 32;
    }

    if (brand === "iphone") return 75;
    if (brand === "samsung") {
      if (family.includes("ultra")) return 62;
      if (family.includes("fold")) return 120;
      if (family.includes("flip")) return 90;
      return 55;
    }
    return 65;
  }

  if (conditionState === "screen_damage") {
    if (
      t.includes("screen lines") ||
      t.includes("green line") ||
      t.includes("pink line") ||
      t.includes("line on screen") ||
      t.includes("lines on screen") ||
      t.includes("lcd line") ||
      t.includes("display line")
    ) {
      if (family.includes("ultra")) return 82;
      if (family.includes("pro_max")) return 85;
      if (family.includes("pro")) return 78;
      if (family.includes("plus")) return 75;
      if (family.includes("fold")) return 140;
      if (family.includes("flip")) return 110;
      if (brand === "iphone") return 72;
      if (brand === "samsung") return 58;
      return 65;
    }

    if (family.includes("ultra")) return 85;
    if (family.includes("pro_max")) return 90;
    if (family.includes("pro")) return 82;
    if (family.includes("plus")) return 78;
    if (family.includes("fold")) return 150;
    if (family.includes("flip")) return 115;
    if (brand === "iphone") return 75;
    if (brand === "samsung") return 62;
    return 68;
  }

  if (conditionState === "minor_fault") {
    if (t.includes("no s pen") || t.includes("missing s pen")) return 18;
    if (t.includes("battery service") || t.includes("battery health low")) {
      if (brand === "samsung") return 26;
      return 32;
    }
    if (t.includes("needs battery") || t.includes("battery needs replacing")) {
      if (brand === "samsung") return 28;
      return 35;
    }
    if (t.includes("charging port") || t.includes("charge port")) {
      if (brand === "samsung") return 24;
      return 30;
    }
    if (t.includes("back glass") || t.includes("rear glass")) return 25;
    if (t.includes("camera fault") || t.includes("camera issue")) return 28;
    if (t.includes("speaker fault") || t.includes("speaker issue")) return 18;
    if (t.includes("face id")) return 35;
    if (t.includes("fingerprint")) return 20;
    return 15;
  }

  return 0;
}

export function scorePhoneV2Candidate(item = {}, queryContext = {}) {
  const titleText = getPhoneTitleText(item);
  const text = getPhoneCombinedItemText(item);

  if (!text) return -10;
  if (failsPhoneBaseGate(item, queryContext)) return -10;

  const conditionState = classifyPhoneConditionState(text);
  const allowDamaged =
    Boolean(queryContext?.allowDamaged) || shouldAllowDamagedPhones(queryContext);

  let score = 0;

  const itemBrand = detectPhoneBrand(text);
  const itemFamily = parsePhoneFamily(text, queryContext?.brand || "");
  const itemStorageGb = extractStorageGb(text);
  const inPhoneCategory = isPhoneCategory(item);
  const faultIntent = detectPhoneFaultIntent(queryContext);
  const faultIntentMatched = matchesPhoneFaultIntent(`${titleText} ${text}`, queryContext);

  if (queryContext.brand) {
    if (itemBrand === queryContext.brand) score += 1.5;
    else return -10;
  }

  if (queryContext.family) {
    if (itemFamily === queryContext.family) score += 5;
    else if (itemFamily && itemFamily !== queryContext.family) score -= 6;
    else score -= 1.5;
  }

  if (Number(queryContext.storageGb || 0) > 0) {
    if (itemStorageGb === Number(queryContext.storageGb)) score += 1.5;
    else if (itemStorageGb > 0 && itemStorageGb !== Number(queryContext.storageGb)) {
      score -= 2.5;
    }
  }

  if (queryContext.wantsUnlocked) {
    if (isExplicitlyUnlockedPhone(text)) score += 0.8;
    if (isNetworkLockedPhone(text)) score -= 3;
  } else if (isNetworkLockedPhone(text)) {
    score -= 1.5;
  }

  if (conditionState === "clean_working") score += 1.5;
  if (conditionState === "cosmetic_wear") score += 0.3;

  if (allowDamaged) {
    if (conditionState === "minor_fault") score -= 0.8;
    if (conditionState === "screen_damage") score -= 2.4;
    if (conditionState === "faulty_or_parts") score -= 4.2;
  } else {
    if (conditionState === "minor_fault") score -= 1.5;
    if (conditionState === "screen_damage") score -= 4.5;
    if (conditionState === "faulty_or_parts") score -= 8;
  }

  if (queryContext.brand === "iphone" && text.includes("iphone")) score += 0.5;
  if (
    queryContext.brand === "samsung" &&
    (text.includes("samsung") || text.includes("galaxy"))
  ) {
    score += 0.5;
  }

  if (inPhoneCategory) score += 2.5;
  else if (hasPhoneHandsetSignals(text)) score += 0.8;
  else score -= 3;

  if (titleText && queryContext.family && titleText.includes(queryContext.family.replaceAll("_", " "))) {
    score += 0.4;
  }

  if (allowDamaged) {
    if (
      text.includes("screen lines") ||
      text.includes("green line") ||
      text.includes("pink line") ||
      text.includes("line on screen") ||
      text.includes("lines on screen")
    ) {
      score += 0.8;
    }

    if (
      text.includes("faulty") ||
      text.includes("spares") ||
      text.includes("repairs") ||
      text.includes("for parts")
    ) {
      score += 0.5;
    }

    if (faultIntent) {
      if (faultIntentMatched) {
        score += 2.4;
      } else {
        score -= 0.7;
      }
    }

    if (
      text.includes("icloud locked") ||
      text.includes("activation locked") ||
      text.includes("blacklisted") ||
      text.includes("blocked imei") ||
      text.includes("water damaged") ||
      text.includes("liquid damage")
    ) {
      score -= 2.5;
    }
  }

  return score;
}

export function enrichPhoneV2CompPool(queryContext = {}, items = []) {
  return (Array.isArray(items) ? items : [])
    .map((item) => {
      const text = getPhoneCombinedItemText(item);
      const conditionState = classifyPhoneConditionState(text);

      return {
        item,
        total: extractTotalPrice(item),
        score: scorePhoneV2Candidate(item, queryContext),
        conditionState,
        repairCost: estimatePhoneRepairCost(queryContext, conditionState, text),
        itemBrand: detectPhoneBrand(text),
        itemFamily: parsePhoneFamily(text, queryContext?.brand || ""),
        itemStorageGb: extractStorageGb(text),
      };
    })
    .filter((entry) => entry.total > 0 && entry.score > -5)
    .sort((a, b) => b.score - a.score);
}

export function buildPhoneV2PricingModel(queryContext = {}, marketItems = [], listingItems = []) {
  const allowDamaged =
    Boolean(queryContext?.allowDamaged) || shouldAllowDamagedPhones(queryContext);

  const marketPool = enrichPhoneV2CompPool(queryContext, marketItems);
  const listingPool = enrichPhoneV2CompPool(queryContext, listingItems);

  const desiredConditionState = allowDamaged ? null : "clean_working";

  let marketConditionPool = desiredConditionState
    ? marketPool.filter((entry) => entry.conditionState === desiredConditionState)
    : marketPool;

  let listingConditionPool = desiredConditionState
    ? listingPool.filter((entry) => entry.conditionState === desiredConditionState)
    : listingPool;

  if (!marketConditionPool.length && marketPool.length) {
    marketConditionPool = marketPool;
  }

  if (!listingConditionPool.length && listingPool.length) {
    listingConditionPool = listingPool;
  }

  const exactMarket = marketConditionPool.filter((entry) => entry.score >= 6);
  const usableMarket =
    exactMarket.length >= 3
      ? exactMarket
      : marketConditionPool.filter((entry) => entry.score >= (allowDamaged ? 1.2 : 3));

  const exactListings = listingConditionPool.filter((entry) => entry.score >= 6);
  const usableListings =
    exactListings.length >= 2
      ? exactListings
      : listingConditionPool.filter((entry) => entry.score >= (allowDamaged ? 1.2 : 3));

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
  const marketLow = percentile(marketTotals, allowDamaged ? 0.3 : 0.35);
  const listingMedian = median(listingTotals);

  let pricingMode = allowDamaged
    ? "Phone V2 damaged-risk model"
    : "Phone V2 model median";

  let baseline = marketMedian || marketLow || listingMedian || 0;

  if (!marketMedian && listingMedian) pricingMode = "Phone V2 listings fallback";
  if (!marketMedian && !listingMedian && marketLow) {
    pricingMode = "Phone V2 low-band fallback";
  }

  let conservativeMultiplier = allowDamaged ? 0.9 : 0.94;

  if (queryContext.family && Number(queryContext.storageGb || 0) > 0) {
    conservativeMultiplier = allowDamaged ? 0.91 : 0.95;
  }

  if (exactMarket.length >= 5) {
    conservativeMultiplier = allowDamaged ? 0.92 : 0.96;
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
  if (Number(queryContext.storageGb || 0) > 0) confidence += 2;

  if (allowDamaged) confidence -= 6;

  confidence = Math.min(92, Math.max(18, confidence));

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

export { estimatePhoneRepairCost };
