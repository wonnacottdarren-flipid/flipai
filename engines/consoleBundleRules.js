// engines/consoleBundleRules.js

export function shouldRejectBundleRequirement(queryContext = {}, isRealBundle = false) {
  const wantsBundle = Boolean(queryContext?.wantsBundle);
  const family = String(queryContext?.family || "");

  // If bundle not required → never reject
  if (!wantsBundle) return false;

  // If it's already a real bundle → never reject
  if (isRealBundle) return false;

  // PS5 exception → allow standard consoles through
  if (family === "ps5_disc" || family === "ps5_digital") {
    return false;
  }

  // All other cases → enforce bundle requirement
  return true;
}
