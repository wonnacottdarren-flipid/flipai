import { hasAny, normalizeAudioText } from "./audioV2Text.js";

const AIRPODS_FAMILY_PATTERNS = [
  [
    "airpods_pro_2",
    [
      "airpods pro 2",
      "airpods pro 2nd",
      "airpods pro second generation",
      "airpods pro gen 2",
      "airpods pro generation 2",
      "airpods pro 2nd gen",
      "airpods pro 2nd generation",
      "airpods pro second gen",
      "airpods pro (2nd gen)",
      "airpods pro 2ndgen",
      "airpods pro 2 generation",
      "apple airpods pro 2",
      "apple airpods pro 2nd",
      "apple airpods pro second generation",
    ],
  ],
  ["airpods_pro", ["airpods pro"]],
  [
    "airpods_3",
    [
      "airpods 3",
      "airpods 3rd",
      "airpods third generation",
      "airpods gen 3",
      "airpods 3rd gen",
      "airpods 3rd generation",
    ],
  ],
  [
    "airpods_2",
    [
      "airpods 2",
      "airpods 2nd",
      "airpods second generation",
      "airpods gen 2",
      "airpods 2nd gen",
      "airpods 2nd generation",
    ],
  ],
  ["airpods_max", ["airpods max"]],
];

const SONY_FAMILY_PATTERNS = [
  ["sony_wh_1000xm5", ["wh-1000xm5", "sony xm5", "sony wh xm5", "sony wh-1000xm5"]],
  ["sony_wh_1000xm4", ["wh-1000xm4", "sony xm4", "sony wh xm4", "sony wh-1000xm4"]],
  ["sony_wh_1000xm3", ["wh-1000xm3", "sony xm3", "sony wh xm3", "sony wh-1000xm3"]],
  ["sony_wf_1000xm5", ["wf-1000xm5", "sony wf xm5", "sony wf-1000xm5"]],
  ["sony_wf_1000xm4", ["wf-1000xm4", "sony wf xm4", "sony wf-1000xm4"]],
  ["sony_wf_1000xm3", ["wf-1000xm3", "sony wf xm3", "sony wf-1000xm3"]],
];

const BOSE_FAMILY_PATTERNS = [
  ["bose_qc_ultra", ["qc ultra", "quietcomfort ultra", "bose ultra headphones", "bose qc ultra"]],
  ["bose_qc_45", ["qc45", "quietcomfort 45", "bose qc45"]],
  ["bose_qc_35_ii", ["qc35 ii", "quietcomfort 35 ii", "bose qc35 ii"]],
  ["bose_qc_35", ["qc35", "quietcomfort 35", "bose qc35"]],
  ["bose_700", ["bose 700", "noise cancelling 700", "nc 700"]],
  ["bose_qc_earbuds_2", ["qc earbuds ii", "qc earbuds 2", "quietcomfort earbuds ii", "quietcomfort earbuds 2"]],
  ["bose_qc_earbuds", ["qc earbuds", "quietcomfort earbuds"]],
];

const SAMSUNG_BUDS_PATTERNS = [
  ["galaxy_buds3_pro", ["galaxy buds 3 pro", "buds3 pro", "buds 3 pro"]],
  ["galaxy_buds3", ["galaxy buds 3"]],
  ["galaxy_buds2_pro", ["galaxy buds 2 pro", "buds2 pro", "buds 2 pro"]],
  ["galaxy_buds2", ["galaxy buds 2"]],
  ["galaxy_buds_pro", ["galaxy buds pro"]],
  ["galaxy_buds_live", ["galaxy buds live"]],
  ["galaxy_buds_plus", ["galaxy buds+", "galaxy buds plus"]],
  ["galaxy_buds_fe", ["galaxy buds fe"]],
];

function parseFamilyFromPatterns(text, patterns = []) {
  const haystack = normalizeAudioText(text);

  for (const [slug, phrases] of patterns) {
    if (phrases.some((phrase) => haystack.includes(normalizeAudioText(phrase)))) {
      return slug;
    }
  }

  return "";
}

export function detectAudioBrand(text = "") {
  const haystack = normalizeAudioText(text);

  if (hasAny(haystack, ["airpods", "apple airpods"])) return "apple";
  if (hasAny(haystack, ["sony", "wh-1000xm5", "wh-1000xm4", "wh-1000xm3", "wf-1000xm5", "wf-1000xm4", "wf-1000xm3"])) return "sony";
  if (hasAny(haystack, ["bose", "quietcomfort", "qc45", "qc35", "qc ultra"])) return "bose";
  if (hasAny(haystack, ["samsung", "galaxy buds"])) return "samsung";

  if (parseFamilyFromPatterns(haystack, AIRPODS_FAMILY_PATTERNS)) return "apple";
  if (parseFamilyFromPatterns(haystack, SONY_FAMILY_PATTERNS)) return "sony";
  if (parseFamilyFromPatterns(haystack, BOSE_FAMILY_PATTERNS)) return "bose";
  if (parseFamilyFromPatterns(haystack, SAMSUNG_BUDS_PATTERNS)) return "samsung";

  return "";
}

export function parseAudioFamily(text = "", brand = "") {
  const haystack = normalizeAudioText(text);
  const audioBrand = brand || detectAudioBrand(haystack);

  if (audioBrand === "apple") return parseFamilyFromPatterns(haystack, AIRPODS_FAMILY_PATTERNS);
  if (audioBrand === "sony") return parseFamilyFromPatterns(haystack, SONY_FAMILY_PATTERNS);
  if (audioBrand === "bose") return parseFamilyFromPatterns(haystack, BOSE_FAMILY_PATTERNS);
  if (audioBrand === "samsung") return parseFamilyFromPatterns(haystack, SAMSUNG_BUDS_PATTERNS);

  return "";
}
