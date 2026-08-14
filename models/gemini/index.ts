/**
 * models/gemini/index.ts
 *
 * Public entry point for the Gemini model layer.
 * Import from here rather than from individual files.
 *
 * Usage:
 *   import { gemini, createModel, getClient } from "../../models/gemini/index.js";
 *   const { text } = await gemini.invoke("Write a plan.");
 */

export { gemini, createModel, getClient } from "./model.js";
export type { GeminiConfig, GeminiModel, GeminiResponse } from "./model.js";
export { callStructured, zodToGoogleSchema } from "./structured.js";
