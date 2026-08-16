/**
 * graph/plannerWorkflow.ts
 *
 * Feature 09 — Planner Agent Graph Workflow
 *
 * Constructs a LangGraph workflow containing the Planner node.
 */

import { StateGraph, START, END } from "@langchain/langgraph";
import { AegisStateAnnotation } from "./state.js";
import { plannerNode } from "./nodes/plannerNode.js";

/**
 * Construct and return the Planner StateGraph workflow.
 */
export function buildPlannerWorkflow(node = plannerNode) {
  return new StateGraph(AegisStateAnnotation)
    .addNode("planner", node)
    .addEdge(START, "planner")
    .addEdge("planner", END);
}

/**
 * Compiled default planner graph runnable instance.
 */
export const plannerGraph = buildPlannerWorkflow().compile();
