import { normalizeText } from "./baseEngine.js";

export function hasAny(text, phrases = []) {
  return phrases.some((phrase) => text.includes(phrase));
}

export function normalizeConsoleText(value) {
  return normalizeText(String(value || ""))
    .replace(/\bps\s*5\b/g, "ps5")
    .replace(/\bplaystation\s*5\b/g, "playstation5")
    .replace(/\bplaystation 5\b/g, "playstation5")
    .replace(/\bsony ps5\b/g, "ps5")
    .replace(/\bplaystation 5 console\b/g, "playstation5 console")
    .replace(/\bdisk edition\b/g, "disc edition")
    .replace(/\bdisk\b/g, "disc")
    .replace(/\bblu ray\b/g, "bluray")
    .replace(/\bblu-ray\b/g, "bluray")
    .replace(/\b1 tb\b/g, "1tb")
    .replace(/\b2 tb\b/g, "2tb")
    .replace(/\b825 gb\b/g, "825gb")
    .replace(/\b512 gb\b/g, "512gb")
    .replace(/\b64 gb\b/g, "64gb")
    .replace(/\b32 gb\b/g, "32gb")
    .replace(/\bseries\s*x\b/g, "series x")
    .replace(/\bseries\s*s\b/g, "series s")
    .replace(/\bjoy\s*cons\b/g, "joy cons")
    .replace(/\bjoy\s*con\b/g, "joy con")
    .replace(/\s+/g, " ")
    .trim();
}

export function getTitleText(item) {
  return normalizeConsoleText([item?.title, item?.subtitle].filter(Boolean).join(" "));
}

export function getCombinedItemText(item) {
  return normalizeConsoleText(
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

export function getCategoryText(item) {
  const categories = Array.isArray(item?.categories) ? item.categories : [];
  return normalizeConsoleText(
    categories
      .map((category) => category?.categoryName)
      .filter(Boolean)
      .join(" ")
  );
}
