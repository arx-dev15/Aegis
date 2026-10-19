/**
 * agents/security/types.ts
 *
 * Feature 15 — Security Agent Types & Schemas
 *
 * Defines Zod schemas and inferred TypeScript types for structured application security audits.
 */

import { z } from "zod";

export const securityVulnerabilitySchema = z.object({
  id: z.string(),
  component: z.optional(z.string()),
  severity: z.enum(["critical", "high", "medium", "low"]),
  vulnerability: z.string(),
  evidence: z.string(),
  impact: z.string(),
  remediation: z.string(),
  confidence: z.enum(["high", "medium", "low"]),
});

export const securityResultSchema = z.object({
  task: z.string(),
  summary: z.string(),
  secure: z.boolean(),
  vulnerabilities: z.array(securityVulnerabilitySchema),
  recommendations: z.array(z.string()),
  notes: z.optional(z.string()),
});

export type SecurityVulnerability = z.infer<typeof securityVulnerabilitySchema>;
export type SecurityResult = z.infer<typeof securityResultSchema>;
