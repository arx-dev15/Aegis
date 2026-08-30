/**
 * graph/dynamicRoutingWorkflow.ts
 *
 * Feature 17 — Dynamic State-Routed Aegis Workflow
 * Feature 18 — Recovery node wired in for context-aware failure recovery
 *
 * Constructs a LangGraph StateGraph that uses `determineNextAgent` conditional edges
 * to dynamically route execution between specialized agents based on current state.
 *
 * Key Capabilities:
 *  - Dynamic Start: From START, determines the initial agent based on provided AegisState.
 *  - Artifact Skipping: Automatically skips completed stages (e.g. jumps past Planner/Researcher if plan/research are already provided).
 *  - Adaptive Transitions: Every agent node routes using `determineNextAgent` logic.
 *  - Context-Aware Recovery (F18): Routes validation failures to `recoveryNode` which builds structured
 *    failure context before handing off to developer for targeted repair.
 */

import { StateGraph, START, END } from "@langchain/langgraph";
import { AegisStateAnnotation } from "./state.js";
import type { CustomMultiAgentNodes, AgentModelConfig } from "./multiAgentWorkflow.js";
import { plannerNode, createPlannerNode } from "./nodes/plannerNode.js";
import { researcherNode, createResearcherNode } from "./nodes/researcherNode.js";
import { architectNode, createArchitectNode } from "./nodes/architectNode.js";
import { developerNode, createDeveloperNode } from "./nodes/developerNode.js";
import { testerNode, createTesterNode } from "./nodes/testerNode.js";
import { reviewerNode, createReviewerNode } from "./nodes/reviewerNode.js";
import { securityNode, createSecurityNode } from "./nodes/securityNode.js";
import { retryLoopNode, multiAgentErrorHandlerNode } from "./nodes/multiAgentNodes.js";
import { recoveryNode } from "./nodes/recoveryNode.js";

import {
  determineNextAgent,
  routeFromPlanner,
  routeFromResearcher,
  routeFromArchitect,
  routeFromDeveloper,
  routeFromTester,
  routeFromReviewer,
  routeFromSecurity,
  routeFromRecovery,
} from "./edges/agentRouter.js";

import { PlannerAgent, GeminiPlannerModel } from "../agents/planner/planner.js";
import { ResearcherAgent, GeminiResearcherModel } from "../agents/researcher/researcher.js";
import { ArchitectAgent, GeminiArchitectModel } from "../agents/architect/architect.js";
import { DeveloperAgent, GeminiDeveloperModel } from "../agents/developer/developer.js";
import { TesterAgent, GeminiTesterModel } from "../agents/tester/tester.js";
import { ReviewerAgent, GeminiReviewerModel } from "../agents/reviewer/reviewer.js";
import { SecurityAgent, GeminiSecurityModel } from "../agents/security/security.js";

/**
 * Construct and return the dynamic state-routed Aegis StateGraph workflow.
 */
export function buildDynamicRoutingWorkflow(
  customNodes: CustomMultiAgentNodes = {},
  modelConfig: AgentModelConfig = {}
) {
  const defaultPlanner = createPlannerNode(
    new PlannerAgent(new GeminiPlannerModel(modelConfig.planner))
  );
  const defaultResearcher = createResearcherNode(
    new ResearcherAgent(new GeminiResearcherModel(modelConfig.researcher))
  );
  const defaultArchitect = createArchitectNode(
    new ArchitectAgent(new GeminiArchitectModel(modelConfig.architect))
  );
  const defaultDeveloper = createDeveloperNode(
    new DeveloperAgent(new GeminiDeveloperModel(modelConfig.developer))
  );
  const defaultTester = createTesterNode(
    new TesterAgent(new GeminiTesterModel(modelConfig.tester))
  );
  const defaultReviewer = createReviewerNode(
    new ReviewerAgent(new GeminiReviewerModel(modelConfig.reviewer))
  );
  const defaultSecurity = createSecurityNode(
    new SecurityAgent(new GeminiSecurityModel(modelConfig.security))
  );

  return new StateGraph(AegisStateAnnotation)
    .addNode("planner",      customNodes.planner      ?? defaultPlanner)
    .addNode("researcher",   customNodes.researcher   ?? defaultResearcher)
    .addNode("architect",    customNodes.architect    ?? defaultArchitect)
    .addNode("developer",    customNodes.developer    ?? defaultDeveloper)
    .addNode("tester",       customNodes.tester       ?? defaultTester)
    .addNode("reviewer",     customNodes.reviewer     ?? defaultReviewer)
    .addNode("security",     customNodes.security     ?? defaultSecurity)
    .addNode("retryLoop",    customNodes.retryLoop    ?? retryLoopNode)
    .addNode("recovery",     customNodes.recovery     ?? recoveryNode)
    .addNode("errorHandler", customNodes.errorHandler ?? multiAgentErrorHandlerNode)

    // Dynamic routing edges starting from initial state inspection
    .addConditionalEdges(START, determineNextAgent)
    .addConditionalEdges("planner", routeFromPlanner)
    .addConditionalEdges("researcher", routeFromResearcher)
    .addConditionalEdges("architect", routeFromArchitect)
    .addConditionalEdges("developer", routeFromDeveloper)
    .addConditionalEdges("tester", routeFromTester)
    .addConditionalEdges("reviewer", routeFromReviewer)
    .addConditionalEdges("security", routeFromSecurity)

    // Feature 16 retryLoop kept for backward compatibility with multiAgentWorkflow
    .addEdge("retryLoop",    "developer")
    // Feature 18: recovery routes to appropriate agent based on failingAgent context
    .addConditionalEdges("recovery", routeFromRecovery)
    .addEdge("errorHandler", END);
}

/**
 * Compiled default dynamic state-routed Aegis workflow instance.
 */
export const dynamicRoutingGraph = buildDynamicRoutingWorkflow().compile();
