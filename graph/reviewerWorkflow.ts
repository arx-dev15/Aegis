/**
 * graph/reviewerWorkflow.ts
 *
 * Feature 14 — Reviewer Agent Graph Workflow
 *
 * Constructs a LangGraph workflow containing the Reviewer node.
 */

import { StateGraph, START, END } from "@langchain/langgraph";
import { AegisStateAnnotation } from "./state.js";
import { reviewerNode } from "./nodes/reviewerNode.js";

/**
 * Construct and return the Reviewer StateGraph workflow.
 */
export function buildReviewerWorkflow(node = reviewerNode) {
  return new StateGraph(AegisStateAnnotation)
    .addNode("reviewer", node)
    .addEdge(START, "reviewer")
    .addEdge("reviewer", END);
}

/**
 * Compiled default reviewer graph runnable instance.
 */
export const reviewerGraph = buildReviewerWorkflow().compile();
