export function isPhoneItem(title = "") {
  const text = String(title || "").toLowerCase();

  return (
    text.includes("iphone") ||
    text.includes("samsung") ||
    text.includes("galaxy") ||
    text.includes("pixel")
  );
}

export function isAudioItem(title = "") {
  const text = String(title || "").toLowerCase();

  return (
    text.includes("airpods") ||
    text.includes("earbuds") ||
    text.includes("earphones") ||
    text.includes("headphones") ||
    text.includes("galaxy buds") ||
    text.includes("sony wf") ||
    text.includes("sony wh") ||
    text.includes("wf-1000xm") ||
    text.includes("wh-1000xm") ||
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
}

export function passesStrictDealFilter(item, includeTightDeals = false) {
  const label = String(item?.finderLabel || "").toLowerCase();
  const compCount = Number(item?.scanner?.compCount || 0);
  const confidence = Number(item?.scanner?.confidence || 0);
  const warningCount = Array.isArray(item?.warningFlags) ? item.warningFlags.length : 0;
  const score = Number(item?.dealScore || 0);
  const estimatedProfit = Number(item?.scanner?.estimatedProfit || item?.estimatedProfit || 0);
  const marginPercent = Number(item?.scanner?.marginPercent || item?.marginPercent || 0);
  const offerProfit = Number(item?.offerProfit || item?.scanner?.offerProfit || 0);

  const titleText = String(item?.title || "").toLowerCase();

  const isAudio = isAudioItem(titleText);

  if (label.includes("buy")) {
    if (isAudio) {
      return (
        estimatedProfit >= 11 &&
        marginPercent >= 7 &&
        score >= 90 &&
        warningCount <= 3 &&
        compCount >= 4 &&
        confidence >= 55
      );
    }

    return (
      estimatedProfit >= 24 &&
      marginPercent >= 10 &&
      score >= 90 &&
      warningCount <= 3 &&
      compCount >= 4 &&
      confidence >= 55
    );
  }

  if (label.includes("offer")) {
    if (isAudio) {
      return (
        offerProfit >= 14 &&
        score >= 72 &&
        warningCount <= 3 &&
        compCount >= 4 &&
        confidence >= 55
      );
    }

    return (
      offerProfit >= 22 &&
      score >= 74 &&
      warningCount <= 3 &&
      compCount >= 4 &&
      confidence >= 55
    );
  }

  if (includeTightDeals && label.includes("tight")) {
    if (isAudio) {
      return (
        (
          (estimatedProfit >= 6 && marginPercent >= 4) ||
          offerProfit >= 10
        ) &&
        score >= 44 &&
        warningCount <= 3 &&
        (compCount >= 2 || confidence >= 45)
      );
    }

    return (
      (
        (estimatedProfit >= 10 && marginPercent >= 6) ||
        offerProfit >= 16
      ) &&
      score >= 44 &&
      warningCount <= 3 &&
      (compCount >= 2 || confidence >= 45)
    );
  }

  return false;
}
