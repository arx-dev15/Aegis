/**
 * graph/architectWorkflow.ts
 *
 * Feature 11 — Architect Agent Graph Workflow
 *
 * Constructs a LangGraph workflow containing the Architect node.
 */

import { StateGraph, START, END } from "@langchain/langgraph";
import { AegisStateAnnotation } from "./state.js";
import { architectNode } from "./nodes/architectNode.js";

/**
 * Construct and return the Architect StateGraph workflow.
 */
export function buildArchitectWorkflow(node = architectNode) {
  return new StateGraph(AegisStateAnnotation)
    .addNode("architect", node)
    .addEdge(START, "architect")
    .addEdge("architect", END);
}

/**
 * Compiled default architect graph runnable instance.
 */
export const architectGraph = buildArchitectWorkflow().compile();
