/**
 * agents/reviewer/types.ts
 *
 * Feature 14 — Reviewer Agent Types & Schemas
 *
 * Defines Zod schemas and inferred TypeScript types for structured engineering quality reviews.
 */

import { z } from "zod";

export const reviewFindingSchema = z.object({
  id: z.string(),
  file: z.optional(z.string()),
  severity: z.enum(["blocking", "important", "suggestion"]),
  issue: z.string(),
  recommendation: z.string(),
});

export const reviewerResultSchema = z.object({
  task: z.string(),
  summary: z.string(),
  approved: z.boolean(),
  findings: z.array(reviewFindingSchema),
  acceptedAspects: z.array(z.string()),
  recommendation: z.enum(["approve", "request_changes", "comment"]),
  notes: z.optional(z.string()),
});

export type ReviewFinding = z.infer<typeof reviewFindingSchema>;
export type ReviewerResult = z.infer<typeof reviewerResultSchema>;
