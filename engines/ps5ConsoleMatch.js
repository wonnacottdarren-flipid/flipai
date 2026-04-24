import { matchPs5CleanListing } from "./ps5CleanFilter.js";

function getItemText(item = {}) {
  return [
    item?.title,
    item?.subtitle,
    item?.condition,
    item?.conditionDisplayName,
    item?.itemCondition,
    item?.shortDescription,
    item?.description,
  ]
    .filter(Boolean)
    .join(" ");
}

export function matchPs5ConsoleFamily({ text = "", item, queryContext } = {}) {
  const combinedItem = {
    ...item,
    title: [text, getItemText(item)].filter(Boolean).join(" "),
  };

  const result = matchPs5CleanListing(combinedItem, queryContext);

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
