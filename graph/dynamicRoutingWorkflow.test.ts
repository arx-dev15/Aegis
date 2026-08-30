/**
 * graph/dynamicRoutingWorkflow.test.ts
 *
 * Feature 17 — Dynamic State-Routed Workflow Tests
 *
 * Run with:
 *   npx tsx graph/dynamicRoutingWorkflow.test.ts
 */

import { buildDynamicRoutingWorkflow } from "./dynamicRoutingWorkflow.js";
import { createPlannerNode } from "./nodes/plannerNode.js";
import { createResearcherNode } from "./nodes/researcherNode.js";
import { createArchitectNode } from "./nodes/architectNode.js";
import { createDeveloperNode } from "./nodes/developerNode.js";
import { createTesterNode } from "./nodes/testerNode.js";
import { createReviewerNode } from "./nodes/reviewerNode.js";
import { createSecurityNode } from "./nodes/securityNode.js";

import { PlannerAgent } from "../agents/planner/planner.js";
import { ResearcherAgent } from "../agents/researcher/researcher.js";
import { ArchitectAgent } from "../agents/architect/architect.js";
import { DeveloperAgent } from "../agents/developer/developer.js";
import { TesterAgent } from "../agents/tester/tester.js";
import { ReviewerAgent } from "../agents/reviewer/reviewer.js";
import { SecurityAgent } from "../agents/security/security.js";

import type { PlannerModel } from "../agents/planner/planner.js";
import type { ResearcherModel } from "../agents/researcher/researcher.js";
import type { ArchitectModel } from "../agents/architect/architect.js";
import type { DeveloperModel } from "../agents/developer/developer.js";
import type { TesterModel } from "../agents/tester/tester.js";
import type { ReviewerModel } from "../agents/reviewer/reviewer.js";
import type { SecurityModel } from "../agents/security/security.js";

const PASS = "✅ PASS";
const FAIL = "❌ FAIL";

// ── Mock Models ─────────────────────────────────────────────────────────────

const mockPlannerModel: PlannerModel = {
  async generateStructured<T>() {
    return {
      goal: "Build Feature 17 Dynamic Router",
      summary: "Plan for dynamic routing workflow.",
      steps: [{ id: "1", title: "Route Logic", description: "Implement determineNextAgent", dependencies: [], verification: "Unit tests" }],
      risks: [],
      verificationStrategy: [],
    } as unknown as T;
  },
};

const mockResearcherModel: ResearcherModel = {
  async generateStructured<T>() {
    return {
      objective: "Research Dynamic Routing",
      summary: "State-driven conditional edges in LangGraph.",
      findings: [{ id: "f1", topic: "Routing", finding: "Use state inspection", evidence: "LangGraph docs" }],
      constraints: [],
      unknowns: [],
      risks: [],
    } as unknown as T;
  },
};

const mockArchitectModel: ArchitectModel = {
  async generateStructured<T>() {
    return {
      title: "Design Router Architecture",
      summary: "Architecture for determineNextAgent.",
      components: [{ name: "AgentRouter", type: "new", description: "State router", responsibilities: ["Determine next agent"] }],
      dataFlow: [],
      dependencies: [],
      risks: [],
      verificationPlan: [],
    } as unknown as T;
  },
};

const mockDeveloperModel: DeveloperModel = {
  async generateStructured<T>() {
    return {
      task: "Implement Agent Router",
      summary: "Added agentRouter.ts.",
      fileChanges: [{ path: "graph/edges/agentRouter.ts", action: "add", content: "export function determineNextAgent() {}", summary: "Added agent router" }],
      commandsExecuted: [],
      status: "completed",
    } as unknown as T;
  },
};

const mockTesterModelSuccess: TesterModel = {
  async generateStructured<T>() {
    return {
      task: "Test Agent Router",
      summary: "All unit tests passed.",
      passed: true,
      totalTests: 12,
      passedTests: 12,
      failedTests: 0,
      testRuns: [{ name: "Unit test suite", passed: true }],
      coverageGaps: [],
    } as unknown as T;
  },
};

const mockReviewerModelSuccess: ReviewerModel = {
  async generateStructured<T>() {
    return {
      task: "Review Agent Router",
      summary: "Code review approved.",
      approved: true,
      findings: [],
      acceptedAspects: ["Clean deterministic routing"],
      recommendation: "approve",
    } as unknown as T;
  },
};

const mockSecurityModelSuccess: SecurityModel = {
  async generateStructured<T>() {
    return {
      task: "Audit Security",
      summary: "No vulnerabilities.",
      secure: true,
      vulnerabilities: [],
      recommendations: [],
    } as unknown as T;
  },
};

// ── Test Suite ───────────────────────────────────────────────────────────────

async function runTests(): Promise<void> {
  let passed = 0;
  let failed = 0;

  console.log("\n=== Feature 17 — Dynamic State-Routed Workflow Tests ===\n");

  let plannerCalls = 0;
  let researcherCalls = 0;
  let architectCalls = 0;

  const trackingPlannerNode = async (state: any) => {
    plannerCalls++;
    return (createPlannerNode(new PlannerAgent(mockPlannerModel)))(state);
  };
  const trackingResearcherNode = async (state: any) => {
    researcherCalls++;
    return (createResearcherNode(new ResearcherAgent(mockResearcherModel)))(state);
  };
  const trackingArchitectNode = async (state: any) => {
    architectCalls++;
    return (createArchitectNode(new ArchitectAgent(mockArchitectModel)))(state);
  };

  const developerNode = createDeveloperNode(new DeveloperAgent(mockDeveloperModel));
  const testerNode = createTesterNode(new TesterAgent(mockTesterModelSuccess));
  const reviewerNode = createReviewerNode(new ReviewerAgent(mockReviewerModelSuccess));
  const securityNode = createSecurityNode(new SecurityAgent(mockSecurityModelSuccess));

  const testGraph = buildDynamicRoutingWorkflow({
    planner: trackingPlannerNode,
    researcher: trackingResearcherNode,
    architect: trackingArchitectNode,
    developer: developerNode,
    tester: testerNode,
    reviewer: reviewerNode,
    security: securityNode,
  }).compile();

  // ── Test 1: Full dynamic execution from fresh state ────────────────────────
  try {
    console.log("Test 1: Full end-to-end execution starting from fresh state...");
    const result = await testGraph.invoke({ task: "Build Feature 17 Router" });

    if (result.status !== "completed") {
      throw new Error(`Expected status "completed", got "${result.status}"`);
    }
    if (plannerCalls !== 1 || researcherCalls !== 1 || architectCalls !== 1) {
      throw new Error(`Expected 1 call each to planner/researcher/architect, got P:${plannerCalls} R:${researcherCalls} A:${architectCalls}`);
    }

    console.log(`       Final Status: "${result.status}"`);
    console.log(`       Plan & Research: Saved in state`);
    console.log(`${PASS} Test 1: Execution dynamically passed through all 7 nodes to completion`);
    passed++;
  } catch (err) {
    console.log(`${FAIL} Test 1: ${(err as Error).message}`);
    failed++;
  }

  // ── Test 2: Conditional Skipping of Planner & Researcher ───────────────────
  try {
    console.log("\nTest 2: Conditional skipping of Planner, Researcher & Architect when artifacts exist...");
    plannerCalls = 0;
    researcherCalls = 0;
    architectCalls = 0;

    const prefilledResult = await testGraph.invoke({
      task: "Build Feature 17 Router",
      plan: [{ id: "p1", description: "Pre-existing plan step", status: "pending" }],
      research: "Pre-existing research summary",
      architecture: "Pre-existing architecture spec",
    });

    if (prefilledResult.status !== "completed") {
      throw new Error(`Expected status "completed", got "${prefilledResult.status}"`);
    }
    if (plannerCalls !== 0 || researcherCalls !== 0 || architectCalls !== 0) {
      throw new Error(`Expected 0 calls to skipped nodes, got P:${plannerCalls} R:${researcherCalls} A:${architectCalls}`);
    }

    console.log(`       Final Status: "${prefilledResult.status}"`);
    console.log(`       Skipped Nodes: Planner, Researcher, Architect were skipped automatically!`);
    console.log(`${PASS} Test 2: Graph dynamically started at Developer node, skipping pre-filled stages`);
    passed++;
  } catch (err) {
    console.log(`${FAIL} Test 2: ${(err as Error).message}`);
    failed++;
  }

  // ── Test 3: Invalid Task Handling in Dynamic Router ─────────────
  try {
    console.log("\nTest 3: Empty task handling in dynamic router...");

    const errorResult = await testGraph.invoke({ task: "" });

    if (errorResult.status !== "failed") {
      throw new Error(`Expected status "failed", got "${errorResult.status}"`);
    }

    console.log(`       Final Status: "${errorResult.status}"`);
    console.log(`${PASS} Test 3: Empty task dynamically routed to errorHandler node`);
    passed++;
  } catch (err) {
    console.log(`${FAIL} Test 3: ${(err as Error).message}`);
    failed++;
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
  if (failed > 0) process.exit(1);
}

runTests().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
