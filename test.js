import "dotenv/config";

import { searchEbayListings } from "./ebay.js";
import { runConsoleV2Engine } from "./engines/consoleV2/consoleV2Engine.js";

async function runTest() {
  try {
    const query = "ps5";

    console.log("=== V2 TEST START ===");
    console.log("Query:", query);

    // 🔥 Fetch real eBay listings
    const listings = await searchEbayListings({
      query,
      limit: 30,
    });

    console.log("Fetched listings:", listings.length);

    // 🔥 Run V2 engine
    const result = runConsoleV2Engine({
      query,
      marketItems: listings,
      listingItems: listings,
    });

    console.log("\n=== V2 RESULT ===");
    console.log("Matched:", result.listings.matchedCount);

    console.log("\nTop 5 Results:\n");

    result.listings.items.slice(0, 5).forEach((item, i) => {
      console.log(`--- #${i + 1} ---`);
      console.log("Title:", item.titleText);
      console.log("Price:", item.total);
      console.log("Score:", item.score);
      console.log("Condition:", item.conditionState);
      console.log("Bundle:", item.bundleType);
      console.log("Warnings:", item.warningFlags);
      console.log("");
    });

    console.log("\n=== PRICING ===");
    console.log(result.pricing);

    console.log("\n=== V2 TEST END ===");
  } catch (err) {
    console.error("V2 TEST ERROR:", err);
  }
}

runTest();
