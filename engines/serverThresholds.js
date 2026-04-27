export function getTightClassificationThresholds(queryContext = {}) {
  const normalized = String(
    queryContext?.rawQuery || queryContext?.normalizedQuery || ""
  )
    .toLowerCase()
    .trim();

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
      strongAskProfit: 22,
      strongAskMargin: 14,
      solidAskProfit: 15,
      solidAskMargin: 9,
      strongOfferProfit: 20,
      strongOfferMarginFloor: 7,
      tightAskProfit: 8,
      tightAskMargin: 5,
      tightOfferProfit: 12,
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
