import { extractTotalPrice } from "../baseEngine.js";
import { parseConsoleFamily } from "./consoleV2Family.js";

function normalize(text = "") {
return String(text).toLowerCase();
}

function hasAny(text = "", terms = []) {
return terms.some((t) => text.includes(t));
}

function isXboxFamily(family = "") {
return String(family || "").startsWith("xbox_series");
}

function isFamilyMismatch(text = "", queryFamily = "") {
const family = String(queryFamily || "");
const itemFamily = parseConsoleFamily(text);

if (!family || !itemFamily) return false;
if (family === itemFamily) return false;

if (family === "switch_v2" && (itemFamily === "switch_oled" || itemFamily === "switch_lite")) return true;
if (family === "switch_oled" && itemFamily !== "switch_oled") return true;
if (family === "switch_lite" && itemFamily !== "switch_lite") return true;
if (family.startsWith("xbox_series") && itemFamily !== family) return true;
if (family.startsWith("ps5") && itemFamily !== family) return true;

return false;
}

function isGameListing(text = "") {
if (!text.includes("console")) return true;

return hasAny(text, [
"pre-order",
"pre order",
"release on",
"ps5 game",
"playstation game",
"ea sports",
"fifa",
"fc ",
"call of duty",
"spiderman",
"disc only",
"game only",
]);
}

function isAccessory(text = "") {
return hasAny(text, [
"controller only",
"dualsense",
"charging dock",
"charging station",
"headset only",
"stand",
"cooling fan",
"faceplate",
"cover plate",
"remote",
"cable only",
]);
}

function isFaulty(text = "") {
return hasAny(text, [
"box only",
"empty box",
"no console",
"for parts",
"spares",
"repair",
"faulty",
"not working",
]);
}

function isMissingController(text = "") {
return hasAny(text, [
"no pad",
"no controller",
"without controller",
"missing controller",
"controller not included",
"pad not included",
"no dualsense",
"without dualsense",
]);
}

function hasCosmeticWear(text = "") {
return hasAny(text, [
"scratches",
"scratched",
"scuffed",
"scuff",
"worn",
"heavy wear",
"fair condition",
"poor condition",
]);
}

function hasMissingCharger(text = "") {
return hasAny(text, [
"no charger",
"without charger",
"charger not included",
"missing charger",
"no power cable",
]);
}

function hasXboxExtraController(text = "") {
return hasAny(text, [
"2 controllers",
"two controllers",
"extra controller",
"second controller",
"spare controller",
"additional controller",
"controller x2",
"x2 controller",
"x2 controllers",
]);
}

function hasXboxAccessoryBundle(text = "") {
return hasAny(text, [
"headset",
"charging dock",
"charging station",
"charge dock",
"rechargeable battery",
"battery pack",
"play and charge",
"with accessories",
"includes accessories",
"accessories included",
"with extras",
"extras included",
]);
}

function hasXboxGameBundle(text = "") {
return hasAny(text, [
"with games",
"includes games",
"games included",
"plus games",
"+ games",
"game bundle",
"8 games",
"eight games",
"6 games",
"six games",
"5 games",
"five games",
"4 games",
"four games",
"3 games",
"three games",
"2 games",
"two games",
]);
}

function hasWeakXboxGameBundle(text = "") {
return hasAny(text, [
"fifa",
"fc 24",
"fc24",
"fc 25",
"fc25",
"ea sports",
"old games",
"digital games",
"downloaded games",
"games installed",
"game pass",
"xbox game pass",
]);
}

function hasXboxControllerIssue(text = "") {
return hasAny(text, [
"stick drift",
"stickdrift",
"controller drift",
"faulty controller",
"controller faulty",
"pad drift",
"broken controller",
]);
}

function detectBundleType(text = "") {
if (isMissingController(text)) return "console_only";

if (
hasAny(text, [
"bundle",
"with games",
"includes games",
"games included",
"with controller",
"includes controller",
"controller included",
"2 controllers",
"two controllers",
"extra controller",
"with accessories",
"includes accessories",
"accessories included",
"with extras",
"extras included",
"charging dock",
"charging station",
])
) {
return "bundle";
}

if (
hasAny(text, [
"controller and",
"controller +",
"plus controller",
"plus games",
"plus extras",
"+ controller",
"+ games",
"+ extras",
])
) {
return "bundle";
}

if (hasAny(text, ["boxed", "complete in box"])) return "boxed";

return "standard";
}

function detectCondition(text = "") {
if (hasAny(text, ["brand new", "sealed"])) return "new";
if (hasAny(text, ["very good", "excellent"])) return "clean_working";
if (hasAny(text, ["good"])) return "used_working";
if (hasAny(text, ["fair condition", "poor condition", "scuffed", "scratched"])) return "cosmetic_wear";
return "unknown";
}

function getWarningFlags(text = "", family = "") {
const warnings = [];
const xbox = isXboxFamily(family);

if (isMissingController(text)) warnings.push("No controller included");
if (hasMissingCharger(text)) warnings.push("No charger included");
if (hasAny(text, ["read description", "see description", "desc"])) warnings.push("Read description carefully");
if (hasCosmeticWear(text)) warnings.push("Cosmetic wear mentioned");
if (hasAny(text, ["low firmware", "jailbreak", "modded"])) warnings.push("Specialist buyer wording");
if (hasAny(text, ["extra ssd", "upgraded ssd", "plus extra 1tb ssd"])) warnings.push("Storage upgrade needs checking");

if (xbox && hasWeakXboxGameBundle(text)) warnings.push("Xbox game bundle value may be weak");
if (xbox && hasXboxControllerIssue(text)) warnings.push("Xbox controller issue mentioned");

return warnings;
}

function getXboxBundleScoreAdjustment(text = "", family = "") {
if (!isXboxFamily(family)) return 0;

let score = 0;

if (hasXboxExtraController(text)) score += 0.9;
if (hasXboxAccessoryBundle(text)) score += 0.45;
if (hasXboxGameBundle(text)) score += 0.25;

if (hasWeakXboxGameBundle(text)) score -= 0.45;
if (hasXboxControllerIssue(text)) score -= 1.6;

return score;
}

function getRankingScore(
text = "",
title = "",
total = 0,
bundleType = "",
conditionState = "",
family = ""
) {
let score = 10;

if (hasAny(text, ["disc edition", "disc version", "825gb", "1tb", "slim"])) score += 1.4;
if (hasAny(text, ["sony playstation 5", "playstation 5", "ps5"])) score += 0.8;
if (hasAny(text, ["xbox series x", "xbox series s", "microsoft xbox"])) score += 0.8;
if (hasAny(text, ["console and controller", "with controller", "controller included"])) score += 0.7;

if (bundleType === "bundle") score += 0.6;
if (bundleType === "boxed") score += 0.4;
if (bundleType === "console_only") score -= 2.4;

score += getXboxBundleScoreAdjustment(text, family);

if (conditionState === "new") score += 1.2;
if (conditionState === "clean_working") score += 0.9;
if (conditionState === "used_working") score += 0.4;
if (conditionState === "cosmetic_wear") score -= 1.1;

if (isMissingController(text)) score -= 2.6;
if (hasMissingCharger(text)) score -= 0.9;
if (hasAny(text, ["low firmware", "jailbreak", "modded"])) score -= 2.4;
if (hasAny(text, ["read description", "see description", "desc"])) score -= 1.2;
if (hasCosmeticWear(text)) score -= 1.2;
if (hasAny(text, ["extra ssd", "upgraded ssd", "plus extra 1tb ssd"])) score -= 1.2;

if (total < 150) score -= 5;
else if (total < 230) score -= 1.6;
else if (total >= 280 && total <= 380) score += 0.8;
else if (total > 430) score -= 0.9;

if (title.length < 10) score -= 2;

return Math.round(score * 100) / 100;
}

function getBundleSignals(text = "", family = "") {
return {
xboxExtraController: isXboxFamily(family) && hasXboxExtraController(text),
xboxAccessoryBundle: isXboxFamily(family) && hasXboxAccessoryBundle(text),
xboxGameBundle: isXboxFamily(family) && hasXboxGameBundle(text),
xboxWeakGameBundle: isXboxFamily(family) && hasWeakXboxGameBundle(text),
xboxControllerIssue: isXboxFamily(family) && hasXboxControllerIssue(text),
};
}

export function scoreConsoleV2Items(items = [], queryContext = {}) {
const results = [];
const family = queryContext?.family || "";

for (const item of items) {
const title = String(item?.title || "");
const text = normalize(title);

if (isGameListing(text)) continue;
if (isAccessory(text)) continue;
if (isFaulty(text)) continue;
if (isFamilyMismatch(text, family)) continue;

if (family === "ps5_disc" && text.includes("digital")) {
  continue;
}

const total = extractTotalPrice(item);

if (!total || total <= 0) continue;

const bundleType = detectBundleType(text);
const conditionState = detectCondition(text);
const warningFlags = getWarningFlags(text, family);
const score = getRankingScore(text, title, total, bundleType, conditionState, family);

results.push({
  item,
  titleText: title,
  total,
  score,
  matched: score > 0,
  family,
  conditionState,
  bundleType,
  bundleSignals: getBundleSignals(text, family),
  warningFlags,
  warningPenalty: warningFlags.length,
});

}

return results.sort((a, b) => b.score - a.score);
}
