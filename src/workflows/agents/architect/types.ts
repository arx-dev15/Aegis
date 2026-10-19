/**
 * agents/architect/types.ts
 *
 * Feature 11 — Architect Agent Types & Schemas
 *
 * Defines Zod schemas and inferred TypeScript types for structured architectural designs.
 */

import { z } from "zod";

export const componentDesignSchema = z.object({
  name: z.string(),
  type: z.enum(["new", "modify", "delete"]),
  description: z.string(),
  responsibilities: z.array(z.string()),
});

export const architectureResultSchema = z.object({
  title: z.string(),
  summary: z.string(),
  components: z.array(componentDesignSchema),
  dataFlow: z.array(z.string()),
  dependencies: z.array(z.string()),
  risks: z.array(z.string()),
  verificationPlan: z.array(z.string()),
});

export type ComponentDesign = z.infer<typeof componentDesignSchema>;
export type ArchitectureResult = z.infer<typeof architectureResultSchema>;
