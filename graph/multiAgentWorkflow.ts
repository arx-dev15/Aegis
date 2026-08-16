/**
 * graph/multiAgentWorkflow.ts
 *
 * Feature 16 — Full Aegis Multi-Agent Workflow
 *
 * Connects Planner, Researcher, Architect, Developer, Tester, Reviewer, and Security agents
 * into a single LangGraph orchestration state machine with feedback loop routing and error handling.
 */

import { StateGraph, START, END } from "@langchain/langgraph";
import { AegisStateAnnotation } from "./state.js";
import { plannerNode } from "./nodes/plannerNode.js";
import { researcherNode } from "./nodes/researcherNode.js";
import { architectNode } from "./nodes/architectNode.js";
import { developerNode } from "./nodes/developerNode.js";
import { testerNode } from "./nodes/testerNode.js";
import { reviewerNode } from "./nodes/reviewerNode.js";
import { securityNode } from "./nodes/securityNode.js";
import { retryLoopNode, multiAgentErrorHandlerNode } from "./nodes/multiAgentNodes.js";
import {
  routeAfterPlanner,
  routeAfterResearcher,
  routeAfterArchitect,
  routeAfterDeveloper,
  routeAfterTester,
  routeAfterReviewer,
  routeAfterSecurity,
} from "./edges/multiAgentRouting.js";

export interface CustomMultiAgentNodes {
  planner?: typeof plannerNode;
  researcher?: typeof researcherNode;
  architect?: typeof architectNode;
  developer?: typeof developerNode;
  tester?: typeof testerNode;
  reviewer?: typeof reviewerNode;
  security?: typeof securityNode;
  retryLoop?: typeof retryLoopNode;
  errorHandler?: typeof multiAgentErrorHandlerNode;
}

/**
 * Construct and return the full 7-agent Aegis StateGraph workflow.
 */
export function buildMultiAgentWorkflow(customNodes: CustomMultiAgentNodes = {}) {
  return new StateGraph(AegisStateAnnotation)
    .addNode("planner", customNodes.planner ?? plannerNode)
    .addNode("researcher", customNodes.researcher ?? researcherNode)
    .addNode("architect", customNodes.architect ?? architectNode)
    .addNode("developer", customNodes.developer ?? developerNode)
    .addNode("tester", customNodes.tester ?? testerNode)
    .addNode("reviewer", customNodes.reviewer ?? reviewerNode)
    .addNode("security", customNodes.security ?? securityNode)
    .addNode("retryLoop", customNodes.retryLoop ?? retryLoopNode)
    .addNode("errorHandler", customNodes.errorHandler ?? multiAgentErrorHandlerNode)

    // Edges & Routing
    .addEdge(START, "planner")
    .addConditionalEdges("planner", routeAfterPlanner)
    .addConditionalEdges("researcher", routeAfterResearcher)
    .addConditionalEdges("architect", routeAfterArchitect)
    .addConditionalEdges("developer", routeAfterDeveloper)
    .addConditionalEdges("tester", routeAfterTester)
    .addConditionalEdges("reviewer", routeAfterReviewer)
    .addConditionalEdges("security", routeAfterSecurity)
    .addEdge("retryLoop", "developer")
    .addEdge("errorHandler", END);
}

/**
 * Compiled default multi-agent Aegis workflow graph runnable instance.
 */
export const multiAgentGraph = buildMultiAgentWorkflow().compile();
