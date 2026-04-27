export function getAudioThresholds() {
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
