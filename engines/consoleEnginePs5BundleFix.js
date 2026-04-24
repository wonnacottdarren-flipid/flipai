import { consoleEngine as baseConsoleEngine } from "./consoleEngine.js";

export const consoleEngine = {
  ...baseConsoleEngine,

  classifyQuery(query = "") {
    const context = baseConsoleEngine.classifyQuery(query);
    const family = String(context?.family || "");

    if ((family === "ps5_disc" || family === "ps5_digital") && context?.wantsBundle) {
      return {
        ...context,
        wantsBundle: false,
        originalWantsBundle: true,
      };
    }

    return context;
  },
};
