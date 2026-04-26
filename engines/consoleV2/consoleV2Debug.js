import { extractTotalPrice } from "../baseEngine.js";
import { detectBundleSignalsV2 } from "./consoleV2Bundle.js";
import {
  isAccessoryCategory,
  isHardNonConsoleCategory,
  isVideoGameOnlyCategory,
} from "./consoleV2Categories.js";
import {
  classifyConsoleV2Condition,
  isSeverelyBadConsoleV2,
} from "./consoleV2Condition.js";
import { detectConsoleBrand, parseConsoleFamily } from "./consoleV2Family.js";
import { scoreConsoleV2Item } from "./consoleV2Scoring.js";
import { buildConsoleV2WarningFlags } from "./consoleV2Warnings.js";
import {
  getCombinedItemText,
  getTitleText,
  normalizeConsoleText,
} from "./consoleV2Text.js";

export function getConsoleV2MatchDebug(item = {}, queryContext = {}) {
  const titleText = getTitleText(item);
  const combinedText = getCombinedItemText(item);
  const fullText = normalizeConsoleText(`${titleText} ${combinedText}`);
  const total = extractTotalPrice(item);
  const itemBrand = detectConsoleBrand(fullText);
  const itemFamily = parseConsoleFamily(fullText);
  const conditionState = classifyConsoleV2Condition(fullText);
  const bundleSignals = detectBundleSignalsV2(fullText, queryContext?.family || "");
  const warningFlags = buildConsoleV2WarningFlags(fullText, queryContext);
  const score = scoreConsoleV2Item(item, queryContext);

  if (!fullText) {
    return {
      matched: false,
      reason: "empty_text",
      score,
    };
  }

  if (total <= 0) {
    return {
      matched: false,
      reason: "missing_price",
      score,
    };
  }

  if (isHardNonConsoleCategory(item)) {
    return {
      matched: false,
      reason: "hard_non_console_category",
      score,
    };
  }

  if (isVideoGameOnlyCategory(item)) {
    return {
      matched: false,
      reason: "video_game_only_category",
      score,
    };
  }

  if (isAccessoryCategory(item)) {
    return {
      matched: false,
      reason: "accessory_category",
      score,
    };
  }

  if (queryContext?.brand && itemBrand && itemBrand !== queryContext.brand) {
    return {
      matched: false,
      reason: `brand_mismatch_${itemBrand}`,
      score,
      itemBrand,
    };
  }

  if (queryContext?.family && itemFamily !== queryContext.family) {
    return {
      matched: false,
      reason: `family_mismatch_${itemFamily || "unknown"}`,
      score,
      itemFamily,
    };
  }

  if (!queryContext?.allowDamaged && isSeverelyBadConsoleV2(fullText, queryContext)) {
    return {
      matched: false,
      reason: "severely_bad_console_blocked",
      score,
      conditionState,
    };
  }

  if (
    !queryContext?.allowDamaged &&
    (conditionState === "minor_fault" || conditionState === "faulty_or_parts")
  ) {
    return {
      matched: false,
      reason: `condition_blocked_${conditionState}`,
      score,
      conditionState,
    };
  }

  if (queryContext?.wantsBundle && bundleSignals.bundleType !== "bundle") {
    return {
      matched: false,
      reason: "bundle_required_but_not_detected",
      score,
      bundleType: bundleSignals.bundleType,
    };
  }

  if (queryContext?.wantsConsoleOnly && bundleSignals.bundleType !== "console_only") {
    return {
      matched: false,
      reason: "console_only_required_but_not_detected",
      score,
      bundleType: bundleSignals.bundleType,
    };
  }

  if (score <= -50) {
    return {
      matched: false,
      reason: "score_rejected",
      score,
      itemFamily,
      conditionState,
      bundleType: bundleSignals.bundleType,
      warningFlags,
    };
  }

  return {
    matched: true,
    reason: "matched",
    score,
    total,
    itemBrand,
    itemFamily,
    conditionState,
    bundleType: bundleSignals.bundleType,
    bundleSignals,
    warningFlags,
  };
}
