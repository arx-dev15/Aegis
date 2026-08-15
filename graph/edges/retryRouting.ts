/**
 * graph/edges/retryRouting.ts
 *
 * Feature 08 — Retry Routing Edges
 *
 * Provides conditional routing decision function evaluating completion status,
 * retry counter, and maximum retry limit.
 */

import { END } from "@langchain/langgraph";
import type { AegisState } from "../state.js";

/**
 * Evaluates execution state to decide next node:
 *  - If status is "completed" -> route to END
 *  - If retryCount < maxRetries -> loop back to "resilientExecutor" for retry
 *  - Otherwise (max retries reached) -> route to "resilientErrorHandler"
 */
export function routeWithRetryLimit(
  state: AegisState
): "resilientExecutor" | "resilientErrorHandler" | typeof END {
  if (state.status === "completed") {
    return END;
  }

  const retries = state.retryCount ?? 0;
  const maxRetries = state.maxRetries ?? 3;

  if (retries < maxRetries) {
    return "resilientExecutor";
  }

  return "resilientErrorHandler";
}
