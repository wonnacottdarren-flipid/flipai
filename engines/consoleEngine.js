import {
  baseEngine,
  normalizeText,
  roundMoney,
  median,
  percentile,
  removePriceOutliers,
  extractTotalPrice,
} from "./baseEngine.js";

/* =========================
   CORE CONSTANTS
========================= */

const CONSOLE_FAMILIES = [
  ["ps5_disc", ["ps5 disc", "playstation 5 disc", "disc edition", "standard edition"]],
  ["ps5_digital", ["ps5 digital", "digital edition", "discless"]],
  ["xbox_series_x", ["xbox series x", "series x"]],
  ["xbox_series_s", ["xbox series s", "series s"]],
  ["switch_oled", ["switch oled", "nintendo switch oled"]],
  ["switch_lite", ["switch lite", "nintendo switch lite"]],
  ["switch_v2", ["nintendo switch", "switch console"]],
];

const HARD_REJECT_TERMS = [
  "for parts",
  "spares",
  "repairs",
  "faulty",
  "broken",
  "not working",
  "no power",
  "water damaged",
  "account locked",
  "banned",
];

const ACCESSORY_TERMS = [
  "controller only",
  "headset",
  "charger",
  "dock",
  "stand",
  "case",
  "shell",
  "cover",
  "cable",
];

/* =========================
   HELPERS
========================= */

function hasAny(text, arr = []) {
  return arr.some((x) => text.includes(x));
}

function normalizeConsoleText(value) {
  return normalizeText(String(value || ""))
    .replace(/\bps\s*5\b/g, "ps5")
    .replace(/\bplaystation\s*5\b/g, "playstation5")
    .replace(/\s+/g, " ")
    .trim();
}

function getText(item) {
  return normalizeConsoleText(
    [
      item?.title,
      item?.subtitle,
      item?.description,
      item?.condition,
    ]
      .filter(Boolean)
      .join(" ")
  );
}

function detectBrand(text) {
  if (text.includes("ps5")) return "playstation";
  if (text.includes("xbox")) return "xbox";
  if (text.includes("switch")) return "nintendo";
  return "";
}

function detectFamily(text) {
  for (const [family, patterns] of CONSOLE_FAMILIES) {
    if (patterns.some((p) => text.includes(p))) return family;
  }

  if (text.includes("ps5")) return "ps5_disc";
  return "";
}

/* =========================
   FILTERING LOGIC
========================= */

function isAccessory(text) {
  return hasAny(text, ACCESSORY_TERMS);
}

function isBadCondition(text) {
  return hasAny(text, HARD_REJECT_TERMS);
}

function isValidConsole(item, ctx) {
  const text = getText(item);

  if (!text) return false;
  if (isAccessory(text)) return false;

  if (!ctx.allowDamaged && isBadCondition(text)) {
    return false;
  }

  if (ctx.family) {
    const fam = detectFamily(text);
    if (fam && fam !== ctx.family) return false;
  }

  return true;
}

/* =========================
   SCORING
========================= */

function scoreItem(item, ctx) {
  const text = getText(item);
  let score = 0;

  if (!isValidConsole(item, ctx)) return -10;

  if (text.includes("console")) score += 2;
  if (text.includes("boxed")) score += 1;
  if (text.includes("controller")) score += 1;

  if (text.includes("bundle")) score += 1.5;

  return score;
}
function buildPricingModel(queryContext, marketItems = [], listingItems = []) {
  const validMarket = (Array.isArray(marketItems) ? marketItems : [])
    .filter((item) => isValidConsole(item, queryContext))
    .map((item) => ({
      item,
      total: extractTotalPrice(item),
      score: scoreItem(item, queryContext),
    }))
    .filter((x) => x.total > 0 && x.score > -5)
    .sort((a, b) => b.score - a.score);

  const validListings = (Array.isArray(listingItems) ? listingItems : [])
    .filter((item) => isValidConsole(item, queryContext))
    .map((item) => ({
      item,
      total: extractTotalPrice(item),
      score: scoreItem(item, queryContext),
    }))
    .filter((x) => x.total > 0 && x.score > -5)
    .sort((a, b) => b.score - a.score);

  let marketTotals = removePriceOutliers(
    validMarket.slice(0, 28).map((x) => x.total).filter((v) => v > 0)
  );

  let listingTotals = removePriceOutliers(
    validListings.slice(0, 18).map((x) => x.total).filter((v) => v > 0)
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

  let baseline = marketMedian || marketLow || listingMedian || 0;
  let pricingMode = "Console model median";

  if (!marketMedian && listingMedian) pricingMode = "Console listings fallback";
  if (!marketMedian && !listingMedian && marketLow) pricingMode = "Console low-band fallback";

  if (queryContext.family === "switch_v2") {
    baseline = Math.max(baseline, 165);
    pricingMode = "Switch V2 median";
  } else if (queryContext.family === "switch_oled") {
    baseline = Math.max(baseline, 210);
    pricingMode = "Switch OLED median";
  } else if (queryContext.family === "switch_lite") {
    baseline = Math.max(baseline, 115);
    pricingMode = "Switch Lite median";
  } else if (queryContext.family === "ps5_disc") {
    baseline = Math.max(baseline, 390);
    pricingMode = "PS5 disc median";
  } else if (queryContext.family === "ps5_digital") {
    baseline = Math.max(baseline, 315);
    pricingMode = "PS5 digital median";
  } else if (queryContext.family === "xbox_series_x") {
    baseline = Math.max(baseline, 305);
    pricingMode = "Series X median";
  } else if (queryContext.family === "xbox_series_s") {
    baseline = Math.max(baseline, 165);
    pricingMode = "Series S median";
  }

  const estimatedResale = roundMoney(baseline * 0.982);

  const compCount = marketTotals.length;

  let confidence = 24;
  if (compCount >= 3) confidence = 55;
  if (compCount >= 5) confidence = 70;
  if (compCount >= 8) confidence = 84;
  if (compCount >= 12) confidence = 92;

  let confidenceLabel = "Low";
  if (confidence >= 80) confidenceLabel = "High";
  else if (confidence >= 55) confidenceLabel = "Medium";

  return {
    estimatedResale,
    compCount,
    confidence,
    confidenceLabel,
    pricingMode,
    marketMedian: roundMoney(marketMedian || 0),
    marketLow: roundMoney(marketLow || 0),
    listingMedian: roundMoney(listingMedian || 0),
    debug: {
      marketPoolSize: validMarket.length,
      listingPoolSize: validListings.length,
      baseline: roundMoney(baseline || 0),
    },
  };
}

function classifyItem(item, queryContext) {
  const text = getText(item);

  let warningFlags = [];

  if (text.includes("read description")) {
    warningFlags.push("Read description carefully");
  }

  if (text.includes("no box") || text.includes("without box") || text.includes("unboxed")) {
    warningFlags.push("No box included");
  }

  if (
    text.includes("heavy wear") ||
    text.includes("heavily used") ||
    text.includes("lot of wear") ||
    text.includes("poor condition") ||
    text.includes("worn")
  ) {
    warningFlags.push("Condition may reduce resale appeal");
  }

  if (
    text.includes("scratch") ||
    text.includes("scratches") ||
    text.includes("scratched") ||
    text.includes("cosmetic wear") ||
    text.includes("cosmetic marks")
  ) {
    warningFlags.push("Visible cosmetic wear mentioned");
  }

  let warningScorePenalty = 0;
  for (const flag of warningFlags) {
    if (flag === "Read description carefully") warningScorePenalty += 5;
    else if (flag === "No box included") warningScorePenalty += 1;
    else if (flag === "Condition may reduce resale appeal") warningScorePenalty += 6;
    else if (flag === "Visible cosmetic wear mentioned") warningScorePenalty += 4;
  }

  let bundleType = "standard";
  if (text.includes("boxed")) bundleType = "boxed";
  if (
    text.includes("bundle") ||
    text.includes("with games") ||
    text.includes("games included") ||
    text.includes("extra controller")
  ) {
    bundleType = "bundle";
  }

  return {
    conditionState: isBadCondition(text) ? "faulty_or_parts" : "clean_working",
    repairCost: 0,
    bundleType,
    bundleSignals: {
      bundleType,
      extraControllerCount: 0,
      includedGamesCount: 0,
      hasBox: text.includes("boxed"),
      hasAccessories: text.includes("case") || text.includes("dock"),
      explicitBundleWords: text.includes("bundle"),
    },
    bundleValueBonus: bundleType === "boxed" ? 6 : 0,
    warningFlags,
    warningScorePenalty,
    debug: {
      matched: isValidConsole(item, queryContext),
    },
  };
}

function adjustListingPricing({ queryContext, item, pricingModel }) {
  const text = getText(item);
  let estimatedResale = Number(pricingModel?.estimatedResale || 0);

  if (text.includes("boxed")) estimatedResale += 6;
  if (text.includes("case")) estimatedResale += 4;
  if (text.includes("dock")) estimatedResale += 6;

  return {
    bundleSignals: {
      bundleType: text.includes("boxed") ? "boxed" : "standard",
      extraControllerCount: 0,
      includedGamesCount: 0,
      hasBox: text.includes("boxed"),
      hasAccessories: text.includes("case") || text.includes("dock"),
      explicitBundleWords: text.includes("bundle"),
    },
    bundleType: text.includes("boxed") ? "boxed" : "standard",
    bundleValueBonus: text.includes("boxed") ? 6 : 0,
    warningFlags: [],
    warningScorePenalty: 0,
    estimatedResale: roundMoney(estimatedResale),
    debug: {},
  };
}
export const consoleEngine = {
  ...baseEngine,
  id: "console",

  detect(query = "") {
    const text = normalizeConsoleText(query);

    return (
      text.includes("ps5") ||
      text.includes("playstation5") ||
      text.includes("playstation 5") ||
      text.includes("xbox series x") ||
      text.includes("xbox series s") ||
      text.includes("switch oled") ||
      text.includes("switch lite") ||
      text.includes("nintendo switch")
    );
  },

  classifyQuery(query = "") {
    const rawQuery = String(query || "").trim();
    const normalizedQuery = normalizeConsoleText(rawQuery);
    const brand = detectConsoleBrand(normalizedQuery);
    const family = parseConsoleFamily(normalizedQuery);
    const allowDamaged = shouldAllowDamagedConsoles({ normalizedQuery });

    const wantsBundle =
      normalizedQuery.includes("bundle") ||
      normalizedQuery.includes("with games") ||
      normalizedQuery.includes("games included") ||
      normalizedQuery.includes("with 2 controllers") ||
      normalizedQuery.includes("with two controllers") ||
      normalizedQuery.includes("extra controller") ||
      normalizedQuery.includes("second controller") ||
      normalizedQuery.includes("spare controller") ||
      normalizedQuery.includes("job lot") ||
      normalizedQuery.includes("comes with");

    return {
      rawQuery,
      normalizedQuery,
      brand,
      family,
      allowDamaged,
      wantsBundle,
    };
  },

  buildSearchQuery(query = "") {
    const ctx = this.classifyQuery(query);

    if (ctx.family === "ps5_disc" || ctx.family === "ps5_digital") {
      return "ps5";
    }

    if (ctx.family === "xbox_series_x") {
      return "xbox series x";
    }

    if (ctx.family === "xbox_series_s") {
      return "xbox series s";
    }

    if (ctx.family === "switch_oled") {
      return "nintendo switch oled";
    }

    if (ctx.family === "switch_lite") {
      return "nintendo switch lite";
    }

    if (ctx.family === "switch_v2") {
      return "nintendo switch";
    }

    return String(query || "").trim();
  },

  expandSearchVariants(query = "") {
    const rawQuery = String(query || "").trim();
    const ctx = this.classifyQuery(rawQuery);

    if (ctx.family === "ps5_disc") {
      return [
        "ps5",
        "playstation 5",
        "ps5 console",
        "sony ps5",
        "playstation 5 console",
        "ps5 disc",
        "ps5 standard",
        "ps5 bundle",
      ];
    }

    if (ctx.family === "ps5_digital") {
      return [
        "ps5",
        "ps5 digital",
        "playstation 5 digital",
        "digital edition ps5",
        "ps5 digital console",
      ];
    }

    if (ctx.family === "xbox_series_x") {
      return ["xbox series x", "series x", "xbox series x console"];
    }

    if (ctx.family === "xbox_series_s") {
      return ["xbox series s", "series s", "xbox series s console"];
    }

    if (ctx.family === "switch_oled") {
      return ["nintendo switch oled", "switch oled"];
    }

    if (ctx.family === "switch_lite") {
      return ["nintendo switch lite", "switch lite"];
    }

    if (ctx.family === "switch_v2") {
      return ["nintendo switch", "switch console"];
    }

    return [rawQuery].filter(Boolean);
  },

  matchesItem(item, queryContext) {
    return isValidConsole(item, queryContext);
  },

  buildPricingModel({ queryContext, marketItems = [], listingItems = [] }) {
    return buildPricingModel(queryContext, marketItems, listingItems);
  },

  classifyItem(item, queryContext) {
    return classifyItem(item, queryContext);
  },

  adjustListingPricing({ queryContext, item, pricingModel }) {
    return adjustListingPricing({ queryContext, item, pricingModel });
  },
};
