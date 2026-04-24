let ps5BundleDebugState = {
  totalChecked: 0,
  passedHardRejects: 0,
  ps5BundleCandidates: 0,
  skippedSharedGate: 0,
  skippedNonConsole: 0,
  skippedAccessory: 0,
};
 
export function resetPs5BundleDebug() {
  ps5BundleDebugState = {
    totalChecked: 0,
    passedHardRejects: 0,
    ps5BundleCandidates: 0,
    skippedSharedGate: 0,
    skippedNonConsole: 0,
    skippedAccessory: 0,
  };
}

export function countPs5BundleDebug(type) {
  if (!ps5BundleDebugState[type] && ps5BundleDebugState[type] !== 0) return;
  ps5BundleDebugState[type]++;
}

export function logPs5BundleDebug(context = {}) {
  console.log("=== PS5 BUNDLE DEBUG ===");
  console.log("Query:", context.query);
  console.log("Totals:", ps5BundleDebugState);
  console.log("Listings:", {
    cleanListings: context.cleanListings?.length || 0,
    cleanMarket: context.cleanMarket?.length || 0,
    evaluatedDeals: context.evaluatedDeals?.length || 0,
    preferredDeals: context.preferredDeals?.length || 0,
    finalDeals: context.finalDeals?.length || 0,
  });
  console.log("=========================");
}
