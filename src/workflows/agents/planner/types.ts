// export interface PlannerStep {
//   id: string;
//   title: string;
//   description: string;
//   dependencies: string[];
//   verification: string;
// }

// export interface PlannerResult {
//   goal: string;
//   summary: string;
//   steps: PlannerStep[];
//   risks: string[];
//   verificationStrategy: string[];
// }

import { z } from "zod";

export const plannerStepSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  dependencies: z.array(z.string()),
  verification: z.string(),
});

export const plannerResultSchema = z.object({
  goal: z.string(),
  summary: z.string(),
  steps: z.array(plannerStepSchema),
  risks: z.array(z.string()),
  verificationStrategy: z.array(z.string()),
});

export type PlannerStep = z.infer<typeof plannerStepSchema>;
export type PlannerResult = z.infer<typeof plannerResultSchema>;