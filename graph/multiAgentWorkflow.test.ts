/**
 * graph/multiAgentWorkflow.test.ts
 *
 * Feature 16 — Full Aegis Multi-Agent Workflow Tests
 *
 * Run with:
 *   npx tsx graph/multiAgentWorkflow.test.ts
 */

import { buildMultiAgentWorkflow } from "./multiAgentWorkflow.js";
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
      goal: "Build Secure User Authentication",
      summary: "Plan for JWT-based auth API.",
      steps: [
        {
          id: "1",
          title: "Auth Route",
          description: "Create /api/auth",
          dependencies: [],
          verification: "Integration test endpoint",
        },
      ],
      risks: ["Token exposure"],
      verificationStrategy: ["Integration tests"],
    } as unknown as T;
  },
};

const mockResearcherModel: ResearcherModel = {
  async generateStructured<T>() {
    return {
      objective: "Research Auth Requirements",
      summary: "JWT tokens with HTTP-only cookies standard.",
      findings: [{ id: "f1", topic: "Auth", finding: "Use bcrypt & JWT", evidence: "RFC 7519 standard" }],
      constraints: ["Node 20+"],
      unknowns: [],
      risks: [],
    } as unknown as T;
  },
};

const mockArchitectModel: ArchitectModel = {
  async generateStructured<T>() {
    return {
      title: "Design Auth Architecture",
      summary: "Auth middleware architecture design.",
      components: [
        {
          name: "AuthMiddleware",
          type: "new",
          description: "Middleware to verify JWT",
          responsibilities: ["Verify JWT token", "Attach user payload"],
        },
      ],
      dataFlow: ["Client -> Middleware -> Route Handler"],
      dependencies: ["jsonwebtoken"],
      risks: [],
      verificationPlan: ["Unit test middleware"],
    } as unknown as T;
  },
};

const mockDeveloperModel: DeveloperModel = {
  async generateStructured<T>() {
    return {
      task: "Implement Auth Middleware",
      summary: "Added auth middleware in apps/api/middleware/auth.ts.",
      fileChanges: [
        {
          path: "apps/api/middleware/auth.ts",
          action: "add",
          content: "export function auth() {}",
          summary: "Auth middleware implementation",
        },
      ],
      commandsExecuted: [],
      status: "completed",
    } as unknown as T;
  },
};

const mockTesterModelSuccess: TesterModel = {
  async generateStructured<T>() {
    return {
      task: "Test Auth Middleware",
      summary: "All 2 tests passed.",
      passed: true,
      totalTests: 2,
      passedTests: 2,
      failedTests: 0,
      testRuns: [{ name: "Test 1", passed: true }],
      coverageGaps: [],
    } as unknown as T;
  },
};

const mockReviewerModelSuccess: ReviewerModel = {
  async generateStructured<T>() {
    return {
      task: "Review Auth Middleware",
      summary: "Code review passed with zero blocking issues.",
      approved: true,
      findings: [],
      acceptedAspects: ["Clean modular structure"],
      recommendation: "approve",
    } as unknown as T;
  },
};

const mockSecurityModelSuccess: SecurityModel = {
  async generateStructured<T>() {
    return {
      task: "Audit Auth Security",
      summary: "No vulnerabilities identified.",
      secure: true,
      vulnerabilities: [],
      recommendations: ["Use HTTPS"],
    } as unknown as T;
  },
};

// ── Test Runner ──────────────────────────────────────────────────────────────

async function runTests(): Promise<void> {
  let passed = 0;
  let failed = 0;

  console.log("\n=== Feature 16 — Full Aegis Multi-Agent Workflow Tests ===\n");

  const plannerNode = createPlannerNode(new PlannerAgent(mockPlannerModel));
  const researcherNode = createResearcherNode(new ResearcherAgent(mockResearcherModel));
  const architectNode = createArchitectNode(new ArchitectAgent(mockArchitectModel));
  const developerNode = createDeveloperNode(new DeveloperAgent(mockDeveloperModel));
  const testerNode = createTesterNode(new TesterAgent(mockTesterModelSuccess));
  const reviewerNode = createReviewerNode(new ReviewerAgent(mockReviewerModelSuccess));
  const securityNode = createSecurityNode(new SecurityAgent(mockSecurityModelSuccess));

  const successGraph = buildMultiAgentWorkflow({
    planner: plannerNode,
    researcher: researcherNode,
    architect: architectNode,
    developer: developerNode,
    tester: testerNode,
    reviewer: reviewerNode,
    security: securityNode,
  }).compile();

  // ── Test 1: Full End-to-End Successful Execution ─────────────────────────
  try {
    console.log("Test 1: Full 7-agent workflow end-to-end execution...");
    const result = await successGraph.invoke({ task: "Build Secure User Authentication" });

    if (result.status !== "completed") {
      throw new Error(`Expected final status "completed", got "${result.status}". Errors: ${JSON.stringify(result.errors)}`);
    }
    if (result.plan.length !== 1) {
      throw new Error(`Expected 1 plan step, got ${result.plan.length}`);
    }
    if (!result.research.includes("JWT tokens")) {
      throw new Error("Expected research output in state");
    }
    if (!result.architecture.includes("AuthMiddleware")) {
      throw new Error("Expected architecture design in state");
    }
    if (result.codeChanges.length !== 1) {
      throw new Error(`Expected 1 code change, got ${result.codeChanges.length}`);
    }
    if (!result.testResults?.passed) {
      throw new Error("Expected testResults.passed = true");
    }
    if (!result.reviewResults?.approved) {
      throw new Error("Expected reviewResults.approved = true");
    }

    console.log(`       Final Status: "${result.status}"`);
    console.log(`       Code Changes: ${result.codeChanges.length} file updated`);
    console.log(`       Test & Review: Passed & Approved`);
    console.log(`${PASS} Test 1: Execution flowed Planner -> Researcher -> Architect -> Developer -> Tester -> Reviewer -> Security -> END`);
    passed++;
  } catch (err) {
    console.log(`${FAIL} Test 1: ${(err as Error).message}`);
    failed++;
  }

  // ── Test 2: Feedback Loop Routing (Tester Fails -> Developer Repaired) ─────
  try {
    console.log("\nTest 2: Conditional routing on Test Failure (Tester Fails -> Loop Back to Developer)...");
    let testAttempts = 0;

    const mockTesterFlakyModel: TesterModel = {
      async generateStructured<T>() {
        testAttempts++;
        const isFirstAttempt = testAttempts === 1;
        return {
          task: "Test Auth Middleware",
          summary: isFirstAttempt ? "1 test failed" : "All tests passed on retry",
          passed: !isFirstAttempt,
          totalTests: 2,
          passedTests: isFirstAttempt ? 1 : 2,
          failedTests: isFirstAttempt ? 1 : 0,
          testRuns: [{ name: "Test 1", passed: !isFirstAttempt }],
          coverageGaps: [],
        } as unknown as T;
      },
    };

    const flakyTesterNode = createTesterNode(new TesterAgent(mockTesterFlakyModel));

    const retryGraph = buildMultiAgentWorkflow({
      planner: plannerNode,
      researcher: researcherNode,
      architect: architectNode,
      developer: developerNode,
      tester: flakyTesterNode,
      reviewer: reviewerNode,
      security: securityNode,
    }).compile();

    const result = await retryGraph.invoke({ task: "Build Secure User Authentication" });

    if (result.status !== "completed") {
      throw new Error(`Expected final status "completed" after retry, got "${result.status}". Errors: ${JSON.stringify(result.errors)}`);
    }
    if (result.retryCount !== 1) {
      throw new Error(`Expected retryCount = 1, got ${result.retryCount}`);
    }
    if (testAttempts !== 2) {
      throw new Error(`Expected 2 test attempts, got ${testAttempts}`);
    }

    console.log(`       Final Status: "${result.status}"`);
    console.log(`       Retry Count: ${result.retryCount}`);
    console.log(`${PASS} Test 2: Tester failed -> routed back to Developer via retryLoop -> repaired & completed on retry`);
    passed++;
  } catch (err) {
    console.log(`${FAIL} Test 2: ${(err as Error).message}`);
    failed++;
  }

  // ── Test 3: Terminal Failure on Max Retries Exceeded ───────────────────────
  try {
    console.log("\nTest 3: Terminal failure routing when Max Retries are exceeded...");

    const mockTesterAlwaysFails: TesterModel = {
      async generateStructured<T>() {
        return {
          task: "Test Auth Middleware",
          summary: "Always fails",
          passed: false,
          totalTests: 1,
          passedTests: 0,
          failedTests: 1,
          testRuns: [{ name: "Test 1", passed: false }],
          coverageGaps: [],
        } as unknown as T;
      },
    };

    const failingTesterNode = createTesterNode(new TesterAgent(mockTesterAlwaysFails));

    const failGraph = buildMultiAgentWorkflow({
      planner: plannerNode,
      researcher: researcherNode,
      architect: architectNode,
      developer: developerNode,
      tester: failingTesterNode,
      reviewer: reviewerNode,
      security: securityNode,
    }).compile();

    const result = await failGraph.invoke({
      task: "Build Secure User Authentication",
      maxRetries: 2,
    });

    if (result.status !== "failed") {
      throw new Error(`Expected final status "failed", got "${result.status}"`);
    }
    if (result.retryCount !== 2) {
      throw new Error(`Expected retryCount = 2, got ${result.retryCount}`);
    }

    console.log(`       Final Status: "${result.status}"`);
    console.log(`       Retries Attempted: ${result.retryCount}/2`);
    console.log(`${PASS} Test 3: Max retries exceeded -> routed to errorHandler -> status updated to "failed"`);
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
