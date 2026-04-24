import { matchesConsoleFamily as matchesConsoleFamilyOld } from "./consoleFilters.js";
import { matchesConsoleFamily as matchesConsoleFamilyV2 } from "./consoleFiltersV2.js";

export function matchesConsoleFamily(text, queryContext, item) {
  const family = String(queryContext?.family || "");

  if (family.startsWith("ps5")) {
    return matchesConsoleFamilyV2({ item, queryContext });
  }

  return matchesConsoleFamilyOld(text, queryContext, item);
}
