/**
 * graph/edges/agentRouter.test.ts
 *
 * Feature 17 — Agent Router Unit Tests
 *
 * Run with:
 *   npx tsx graph/edges/agentRouter.test.ts
 */

import { determineNextAgent } from "./agentRouter.js";
import { END } from "@langchain/langgraph";
import type { AegisState } from "../state.js";

const PASS = "✅ PASS";
const FAIL = "❌ FAIL";

function createBaseState(overrides: Partial<AegisState> = {}): AegisState {
  return {
    task: "Implement user authentication",
    plan: [],
    research: "",
    architecture: "",
    codeChanges: [],
    testResults: null,
    reviewResults: null,
    errors: [],
    status: "idle",
    retryCount: 0,
    maxRetries: 3,
    workspace: "",
    executionLog: [],
    recoveryContext: [],
    ...overrides,
  };
}

async function runTests(): Promise<void> {
  let passed = 0;
  let failed = 0;

  console.log("\n=== Feature 17 — Agent Router Unit Tests ===\n");

  // ── Test 1: Empty / invalid task routes to errorHandler ─────────────────────
  try {
    const invalidState = createBaseState({ task: "" });
    const next = determineNextAgent(invalidState);
    if (next !== "errorHandler") {
      throw new Error(`Expected "errorHandler", got "${String(next)}"`);
    }
    console.log(`${PASS} Test 1: Empty task -> routes to errorHandler`);
    passed++;
  } catch (err) {
    console.log(`${FAIL} Test 1: ${(err as Error).message}`);
    failed++;
  }

  // ── Test 2: Failed status routes to errorHandler ─────────────────────────────
  try {
    const failedState = createBaseState({ status: "failed" });
    const next = determineNextAgent(failedState);
    if (next !== "errorHandler") {
      throw new Error(`Expected "errorHandler", got "${String(next)}"`);
    }
    console.log(`${PASS} Test 2: Failed status -> routes to errorHandler`);
    passed++;
  } catch (err) {
    console.log(`${FAIL} Test 2: ${(err as Error).message}`);
    failed++;
  }

  // ── Test 3: Completed status routes to END ───────────────────────────────────
  try {
    const completedState = createBaseState({ status: "completed" });
    const next = determineNextAgent(completedState);
    if (next !== END) {
      throw new Error(`Expected END, got "${String(next)}"`);
    }
    console.log(`${PASS} Test 3: Completed status -> routes to END`);
    passed++;
  } catch (err) {
    console.log(`${FAIL} Test 3: ${(err as Error).message}`);
    failed++;
  }

  // ── Test 4: Fresh state (no plan) routes to planner ──────────────────────────
  try {
    const freshState = createBaseState();
    const next = determineNextAgent(freshState);
    if (next !== "planner") {
      throw new Error(`Expected "planner", got "${String(next)}"`);
    }
    console.log(`${PASS} Test 4: Fresh state (no plan) -> routes to planner`);
    passed++;
  } catch (err) {
    console.log(`${FAIL} Test 4: ${(err as Error).message}`);
    failed++;
  }

  // ── Test 5: Plan present, missing research routes to researcher ─────────────
  try {
    const stateWithPlan = createBaseState({
      plan: [{ id: "1", description: "Design Auth", status: "pending" }],
    });
    const next = determineNextAgent(stateWithPlan);
    if (next !== "researcher") {
      throw new Error(`Expected "researcher", got "${String(next)}"`);
    }
    console.log(`${PASS} Test 5: Plan present -> routes to researcher`);
    passed++;
  } catch (err) {
    console.log(`${FAIL} Test 5: ${(err as Error).message}`);
    failed++;
  }

  // ── Test 6: Plan & research present, missing architecture routes to architect
  try {
    const stateWithResearch = createBaseState({
      plan: [{ id: "1", description: "Design Auth", status: "pending" }],
      research: "JWT best practices analyzed.",
    });
    const next = determineNextAgent(stateWithResearch);
    if (next !== "architect") {
      throw new Error(`Expected "architect", got "${String(next)}"`);
    }
    console.log(`${PASS} Test 6: Plan & Research present -> routes to architect`);
    passed++;
  } catch (err) {
    console.log(`${FAIL} Test 6: ${(err as Error).message}`);
    failed++;
  }

  // ── Test 7: Architecture present, missing codeChanges routes to developer ───
  try {
    const stateWithArch = createBaseState({
      plan: [{ id: "1", description: "Design Auth", status: "pending" }],
      research: "JWT best practices analyzed.",
      architecture: "AuthMiddleware design spec.",
    });
    const next = determineNextAgent(stateWithArch);
    if (next !== "developer") {
      throw new Error(`Expected "developer", got "${String(next)}"`);
    }
    console.log(`${PASS} Test 7: Architecture present (conditional skip planner/researcher) -> routes to developer`);
    passed++;
  } catch (err) {
    console.log(`${FAIL} Test 7: ${(err as Error).message}`);
    failed++;
  }

  // ── Test 8: Status 'developing' routes to tester (even if old testResults exist)
  try {
    const stateDeveloping = createBaseState({
      status: "developing",
      testResults: { passed: false, totalTests: 1, passedTests: 0, failedTests: 1 },
      retryCount: 1,
    });
    const next = determineNextAgent(stateDeveloping);
    if (next !== "tester") {
      throw new Error(`Expected "tester", got "${String(next)}"`);
    }
    console.log(`${PASS} Test 8: Status "developing" -> routes to tester (repair code ready for re-testing)`);
    passed++;
  } catch (err) {
    console.log(`${FAIL} Test 8: ${(err as Error).message}`);
    failed++;
  }

  // ── Test 9: Test passed, status 'testing' routes to reviewer ────────────────
  try {
    const stateWithTests = createBaseState({
      status: "testing",
      plan: [{ id: "1", description: "Design Auth", status: "pending" }],
      research: "JWT best practices analyzed.",
      architecture: "AuthMiddleware design spec.",
      codeChanges: [{ path: "src/auth.ts", action: "add", summary: "Added auth" }],
      testResults: { passed: true, totalTests: 2, passedTests: 2, failedTests: 0 },
    });
    const next = determineNextAgent(stateWithTests);
    if (next !== "reviewer") {
      throw new Error(`Expected "reviewer", got "${String(next)}"`);
    }
    console.log(`${PASS} Test 9: Status "testing" with passed tests -> routes to reviewer`);
    passed++;
  } catch (err) {
    console.log(`${FAIL} Test 9: ${(err as Error).message}`);
    failed++;
  }

  // ── Test 10: Review approved, status 'reviewing' routes to security ─────────
  try {
    const stateWithReview = createBaseState({
      status: "reviewing",
      plan: [{ id: "1", description: "Design Auth", status: "pending" }],
      research: "JWT best practices analyzed.",
      architecture: "AuthMiddleware design spec.",
      codeChanges: [{ path: "src/auth.ts", action: "add", summary: "Added auth" }],
      testResults: { passed: true, totalTests: 2, passedTests: 2, failedTests: 0 },
      reviewResults: { approved: true, comments: ["Good"] },
    });
    const next = determineNextAgent(stateWithReview);
    if (next !== "security") {
      throw new Error(`Expected "security", got "${String(next)}"`);
    }
    console.log(`${PASS} Test 10: Status "reviewing" with approved review -> routes to security`);
    passed++;
  } catch (err) {
    console.log(`${FAIL} Test 10: ${(err as Error).message}`);
    failed++;
  }

  // ── Test 11: Failed tests with retries remaining routes to recovery (Feature 18) ────
  try {
    const testFailState = createBaseState({
      status: "testing",
      testResults: { passed: false, totalTests: 2, passedTests: 1, failedTests: 1 },
      retryCount: 1,
      maxRetries: 3,
    });
    const next = determineNextAgent(testFailState);
    if (next !== "recovery") {
      throw new Error(`Expected "recovery", got "${String(next)}"`);
    }
    console.log(`${PASS} Test 11: Status "testing" with test failure & retries -> routes to recovery (context-aware F18)`);
    passed++;
  } catch (err) {
    console.log(`${FAIL} Test 11: ${(err as Error).message}`);
    failed++;
  }

  // ── Test 12: Failed tests with max retries reached routes to errorHandler ───
  try {
    const testMaxFailState = createBaseState({
      status: "testing",
      testResults: { passed: false, totalTests: 2, passedTests: 0, failedTests: 2 },
      retryCount: 3,
      maxRetries: 3,
    });
    const next = determineNextAgent(testMaxFailState);
    if (next !== "errorHandler") {
      throw new Error(`Expected "errorHandler", got "${String(next)}"`);
    }
    console.log(`${PASS} Test 12: Status "testing" with max retries reached -> routes to errorHandler`);
    passed++;
  } catch (err) {
    console.log(`${FAIL} Test 12: ${(err as Error).message}`);
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
