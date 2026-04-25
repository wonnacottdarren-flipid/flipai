import { classifyConsoleQuery } from "./consoleQueryContext.js";

export function buildConsoleSearchQuery(query = "") {
  const ctx = classifyConsoleQuery(query);

  if (ctx.wantsConsoleOnly) {
    if (ctx.family === "ps5_disc") return "ps5 console only";
    if (ctx.family === "ps5_digital") return "ps5 digital console only";
    if (ctx.family === "xbox_series_x") return "xbox series x console only";
    if (ctx.family === "xbox_series_s") return "xbox series s console only";
  }

  if (ctx.family === "ps5_disc" || ctx.family === "ps5_digital") return "ps5";
  if (ctx.family === "xbox_series_x") return "xbox series x";
  if (ctx.family === "xbox_series_s") return "xbox series s";
  if (ctx.family === "switch_oled") return "nintendo switch oled";
  if (ctx.family === "switch_lite") return "nintendo switch lite";
  if (ctx.family === "switch_v2") return "nintendo switch";

  return String(query || "").trim();
}

export function expandConsoleSearchVariants(query = "") {
  const rawQuery = String(query || "").trim();
  const ctx = classifyConsoleQuery(rawQuery);

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

  if (ctx.wantsConsoleOnly) {
    if (ctx.family === "ps5_disc") {
      return [
        "ps5 console only",
        "playstation 5 console only",
        "ps5 no controller",
        "ps5 without controller",
        "ps5 unit only",
        "ps5 main unit only",
        "ps5 body only",
      ];
    }

    if (ctx.family === "ps5_digital") {
      return [
        "ps5 digital console only",
        "playstation 5 digital console only",
        "ps5 digital no controller",
        "ps5 digital without controller",
        "digital edition ps5 console only",
      ];
    }

    if (ctx.family === "xbox_series_x") {
      return [
        "xbox series x console only",
        "xbox series x no controller",
        "xbox series x without controller",
        "xbox series x console",
        "microsoft xbox series x console",
      ];
    }

    if (ctx.family === "xbox_series_s") {
      return [
        "xbox series s console only",
        "xbox series s no controller",
        "xbox series s without controller",
        "xbox series s console",
        "microsoft xbox series s console",
      ];
    }
  }

  if (ctx.family === "ps5_disc") {
    return [
      "ps5",
      "playstation 5",
      "ps5 console",
      "sony ps5",
      "playstation 5 console",
      "ps5 disc",
      "ps5 standard",
      "ps5 bundle",
    ];
  }

  if (ctx.family === "ps5_digital") {
    return [
      "ps5",
      "ps5 digital",
      "playstation 5 digital",
      "digital edition ps5",
      "ps5 digital console",
    ];
  }

  if (ctx.family === "xbox_series_x") {
    return [
      "xbox series x",
      "xbox series x console",
      "microsoft xbox series x",
      "microsoft xbox series x console",
      "series x console",
    ];
  }

  if (ctx.family === "xbox_series_s") {
    return [
      "xbox series s",
      "xbox series s console",
      "microsoft xbox series s",
      "microsoft xbox series s console",
      "series s console",
    ];
  }

  if (ctx.family === "switch_oled") {
    return [
      "nintendo switch oled",
      "switch oled",
      "nintendo switch oled console",
      "switch oled console",
    ];
  }

  if (ctx.family === "switch_lite") {
    return [
      "nintendo switch lite",
      "switch lite",
      "nintendo switch lite console",
      "switch lite console",
    ];
  }

  if (ctx.family === "switch_v2") {
    return [
      "nintendo switch",
      "nintendo switch console",
      "switch console",
      "nintendo switch v2",
      "red box nintendo switch",
    ];
  }

  return [rawQuery].filter(Boolean);
}
