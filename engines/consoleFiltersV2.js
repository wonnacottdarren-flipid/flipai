import { matchPs5ConsoleFamily } from "./ps5ConsoleMatch.js";

export function matchesConsoleFamily({ text = "", item, queryContext } = {}) {
  const family = String(queryContext?.family || "");

  if (family.startsWith("ps5")) {
    return matchPs5ConsoleFamily({ text, item, queryContext });
  }

  return true;
}
