// ps5MatchTest.js

import { matchPs5ConsoleFamily } from "./engines/ps5ConsoleMatch.js";
import * as ps5ConsoleFilter from "./engines/ps5ConsoleFilter.js";

const sampleItems = [
  {
    title: "Sony PlayStation 5 PS5 Disc Console Bundle with Controller and Games",
  },
  {
    title: "PS5 Console Disc Edition with Controller",
  },
  {
    title: "PlayStation 5 Digital Edition Console",
  },
  {
    title: "PS5 DualSense Controller Only",
  },
  {
    title: "PS5 Disc Drive Only",
  },
  {
    title: "PS5 Box Only Empty Box",
  },
  {
    title: "Faulty PS5 Console For Parts",
  },
  {
    title: "Sony PS5 Bundle Boxed with Cables and 2 Controllers",
  },
];

const helpers = {
  ...ps5ConsoleFilter,
};

const testQueries = [
  {
    name: "PS5 bundle search",
    queryContext: {
      rawQuery: "ps5 bundle",
      normalizedQuery: "ps5 bundle",
      family: "ps5_disc",
      wantsBundle: true,
      storagePreference: "unknown",
    },
  },
  {
    name: "PS5 disc search",
    queryContext: {
      rawQuery: "ps5",
      normalizedQuery: "ps5",
      family: "ps5_disc",
      wantsBundle: false,
      storagePreference: "unknown",
    },
  },
  {
    name: "PS5 digital search",
    queryContext: {
      rawQuery: "ps5 digital",
      normalizedQuery: "ps5 digital",
      family: "ps5_digital",
      wantsBundle: false,
      storagePreference: "unknown",
    },
  },
];

for (const test of testQueries) {
  console.log("");
  console.log("====================================");
  console.log(test.name);
  console.log("====================================");

  for (const item of sampleItems) {
    const result = matchPs5ConsoleFamily({
      text: item.title,
      queryContext: test.queryContext,
      item,
      helpers,
    });

    console.log({
      title: item.title,
      matched: result?.matched === true,
      reason: result?.reason || "matched",
    });
  }
}
