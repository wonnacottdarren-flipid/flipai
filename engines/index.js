import { baseEngine } from "./baseEngine.js";
import { dysonEngine } from "./dysonEngine.js";

const engineRegistry = [dysonEngine];

export function detectCategoryEngine(query = "") {
  for (const engine of engineRegistry) {
    if (engine.detect(query)) {
      return engine;
    }
  }

  return baseEngine;
}

export { baseEngine, dysonEngine };
