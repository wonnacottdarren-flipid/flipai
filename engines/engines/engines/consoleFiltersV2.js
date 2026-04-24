import { matchPs5ConsoleFamily } from "./ps5ConsoleMatch.js";

export function matchesConsoleFamily({ item, queryContext }) {
  const family = String(queryContext?.family || "");

  // PS5 routing
  if (family.startsWith("ps5")) {
    return matchPs5ConsoleFamily({ item, queryContext });
  }

  // Allow everything else for now (Xbox/Nintendo untouched)
  return true;
}
