import { matchPs5ConsoleFamily } from "./ps5ConsoleMatch.js";

export function matchesConsoleFamily({ item, queryContext }) {
  const family = String(queryContext?.family || "");

  if (family.startsWith("ps5")) {
    return matchPs5ConsoleFamily({ item, queryContext });
  }

  return true;
}
