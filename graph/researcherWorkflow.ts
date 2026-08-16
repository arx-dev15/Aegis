/**
 * graph/researcherWorkflow.ts
 *
 * Feature 10 — Researcher Agent Graph Workflow
 *
 * Constructs a LangGraph workflow containing the Researcher node.
 */

import { StateGraph, START, END } from "@langchain/langgraph";
import { AegisStateAnnotation } from "./state.js";
import { researcherNode } from "./nodes/researcherNode.js";

/**
 * Construct and return the Researcher StateGraph workflow.
 */
export function buildResearcherWorkflow(node = researcherNode) {
  return new StateGraph(AegisStateAnnotation)
    .addNode("researcher", node)
    .addEdge(START, "researcher")
    .addEdge("researcher", END);
}

/**
 * Compiled default researcher graph runnable instance.
 */
export const researcherGraph = buildResearcherWorkflow().compile();
