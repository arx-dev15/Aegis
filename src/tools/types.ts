/**
 * tools/types.ts
 *
 * Feature 03 — Tool System
 *
 * Base types and helper for creating Aegis tools built on LangChain's tool framework.
 */

import { tool, StructuredTool } from "@langchain/core/tools";
import { z } from "zod";

export type { StructuredTool };
export { tool };

export interface AegisToolOptions<T extends z.ZodTypeAny> {
  name: string;
  description: string;
  schema: T;
}

/**
 * Helper to create a typed Aegis tool using Zod input validation and LangChain tool infrastructure.
 */
export function createAegisTool<T extends z.ZodTypeAny, R = string>(
  func: (input: z.infer<T>) => Promise<R> | R,
  options: AegisToolOptions<T>
): StructuredTool {
  return tool(func, options);
}
