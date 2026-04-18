import { baseEngine } from "./baseEngine.js";
import { dysonEngine } from "./dysonEngine.js";
import { phoneEngine } from "./phoneEngine.js";
import { consoleEngine } from "./consoleEngine.js";

const engines = [
  dysonEngine,
  phoneEngine,
  consoleEngine,
];

export function detectEngineForQuery(query = "") {
  for (const engine of engines) {
    if (engine && typeof engine.detect === "function" && engine.detect(query)) {
      return engine;
    }
  }

  return baseEngine;
}

export function getEngineForQuery(query = "") {
  return detectEngineForQuery(query);
}

export { engines, baseEngine, dysonEngine, phoneEngine, consoleEngine };

export default {
  detectEngineForQuery,
  getEngineForQuery,
  engines,
  baseEngine,
  dysonEngine,
  phoneEngine,
  consoleEngine,
};
