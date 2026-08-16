/**
 * graph/testerWorkflow.test.ts
 *
 * Feature 13 — Tester Agent Graph Workflow Tests
 *
 * Run with:
 *   npx tsx graph/testerWorkflow.test.ts
 */

import { buildTesterWorkflow } from "./testerWorkflow.js";
import { createTesterNode } from "./nodes/testerNode.js";
import { TesterAgent } from "../agents/tester/tester.js";
import type { TesterModel } from "../agents/tester/tester.js";

const PASS = "✅ PASS";
const FAIL = "❌ FAIL";

const mockTesterModel: TesterModel = {
  async generateStructured<T>(_systemPrompt: string, _userPrompt: string, _schema: unknown): Promise<T> {
    return {
      task: "Verify Auth Route API",
      summary: "All 3 auth integration tests passed.",
      passed: true,
      totalTests: 3,
      passedTests: 3,
      failedTests: 0,
      testRuns: [
        {
          name: "Test 1: Valid Login",
          passed: true,
        },
      ],
      coverageGaps: [],
    } as unknown as T;
  },
};

async function runTests(): Promise<void> {
  let passed = 0;
  let failed = 0;

  console.log("\n=== Feature 13 — Tester Agent Graph Workflow Tests ===\n");

  const mockTesterAgent = new TesterAgent(mockTesterModel);
  const mockTesterNode = createTesterNode(mockTesterAgent);
  const testGraph = buildTesterWorkflow(mockTesterNode).compile();

  // ── Test 1: Successful test results generation through graph ─────────────
  try {
    console.log('Test 1: Graph execution for tester task ("Verify Auth Route API")...');
    const result = await testGraph.invoke({ task: "Verify Auth Route API" });

    if (result.status !== "testing") {
      throw new Error(`Expected status "testing", got "${result.status}"`);
    }
    if (!result.testResults || !result.testResults.passed) {
      throw new Error(`Expected testResults.passed = true, got ${JSON.stringify(result.testResults)}`);
    }
    if (result.testResults.totalTests !== 3) {
      throw new Error(`Expected 3 total tests, got ${result.testResults.totalTests}`);
    }

    console.log(`       Final Status: "${result.status}"`);
    console.log(`       Test Results: ${result.testResults.passedTests}/${result.testResults.totalTests} passed`);
    console.log(`${PASS} Test 1: Task entered graph -> Tester generated test output -> stored in AegisState.testResults`);
    passed++;
  } catch (err) {
    console.log(`${FAIL} Test 1: ${(err as Error).message}`);
    failed++;
  }

  // ── Test 2: Empty task error handling in graph node ─────────────────────
  try {
    console.log('\nTest 2: Graph execution with empty task ("")...');
    const result = await testGraph.invoke({ task: "" });

    if (result.status !== "failed") {
      throw new Error(`Expected status "failed", got "${result.status}"`);
    }
    if (!result.errors || result.errors.length === 0) {
      throw new Error("Expected errors in graph state");
    }

    console.log(`       Final Status: "${result.status}"`);
    console.log(`       Errors: ${result.errors.join("; ")}`);
    console.log(`${PASS} Test 2: Empty task handled gracefully -> graph state updated to failed with errors`);
    passed++;
  } catch (err) {
    console.log(`${FAIL} Test 2: ${(err as Error).message}`);
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
