// ps5MatchTest.js

import { matchPs5ConsoleFamily } from "./ps5ConsoleMatch.js";

const tests = [
  "PS5 Console Bundle With Controller",
  "PS5 Disc Console With Games",
  "PS5 Boxed With Cables",
  "PS5 Controller Only",
  "PS5 Disc Drive Only",
  "PS5 Faulty Not Working",
];

const baseQueryContext = {
  rawQuery: "ps5 bundle",
  normalizedQuery: "ps5 bundle",
  family: "ps5_disc",
  wantsBundle: true,
  storagePreference: "unknown",
};

const helpers = {};

for (const title of tests) {
  const item = { title };

  const result = matchPs5ConsoleFamily({
    text: title,
    queryContext: baseQueryContext,
    item,
    helpers,
  });

  console.log(`${title} → matched: ${result.matched} | reason: ${result.reason || "matched"}`);
}
