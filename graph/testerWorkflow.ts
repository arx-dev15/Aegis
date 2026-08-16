/**
 * graph/testerWorkflow.ts
 *
 * Feature 13 — Tester Agent Graph Workflow
 *
 * Constructs a LangGraph workflow containing the Tester node.
 */

import { StateGraph, START, END } from "@langchain/langgraph";
import { AegisStateAnnotation } from "./state.js";
import { testerNode } from "./nodes/testerNode.js";

/**
 * Construct and return the Tester StateGraph workflow.
 */
export function buildTesterWorkflow(node = testerNode) {
  return new StateGraph(AegisStateAnnotation)
    .addNode("tester", node)
    .addEdge(START, "tester")
    .addEdge("tester", END);
}

/**
 * Compiled default tester graph runnable instance.
 */
export const testerGraph = buildTesterWorkflow().compile();
