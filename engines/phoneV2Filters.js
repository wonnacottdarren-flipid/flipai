import {
  hasAnyPhoneText,
  normalizePhoneText,
  getPhoneTitleText,
  getPhoneCombinedItemText,
  getPhoneCategoryText,
} from "./phoneV2Text.js";

import {
  classifyPhoneConditionState,
  isDamagedPhoneConditionState,
  shouldAllowDamagedPhones,
} from "./phoneV2Condition.js";

import {
  detectPhoneBrand,
  parsePhoneFamily,
  extractStorageGb,
} from "./phoneV2Families.js";

const PHONE_CATEGORY_TERMS = [
  "mobile and smart phones",
  "mobile & smart phones",
  "mobile phones",
  "smartphones",
  "cell phones",
  "cell phones and smartphones",
  "cell phones & smartphones",
  "mobile phones and communication",
  "mobile phones & communication",
];

const ACCESSORY_CATEGORY_TERMS = [
  "cases covers and skins",
  "cases, covers and skins",
  "cases covers & skins",
  "mobile phone accessories",
  "phone accessories",
  "chargers and docks",
  "chargers & docks",
  "cables and adapters",
  "cables & adapters",
  "screen protectors",
  "mounts and holders",
  "mounts & holders",
  "holders",
  "battery cases",
  "accessories",
];

const PARTS_CATEGORY_TERMS = [
  "replacement parts",
  "parts",
  "lcds",
  "digitizers",
  "screens",
  "batteries",
  "housing",
  "flex cables",
  "logic boards",
];

const ACCESSORY_ONLY_TERMS = [
  "case only",
  "cover only",
  "screen protector",
  "charger only",
  "cable only",
  "usb cable",
  "lightning cable",
  "type c cable",
  "box only",
  "empty box",
  "manual only",
  "sim tray",
  "camera lens protector",
  "tempered glass",
  "screen guard",
  "phone case",
  "back cover",
  "housing only",
  "rear housing",
  "lcd only",
  "screen only",
  "display only",
  "battery only",
  "motherboard only",
  "logic board",
  "replacement screen",
  "screen assembly",
  "battery replacement",
  "rear glass only",
  "front glass only",
];

const SEVERELY_LOCKED_TERMS = [
  "icloud locked",
  "activation locked",
  "google locked",
  "frp locked",
  "mdm locked",
  "finance locked",
  "blacklisted",
  "blocked imei",
  "bad esn",
];

const NETWORK_LOCKED_TERMS = [
  "network locked",
  "locked to",
  "o2 locked",
  "ee locked",
  "vodafone locked",
  "three locked",
  "tesco locked",
  "virgin locked",
];

const UNLOCKED_TERMS = [
  "unlocked",
  "sim free",
  "factory unlocked",
  "open network",
];

const HANDSET_SIGNAL_TERMS = [
  "smartphone",
  "mobile phone",
  "handset",
  "phone",
  "boxed",
  "original box",
  "battery health",
  "face id",
  "fully working",
  "working order",
  "used",
  "grade a",
  "grade b",
  "grade c",
  "sim free",
  "unlocked",
  "64gb",
  "128gb",
  "256gb",
  "512gb",
  "1tb",
];

export function isPhoneCategory(item = {}) {
  const categoryText = getPhoneCategoryText(item);
  return hasAnyPhoneText(categoryText, PHONE_CATEGORY_TERMS);
}

export function isPhoneAccessoryCategory(item = {}) {
  const categoryText = getPhoneCategoryText(item);
  return hasAnyPhoneText(categoryText, ACCESSORY_CATEGORY_TERMS);
}

export function isPhonePartsCategory(item = {}) {
  const categoryText = getPhoneCategoryText(item);
  return hasAnyPhoneText(categoryText, PARTS_CATEGORY_TERMS);
}

export function isPhoneAccessoryOnly(text = "") {
  const t = normalizePhoneText(text);
  return hasAnyPhoneText(t, ACCESSORY_ONLY_TERMS);
}

export function isSeverelyLockedPhone(text = "") {
  const t = normalizePhoneText(text);
  return hasAnyPhoneText(t, SEVERELY_LOCKED_TERMS);
}

export function isNetworkLockedPhone(text = "") {
  const t = normalizePhoneText(text);
  return hasAnyPhoneText(t, NETWORK_LOCKED_TERMS);
}

export function isExplicitlyUnlockedPhone(text = "") {
  const t = normalizePhoneText(text);
  return hasAnyPhoneText(t, UNLOCKED_TERMS);
}

export function hasPhoneHandsetSignals(text = "") {
  const t = normalizePhoneText(text);
  return hasAnyPhoneText(t, HANDSET_SIGNAL_TERMS);
}

export function isOverlyGenericPhoneTitle(titleText = "", queryContext = {}) {
  const t = normalizePhoneText(titleText);
  const family = String(queryContext?.family || "");

  if (!family) return false;

  const genericIphoneTitles = ["iphone", "apple iphone"];
  const genericSamsungTitles = ["samsung", "samsung galaxy", "galaxy"];

  if (queryContext.brand === "iphone" && genericIphoneTitles.includes(t)) {
    return true;
  }

  if (queryContext.brand === "samsung" && genericSamsungTitles.includes(t)) {
    return true;
  }

  if (family === "iphone_13" && t === "iphone 13") return false;
  if (family === "iphone_12" && t === "iphone 12") return false;
  if (family === "iphone_11" && t === "iphone 11") return false;

  return false;
}

export function isWrongPhoneBrand(text = "", queryContext = {}) {
  const queryBrand = String(queryContext?.brand || "");
  if (!queryBrand) return false;

  const itemBrand = detectPhoneBrand(text);
  return Boolean(itemBrand && itemBrand !== queryBrand);
}

export function isWrongPhoneFamily(text = "", queryContext = {}) {
  const queryFamily = String(queryContext?.family || "");
  if (!queryFamily) return false;

  const itemFamily = parsePhoneFamily(text, queryContext?.brand || "");
  return Boolean(itemFamily && itemFamily !== queryFamily);
}

export function isWrongPhoneStorage(text = "", queryContext = {}) {
  const queryStorageGb = Number(queryContext?.storageGb || 0);
  if (!queryStorageGb) return false;

  const itemStorageGb = extractStorageGb(text);
  return Boolean(itemStorageGb > 0 && itemStorageGb !== queryStorageGb);
}

export function failsPhoneConditionGate(text = "", queryContext = {}) {
  const conditionState = classifyPhoneConditionState(text);
  const allowDamaged =
    Boolean(queryContext?.allowDamaged) || shouldAllowDamagedPhones(queryContext);

  return !allowDamaged && isDamagedPhoneConditionState(conditionState);
}

export function failsPhoneUnlockedGate(text = "", queryContext = {}) {
  if (!queryContext?.wantsUnlocked) return false;

  if (isSeverelyLockedPhone(text)) return true;
  if (isNetworkLockedPhone(text)) return true;

  return false;
}

export function failsPhoneBaseGate(item = {}, queryContext = {}) {
  const titleText = getPhoneTitleText(item);
  const combinedText = getPhoneCombinedItemText(item);

  if (!combinedText) return true;

  if (isPhoneAccessoryOnly(combinedText)) return true;
  if (isSeverelyLockedPhone(combinedText)) return true;
  if (isPhoneAccessoryCategory(item)) return true;
  if (isPhonePartsCategory(item)) return true;

  if (failsPhoneConditionGate(combinedText, queryContext)) return true;
  if (failsPhoneUnlockedGate(combinedText, queryContext)) return true;

  if (isWrongPhoneBrand(combinedText, queryContext)) return true;
  if (isWrongPhoneFamily(combinedText, queryContext)) return true;
  if (isWrongPhoneStorage(combinedText, queryContext)) return true;

  const inPhoneCategory = isPhoneCategory(item);
  if (!inPhoneCategory && !hasPhoneHandsetSignals(combinedText)) {
    return true;
  }

  if (isOverlyGenericPhoneTitle(titleText, queryContext) && !inPhoneCategory) {
    return true;
  }

  return false;
}

export function getPhoneFilterDebug(item = {}, queryContext = {}) {
  const titleText = getPhoneTitleText(item);
  const combinedText = getPhoneCombinedItemText(item);
  const categoryText = getPhoneCategoryText(item);
  const conditionState = classifyPhoneConditionState(combinedText);

  if (!combinedText) return { matched: false, reason: "empty_text" };
  if (isPhoneAccessoryOnly(combinedText)) return { matched: false, reason: "accessory_only" };
  if (isSeverelyLockedPhone(combinedText)) return { matched: false, reason: "severely_locked" };
  if (isPhoneAccessoryCategory(item)) return { matched: false, reason: "accessory_category" };
  if (isPhonePartsCategory(item)) return { matched: false, reason: "parts_category" };
  if (failsPhoneConditionGate(combinedText, queryContext)) {
    return { matched: false, reason: `condition_blocked_${conditionState}` };
  }
  if (failsPhoneUnlockedGate(combinedText, queryContext)) {
    return { matched: false, reason: "unlocked_required_but_locked" };
  }
  if (isWrongPhoneBrand(combinedText, queryContext)) {
    return { matched: false, reason: "brand_mismatch" };
  }
  if (isWrongPhoneFamily(combinedText, queryContext)) {
    return { matched: false, reason: "family_mismatch" };
  }
  if (isWrongPhoneStorage(combinedText, queryContext)) {
    return { matched: false, reason: "storage_mismatch" };
  }

  const inPhoneCategory = isPhoneCategory(item);
  if (!inPhoneCategory && !hasPhoneHandsetSignals(combinedText)) {
    return { matched: false, reason: "no_handset_signal" };
  }

  if (isOverlyGenericPhoneTitle(titleText, queryContext) && !inPhoneCategory) {
    return { matched: false, reason: "overly_generic_title" };
  }

  return {
    matched: true,
    reason: "matched",
    titleText,
    combinedText,
    categoryText,
    conditionState,
    itemBrand: detectPhoneBrand(combinedText),
    itemFamily: parsePhoneFamily(combinedText, queryContext?.brand || ""),
    itemStorageGb: extractStorageGb(combinedText),
    inPhoneCategory,
    isNetworkLocked: isNetworkLockedPhone(combinedText),
    isUnlocked: isExplicitlyUnlockedPhone(combinedText),
  };
}
