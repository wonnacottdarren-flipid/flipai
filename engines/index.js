import { baseEngine } from "./baseEngine.js";
import { dysonEngine } from "./dysonEngine.js";
import { phoneEngine } from "./phoneEngine.js";

const engineRegistry = [dysonEngine, phoneEngine];

export function detectCategoryEngine(query = "") {
  for (const engine of engineRegistry) {
    if (engine.detect(query)) {
      return engine;
    }
  }

  return baseEngine;
}

export { baseEngine, dysonEngine, phoneEngine };
