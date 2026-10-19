/**
 * tools/calculator/index.ts
 *
 * Feature 03 — Calculator Tool
 *
 * Real calculator tool supporting add, subtract, multiply, divide.
 */

import { z } from "zod";
import { createAegisTool } from "../types.js";

export const CalculatorInputSchema = z.object({
  operation: z
    .enum(["add", "subtract", "multiply", "divide"])
    .describe("The mathematical operation to perform"),
  a: z.number().describe("The first operand"),
  b: z.number().describe("The second operand"),
});

export type CalculatorInput = z.infer<typeof CalculatorInputSchema>;

/**
 * Perform calculation logic directly.
 */
export function calculate({ operation, a, b }: CalculatorInput): number {
  switch (operation) {
    case "add":
      return a + b;
    case "subtract":
      return a - b;
    case "multiply":
      return a * b;
    case "divide":
      if (b === 0) {
        throw new Error("Division by zero error");
      }
      return a / b;
    default:
      throw new Error(`Invalid operation: ${operation}`);
  }
}

/**
 * LangChain-compatible Calculator Tool for Aegis agents.
 */
export const calculatorTool = createAegisTool(
  (input: CalculatorInput) => {
    const result = calculate(input);
    return String(result);
  },
  {
    name: "calculator",
    description:
      "Performs basic mathematical operations (add, subtract, multiply, divide) on two numbers.",
    schema: CalculatorInputSchema,
  }
);
