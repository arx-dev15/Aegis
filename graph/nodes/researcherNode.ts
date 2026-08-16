/**
 * graph/nodes/researcherNode.ts
 *
 * Feature 10 — Researcher Agent LangGraph Node
 *
 * Integrates ResearcherAgent into the Aegis LangGraph state machine.
 * Reads task and research from AegisState, invokes ResearcherAgent to generate structured research,
 * and updates state with findings, constraints, risks, and execution status.
 */

import type { AegisState, AegisStateUpdate } from "../state.js";
import { ResearcherAgent } from "../../agents/researcher/researcher.js";

/**
 * Creates a researcher node using a provided ResearcherAgent instance or defaults to standard ResearcherAgent.
 */
export function createResearcherNode(agent?: ResearcherAgent) {
  const researcher = agent ?? new ResearcherAgent();

  return async function researcherNode(state: AegisState): Promise<AegisStateUpdate> {
    if (!state.task || state.task.trim() === "") {
      return {
        status: "failed",
        errors: ["Task input is empty in researcher node"],
      };
    }

    try {
      const result = await researcher.research(state.task, state.research);

      const findingsFormatted = result.findings
        .map((f) => `- [${f.topic}] ${f.finding} (Evidence: ${f.evidence}${f.source ? `, Source: ${f.source}` : ""})`)
        .join("\n");

      const researchSummary = [
        `Research Objective: ${result.objective}`,
        `Summary: ${result.summary}`,
        `Findings:\n${findingsFormatted}`,
        `Constraints: ${result.constraints.join("; ")}`,
        `Unknowns: ${result.unknowns.join("; ")}`,
        `Risks: ${result.risks.join("; ")}`,
      ].join("\n");

      return {
        status: "researching",
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
 * Default Researcher Agent node function for standard graph workflows.
 */
export const researcherNode = createResearcherNode();
