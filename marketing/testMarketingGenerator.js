// marketing/testMarketingGenerator.js

import { generateMarketingContent } from "./marketingGenerator.js";

const result = generateMarketingContent({
  idea: "Bought a PS5 for £180 and sold it for £320",
  category: "flip",
});

console.log(JSON.stringify(result, null, 2));
