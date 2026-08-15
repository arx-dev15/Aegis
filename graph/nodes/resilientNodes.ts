/**
 * graph/nodes/resilientNodes.ts
 *
 * Feature 08 — Resilient Nodes (Error Handling & Controlled Retries)
 *
 * Contains node implementations that handle task execution, transient failure simulation,
 * retry counter increments, and clear terminal failure state updates.
 */

import type { AegisState, AegisStateUpdate } from "../state.js";

/**
 * Resilient Executor Node function.
 * Attempts execution; if transient error condition exists, increments retryCount and records error.
 * On success, updates status to "completed".
 */
export async function resilientExecutorNode(state: AegisState): Promise<AegisStateUpdate> {
  const currentAttempts = state.retryCount ?? 0;

  // Check if simulated failures are requested in task prompt (e.g. "FAIL:2" means fail 2 times then succeed)
  const failMatch = state.task.match(/FAIL:(\d+)/i);
  const requestedFailures = failMatch ? parseInt(failMatch[1]!, 10) : 0;
  const isAlwaysFail = state.task.toLowerCase().includes("fail_always");

  if (isAlwaysFail || currentAttempts < requestedFailures) {
    const nextAttempt = currentAttempts + 1;
    return {
      errors: [`Execution attempt ${nextAttempt} failed due to simulated error`],
      retryCount: nextAttempt,
    };
  }

  return {
    status: "completed",
    research: `Successfully processed task: "${state.task.replace(/FAIL:\d+/i, "").trim()}" after ${currentAttempts} retries`,
  };
}

/**
 * Resilient Error Handler Node function.
 * Called when max retries are exhausted or terminal errors occur.
 * Marks the workflow status as "failed".
 */
export async function resilientErrorHandlerNode(state: AegisState): Promise<AegisStateUpdate> {
  return {
    status: "failed",
    errors: [`Maximum retry limit (${state.maxRetries}) reached. Execution aborted.`],
  };
}
