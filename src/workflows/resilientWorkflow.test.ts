/**
 * graph/resilientWorkflow.test.ts
 *
 * Feature 08 — Loops, Retries & Error Handling Verification
 *
 * Run with:
 *   npx tsx graph/resilientWorkflow.test.ts
 *
 * Tests:
 *  1. Successful execution (completes on 1st attempt)
 *  2. Recoverable failure & retry (fails initial attempts, retries, then succeeds)
 *  3. Retry limit reached (fails repeatedly until max retries reached -> moves to failure state)
 */

import { resilientGraph } from "./resilientWorkflow.js";

const PASS = "✅ PASS";
const FAIL = "❌ FAIL";

async function runTests(): Promise<void> {
  let passed = 0;
  let failed = 0;

  console.log("\n=== Feature 08 — Loops, Retries & Error Handling Tests ===\n");

  // ── Test 1: Successful Execution Path ─────────────────────────────────────
  try {
    console.log('Test 1: Direct successful execution path ("Execute standard task")...');
    const result = await resilientGraph.invoke({
      task: "Execute standard task",
      maxRetries: 3,
    });

    if (result.status !== "completed") {
      throw new Error(`Expected status "completed", got "${result.status}"`);
    }
    if (result.retryCount !== 0) {
      throw new Error(`Expected 0 retries, got ${result.retryCount}`);
    }

    console.log(`       Final Status: "${result.status}"`);
    console.log(`       Retries:      ${result.retryCount}`);
    console.log(`       Research:     "${result.research}"`);
    console.log(`${PASS} Test 1: Successful execution completed on 1st attempt with 0 retries`);
    passed++;
  } catch (err) {
    console.log(`${FAIL} Test 1: ${(err as Error).message}`);
    failed++;
  }

  // ── Test 2: Recoverable Failure & Retry ────────────────────────────────────
  try {
    console.log('\nTest 2: Recoverable failure & retry loop ("Process payment FAIL:2")...');
    const result = await resilientGraph.invoke({
      task: "Process payment FAIL:2",
      maxRetries: 3,
    });

    if (result.status !== "completed") {
      throw new Error(`Expected status "completed" after recovery, got "${result.status}"`);
    }
    if (result.retryCount !== 2) {
      throw new Error(`Expected retryCount 2, got ${result.retryCount}`);
    }
    if (result.errors.length !== 2) {
      throw new Error(`Expected 2 recorded transient errors, got ${result.errors.length}`);
    }

    console.log(`       Final Status:  "${result.status}"`);
    console.log(`       Retry Count:   ${result.retryCount}`);
    console.log(`       Errors Logged: ${result.errors.length}`);
    console.log(`${PASS} Test 2: Recoverable failure successfully looped and recovered on attempt 3`);
    passed++;
  } catch (err) {
    console.log(`${FAIL} Test 2: ${(err as Error).message}`);
    failed++;
  }

  // ── Test 3: Retry Limit Reached (Terminal Failure) ─────────────────────────
  try {
    console.log('\nTest 3: Retry limit reached ("Task FAIL_ALWAYS")...');
    const result = await resilientGraph.invoke({
      task: "Task FAIL_ALWAYS",
      maxRetries: 3,
    });

    if (result.status !== "failed") {
      throw new Error(`Expected final status "failed", got "${result.status}"`);
    }
    if (result.retryCount !== 3) {
      throw new Error(`Expected retryCount to reach limit (3), got ${result.retryCount}`);
    }
    if (result.errors.length < 3) {
      throw new Error(`Expected at least 3 errors recorded, got ${result.errors.length}`);
    }

    console.log(`       Final Status:    "${result.status}"`);
    console.log(`       Retry Count:     ${result.retryCount}`);
    console.log(`       Terminal Errors: ${JSON.stringify(result.errors.slice(-1))}`);
    console.log(`${PASS} Test 3: Graph correctly routed to failure state when max retries limit was reached`);
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
