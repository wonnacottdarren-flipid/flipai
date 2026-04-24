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

  expandSearchVariants(query = "") {
    const rawQuery = String(query || "").trim();
    const ctx = this.classifyQuery(rawQuery);

    if (
      (ctx.family === "ps5_disc" || ctx.family === "ps5_digital") &&
      (ctx.wantsBundle || ctx.originalWantsBundle)
    ) {
      return [
        "ps5 bundle",
        "ps5 console bundle",
        "ps5 with games",
        "ps5 games bundle",
        "ps5 with 2 controllers",
        "ps5 with controller",
      ];
    }

    return baseConsoleEngine.expandSearchVariants(query);
  },
};
