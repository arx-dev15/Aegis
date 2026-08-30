/**
 * graph/failureRecovery.test.ts
 *
 * Feature 18 — Failure Recovery + Iteration Loops Tests
 *
 * Tests the context-aware recovery system built on the dynamic routing workflow.
 * Verifies that:
 *   1. Tester failure → recoveryNode builds context → Developer repairs → completes
 *   2. Reviewer rejection → recoveryNode builds context → Developer repairs → approved
 *   3. Security vulnerability → recoveryNode builds context → Developer fixes → completed
 *   4. Max retries exhausted → workflow terminates as "failed"
 *   5. Happy path regression — successful flow still completes correctly
 *
 * Run with:
 *   npx tsx graph/failureRecovery.test.ts
 */

import { buildDynamicRoutingWorkflow } from "./dynamicRoutingWorkflow.js";
import { recoveryNode } from "./nodes/recoveryNode.js";
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
import type { AegisState } from "./state.js";

const PASS = "✅ PASS";
const FAIL = "❌ FAIL";

// ── Shared Mock Models ────────────────────────────────────────────────────────

const mockPlannerModel: PlannerModel = {
  async generateStructured<T>() {
    return {
      goal: "Build Auth Feature",
      summary: "Plan for auth implementation.",
      steps: [{ id: "1", title: "Auth", description: "Implement auth", dependencies: [], verification: "Tests" }],
      risks: [],
      verificationStrategy: [],
    } as unknown as T;
  },
};

const mockResearcherModel: ResearcherModel = {
  async generateStructured<T>() {
    return {
      objective: "Research Auth",
      summary: "Use JWT with bcrypt.",
      findings: [{ id: "f1", topic: "Auth", finding: "Use JWT", evidence: "RFC 7519" }],
      constraints: [],
      unknowns: [],
      risks: [],
    } as unknown as T;
  },
};

const mockArchitectModel: ArchitectModel = {
  async generateStructured<T>() {
    return {
      title: "Auth Architecture",
      summary: "JWT middleware design.",
      components: [{ name: "AuthMiddleware", type: "new", description: "Verify JWT", responsibilities: ["Verify token"] }],
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
      task: "Implement Auth",
      summary: "Auth middleware added.",
      fileChanges: [{ path: "src/auth.ts", action: "add", content: "export function auth() {}", summary: "Auth impl" }],
      commandsExecuted: [],
      status: "completed",
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

// ── Test Suite ────────────────────────────────────────────────────────────────

async function runTests(): Promise<void> {
  let passed = 0;
  let failed = 0;

  console.log("\n=== Feature 18 — Failure Recovery + Iteration Loops Tests ===\n");

  // Shared base nodes (non-failing path)
  const plannerNode = createPlannerNode(new PlannerAgent(mockPlannerModel));
  const researcherNode = createResearcherNode(new ResearcherAgent(mockResearcherModel));
  const architectNode = createArchitectNode(new ArchitectAgent(mockArchitectModel));
  const developerNode = createDeveloperNode(new DeveloperAgent(mockDeveloperModel));
  const securityNode = createSecurityNode(new SecurityAgent(mockSecurityModelSuccess));

  // ── Test 1: Tester Failure → Recovery Context → Developer Repairs → Passes ──
  try {
    console.log("Test 1: Tester failure → recoveryNode builds context → developer repairs → completes...");

    let testAttempts = 0;
    let developerCallsWithRecovery = 0;

    const mockTesterFlakyModel: TesterModel = {
      async generateStructured<T>() {
        testAttempts++;
        const isFirst = testAttempts === 1;
        return {
          task: "Test Auth",
          summary: isFirst ? "1 test failed: null reference in token validation" : "All tests passed",
          passed: !isFirst,
          totalTests: 3,
          passedTests: isFirst ? 2 : 3,
          failedTests: isFirst ? 1 : 0,
          testRuns: [{ name: "token validation test", passed: !isFirst }],
          coverageGaps: [],
        } as unknown as T;
      },
    };

    // Track if developer was called with recovery context
    const trackingDeveloperModel: DeveloperModel = {
      async generateStructured<T>(systemPrompt: string, userPrompt: string) {
        if (userPrompt.includes("REPAIR CONTEXT")) {
          developerCallsWithRecovery++;
        }
        return mockDeveloperModel.generateStructured<T>(systemPrompt, userPrompt, {} as any);
      },
    };

    const mockReviewerSuccess: ReviewerModel = {
      async generateStructured<T>() {
        return {
          task: "Review Auth",
          summary: "Approved.",
          approved: true,
          findings: [],
          acceptedAspects: ["Clean code"],
          recommendation: "approve",
        } as unknown as T;
      },
    };

    const graph = buildDynamicRoutingWorkflow({
      planner: plannerNode,
      researcher: researcherNode,
      architect: architectNode,
      developer: createDeveloperNode(new DeveloperAgent(trackingDeveloperModel)),
      tester: createTesterNode(new TesterAgent(mockTesterFlakyModel)),
      reviewer: createReviewerNode(new ReviewerAgent(mockReviewerSuccess)),
      security: securityNode,
    }).compile();

    const result = await graph.invoke({ task: "Build Auth Feature" });

    if (result.status !== "completed") {
      throw new Error(`Expected "completed", got "${result.status}". Errors: ${JSON.stringify(result.errors)}`);
    }
    if (result.retryCount !== 1) {
      throw new Error(`Expected retryCount = 1, got ${result.retryCount}`);
    }
    if (result.recoveryContext.length !== 1) {
      throw new Error(`Expected 1 recoveryContext entry, got ${result.recoveryContext.length}`);
    }
    if (result.recoveryContext[0].failingAgent !== "tester") {
      throw new Error(`Expected failingAgent "tester", got "${result.recoveryContext[0].failingAgent}"`);
    }
    if (developerCallsWithRecovery === 0) {
      throw new Error("Developer was never called with REPAIR CONTEXT — recovery context was not forwarded");
    }

    console.log(`       Final Status: "${result.status}"`);
    console.log(`       Retry Count: ${result.retryCount}`);
    console.log(`       Recovery entries: ${result.recoveryContext.length} (failingAgent: "${result.recoveryContext[0].failingAgent}")`);
    console.log(`       Developer received repair context: YES`);
    console.log(`${PASS} Test 1: Tester failure → recovery context built → developer repaired → completed`);
    passed++;
  } catch (err) {
    console.log(`${FAIL} Test 1: ${(err as Error).message}`);
    failed++;
  }

  // ── Test 2: Reviewer Rejection → Recovery Context → Developer Repairs → Approved ──
  try {
    console.log("\nTest 2: Reviewer rejection → recoveryNode builds context → developer repairs → approved...");

    let reviewerAttempts = 0;

    const mockTesterSuccess: TesterModel = {
      async generateStructured<T>() {
        return {
          task: "Test Auth",
          summary: "All tests passed.",
          passed: true,
          totalTests: 3,
          passedTests: 3,
          failedTests: 0,
          testRuns: [{ name: "all tests", passed: true }],
          coverageGaps: [],
        } as unknown as T;
      },
    };

    const mockFlakyReviewerModel: ReviewerModel = {
      async generateStructured<T>() {
        reviewerAttempts++;
        const isFirst = reviewerAttempts === 1;
        return {
          task: "Review Auth",
          summary: isFirst ? "Rejected: missing error handling" : "Approved after fix.",
          approved: !isFirst,
          findings: isFirst
            ? [{
                id: "r1",
                severity: "blocking" as const,
                issue: "Missing error handling in token validation",
                recommendation: "Add try/catch around JWT.verify()",
              }]
            : [],
          acceptedAspects: ["Clean structure"],
          recommendation: isFirst ? "request_changes" as const : "approve" as const,
        } as unknown as T;
      },
    };

    const graph = buildDynamicRoutingWorkflow({
      planner: plannerNode,
      researcher: researcherNode,
      architect: architectNode,
      developer: developerNode,
      tester: createTesterNode(new TesterAgent(mockTesterSuccess)),
      reviewer: createReviewerNode(new ReviewerAgent(mockFlakyReviewerModel)),
      security: securityNode,
    }).compile();

    const result = await graph.invoke({ task: "Build Auth Feature" });

    if (result.status !== "completed") {
      throw new Error(`Expected "completed", got "${result.status}". Errors: ${JSON.stringify(result.errors)}`);
    }
    if (result.retryCount !== 1) {
      throw new Error(`Expected retryCount = 1, got ${result.retryCount}`);
    }
    if (result.recoveryContext.length !== 1) {
      throw new Error(`Expected 1 recoveryContext entry, got ${result.recoveryContext.length}`);
    }
    if (result.recoveryContext[0].failingAgent !== "reviewer") {
      throw new Error(`Expected failingAgent "reviewer", got "${result.recoveryContext[0].failingAgent}"`);
    }
    if (!result.recoveryContext[0].details.some((d) => d.includes("error handling"))) {
      throw new Error("Expected review rejection details to be captured in recoveryContext");
    }

    console.log(`       Final Status: "${result.status}"`);
    console.log(`       Recovery entries: ${result.recoveryContext.length} (failingAgent: "${result.recoveryContext[0].failingAgent}")`);
    console.log(`       Review details captured: "${result.recoveryContext[0].details[0]?.slice(0, 60)}..."`);
    console.log(`${PASS} Test 2: Reviewer rejection → recovery context built → developer repaired → approved`);
    passed++;
  } catch (err) {
    console.log(`${FAIL} Test 2: ${(err as Error).message}`);
    failed++;
  }

  // ── Test 3: Security Vulnerability → Recovery Context → Developer Fixes → Completed ──
  try {
    console.log("\nTest 3: Security vulnerability → recoveryNode builds context → developer fixes → completed...");

    let securityAttempts = 0;

    const mockTesterSuccess: TesterModel = {
      async generateStructured<T>() {
        return {
          task: "Test Auth",
          summary: "All tests passed.",
          passed: true,
          totalTests: 2,
          passedTests: 2,
          failedTests: 0,
          testRuns: [],
          coverageGaps: [],
        } as unknown as T;
      },
    };

    const mockReviewerSuccess: ReviewerModel = {
      async generateStructured<T>() {
        return {
          task: "Review Auth",
          summary: "Approved.",
          approved: true,
          findings: [],
          acceptedAspects: [],
          recommendation: "approve",
        } as unknown as T;
      },
    };

    const mockFlakySecurityModel: SecurityModel = {
      async generateStructured<T>() {
        securityAttempts++;
        const isFirst = securityAttempts === 1;
        return {
          task: "Audit Security",
          summary: isFirst ? "SQL injection risk found" : "All clear after remediation.",
          secure: !isFirst,
          vulnerabilities: isFirst
            ? [{
                id: "v1",
                severity: "high" as const,
                vulnerability: "SQL injection in token query",
                evidence: "Unsanitized user input concatenated in SQL string",
                impact: "Full database read/write access by attacker",
                remediation: "Use parameterized queries",
                confidence: "high" as const,
              }]
            : [],
          recommendations: isFirst ? ["Use parameterized queries"] : [],
        } as unknown as T;
      },
    };

    const graph = buildDynamicRoutingWorkflow({
      planner: plannerNode,
      researcher: researcherNode,
      architect: architectNode,
      developer: developerNode,
      tester: createTesterNode(new TesterAgent(mockTesterSuccess)),
      reviewer: createReviewerNode(new ReviewerAgent(mockReviewerSuccess)),
      security: createSecurityNode(new SecurityAgent(mockFlakySecurityModel)),
    }).compile();

    const result = await graph.invoke({ task: "Build Auth Feature" });

    if (result.status !== "completed") {
      throw new Error(`Expected "completed", got "${result.status}". Errors: ${JSON.stringify(result.errors)}`);
    }
    if (result.retryCount !== 1) {
      throw new Error(`Expected retryCount = 1, got ${result.retryCount}`);
    }
    if (result.recoveryContext.length !== 1) {
      throw new Error(`Expected 1 recoveryContext entry, got ${result.recoveryContext.length}`);
    }
    if (result.recoveryContext[0].failingAgent !== "security") {
      throw new Error(`Expected failingAgent "security", got "${result.recoveryContext[0].failingAgent}"`);
    }

    console.log(`       Final Status: "${result.status}"`);
    console.log(`       Recovery entries: ${result.recoveryContext.length} (failingAgent: "${result.recoveryContext[0].failingAgent}")`);
    console.log(`${PASS} Test 3: Security vulnerability → recovery context built → developer fixed → completed`);
    passed++;
  } catch (err) {
    console.log(`${FAIL} Test 3: ${(err as Error).message}`);
    failed++;
  }

  // ── Test 4: Max Retries Exhausted → Workflow Terminates as "failed" ──────────
  try {
    console.log("\nTest 4: Max retries exhausted → workflow terminates as \"failed\"...");

    const mockAlwaysFailingTester: TesterModel = {
      async generateStructured<T>() {
        return {
          task: "Test Auth",
          summary: "Always fails — critical bug",
          passed: false,
          totalTests: 5,
          passedTests: 0,
          failedTests: 5,
          testRuns: [{ name: "all tests", passed: false }],
          coverageGaps: [],
        } as unknown as T;
      },
    };

    const mockReviewerSuccess: ReviewerModel = {
      async generateStructured<T>() {
        return { task: "Review", summary: "OK", approved: true, findings: [], acceptedAspects: [], recommendation: "approve" } as unknown as T;
      },
    };

    const graph = buildDynamicRoutingWorkflow({
      planner: plannerNode,
      researcher: researcherNode,
      architect: architectNode,
      developer: developerNode,
      tester: createTesterNode(new TesterAgent(mockAlwaysFailingTester)),
      reviewer: createReviewerNode(new ReviewerAgent(mockReviewerSuccess)),
      security: securityNode,
    }).compile();

    const result = await graph.invoke({ task: "Build Auth Feature", maxRetries: 2 });

    if (result.status !== "failed") {
      throw new Error(`Expected "failed", got "${result.status}"`);
    }
    if (result.retryCount !== 2) {
      throw new Error(`Expected retryCount = 2, got ${result.retryCount}`);
    }
    // Should have recovery context for each retry
    if (result.recoveryContext.length !== 2) {
      throw new Error(`Expected 2 recoveryContext entries (one per retry), got ${result.recoveryContext.length}`);
    }

    console.log(`       Final Status: "${result.status}"`);
    console.log(`       Retries attempted: ${result.retryCount}/2`);
    console.log(`       Recovery context entries: ${result.recoveryContext.length}`);
    console.log(`${PASS} Test 4: Max retries (2) exhausted → correctly terminated as "failed"`);
    passed++;
  } catch (err) {
    console.log(`${FAIL} Test 4: ${(err as Error).message}`);
    failed++;
  }

  // ── Test 5: Happy Path Regression — No Failures, Normal Completion ───────────
  try {
    console.log("\nTest 5: Happy path regression — no failures → normal completion...");

    const mockTesterSuccess: TesterModel = {
      async generateStructured<T>() {
        return {
          task: "Test Auth",
          summary: "All tests passed.",
          passed: true,
          totalTests: 3,
          passedTests: 3,
          failedTests: 0,
          testRuns: [{ name: "auth tests", passed: true }],
          coverageGaps: [],
        } as unknown as T;
      },
    };

    const mockReviewerSuccess: ReviewerModel = {
      async generateStructured<T>() {
        return {
          task: "Review Auth",
          summary: "Approved.",
          approved: true,
          findings: [],
          acceptedAspects: ["Clean implementation"],
          recommendation: "approve",
        } as unknown as T;
      },
    };

    const graph = buildDynamicRoutingWorkflow({
      planner: plannerNode,
      researcher: researcherNode,
      architect: architectNode,
      developer: developerNode,
      tester: createTesterNode(new TesterAgent(mockTesterSuccess)),
      reviewer: createReviewerNode(new ReviewerAgent(mockReviewerSuccess)),
      security: securityNode,
    }).compile();

    const result = await graph.invoke({ task: "Build Auth Feature" });

    if (result.status !== "completed") {
      throw new Error(`Expected "completed", got "${result.status}". Errors: ${JSON.stringify(result.errors)}`);
    }
    if (result.retryCount !== 0) {
      throw new Error(`Expected retryCount = 0, got ${result.retryCount}`);
    }
    if (result.recoveryContext.length !== 0) {
      throw new Error(`Expected 0 recoveryContext entries (no failures), got ${result.recoveryContext.length}`);
    }

    console.log(`       Final Status: "${result.status}"`);
    console.log(`       Retry Count: ${result.retryCount} (no retries needed)`);
    console.log(`       Recovery Context Entries: ${result.recoveryContext.length} (none — clean run)`);
    console.log(`${PASS} Test 5: Happy path — completed with 0 retries and no recovery entries`);
    passed++;
  } catch (err) {
    console.log(`${FAIL} Test 5: ${(err as Error).message}`);
    failed++;
  }

  // ── Test 6: Agent Failure (Researcher) → Recovery Route to Researcher ─────────
  try {
    console.log("\nTest 6: Researcher failure → recoveryNode routes back to researcher...");

    let researchAttempts = 0;
    const mockFlakyResearcherModel: ResearcherModel = {
      async generateStructured<T>() {
        researchAttempts++;
        return {
          objective: "Research Auth",
          summary: researchAttempts === 1 ? "Incomplete research" : "Complete research findings",
          findings: [{ id: `f${researchAttempts}`, topic: "Auth", finding: "JWT", evidence: "RFC" }],
          constraints: [],
          unknowns: [],
          risks: [],
        } as unknown as T;
      },
    };

    const mockTesterSuccess: TesterModel = {
      async generateStructured<T>() {
        return { task: "Test", summary: "Pass", passed: true, totalTests: 1, passedTests: 1, failedTests: 0, testRuns: [], coverageGaps: [] } as unknown as T;
      },
    };
    const mockReviewerSuccess: ReviewerModel = {
      async generateStructured<T>() {
        return { task: "Review", summary: "Approve", approved: true, findings: [], acceptedAspects: [], recommendation: "approve" } as unknown as T;
      },
    };

    const graph = buildDynamicRoutingWorkflow({
      planner: plannerNode,
      researcher: createResearcherNode(new ResearcherAgent(mockFlakyResearcherModel)),
      architect: architectNode,
      developer: developerNode,
      tester: createTesterNode(new TesterAgent(mockTesterSuccess)),
      reviewer: createReviewerNode(new ReviewerAgent(mockReviewerSuccess)),
      security: securityNode,
    }).compile();

    const result = await graph.invoke({ task: "Build Auth Feature" });

    if (result.status !== "completed") {
      throw new Error(`Expected "completed", got "${result.status}"`);
    }

    console.log(`       Final Status: "${result.status}"`);
    console.log(`       Research attempts: ${researchAttempts}`);
    console.log(`${PASS} Test 6: Agent failure (Researcher) → recovery routed back to Researcher → completed`);
    passed++;
  } catch (err) {
    console.log(`${FAIL} Test 6: ${(err as Error).message}`);
    failed++;
  }

  // ── Test 7: Invalid Recovery State / Empty Task → Terminal Failure ───────────
  try {
    console.log("\nTest 7: Invalid recovery state (empty task) → routes to errorHandler terminal failure...");

    const graph = buildDynamicRoutingWorkflow().compile();
    const result = await graph.invoke({ task: "" });

    if (result.status !== "failed") {
      throw new Error(`Expected status "failed", got "${result.status}"`);
    }
    if (!result.errors.some((e) => e.includes("WORKFLOW TERMINATED"))) {
      throw new Error("Expected WORKFLOW TERMINATED error message for empty task");
    }

    console.log(`       Final Status: "${result.status}"`);
    console.log(`       Errors recorded: ${JSON.stringify(result.errors)}`);
    console.log(`${PASS} Test 7: Invalid recovery state / empty task → terminal failure`);
    passed++;
  } catch (err) {
    console.log(`${FAIL} Test 7: ${(err as Error).message}`);
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
