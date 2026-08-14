/**
 * agents/test.ts
 *
 * Feature 04 — First Tool-Calling Agent Verification
 *
 * Run with:
 *   npx tsx agents/test.ts
 *
 * Tests:
 *  1. Query requiring tool call ("What is 45 multiplied by 12?")
 *  2. Query NOT requiring tool call ("Hello! What is Aegis?")
 */

import { runToolAgent } from "./agent.js";
import { calculatorTool } from "../tools/index.js";

const PASS = "✅ PASS";
const FAIL = "❌ FAIL";

async function runTests(): Promise<void> {
  let passed = 0;
  let failed = 0;

  console.log("\n=== Feature 04 — First Tool-Calling Agent Tests ===\n");

  // ── Test 1: Query requiring tool call ───────────────────────────────────
  try {
    console.log('Test 1: Prompt requiring calculator ("What is 45 multiplied by 12?")...');
    const result = await runToolAgent(
      "What is 45 multiplied by 12?",
      [calculatorTool]
    );

    if (result.toolCallsExecuted.length === 0) {
      throw new Error("Expected at least 1 tool call, but none were executed");
    }

    const firstCall = result.toolCallsExecuted[0]!;
    if (firstCall.name !== "calculator") {
      throw new Error(`Expected tool call name "calculator", got "${firstCall.name}"`);
    }

    if (!result.text.includes("540")) {
      throw new Error(`Expected final response to contain "540", got: "${result.text}"`);
    }

    console.log(`       Tool Executed: ${firstCall.name}(${JSON.stringify(firstCall.args)}) => ${firstCall.output}`);
    console.log(`       Final Answer:  "${result.text.trim()}"`);
    console.log(`       Steps Taken:   ${result.steps}`);
    console.log(`${PASS} Test 1: Agent correctly identified tool requirement and synthesized final answer`);
    passed++;
  } catch (err) {
    console.log(`${FAIL} Test 1: ${(err as Error).message}`);
    failed++;
  }

  // ── Test 2: Query NOT requiring tool call ────────────────────────────────
  try {
    console.log('\nTest 2: Prompt NOT requiring calculator ("Hello! What is Aegis?")...');
    const result = await runToolAgent(
      "Hello! What is Aegis?",
      [calculatorTool]
    );

    if (result.toolCallsExecuted.length > 0) {
      throw new Error(`Expected 0 tool calls for plain query, but executed ${result.toolCallsExecuted.length}`);
    }

    if (!result.text || result.text.trim().length === 0) {
      throw new Error("Expected non-empty direct answer from model");
    }

    console.log(`       Final Answer: "${result.text.trim().substring(0, 100)}..."`);
    console.log(`       Steps Taken:  ${result.steps}`);
    console.log(`${PASS} Test 2: Agent correctly answered without invoking tools`);
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
