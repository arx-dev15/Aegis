/**
 * graph/nodes/multiAgentNodes.ts
 *
 * Feature 16 — Multi-Agent Helper Nodes
 *
 * Provides loop/retry increment node and multi-agent error handler node for LangGraph orchestration.
 */

import type { AegisState, AegisStateUpdate } from "../state.js";

/**
 * Retry Loop Node function.
 * Increments state.retryCount and records feedback note before re-executing Developer agent.
 */
export async function retryLoopNode(state: AegisState): Promise<AegisStateUpdate> {
  const currentRetries = state.retryCount ?? 0;
  const nextRetries = currentRetries + 1;
  const maxRetries = state.maxRetries ?? 3;

  return {
    retryCount: nextRetries,
    errors: [`[RETRY LOOP] Feedback received. Initiating repair attempt ${nextRetries}/${maxRetries}`],
  };
}

/**
 * Multi-Agent Error Handler Node function.
 * Called when execution status is failed or max retries are exhausted.
 */
export async function multiAgentErrorHandlerNode(state: AegisState): Promise<AegisStateUpdate> {
  return {
    status: "failed",
    errors: [`[WORKFLOW TERMINATED] Execution failed after ${state.retryCount ?? 0} retries. maxRetries (${state.maxRetries ?? 3}) reached.`],
  };
}
