export * from "./consoleFiltersLegacy.js";

import { matchesConsoleFamily as matchesConsoleFamilyLegacy } from "./consoleFiltersLegacy.js";
import { matchesConsoleFamily as matchesConsoleFamilyV2 } from "./consoleFiltersV2.js";

export function matchesConsoleFamily(text, queryContext, item) {
  const family = String(queryContext?.family || "");

  if (family.startsWith("ps5")) {
    return matchesConsoleFamilyV2({ item, queryContext });
  }

  return matchesConsoleFamilyLegacy(text, queryContext, item);
}
