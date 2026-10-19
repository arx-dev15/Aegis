/**
 * agents/tester/types.ts
 *
 * Feature 13 — Tester Agent Types & Schemas
 *
 * Defines Zod schemas and inferred TypeScript types for structured verification test results.
 */

import { z } from "zod";

export const singleTestRunSchema = z.object({
  name: z.string(),
  passed: z.boolean(),
  output: z.optional(z.string()),
  durationMs: z.optional(z.number()),
});

export const testerResultSchema = z.object({
  task: z.string(),
  summary: z.string(),
  passed: z.boolean(),
  totalTests: z.number(),
  passedTests: z.number(),
  failedTests: z.number(),
  testRuns: z.array(singleTestRunSchema),
  coverageGaps: z.array(z.string()),
  notes: z.optional(z.string()),
});

export type SingleTestRun = z.infer<typeof singleTestRunSchema>;
export type TesterResult = z.infer<typeof testerResultSchema>;
