/**
 * graph/developerWorkflow.ts
 *
 * Feature 12 — Developer Agent Graph Workflow
 *
 * Constructs a LangGraph workflow containing the Developer node.
 */

import { StateGraph, START, END } from "@langchain/langgraph";
import { AegisStateAnnotation } from "./state.js";
import { developerNode } from "./nodes/developerNode.js";

/**
 * Construct and return the Developer StateGraph workflow.
 */
export function buildDeveloperWorkflow(node = developerNode) {
  return new StateGraph(AegisStateAnnotation)
    .addNode("developer", node)
    .addEdge(START, "developer")
    .addEdge("developer", END);
}

/**
 * Compiled default developer graph runnable instance.
 */
export const developerGraph = buildDeveloperWorkflow().compile();
