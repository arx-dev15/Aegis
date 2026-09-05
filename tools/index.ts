/**
 * tools/index.ts
 *
 * Feature 03 — Tool System
 *
 * Public entry point for Aegis tools and tool creation utilities.
 */

export * from "./types.js";
export { calculatorTool, calculate, CalculatorInputSchema } from "./calculator/index.js";
export type { CalculatorInput } from "./calculator/index.js";
export * from "./guardrails/index.js";
export * from "./github/index.js";
export * from "./repoIntelligence/repoExplorerTool.js";
