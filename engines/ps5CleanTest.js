import { matchPs5CleanListing } from "./ps5CleanFilter.js";

const tests = [
  "PS5 Console Bundle With Controller",
  "PS5 Disc Console With Games",
  "PS5 Boxed With Cables",
  "PS5 Controller Only",
  "PS5 Disc Drive Only",
  "PS5 Faulty Not Working",
  "PS5 game only",
  "PS5",
];

tests.forEach((title) => {
  const item = { title };

  const result = matchPs5CleanListing(item, {});

  console.log(
    `${title} → matched: ${result.matched}, reason: ${result.reason}, variant: ${result.variant}, bundleType: ${result.bundleType}`
  );
});
