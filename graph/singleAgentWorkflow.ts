/**
 * graph/singleAgentWorkflow.ts
 *
 * Feature 07 — Single-Agent Graph Workflow
 *
 * Constructs a LangGraph workflow containing a single tool-calling agent node.
 */

import { StateGraph, START, END } from "@langchain/langgraph";
import { AegisStateAnnotation } from "./state.js";
import { toolAgentNode } from "./nodes/agentNode.js";

/**
 * Construct and return the single-agent StateGraph workflow.
 */
export function buildSingleAgentGraph() {
  return new StateGraph(AegisStateAnnotation)
    .addNode("agent", toolAgentNode)
    .addEdge(START, "agent")
    .addEdge("agent", END);
}

/**
 * Compiled single-agent graph runnable instance.
 */
export const singleAgentGraph = buildSingleAgentGraph().compile();
