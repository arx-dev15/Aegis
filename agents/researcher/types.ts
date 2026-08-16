/**
 * agents/researcher/types.ts
 *
 * Feature 10 — Researcher Agent Types & Schemas
 *
 * Defines Zod schemas and inferred TypeScript types for structured research findings.
 */

import { z } from "zod";

export const researchFindingSchema = z.object({
  id: z.string(),
  topic: z.string(),
  finding: z.string(),
  evidence: z.string(),
  source: z.optional(z.string()),
});

export const researchResultSchema = z.object({
  objective: z.string(),
  summary: z.string(),
  findings: z.array(researchFindingSchema),
  constraints: z.array(z.string()),
  unknowns: z.array(z.string()),
  risks: z.array(z.string()),
});

export type ResearchFinding = z.infer<typeof researchFindingSchema>;
export type ResearchResult = z.infer<typeof researchResultSchema>;
