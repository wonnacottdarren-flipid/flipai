// ps5MatchTest.js

import { matchPs5ConsoleFamily } from "./ps5ConsoleMatch.js";

const testCases = [
  "PS5 Console Bundle With Controller",
  "PS5 Disc Console With Games",
  "PS5 Boxed With Cables",
  "PS5 Controller Only",
  "PS5 Disc Drive Only",
  "PS5 Faulty Not Working",
];

for (const title of testCases) {
  const result = matchPs5ConsoleFamily({
    text: title,
    queryContext: {
      family: "ps5_disc",
      wantsBundle: true,
    },
    item: {
      title,
    },
    helpers: {},
  });

  console.log(title, "→", result);
}
