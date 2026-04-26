import { normalizeText } from "./baseEngine.js";

export function hasAnyPhoneText(text = "", phrases = []) {
  return phrases.some((phrase) => text.includes(phrase));
}

export function normalizePhoneText(value = "") {
  return normalizeText(String(value || ""))
    .replace(/[&+]/g, " and ")
    .replace(/\bdoesnt\b/g, "doesn't")
    .replace(/\bwont\b/g, "won't")
    .replace(/\bcant\b/g, "can't")
    .replace(/\biphone\s*se\s*3rd\b/g, "iphone se 3rd")
    .replace(/\biphone\s*se\s*2nd\b/g, "iphone se 2nd")
    .replace(/\bface\s*id\b/g, "face id")
    .replace(/\btouch\s*id\b/g, "touch id")
    .replace(/\bicloud\s*locked\b/g, "icloud locked")
    .replace(/\bactivation\s*locked\b/g, "activation locked")
    .replace(/\b1\s*tb\b/g, "1tb")
    .replace(/\b64\s*gb\b/g, "64gb")
    .replace(/\b128\s*gb\b/g, "128gb")
    .replace(/\b256\s*gb\b/g, "256gb")
    .replace(/\b512\s*gb\b/g, "512gb")
    .replace(/\b1024\s*gb\b/g, "1024gb")
    .replace(/\s+/g, " ")
    .trim();
}

export function getPhoneTitleText(item = {}) {
  return normalizePhoneText(
    [
      item?.title,
      item?.subtitle,
    ]
      .filter(Boolean)
      .join(" ")
  );
}

export function getPhoneCombinedItemText(item = {}) {
  return normalizePhoneText(
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

export function getPhoneCategoryText(item = {}) {
  const categories = Array.isArray(item?.categories) ? item.categories : [];

  return normalizePhoneText(
    categories
      .map((category) => category?.categoryName)
      .filter(Boolean)
      .join(" ")
  );
}

export function getPhoneItemTextParts(item = {}) {
  return {
    titleText: getPhoneTitleText(item),
    combinedText: getPhoneCombinedItemText(item),
    categoryText: getPhoneCategoryText(item),
  };
}
