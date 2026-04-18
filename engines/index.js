import { baseEngine } from "./baseEngine.js";
import { dysonEngine } from "./dysonEngine.js";
import { phoneEngine } from "./phoneEngine.js";
import { consoleEngine } from "./consoleEngine.js";

const engineRegistry = [dysonEngine, phoneEngine, consoleEngine];

export function detectCategoryEngine(query = "") {
  for (const engine of engineRegistry) {
    if (engine.detect(query)) {
      return engine;
    }
  }

  return baseEngine;
}

export { baseEngine, dysonEngine, phoneEngine, consoleEngine };
