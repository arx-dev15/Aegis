/**
 * graph/edges/routing.ts
 *
 * Feature 06 — Conditional Routing Edges
 *
 * Contains routing decision functions used by LangGraph conditional edges.
 */

import { END } from "@langchain/langgraph";
import type { AegisState } from "../state.js";

/**
 * Route decision logic following input processing:
 *  - If errors exist or status is failed -> route to "errorHandler"
 *  - Otherwise -> route to "taskExecuter"
 */
export function routeAfterInput(state: AegisState): "taskExecuter" | "errorHandler" | typeof END {
  if (state.errors && state.errors.length > 0) {
    return "errorHandler";
  }
  if (state.status === "failed") {
    return "errorHandler";
  }
  return "taskExecuter";
}
