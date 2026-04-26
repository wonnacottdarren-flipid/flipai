import { hasAny, getCategoryText } from "./consoleItemText.js";

const CONSOLE_CATEGORY_TERMS = [
  "video game consoles",
  "consoles",
  "home consoles",
  "game consoles",
];

const ACCESSORY_CATEGORY_TERMS = [
  "controllers attachments",
  "controllers and attachments",
  "video game accessories",
  "accessories",
  "headsets",
  "chargers docks",
  "chargers and docks",
  "replacement parts tools",
  "replacement parts and tools",
  "bags skins travel",
  "bags skins and travel",
];

const NON_CONSOLE_CATEGORY_TERMS = [
  "video game merchandise",
  "merchandise",
  "video games",
  "strategy guides cheats",
  "strategy guides & cheats",
  "soundtracks",
  "books, comics & magazines",
  "action figures",
  "toys to life products",
];

const HARD_NON_CONSOLE_CATEGORY_TERMS = [
  "art",
  "art drawings",
  "drawings",
  "paintings",
  "prints",
  "posters",
  "canvas",
  "collectibles",
  "collectable card games",
  "trading card games",
  "coins",
  "stamps",
  "pottery",
  "ceramics",
  "antiques",
  "jewellery",
  "jewelry",
  "clothes shoes accessories",
  "fashion",
  "books",
  "magazines",
  "music",
  "records",
  "vinyl",
  "dolls bears",
  "toys",
  "model railways",
  "cameras photography",
  "mobile phones communication",
  "computers tablets networking",
  "home furniture diy",
  "health beauty",
  "sporting goods",
  "vehicle parts accessories",
  "pet supplies",
  "crafts",
];

export function isConsoleCategory(item) {
  const categoryText = getCategoryText(item);
  return hasAny(categoryText, CONSOLE_CATEGORY_TERMS);
}

export function isAccessoryCategory(item) {
  const categoryText = getCategoryText(item);
  return hasAny(categoryText, ACCESSORY_CATEGORY_TERMS);
}

export function isNonConsoleCategory(item) {
  const categoryText = getCategoryText(item);
  return hasAny(categoryText, NON_CONSOLE_CATEGORY_TERMS);
}

export function isHardNonConsoleCategory(item) {
  const categoryText = getCategoryText(item);

  if (isConsoleCategory(item)) return false;

  return hasAny(categoryText, HARD_NON_CONSOLE_CATEGORY_TERMS);
}
