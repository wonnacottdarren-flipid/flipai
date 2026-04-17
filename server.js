function buildFindDealsResults({ candidateItems, marketPool, query, condition }) {
  const snapshot = buildLiveMarketSnapshot({
    items: marketPool,
    query,
    condition,
  });

  const searchText = normalizeText(query);

  const isDysonSearch = searchText.includes("dyson");
  const isMainUnitSearch = searchText.includes("main unit") || searchText.includes("body");
  const isOutsizeSearch = searchText.includes("outsize");

  const exactCandidates = filterItemsForExactSearch(
    candidateItems,
    query,
    condition || ""
  );

  const scoredCandidates = exactCandidates
    .map((item) => {
      const title = normalizeText(item?.title || "");

      // 🔥 SAFE DYSON FILTER (NO SYSTEM BREAK)
      if (isDysonSearch) {
        const isMainUnit =
          title.includes("main unit") ||
          title.includes("motor unit") ||
          title.includes("body only");

        const isOutsize = title.includes("outsize");

        const isParts =
          title.includes("battery only") ||
          title.includes("filter only") ||
          title.includes("wand only") ||
          title.includes("head only") ||
          title.includes("tools only") ||
          title.includes("attachments only") ||
          title.includes("spares") ||
          title.includes("parts");

        if (isParts) return null;

        if (isMainUnitSearch && !isMainUnit) return null;
        if (isOutsizeSearch && !isOutsize) return null;

        // Generic search → ONLY full machines
        if (!isMainUnitSearch && !isOutsizeSearch) {
          if (isMainUnit || isOutsize) return null;
        }
      }

      const scanner = buildScannerMetricsFromLiveMarket(item, snapshot, query);
      const bestOffer = buildBestOfferGuidance(item, scanner);
      const scored = scoreDealCandidate(item, scanner);
      const reason = getDealReason(item, scanner);
      const sanity = getSanityDecision(item, scanner);

      return {
        ...item,
        scanner,
        bestOffer,
        dealScore: scored.dealScore,
        undervaluedAmount: scored.undervaluedAmount,
        undervaluedPercent: scored.undervaluedPercent,
        reason,
        marketBucket: getItemBucket(item, condition || ""),
        sanityPassed: sanity.passed,
        sanityReason: sanity.reason,
        listingQualityScore: getListingQualityScore(item),
      };
    })
    .filter(Boolean)
    .filter((item) => Number(item?.scanner?.estimatedResale || 0) > 0);

  const passedSanity = scoredCandidates.filter((item) => item.sanityPassed === true);

  const deals = passedSanity
    .sort((a, b) => {
      return (
        Number(b.dealScore || 0) - Number(a.dealScore || 0) ||
        Number(b?.scanner?.estimatedProfit || 0) -
          Number(a?.scanner?.estimatedProfit || 0)
      );
    })
    .map((item) => ({
      ...item,
      finderLabel: getDealLabel(item.scanner, item),
    }));

  const rejectedBySanity = scoredCandidates
    .filter((item) => item.sanityPassed !== true)
    .slice(0, 12)
    .map((item) => ({
      itemId: item.itemId,
      title: item.title,
      price: item.price,
      shipping: item.shipping,
      totalBuyPrice: item?.scanner?.totalBuyPrice ?? 0,
      estimatedResale: item?.scanner?.estimatedResale ?? 0,
      estimatedProfit: item?.scanner?.estimatedProfit ?? 0,
      marginPercent: item?.scanner?.marginPercent ?? 0,
      compCount: item?.scanner?.compCount ?? 0,
      marketMedian: item?.scanner?.marketMedian ?? 0,
      risk: item?.scanner?.risk ?? "",
      resaleUplift: item?.scanner?.resaleUplift ?? 1,
      sanityReason: item.sanityReason,
    }));

  return {
    snapshot,
    exactCandidates,
    scoredCandidates,
    deals,
    debug: {
      fetchedCandidateItems: candidateItems.length,
      fetchedMarketPoolItems: marketPool.length,
      exactMatchCount: exactCandidates.length,
      scoredCount: scoredCandidates.length,
      sanityPassedCount: passedSanity.length,
      sanityRejectedCount: scoredCandidates.length - passedSanity.length,
      rejectedBySanityPreview: rejectedBySanity,
      exactMatchPreview: exactCandidates.slice(0, 12).map((item) => ({
        itemId: item.itemId,
        title: item.title,
        price: item.price,
        shipping: item.shipping,
        condition: item.condition,
      })),
    },
  };
}
