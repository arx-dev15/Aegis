/**
 * agents/developer/types.ts
 *
 * Feature 12 — Developer Agent Types & Schemas
 *
 * Defines Zod schemas and inferred TypeScript types for structured developer code implementations.
 */

import { z } from "zod";

export const fileChangeSchema = z.object({
  path: z.string(),
  action: z.enum(["add", "modify", "delete"]),
  summary: z.string(),
  content: z.optional(z.string()),
});

export const developerResultSchema = z.object({
  task: z.string(),
  summary: z.string(),
  fileChanges: z.array(fileChangeSchema),
  commandsExecuted: z.array(z.string()),
  status: z.enum(["completed", "repaired", "failed"]),
  notes: z.optional(z.string()),
});

export type FileChange = z.infer<typeof fileChangeSchema>;
export type DeveloperResult = z.infer<typeof developerResultSchema>;
