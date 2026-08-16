/**
 * graph/securityWorkflow.ts
 *
 * Feature 15 — Security Agent Graph Workflow
 *
 * Constructs a LangGraph workflow containing the Security node.
 */

import { StateGraph, START, END } from "@langchain/langgraph";
import { AegisStateAnnotation } from "./state.js";
import { securityNode } from "./nodes/securityNode.js";

/**
 * Construct and return the Security StateGraph workflow.
 */
export function buildSecurityWorkflow(node = securityNode) {
  return new StateGraph(AegisStateAnnotation)
    .addNode("security", node)
    .addEdge(START, "security")
    .addEdge("security", END);
}

/**
 * Compiled default security graph runnable instance.
 */
export const securityGraph = buildSecurityWorkflow().compile();
