import { hasAny, normalizeAudioText } from "./audioV2Text.js";

const AIRPODS_FAMILY_PATTERNS = [
  [
    "airpods_pro_2",
    [
      "airpods pro 2",
      "airpods pro2",
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
      "apple airpods pro2",
      "apple airpods pro 2nd",
      "apple airpods pro second generation",
      "a2698",
      "a2699",
      "a2700",
      "a2968",
      "a2969",
      "a3047",
      "a3048",
      "a3049",
    ],
  ],
  [
    "airpods_pro",
    [
      "airpods pro",
      "apple airpods pro",
      "airpod pro",
      "airpods pros",
      "a2083",
      "a2084",
      "a2190",
    ],
  ],
  [
    "airpods_3",
    [
      "airpods 3",
      "airpods3",
      "airpods 3rd",
      "airpods third generation",
      "airpods gen 3",
      "airpods 3rd gen",
      "airpods 3rd generation",
      "apple airpods 3",
      "a2564",
      "a2565",
      "a2566",
    ],
  ],
  [
    "airpods_2",
    [
      "airpods 2",
      "airpods2",
      "airpods 2nd",
      "airpods second generation",
      "airpods gen 2",
      "airpods 2nd gen",
      "airpods 2nd generation",
      "apple airpods 2",
      "a2031",
      "a2032",
      "a1602",
      "a1938",
    ],
  ],
  [
    "airpods_max",
    [
      "airpods max",
      "apple airpods max",
      "airpod max",
      "a2096",
    ],
  ],
];

const SONY_FAMILY_PATTERNS = [
  [
    "sony_wh_1000xm5",
    [
      "wh-1000xm5",
      "wh 1000xm5",
      "wh1000xm5",
      "sony xm5",
      "sony wh xm5",
      "sony wh-1000xm5",
      "sony wh 1000xm5",
    ],
  ],
  [
    "sony_wh_1000xm4",
    [
      "wh-1000xm4",
      "wh 1000xm4",
      "wh1000xm4",
      "sony xm4",
      "sony wh xm4",
      "sony wh-1000xm4",
      "sony wh 1000xm4",
    ],
  ],
  [
    "sony_wh_1000xm3",
    [
      "wh-1000xm3",
      "wh 1000xm3",
      "wh1000xm3",
      "sony xm3",
      "sony wh xm3",
      "sony wh-1000xm3",
      "sony wh 1000xm3",
    ],
  ],
  [
    "sony_wf_1000xm5",
    [
      "wf-1000xm5",
      "wf 1000xm5",
      "wf1000xm5",
      "sony wf xm5",
      "sony wf-1000xm5",
      "sony wf 1000xm5",
    ],
  ],
  [
    "sony_wf_1000xm4",
    [
      "wf-1000xm4",
      "wf 1000xm4",
      "wf1000xm4",
      "sony wf xm4",
      "sony wf-1000xm4",
      "sony wf 1000xm4",
    ],
  ],
  [
    "sony_wf_1000xm3",
    [
      "wf-1000xm3",
      "wf 1000xm3",
      "wf1000xm3",
      "sony wf xm3",
      "sony wf-1000xm3",
      "sony wf 1000xm3",
    ],
  ],
];

const BOSE_FAMILY_PATTERNS = [
  ["bose_qc_ultra", ["qc ultra", "quietcomfort ultra", "bose ultra headphones", "bose qc ultra"]],
  ["bose_qc_45", ["qc45", "qc 45", "quietcomfort 45", "bose qc45", "bose qc 45"]],
  ["bose_qc_35_ii", ["qc35 ii", "qc 35 ii", "quietcomfort 35 ii", "bose qc35 ii", "bose qc 35 ii"]],
  ["bose_qc_35", ["qc35", "qc 35", "quietcomfort 35", "bose qc35", "bose qc 35"]],
  ["bose_700", ["bose 700", "noise cancelling 700", "nc 700"]],
  ["bose_qc_earbuds_2", ["qc earbuds ii", "qc earbuds 2", "quietcomfort earbuds ii", "quietcomfort earbuds 2"]],
  ["bose_qc_earbuds", ["qc earbuds", "quietcomfort earbuds"]],
];

const SAMSUNG_BUDS_PATTERNS = [
  ["galaxy_buds3_pro", ["galaxy buds 3 pro", "galaxy buds3 pro", "buds3 pro", "buds 3 pro"]],
  ["galaxy_buds3", ["galaxy buds 3", "galaxy buds3", "buds3", "buds 3"]],
  ["galaxy_buds2_pro", ["galaxy buds 2 pro", "galaxy buds2 pro", "buds2 pro", "buds 2 pro"]],
  ["galaxy_buds2", ["galaxy buds 2", "galaxy buds2", "buds2", "buds 2"]],
  ["galaxy_buds_pro", ["galaxy buds pro", "buds pro"]],
  ["galaxy_buds_live", ["galaxy buds live", "buds live"]],
  ["galaxy_buds_plus", ["galaxy buds+", "galaxy buds plus", "buds plus"]],
  ["galaxy_buds_fe", ["galaxy buds fe", "buds fe"]],
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

  if (hasAny(haystack, ["airpods", "airpod", "apple airpods", "apple airpod"])) return "apple";
  if (
    hasAny(haystack, [
      "sony",
      "wh-1000xm5",
      "wh 1000xm5",
      "wh1000xm5",
      "wh-1000xm4",
      "wh 1000xm4",
      "wh1000xm4",
      "wh-1000xm3",
      "wh 1000xm3",
      "wh1000xm3",
      "wf-1000xm5",
      "wf 1000xm5",
      "wf1000xm5",
      "wf-1000xm4",
      "wf 1000xm4",
      "wf1000xm4",
      "wf-1000xm3",
      "wf 1000xm3",
      "wf1000xm3",
    ])
  ) {
    return "sony";
  }

  if (hasAny(haystack, ["bose", "quietcomfort", "qc45", "qc 45", "qc35", "qc 35", "qc ultra"])) {
    return "bose";
  }

  if (hasAny(haystack, ["samsung", "galaxy buds", "buds2", "buds 2", "buds3", "buds 3"])) {
    return "samsung";
  }

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

export function isCompatibleAudioFamily(queryFamily = "", itemFamily = "") {
  const q = String(queryFamily || "");
  const i = String(itemFamily || "");

  if (!q || !i) return true;
  if (q === i) return true;

  if (q === "airpods_pro" && i === "airpods_pro_2") return true;
  if (q === "galaxy_buds2" && i === "galaxy_buds2_pro") return true;
  if (q === "galaxy_buds3" && i === "galaxy_buds3_pro") return true;

  return false;
}
