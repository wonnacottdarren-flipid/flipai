import { matchPs5CleanListing } from "./ps5CleanFilter.js";

export function matchPs5ConsoleFamily({ item, queryContext } = {}) {
  const result = matchPs5CleanListing(item, queryContext);

  if (!result?.matched) return false;

  const family = String(queryContext?.family || "");

  if (family === "ps5_digital") {
    return result.variant === "digital";
  }

  if (family === "ps5_disc") {
    return result.variant !== "digital";
  }

  return true;
}

export default {
  matchPs5ConsoleFamily,
};
