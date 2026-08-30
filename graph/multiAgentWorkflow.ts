/**
 * graph/multiAgentWorkflow.ts
 *
 * Feature 16 — Full Aegis Multi-Agent Workflow
 *
 * Connects Planner, Researcher, Architect, Developer, Tester, Reviewer, and Security agents
 * into a single LangGraph orchestration state machine with:
 *   - Feedback loop routing (Tester/Reviewer/Security failures → Developer repair)
 *   - Max retry enforcement
 *   - Error handling terminal state
 *   - Real tool execution when workspace is configured
 *
 * Model Configuration:
 *   Pass modelConfig to use different Gemini model settings per agent (e.g. different
 *   temperatures or model names). Individual agents can still be fully replaced via
 *   customNodes for testing.
 *
 * Execution Modes:
 *   - Simulation (no workspace): LLM generates descriptions, no disk writes or commands run.
 *   - Real execution (workspace set): Developer writes files, Tester runs actual commands.
 *     Set state.workspace before invoking to activate this mode.
 */

import { StateGraph, START, END } from "@langchain/langgraph";
import { AegisStateAnnotation } from "./state.js";
import type { GeminiConfig } from "../models/gemini/index.js";
import { plannerNode, createPlannerNode } from "./nodes/plannerNode.js";
import { researcherNode, createResearcherNode } from "./nodes/researcherNode.js";
import { architectNode, createArchitectNode } from "./nodes/architectNode.js";
import { developerNode, createDeveloperNode } from "./nodes/developerNode.js";
import { testerNode, createTesterNode } from "./nodes/testerNode.js";
import { reviewerNode, createReviewerNode } from "./nodes/reviewerNode.js";
import { securityNode, createSecurityNode } from "./nodes/securityNode.js";
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

import { PlannerAgent, GeminiPlannerModel } from "../agents/planner/planner.js";
import { ResearcherAgent, GeminiResearcherModel } from "../agents/researcher/researcher.js";
import { ArchitectAgent, GeminiArchitectModel } from "../agents/architect/architect.js";
import { DeveloperAgent, GeminiDeveloperModel } from "../agents/developer/developer.js";
import { TesterAgent, GeminiTesterModel } from "../agents/tester/tester.js";
import { ReviewerAgent, GeminiReviewerModel } from "../agents/reviewer/reviewer.js";
import { SecurityAgent, GeminiSecurityModel } from "../agents/security/security.js";

// ── Types ─────────────────────────────────────────────────────────────────────

/**
 * Override individual node functions for testing.
 * When a node is provided, it fully replaces the default for that agent.
 */
export interface CustomMultiAgentNodes {
  planner?: typeof plannerNode;
  researcher?: typeof researcherNode;
  architect?: typeof architectNode;
  developer?: typeof developerNode;
  tester?: typeof testerNode;
  reviewer?: typeof reviewerNode;
  security?: typeof securityNode;
  retryLoop?: typeof retryLoopNode;
  /** Feature 18: context-aware recovery node (used in dynamic routing workflow) */
  recovery?: typeof retryLoopNode;
  errorHandler?: typeof multiAgentErrorHandlerNode;
}

/**
 * Per-agent model configuration.
 * Allows different temperature/model settings for each role.
 * Falls back to defaults if not specified.
 */
export interface AgentModelConfig {
  /** Model config for the Planner agent. */
  planner?: GeminiConfig;
  /** Model config for the Researcher agent. */
  researcher?: GeminiConfig;
  /** Model config for the Architect agent. */
  architect?: GeminiConfig;
  /** Model config for the Developer agent — lower temperature for precise code. */
  developer?: GeminiConfig;
  /** Model config for the Tester agent. */
  tester?: GeminiConfig;
  /** Model config for the Reviewer agent. */
  reviewer?: GeminiConfig;
  /** Model config for the Security agent. */
  security?: GeminiConfig;
}

// ── Builder ───────────────────────────────────────────────────────────────────

/**
 * Build the full 7-agent Aegis StateGraph workflow.
 *
 * @param customNodes  - Optional node overrides (primarily for tests).
 * @param modelConfig  - Optional per-agent Gemini model configuration.
 */
export function buildMultiAgentWorkflow(
  customNodes: CustomMultiAgentNodes = {},
  modelConfig: AgentModelConfig = {}
) {
  // Build default agents with model config when nodes aren't overridden
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
    .addNode("errorHandler", customNodes.errorHandler ?? multiAgentErrorHandlerNode)

    // ── Edges & Routing ───────────────────────────────────────────────────
    .addEdge(START, "planner")
    .addConditionalEdges("planner",    routeAfterPlanner)
    .addConditionalEdges("researcher", routeAfterResearcher)
    .addConditionalEdges("architect",  routeAfterArchitect)
    .addConditionalEdges("developer",  routeAfterDeveloper)
    .addConditionalEdges("tester",     routeAfterTester)
    .addConditionalEdges("reviewer",   routeAfterReviewer)
    .addConditionalEdges("security",   routeAfterSecurity)
    .addEdge("retryLoop", "developer")
    .addEdge("errorHandler", END);
}

/**
 * Compiled default multi-agent Aegis workflow graph.
 * Ready to invoke: multiAgentGraph.invoke({ task: "..." })
 *
 * For real file execution, pass workspace:
 *   multiAgentGraph.invoke({ task: "...", workspace: "/path/to/sandbox" })
 */
export const multiAgentGraph = buildMultiAgentWorkflow().compile();
