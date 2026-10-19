/**
 * graph/workflow.test.ts
 *
 * Feature 06 — LangGraph Workflow Verification
 *
 * Run with:
 *   npx tsx graph/workflow.test.ts
 */

import { aegisGraph } from "./workflow.js";

const PASS = "✅ PASS";
const FAIL = "❌ FAIL";

async function runTests(): Promise<void> {
  let passed = 0;
  let failed = 0;

  console.log("\n=== Feature 06 — LangGraph Nodes + Edges + Routing Tests ===\n");

  // ── Test 1: Successful Workflow Path (START -> inputProcessor -> taskExecuter -> END)
  try {
    console.log('Test 1: Executing workflow with valid task ("Build state graph")...');
    const result = await aegisGraph.invoke({ task: "Build state graph" });

    if (result.status !== "completed") {
      throw new Error(`Expected final status "completed", got "${result.status}"`);
    }
    if (!result.research || !result.research.includes("Build state graph")) {
      throw new Error(`Expected research to contain task info, got: "${result.research}"`);
    }
    if (!result.architecture || !result.architecture.includes("Architecture designed")) {
      throw new Error(`Expected architecture notes, got: "${result.architecture}"`);
    }
    if (!result.codeChanges || result.codeChanges.length === 0) {
      throw new Error("Expected codeChanges array to contain generated changes");
    }

    console.log(`       Final Status:  "${result.status}"`);
    console.log(`       Research:      "${result.research}"`);
    console.log(`       Architecture:  "${result.architecture}"`);
    console.log(`       Code Changes:  ${result.codeChanges.length} file(s) updated`);
    console.log(`${PASS} Test 1: Workflow executed successful path through conditional routing`);
    passed++;
  } catch (err) {
    console.log(`${FAIL} Test 1: ${(err as Error).message}`);
    failed++;
  }

  // ── Test 2: Conditional Error Routing Path (START -> inputProcessor -> errorHandler -> END)
  try {
    console.log('\nTest 2: Executing workflow with invalid empty task ("")...');
    const result = await aegisGraph.invoke({ task: "" });

    if (result.status !== "failed") {
      throw new Error(`Expected final status "failed", got "${result.status}"`);
    }
    if (!result.errors || result.errors.length === 0) {
      throw new Error("Expected errors array to record validation failure");
    }

    console.log(`       Final Status:  "${result.status}"`);
    console.log(`       Recorded Errors: ${JSON.stringify(result.errors)}`);
    console.log(`${PASS} Test 2: Conditional edge correctly routed to errorHandler on validation error`);
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
