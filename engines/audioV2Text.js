import { normalizeText } from "./baseEngine.js";

export function hasAny(text, phrases = []) {
  const haystack = normalizeAudioText(text);

  return phrases.some((phrase) => {
    const needle = normalizeAudioText(phrase);
    return needle && haystack.includes(needle);
  });
}

export function normalizeAudioText(value) {
  return normalizeText(String(value || ""))
    .replace(/[’‘]/g, "'")
    .replace(/[‐-‒–—]/g, "-")
    .replace(/[&+]/g, " and ")

    .replace(/\bair\s*pods\b/g, "airpods")
    .replace(/\bair\s*pod\b/g, "airpod")
    .replace(/\bapple\s+air\s*pods\b/g, "apple airpods")
    .replace(/\bapple\s+air\s*pod\b/g, "apple airpod")

    .replace(/\bairpods\s*pro\s*\(?\s*2nd\s*gen(?:eration)?\s*\)?\b/g, "airpods pro 2nd generation")
    .replace(/\bairpods\s*pro\s*\(?\s*second\s*gen(?:eration)?\s*\)?\b/g, "airpods pro second generation")
    .replace(/\bairpods\s*pro\s*gen\s*2\b/g, "airpods pro gen 2")
    .replace(/\bairpods\s*pro\s*generation\s*2\b/g, "airpods pro generation 2")
    .replace(/\bairpods\s*pro\s*2ndgen\b/g, "airpods pro 2nd gen")
    .replace(/\bairpods\s*pro2\b/g, "airpods pro 2")
    .replace(/\bairpods\s*pro\s*2\b/g, "airpods pro 2")
    .replace(/\bairpods\s*pro\b/g, "airpods pro")

    .replace(/\bairpods\s*\(?\s*3rd\s*gen(?:eration)?\s*\)?\b/g, "airpods 3rd generation")
    .replace(/\bairpods\s*third\s*gen(?:eration)?\b/g, "airpods third generation")
    .replace(/\bairpods\s*gen\s*3\b/g, "airpods gen 3")
    .replace(/\bairpods3\b/g, "airpods 3")
    .replace(/\bairpods\s*3\b/g, "airpods 3")

    .replace(/\bairpods\s*\(?\s*2nd\s*gen(?:eration)?\s*\)?\b/g, "airpods 2nd generation")
    .replace(/\bairpods\s*second\s*gen(?:eration)?\b/g, "airpods second generation")
    .replace(/\bairpods\s*gen\s*2\b/g, "airpods gen 2")
    .replace(/\bairpods2\b/g, "airpods 2")
    .replace(/\bairpods\s*2\b/g, "airpods 2")

    .replace(/\bairpods\s*max\b/g, "airpods max")

    .replace(/\bgalaxy\s*buds\s*3\s*pro\b/g, "galaxy buds 3 pro")
    .replace(/\bgalaxy\s*buds3\s*pro\b/g, "galaxy buds 3 pro")
    .replace(/\bbuds\s*3\s*pro\b/g, "buds 3 pro")
    .replace(/\bbuds3\s*pro\b/g, "buds 3 pro")
    .replace(/\bgalaxy\s*buds\s*3\b/g, "galaxy buds 3")
    .replace(/\bgalaxy\s*buds3\b/g, "galaxy buds 3")
    .replace(/\bbuds3\b/g, "buds 3")

    .replace(/\bgalaxy\s*buds\s*2\s*pro\b/g, "galaxy buds 2 pro")
    .replace(/\bgalaxy\s*buds2\s*pro\b/g, "galaxy buds 2 pro")
    .replace(/\bbuds\s*2\s*pro\b/g, "buds 2 pro")
    .replace(/\bbuds2\s*pro\b/g, "buds 2 pro")
    .replace(/\bgalaxy\s*buds\s*2\b/g, "galaxy buds 2")
    .replace(/\bgalaxy\s*buds2\b/g, "galaxy buds 2")
    .replace(/\bbuds2\b/g, "buds 2")

    .replace(/\bgalaxy\s*buds\s*live\b/g, "galaxy buds live")
    .replace(/\bgalaxy\s*buds\s*plus\b/g, "galaxy buds plus")
    .replace(/\bgalaxy\s*buds\+\b/g, "galaxy buds plus")
    .replace(/\bgalaxy\s*buds\s*fe\b/g, "galaxy buds fe")
    .replace(/\bgalaxy\s*buds\s*pro\b/g, "galaxy buds pro")

    .replace(/\bwh\s*-?\s*1000\s*xm\s*5\b/g, "wh-1000xm5")
    .replace(/\bwh1000xm5\b/g, "wh-1000xm5")
    .replace(/\bwh\s*-?\s*1000\s*xm\s*4\b/g, "wh-1000xm4")
    .replace(/\bwh1000xm4\b/g, "wh-1000xm4")
    .replace(/\bwh\s*-?\s*1000\s*xm\s*3\b/g, "wh-1000xm3")
    .replace(/\bwh1000xm3\b/g, "wh-1000xm3")

    .replace(/\bwf\s*-?\s*1000\s*xm\s*5\b/g, "wf-1000xm5")
    .replace(/\bwf1000xm5\b/g, "wf-1000xm5")
    .replace(/\bwf\s*-?\s*1000\s*xm\s*4\b/g, "wf-1000xm4")
    .replace(/\bwf1000xm4\b/g, "wf-1000xm4")
    .replace(/\bwf\s*-?\s*1000\s*xm\s*3\b/g, "wf-1000xm3")
    .replace(/\bwf1000xm3\b/g, "wf-1000xm3")

    .replace(/\bqc\s*ultra\b/g, "qc ultra")
    .replace(/\bquiet\s*comfort\b/g, "quietcomfort")
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
