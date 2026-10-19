/**
 * graph/singleAgentWorkflow.test.ts
 *
 * Feature 07 — Single-Agent Graph Verification
 *
 * Run with:
 *   npx tsx graph/singleAgentWorkflow.test.ts
 */

import { singleAgentGraph } from "./singleAgentWorkflow.js";

const PASS = "✅ PASS";
const FAIL = "❌ FAIL";

async function runTests(): Promise<void> {
  let passed = 0;
  let failed = 0;

  console.log("\n=== Feature 07 — Single-Agent Graph Tests ===\n");

  // ── Test 1: Task requiring tool call through graph ────────────────────────
  try {
    console.log('Test 1: Graph execution for math task ("What is 35 multiplied by 14?")...');
    const result = await singleAgentGraph.invoke({ task: "What is 35 multiplied by 14?" });

    if (result.status !== "completed") {
      throw new Error(`Expected final status "completed", got "${result.status}"`);
    }
    if (!result.research || !result.research.includes("490")) {
      throw new Error(`Expected research output to contain "490", got: "${result.research}"`);
    }

    console.log(`       Final Status: "${result.status}"`);
    console.log(`       Agent Result: "${result.research.trim()}"`);
    console.log(`${PASS} Test 1: Task entered graph -> agent invoked calculator tool -> result returned in graph state`);
    passed++;
  } catch (err) {
    console.log(`${FAIL} Test 1: ${(err as Error).message}`);
    failed++;
  }

  // ── Test 2: Task NOT requiring tool call through graph ─────────────────────
  try {
    console.log('\nTest 2: Graph execution for general query ("Summarize what Aegis is in one sentence")...');
    const result = await singleAgentGraph.invoke({ task: "Summarize what Aegis is in one sentence." });

    if (result.status !== "completed") {
      throw new Error(`Expected final status "completed", got "${result.status}"`);
    }
    if (!result.research || result.research.trim().length === 0) {
      throw new Error("Expected non-empty research text from agent");
    }

    console.log(`       Final Status: "${result.status}"`);
    console.log(`       Agent Result: "${result.research.trim()}"`);
    console.log(`${PASS} Test 2: Task entered graph -> agent processed without tools -> result returned in graph state`);
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
