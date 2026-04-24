import { matchPs5Clean } from "./ps5CleanFilter.js";

const tests = [
  "ps5 console",
  "ps5 disc edition",
  "ps5 bundle with controller",
  "ps5 with 2 controllers and games",
  "ps5 controller only",
  "ps5 headset",
  "ps5 faulty",
];

for (const t of tests) {
  console.log("----");
  console.log(t);
  console.log(matchPs5Clean(t));
}
