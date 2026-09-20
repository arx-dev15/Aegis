/**
 * graph/nodes/plannerNode.ts
 *
 * Feature 09 — Planner Agent LangGraph Node
 *
 * Integrates PlannerAgent into the Aegis LangGraph state machine.
 * Reads task from AegisState, invokes PlannerAgent to generate a structured implementation plan,
 * and updates state with planned steps, risk/verification notes, and execution status.
 */

import type { AegisState, AegisStateUpdate, PlanStep } from "../state.js";
import { PlannerAgent } from "../../agents/planner/planner.js";
import { memoryManager } from "../../memory/memoryManager.js";

/**
 * Creates a planner node using a provided PlannerAgent instance or defaults to standard PlannerAgent.
 */
export function createPlannerNode(agent?: PlannerAgent) {
  const planner = agent ?? new PlannerAgent();

  return async function plannerNode(state: AegisState): Promise<AegisStateUpdate> {
    if (state.approvalDecision && state.plan && state.plan.length > 0) {
      return {
        status: "planning",
        plan: state.plan,
        research: state.research,
      };
    }

    if (!state.task || state.task.trim() === "") {
      return {
        status: "failed",
        errors: ["Task input is empty in planner node"],
      };
    }

    try {
      const memoryContext = state.memoryContext || (state.runId ? memoryManager.getFormattedMemoryContext({ runId: state.runId }) : "");
      const fullTask = memoryContext ? `${state.task}\n\n${memoryContext}` : state.task;

      const result = await planner.plan(fullTask);

      if (state.runId) {
        memoryManager.shortTerm.set(state.runId, "planner_summary", result.summary, "step_note");
      }

      const planSteps: PlanStep[] = result.steps.map((step) => ({
        id: step.id,
        description: `${step.title}: ${step.description}`,
        status: "pending",
      }));

      const researchSummary = [
        `Plan Goal: ${result.goal}`,
        `Summary: ${result.summary}`,
        `Risks: ${result.risks.join("; ")}`,
        `Verification: ${result.verificationStrategy.join("; ")}`,
      ].join("\n");

      return {
        status: "planning",
        plan: planSteps,
        research: researchSummary,
      };
    } catch (err) {
      return {
        status: "failed",
        errors: [(err as Error).message],
      };
    }
  };
}

/**
 * Default Planner Agent node function for standard graph workflows.
 */
export const plannerNode = createPlannerNode();
