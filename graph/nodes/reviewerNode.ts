/**
 * graph/nodes/reviewerNode.ts
 *
 * Feature 14 — Reviewer Agent LangGraph Node
 *
 * Integrates ReviewerAgent into the Aegis LangGraph state machine.
 * Reads task, codeChanges, and testResults from AegisState, invokes ReviewerAgent to run code review,
 * and updates state with review results and execution status.
 */

import type { AegisState, AegisStateUpdate, ReviewResult } from "../state.js";
import { ReviewerAgent } from "../../agents/reviewer/reviewer.js";

/**
 * Creates a reviewer node using a provided ReviewerAgent instance or defaults to standard ReviewerAgent.
 */
export function createReviewerNode(agent?: ReviewerAgent) {
  const reviewer = agent ?? new ReviewerAgent();

  return async function reviewerNode(state: AegisState): Promise<AegisStateUpdate> {
    if (!state.task || state.task.trim() === "") {
      return {
        status: "failed",
        errors: ["Task input is empty in reviewer node"],
      };
    }

    try {
      const codeChangesContext = state.codeChanges.map((c) => c.path).join(", ");
      const testEvidence = state.testResults ? state.testResults.output : undefined;

      const result = await reviewer.review(state.task, codeChangesContext, testEvidence);

      const reviewResultState: ReviewResult = {
        approved: result.approved,
        comments: result.findings.map((f) => `[${f.severity.toUpperCase()}] ${f.issue} -> ${f.recommendation}`),
        suggestedFixes: result.findings.filter((f) => f.recommendation).map((f) => f.recommendation),
      };

      return {
        status: "reviewing",
        reviewResults: reviewResultState,
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
 * Default Reviewer Agent node function for standard graph workflows.
 */
export const reviewerNode = createReviewerNode();
