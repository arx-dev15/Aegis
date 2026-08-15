/**
 * graph/workflow.ts
 *
 * Feature 06 — LangGraph Workflow (Nodes + Edges + Routing)
 *
 * Builds the Aegis state graph connecting START, nodes, conditional routing, and END.
 */

import { StateGraph, START, END } from "@langchain/langgraph";
import { AegisStateAnnotation } from "./state.js";
import { inputProcessorNode, taskExecuterNode, errorHandlerNode } from "./nodes/sampleNodes.js";
import { routeAfterInput } from "./edges/routing.js";

/**
 * Construct and return the uncompiled StateGraph workflow.
 */
export function buildAegisWorkflow() {
  return new StateGraph(AegisStateAnnotation)
    // Add processing nodes
    .addNode("inputProcessor", inputProcessorNode)
    .addNode("taskExecuter", taskExecuterNode)
    .addNode("errorHandler", errorHandlerNode)

    // Add graph edges and conditional routing
    .addEdge(START, "inputProcessor")
    .addConditionalEdges("inputProcessor", routeAfterInput)
    .addEdge("taskExecuter", END)
    .addEdge("errorHandler", END);
}

/**
 * Pre-compiled default Aegis StateGraph instance.
 */
export const aegisGraph = buildAegisWorkflow().compile();
