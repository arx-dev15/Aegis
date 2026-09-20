/**
 * graph/planContext.ts
 *
 * Feature 25 (R02) — Role-Aware Shared Plan Context Formatter
 *
 * Formats structured PlanStep arrays into role-specific, human-readable plan context blocks
 * for downstream engineering agents (Researcher, Architect, Developer).
 *
 * Prevents mutation of graph state and keeps prompt section responsibilities explicit.
 */

import type { PlanStep } from "./state.js";

export type PlanRole = "researcher" | "architect" | "developer";

/**
 * Formats AegisState plan steps into a role-aware structured plan context block.
 * Returns undefined when plan is missing or empty ([]).
 */
export function formatPlanContext(plan?: PlanStep[], role: PlanRole = "developer"): string | undefined {
  if (!plan || plan.length === 0) return undefined;

  const headerMap: Record<PlanRole, string> = {
    researcher: "PLAN CONTEXT FOR INVESTIGATION",
    architect: "PLAN CONTEXT FOR DESIGN",
    developer: "PLAN CONTEXT FOR IMPLEMENTATION",
  };

  const lines: string[] = [headerMap[role]];

  if (role === "researcher") {
    lines.push("(Note: The engineering plan provides intended direction. Verify repository-specific assumptions using available evidence.)\n");
  }

  plan.forEach((step, idx) => {
    const stepTitle = step.title ? `${step.title}: ` : "";
    const desc = step.description.startsWith(stepTitle)
      ? step.description
      : `${stepTitle}${step.description}`;

    let line = `${idx + 1}. [${step.id}] ${desc}`;

    if (step.dependencies && step.dependencies.length > 0) {
      line += ` (Depends on: ${step.dependencies.join(", ")})`;
    }

    if (step.verification && (role === "architect" || role === "developer")) {
      line += ` [Verification: ${step.verification}]`;
    }

    lines.push(line);
  });

  return lines.join("\n");
}
