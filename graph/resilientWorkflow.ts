/**
 * graph/resilientWorkflow.ts
 *
 * Feature 08 — Resilient Workflow (Loops + Retries + Error Handling)
 *
 * Constructs a LangGraph workflow with error recovery loops, max retry enforcement,
 * and clear failure states.
 */

import { StateGraph, START, END } from "@langchain/langgraph";
import { AegisStateAnnotation } from "./state.js";
import { resilientExecutorNode, resilientErrorHandlerNode } from "./nodes/resilientNodes.js";
import { routeWithRetryLimit } from "./edges/retryRouting.js";

/**
 * Construct and return the resilient StateGraph workflow.
 */
export function buildResilientWorkflow() {
  return new StateGraph(AegisStateAnnotation)
    // Add nodes
    .addNode("resilientExecutor", resilientExecutorNode)
    .addNode("resilientErrorHandler", resilientErrorHandlerNode)

    // Add graph edges with conditional retry loop
    .addEdge(START, "resilientExecutor")
    .addConditionalEdges("resilientExecutor", routeWithRetryLimit)
    .addEdge("resilientErrorHandler", END);
}

/**
 * Pre-compiled resilient StateGraph instance.
 */
export const resilientGraph = buildResilientWorkflow().compile();
