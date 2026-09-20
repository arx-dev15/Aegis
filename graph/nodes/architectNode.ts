/**
 * graph/nodes/architectNode.ts
 *
 * Feature 11 — Architect Agent LangGraph Node
 *
 * Integrates ArchitectAgent into the Aegis LangGraph state machine.
 * Reads task and research from AegisState, invokes ArchitectAgent to generate a structured design,
 * and updates state with architecture details, risks, dependencies, and execution status.
 */

import type { AegisState, AegisStateUpdate } from "../state.js";
import { ArchitectAgent } from "../../agents/architect/architect.js";
import { memoryManager } from "../../memory/memoryManager.js";
import { formatPlanContext } from "../planContext.js";

/**
 * Creates an architect node using a provided ArchitectAgent instance or defaults to standard ArchitectAgent.
 */
export function createArchitectNode(agent?: ArchitectAgent) {
  const architect = agent ?? new ArchitectAgent();

  return async function architectNode(state: AegisState): Promise<AegisStateUpdate> {
    if (state.approvalDecision && state.architecture && state.architecture.trim() !== "") {
      return {
        status: "architecting",
        architecture: state.architecture,
      };
    }

    if (!state.task || state.task.trim() === "") {
      return {
        status: "failed",
        errors: ["Task input is empty in architect node"],
      };
    }

    try {
      const memoryContext = state.memoryContext || (state.runId ? memoryManager.getFormattedMemoryContext({ runId: state.runId }) : "");
      const baseResearch = memoryContext ? `${state.research}\n\n${memoryContext}`.trim() : state.research;

      const planContext = formatPlanContext(state.plan, "architect");
      const result = await architect.design(state.task, baseResearch, planContext);

      if (state.runId) {
        memoryManager.shortTerm.set(state.runId, "architect_summary", result.summary, "step_note");
      }

      const componentsFormatted = result.components
        .map((c) => `- [${c.type.toUpperCase()}] ${c.name}: ${c.description} (Responsibilities: ${c.responsibilities.join(", ")})`)
        .join("\n");

      const architectureSummary = [
        `Title: ${result.title}`,
        `Summary: ${result.summary}`,
        `Components:\n${componentsFormatted}`,
        `Data Flow: ${result.dataFlow.join(" -> ")}`,
        `Dependencies: ${result.dependencies.join(", ")}`,
        `Risks: ${result.risks.join("; ")}`,
        `Verification Plan: ${result.verificationPlan.join("; ")}`,
      ].join("\n");

      return {
        status: "architecting",
        architecture: architectureSummary,
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
 * Default Architect Agent node function for standard graph workflows.
 */
export const architectNode = createArchitectNode();
