import { normalizeConsoleText } from "./consoleItemText.js";

export function isGenericUnknownSwitchTitle(titleText = "") {
  const t = normalizeConsoleText(titleText);

  return (
    t === "nintendo switch" ||
    t === "switch console" ||
    t === "nintendo switch console" ||
    t === "nintendo switch 32gb console" ||
    t === "nintendo switch 32 gb console" ||
    t === "nintendo switch console 32gb" ||
    t === "nintendo switch console 32 gb"
  );
}
