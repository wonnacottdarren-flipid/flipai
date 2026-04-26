import { runConsoleV2Engine } from "./engines/consoleV2/consoleV2Engine.js";

const result = runConsoleV2Engine({
  query: "ps5",
  marketItems: [],
  listingItems: [],
});

console.log(JSON.stringify(result, null, 2));
