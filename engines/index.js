import { baseEngine } from "./baseEngine.js";
import { dysonEngine } from "./dysonEngine.js";
import { phoneEngine } from "./phoneEngine.js";
import { consoleV2Adapter } from "./consoleV2/consoleV2Adapter.js";
import { cameraEngine } from "./cameraEngine.js";
import { audioEngine } from "./audioEngine.js";

const engines = [
  dysonEngine,
  audioEngine,
  phoneEngine,
  consoleV2Adapter,
  cameraEngine,
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

export {
  engines,
  baseEngine,
  dysonEngine,
  phoneEngine,
  consoleV2Adapter,
  cameraEngine,
  audioEngine,
};

export default {
  detectEngineForQuery,
  getEngineForQuery,
  engines,
  baseEngine,
  dysonEngine,
  phoneEngine,
  consoleV2Adapter,
  cameraEngine,
  audioEngine,
};
