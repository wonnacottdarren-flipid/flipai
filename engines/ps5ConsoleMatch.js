// ps5ConsoleMatch.js

import {
  isPs5Like,
  isHardPs5AccessoryText,
  isPs5BundleCandidate,
  detectConsoleType,
  hasHardPs5Reject,
} from "./ps5ConsoleFilter.js";

function safeText(value) {
  return String(value || "");
}

function getItemText(item = {}) {
  return [
    item?.title,
    item?.subtitle,
    item?.condition,
    item?.conditionDisplayName,
    item?.itemCondition,
    item?.shortDescription,
    item?.description,
  ]
    .filter(Boolean)
    .join(" ");
}

export function matchPs5ConsoleFamily({ text = "", queryContext = {}, item = {}, helpers = {} } = {}) {
  const normalizeConsoleText =
    helpers.normalizeConsoleText || ((value) => safeText(value).toLowerCase());

  const isConsoleCategory =
    helpers.isConsoleCategory || (() => false);

  const hasStrongConsoleSignals =
    helpers.hasStrongConsoleSignals || (() => false);

  const isStorageMismatch =
    helpers.isStorageMismatch || (() => false);

  const detectConsoleStorage =
    helpers.detectConsoleStorage || (() => "unknown");

  const titleText = normalizeConsoleText([item?.title, item?.subtitle].filter(Boolean).join(" "));
  const combinedText = normalizeConsoleText(`${titleText} ${text} ${getItemText(item)}`);

  const family = String(queryContext?.family || "");
  const queryStorage = String(queryContext?.storagePreference || "");
  const itemStorage = detectConsoleStorage(combinedText, family);

  const wantsBundle = Boolean(queryContext?.wantsBundle);
  const bundleCandidate = wantsBundle && isPs5BundleCandidate(combinedText);

  if (!isPs5Like(combinedText)) {
    return { matched: false, reason: "notPs5" };
  }

  if (hasHardPs5Reject(combinedText)) {
    return { matched: false, reason: "hardPs5Reject" };
  }

  if (!bundleCandidate && isHardPs5AccessoryText(combinedText)) {
    return { matched: false, reason: "hardPs5Accessory" };
  }

  if (!bundleCandidate && !isConsoleCategory(item) && !hasStrongConsoleSignals(titleText)) {
    return { matched: false, reason: "weakConsoleSignals" };
  }

  const consoleInfo = detectConsoleType(combinedText);

  if (!bundleCandidate && !consoleInfo?.isConsole) {
    return { matched: false, reason: "notConsoleType" };
  }

  if (family === "ps5_digital") {
    if (consoleInfo?.variant !== "ps5_digital" && !combinedText.includes("digital")) {
      return { matched: false, reason: "consoleTypeDigitalMismatch" };
    }
  }

  if (family === "ps5_disc") {
    if (consoleInfo?.variant === "ps5_digital" || combinedText.includes("digital edition")) {
      return { matched: false, reason: "consoleTypeDigitalMismatch" };
    }
  }

  if (isStorageMismatch(queryStorage, itemStorage, family)) {
    return { matched: false, reason: "storageMismatch" };
  }

  return {
    matched: true,
    reason: bundleCandidate ? "ps5BundleCandidate" : "ps5ConsoleMatch",
  };
}

export default {
  matchPs5ConsoleFamily,
};
