import { normalizeText } from "./baseEngine.js";

const IPHONE_FAMILY_PATTERNS = [
  ["iphone_16_pro_max", ["iphone 16 pro max"]],
  ["iphone_16_pro", ["iphone 16 pro"]],
  ["iphone_16_plus", ["iphone 16 plus"]],
  ["iphone_16", ["iphone 16"]],
  ["iphone_15_pro_max", ["iphone 15 pro max"]],
  ["iphone_15_pro", ["iphone 15 pro"]],
  ["iphone_15_plus", ["iphone 15 plus"]],
  ["iphone_15", ["iphone 15"]],
  ["iphone_14_pro_max", ["iphone 14 pro max"]],
  ["iphone_14_pro", ["iphone 14 pro"]],
  ["iphone_14_plus", ["iphone 14 plus"]],
  ["iphone_14", ["iphone 14"]],
  ["iphone_13_pro_max", ["iphone 13 pro max"]],
  ["iphone_13_pro", ["iphone 13 pro"]],
  ["iphone_13_mini", ["iphone 13 mini"]],
  ["iphone_13", ["iphone 13"]],
  ["iphone_12_pro_max", ["iphone 12 pro max"]],
  ["iphone_12_pro", ["iphone 12 pro"]],
  ["iphone_12_mini", ["iphone 12 mini"]],
  ["iphone_12", ["iphone 12"]],
  ["iphone_11_pro_max", ["iphone 11 pro max"]],
  ["iphone_11_pro", ["iphone 11 pro"]],
  ["iphone_11", ["iphone 11"]],
  ["iphone_se_2022", ["iphone se 2022", "iphone se 3rd", "iphone se 3"]],
  ["iphone_se_2020", ["iphone se 2020", "iphone se 2nd", "iphone se 2"]],
  ["iphone_xr", ["iphone xr"]],
  ["iphone_xs_max", ["iphone xs max"]],
  ["iphone_xs", ["iphone xs"]],
  ["iphone_x", ["iphone x"]],
];

const SAMSUNG_FAMILY_PATTERNS = [
  ["galaxy_z_fold6", ["z fold6", "z fold 6", "galaxy z fold6", "galaxy z fold 6"]],
  ["galaxy_z_fold5", ["z fold5", "z fold 5", "galaxy z fold5", "galaxy z fold 5"]],
  ["galaxy_z_flip6", ["z flip6", "z flip 6", "galaxy z flip6", "galaxy z flip 6"]],
  ["galaxy_z_flip5", ["z flip5", "z flip 5", "galaxy z flip5", "galaxy z flip 5"]],
  ["galaxy_s24_ultra", ["s24 ultra", "galaxy s24 ultra"]],
  ["galaxy_s24_plus", ["s24 plus", "s24+", "galaxy s24 plus", "galaxy s24+"]],
  ["galaxy_s24", ["s24", "galaxy s24"]],
  ["galaxy_s23_ultra", ["s23 ultra", "galaxy s23 ultra"]],
  ["galaxy_s23_plus", ["s23 plus", "s23+", "galaxy s23 plus", "galaxy s23+"]],
  ["galaxy_s23_fe", ["s23 fe", "galaxy s23 fe"]],
  ["galaxy_s23", ["s23", "galaxy s23"]],
  ["galaxy_s22_ultra", ["s22 ultra", "galaxy s22 ultra"]],
  ["galaxy_s22_plus", ["s22 plus", "s22+", "galaxy s22 plus", "galaxy s22+"]],
  ["galaxy_s22", ["s22", "galaxy s22"]],
  ["galaxy_s21_ultra", ["s21 ultra", "galaxy s21 ultra"]],
  ["galaxy_s21_plus", ["s21 plus", "s21+", "galaxy s21 plus", "galaxy s21+"]],
  ["galaxy_s21_fe", ["s21 fe", "galaxy s21 fe"]],
  ["galaxy_s21", ["s21", "galaxy s21"]],
  ["galaxy_a55", ["a55", "galaxy a55"]],
  ["galaxy_a54", ["a54", "galaxy a54"]],
  ["galaxy_a35", ["a35", "galaxy a35"]],
  ["galaxy_a34", ["a34", "galaxy a34"]],
];

function hasAny(text, phrases = []) {
  return phrases.some((phrase) => text.includes(phrase));
}

export function detectPhoneBrand(text = "") {
  const t = normalizeText(text);

  if (t.includes("iphone")) return "iphone";
  if (t.includes("samsung") || t.includes("galaxy")) return "samsung";

  if (parseIphoneFamily(t)) return "iphone";
  if (parseSamsungFamily(t)) return "samsung";

  return "";
}

export function parseIphoneFamily(text = "") {
  const t = normalizeText(text);

  for (const [slug, patterns] of IPHONE_FAMILY_PATTERNS) {
    if (patterns.some((pattern) => t.includes(pattern))) {
      return slug;
    }
  }

  return "";
}

export function parseSamsungFamily(text = "") {
  const t = normalizeText(text);

  for (const [slug, patterns] of SAMSUNG_FAMILY_PATTERNS) {
    if (patterns.some((pattern) => t.includes(pattern))) {
      return slug;
    }
  }

  return "";
}

export function parsePhoneFamily(text = "", brand = "") {
  if (brand === "iphone") return parseIphoneFamily(text);
  if (brand === "samsung") return parseSamsungFamily(text);

  const detected = detectPhoneBrand(text);

  if (detected === "iphone") return parseIphoneFamily(text);
  if (detected === "samsung") return parseSamsungFamily(text);

  return "";
}

export function extractStorageGb(text = "") {
  const t = normalizeText(text);

  const tbMatch = t.match(/\b(1)\s*tb\b/);
  if (tbMatch) return 1024;

  const gbMatch = t.match(/\b(64|128|256|512|1024)\s*(gb|g)\b/);
  if (gbMatch) return Number(gbMatch[1]);

  return 0;
}
