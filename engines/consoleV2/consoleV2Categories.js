import {
  ACCESSORY_CATEGORY_TERMS,
  CONSOLE_CATEGORY_TERMS,
  HARD_NON_CONSOLE_CATEGORY_TERMS,
  NON_CONSOLE_CATEGORY_TERMS,
} from "./consoleV2Constants.js";
import { getCategoryText, hasAny } from "./consoleV2Text.js";

export function isConsoleCategory(item = {}) {
  const categoryText = getCategoryText(item);
  return hasAny(categoryText, CONSOLE_CATEGORY_TERMS);
}

export function isAccessoryCategory(item = {}) {
  const categoryText = getCategoryText(item);
  return hasAny(categoryText, ACCESSORY_CATEGORY_TERMS);
}

export function isNonConsoleCategory(item = {}) {
  const categoryText = getCategoryText(item);
  return hasAny(categoryText, NON_CONSOLE_CATEGORY_TERMS);
}

export function isHardNonConsoleCategory(item = {}) {
  const categoryText = getCategoryText(item);

  return (
    hasAny(categoryText, HARD_NON_CONSOLE_CATEGORY_TERMS) &&
    !isConsoleCategory(item)
  );
}

export function isVideoGameOnlyCategory(item = {}) {
  const categoryText = getCategoryText(item);

  return (
    hasAny(categoryText, ["video games"]) &&
    !isConsoleCategory(item)
  );
}
