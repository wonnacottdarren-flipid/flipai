import {
BUNDLE_KEYWORDS,
CONSOLE_ONLY_QUERY_TERMS,
} from "./consoleV2Constants.js";
import { detectConsoleBrand, parseConsoleFamily } from "./consoleV2Family.js";
import { hasAny, normalizeConsoleText } from "./consoleV2Text.js";
function detectConsoleOnlyIntent(text = "") {
const t = normalizeConsoleText(text);
if (!hasAny(t, CONSOLE_ONLY_QUERY_TERMS)) return false;
if (
hasAny(t, [
"bundle",
"with games",
"games included",
"with 2 controllers",
"with two controllers",
"extra controller",
"second controller",
"spare controller",
"job lot",
"comes with",
])
) {
return false;
}
return true;
}
function detectBundleIntent(text = "", wantsConsoleOnly = false) {
const t = normalizeConsoleText(text);
if (wantsConsoleOnly) return false;
return hasAny(t, [
...BUNDLE_KEYWORDS,
"console bundle",
"with game",
"with games",
"includes game",
"includes games",
"game included",
"games included",
"plus game",
"plus games",
"with controller",
"controller included",
"includes controller",
"with cables",
"cables included",
"box and cables",
"with accessories",
"accessories included",
"includes accessories",
"with extras",
"extras included",
"with 2 controllers",
"with two controllers",
"2 controllers",
"two controllers",
"extra controller",
"second controller",
"spare controller",
"job lot",
"comes with",
]);
}
function shouldAllowDamagedConsoles(text = "") {
const t = normalizeConsoleText(text);
return hasAny(t, [
"faulty",
"broken",
"damaged",
"for parts",
"spares",
"repairs",
"no power",
"no hdmi",
"banned",
"error",
"issue",
"problem",
]);
}
function detectStoragePreference(text = "", family = "") {
const t = normalizeConsoleText(text);
const fam = String(family || "");
if (hasAny(t, ["2tb", "2 tb"])) return "2tb";
if (hasAny(t, ["1tb", "1 tb", "1000gb", "1000 gb"])) return "1tb";
if (hasAny(t, ["825gb", "825 gb"])) return "825gb";
if (hasAny(t, ["512gb", "512 gb"])) return "512gb";
if (hasAny(t, ["64gb", "64 gb"])) return "64gb";
if (hasAny(t, ["32gb", "32 gb"])) return "32gb";
if (fam === "xbox_series_x" && t.includes("galaxy black")) return "2tb";
if (fam === "xbox_series_s" && t.includes("carbon black")) return "1tb";
return "unknown";
}
export function classifyConsoleV2Query(query = "") {
const rawQuery = String(query || "").trim();
const normalizedQuery = normalizeConsoleText(rawQuery);
const brand = detectConsoleBrand(normalizedQuery);
const family = parseConsoleFamily(normalizedQuery);
const wantsConsoleOnly = detectConsoleOnlyIntent(normalizedQuery);
const wantsBundle = detectBundleIntent(normalizedQuery, wantsConsoleOnly);
const allowDamaged = shouldAllowDamagedConsoles(normalizedQuery);
const storagePreference = detectStoragePreference(normalizedQuery, family);
return {
rawQuery,
normalizedQuery,
brand,
family,
wantsBundle,
wantsConsoleOnly,
allowDamaged,
storagePreference,
};
}
export function buildConsoleV2SearchQuery(query = "") {
const ctx = classifyConsoleV2Query(query);
if (ctx.wantsConsoleOnly) {
if (ctx.family === "ps5_disc") return "ps5 console only";
if (ctx.family === "ps5_digital") return "ps5 digital console only";
if (ctx.family === "xbox_series_x") return "xbox series x console only";
if (ctx.family === "xbox_series_s") return "xbox series s console only";
if (ctx.family === "switch_oled") return "nintendo switch oled console only";
if (ctx.family === "switch_lite") return "nintendo switch lite console only";
if (ctx.family === "switch_v2") return "nintendo switch console only";
}
if (ctx.wantsBundle) {
if (ctx.family === "ps5_disc" || ctx.family === "ps5_digital") return "ps5 bundle";
if (ctx.family === "xbox_series_x") return "xbox series x bundle";
if (ctx.family === "xbox_series_s") return "xbox series s bundle";
if (ctx.family === "switch_oled") return "nintendo switch oled bundle";
if (ctx.family === "switch_lite") return "nintendo switch lite bundle";
if (ctx.family === "switch_v2") return "nintendo switch bundle";
}
if (ctx.family === "ps5_disc" || ctx.family === "ps5_digital") return "ps5";
if (ctx.family === "xbox_series_x") return "xbox series x";
if (ctx.family === "xbox_series_s") return "xbox series s";
if (ctx.family === "switch_oled") return "nintendo switch oled";
if (ctx.family === "switch_lite") return "nintendo switch lite";
if (ctx.family === "switch_v2") return "nintendo switch";
return String(query || "").trim();
}
export function expandConsoleV2SearchVariants(query = "") {
const rawQuery = String(query || "").trim();
const ctx = classifyConsoleV2Query(rawQuery);
if (ctx.wantsConsoleOnly) {
if (ctx.family === "ps5_disc") {
return [
"ps5 console only",
"playstation 5 console only",
"ps5 no controller",
"ps5 without controller",
];
}
if (ctx.family === "ps5_digital") {  return [    "ps5 digital console only",    "playstation 5 digital console only",    "ps5 digital no controller",    "ps5 digital without controller",  ];}if (ctx.family === "xbox_series_x") {  return [    "xbox series x console only",    "xbox series x no controller",    "xbox series x without controller",  ];}if (ctx.family === "xbox_series_s") {  return [    "xbox series s console only",    "xbox series s no controller",    "xbox series s without controller",  ];}if (ctx.family === "switch_oled") {  return [    "nintendo switch oled console only",    "switch oled console only",    "nintendo switch oled no joy cons",    "nintendo switch oled without joy cons",  ];}if (ctx.family === "switch_lite") {  return [    "nintendo switch lite console only",    "switch lite console only",    "nintendo switch lite no charger",  ];}if (ctx.family === "switch_v2") {  return [    "nintendo switch console only",    "switch console only",    "nintendo switch no joy cons",    "nintendo switch without joy cons",  ];}
}
if (ctx.wantsBundle) {
if (ctx.family === "ps5_disc" || ctx.family === "ps5_digital") {
return [
"ps5 bundle",
"ps5 console bundle",
"playstation 5 bundle",
"ps5 with games",
"ps5 with controller",
];
}
if (ctx.family === "xbox_series_x") {  return [    "xbox series x bundle",    "xbox series x console bundle",    "xbox series x with games",    "xbox series x with controller",    "microsoft xbox series x bundle",  ];}if (ctx.family === "xbox_series_s") {  return [    "xbox series s bundle",    "xbox series s console bundle",    "xbox series s with games",    "xbox series s with controller",    "microsoft xbox series s bundle",  ];}if (ctx.family === "switch_oled") {  return [    "nintendo switch oled bundle",    "switch oled console bundle",    "nintendo switch oled with games",    "nintendo switch oled with accessories",    "switch oled with joy cons",  ];}if (ctx.family === "switch_lite") {  return [    "nintendo switch lite bundle",    "switch lite console bundle",    "nintendo switch lite with games",    "nintendo switch lite with accessories",    "switch lite with case",  ];}if (ctx.family === "switch_v2") {  return [    "nintendo switch bundle",    "nintendo switch console bundle",    "nintendo switch with games",    "nintendo switch with accessories",    "nintendo switch with joy cons",  ];}
}
if (ctx.family === "ps5_disc") {
return [
"ps5",
"playstation 5",
"ps5 console",
"ps5 disc",
"ps5 standard",
];
}
if (ctx.family === "ps5_digital") {
return [
"ps5 digital",
"playstation 5 digital",
"digital edition ps5",
"ps5 digital console",
];
}
if (ctx.family === "xbox_series_x") {
return [
"xbox series x",
"xbox series x console",
"microsoft xbox series x",
];
}
if (ctx.family === "xbox_series_s") {
return [
"xbox series s",
"xbox series s console",
"microsoft xbox series s",
];
}
if (ctx.family === "switch_oled") {
return [
"nintendo switch oled",
"switch oled",
"nintendo switch oled console",
];
}
if (ctx.family === "switch_lite") {
return [
"nintendo switch lite",
"switch lite",
"nintendo switch lite console",
];
}
if (ctx.family === "switch_v2") {
return [
"nintendo switch",
"nintendo switch console",
"switch console",
"nintendo switch v2",
];
}
return [rawQuery].filter(Boolean);
}
