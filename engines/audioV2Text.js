import { normalizeText } from "./baseEngine.js";

export function hasAny(text, phrases = []) {
  const haystack = String(text || "");

  return phrases.some((phrase) => {
    const needle = String(phrase || "");
    return needle && haystack.includes(needle);
  });
}

export function normalizeAudioText(value) {
  return normalizeText(String(value || ""))
    .replace(/[&+]/g, " and ")
    .replace(/\bair\s*pods\b/g, "airpods")
    .replace(/\bairpods\s*pro\s*2\b/g, "airpods pro 2")
    .replace(/\bairpods\s*pro\s*2nd\b/g, "airpods pro 2nd")
    .replace(/\bairpods\s*pro\s*second\b/g, "airpods pro second")
    .replace(/\bairpods\s*3rd\b/g, "airpods 3rd")
    .replace(/\bairpods\s*2nd\b/g, "airpods 2nd")
    .replace(/\bgalaxy\s*buds\s*3\s*pro\b/g, "galaxy buds 3 pro")
    .replace(/\bgalaxy\s*buds3\s*pro\b/g, "galaxy buds 3 pro")
    .replace(/\bgalaxy\s*buds\s*3\b/g, "galaxy buds 3")
    .replace(/\bgalaxy\s*buds3\b/g, "galaxy buds 3")
    .replace(/\bgalaxy\s*buds\s*2\s*pro\b/g, "galaxy buds 2 pro")
    .replace(/\bgalaxy\s*buds2\s*pro\b/g, "galaxy buds 2 pro")
    .replace(/\bgalaxy\s*buds\s*2\b/g, "galaxy buds 2")
    .replace(/\bgalaxy\s*buds2\b/g, "galaxy buds 2")
    .replace(/\bwh\s*1000\s*xm\s*5\b/g, "wh-1000xm5")
    .replace(/\bwh1000xm5\b/g, "wh-1000xm5")
    .replace(/\bwh\s*1000\s*xm\s*4\b/g, "wh-1000xm4")
    .replace(/\bwh1000xm4\b/g, "wh-1000xm4")
    .replace(/\bwh\s*1000\s*xm\s*3\b/g, "wh-1000xm3")
    .replace(/\bwh1000xm3\b/g, "wh-1000xm3")
    .replace(/\bwf\s*1000\s*xm\s*5\b/g, "wf-1000xm5")
    .replace(/\bwf1000xm5\b/g, "wf-1000xm5")
    .replace(/\bwf\s*1000\s*xm\s*4\b/g, "wf-1000xm4")
    .replace(/\bwf1000xm4\b/g, "wf-1000xm4")
    .replace(/\bwf\s*1000\s*xm\s*3\b/g, "wf-1000xm3")
    .replace(/\bwf1000xm3\b/g, "wf-1000xm3")
    .replace(/\bqc\s*45\b/g, "qc45")
    .replace(/\bqc\s*35\s*ii\b/g, "qc35 ii")
    .replace(/\bqc35ii\b/g, "qc35 ii")
    .replace(/\bqc\s*35\b/g, "qc35")
    .replace(/\s+/g, " ")
    .trim();
}

export function getAudioTitleText(item = {}) {
  return normalizeAudioText([item?.title, item?.subtitle].filter(Boolean).join(" "));
}

export function getAudioCombinedItemText(item = {}) {
  return normalizeAudioText(
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

export function getAudioCategoryTexts(item = {}) {
  const categories = Array.isArray(item?.categories) ? item.categories : [];

  return categories
    .map((category) => normalizeAudioText(category?.categoryName || ""))
    .filter(Boolean);
}

export function getAudioCategoryText(item = {}) {
  return getAudioCategoryTexts(item).join(" ");
}
