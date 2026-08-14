/**
 * tools/calculator/test.ts
 *
 * Feature 03 — Tool System & Calculator Tool Verification
 *
 * Run with:
 *   npx tsx tools/calculator/test.ts
 */

import { calculatorTool, calculate } from "./index.js";

const PASS = "✅ PASS";
const FAIL = "❌ FAIL";

async function runTests(): Promise<void> {
  let passed = 0;
  let failed = 0;

  console.log("\n=== Feature 03 — Tool System & Calculator Tool Tests ===\n");

  // ── Test 1: Tool Metadata ────────────────────────────────────────────────
  try {
    if (calculatorTool.name !== "calculator") {
      throw new Error(`Expected name "calculator", got "${calculatorTool.name}"`);
    }
    if (!calculatorTool.description) {
      throw new Error("Tool description is missing");
    }
    console.log(`${PASS} Test 1: Calculator tool metadata verified (name: "${calculatorTool.name}")`);
    passed++;
  } catch (err) {
    console.log(`${FAIL} Test 1: ${(err as Error).message}`);
    failed++;
  }

  // ── Test 2: Add Operation ─────────────────────────────────────────────────
  try {
    const directResult = calculate({ operation: "add", a: 15, b: 27 });
    if (directResult !== 42) {
      throw new Error(`Expected 42, got ${directResult}`);
    }
    const toolResult = await calculatorTool.invoke({ operation: "add", a: 15, b: 27 });
    if (toolResult !== "42") {
      throw new Error(`Expected "42", got "${toolResult}"`);
    }
    console.log(`${PASS} Test 2: Addition (15 + 27 = 42)`);
    passed++;
  } catch (err) {
    console.log(`${FAIL} Test 2: ${(err as Error).message}`);
    failed++;
  }

  // ── Test 3: Subtract Operation ────────────────────────────────────────────
  try {
    const directResult = calculate({ operation: "subtract", a: 100, b: 35 });
    if (directResult !== 65) {
      throw new Error(`Expected 65, got ${directResult}`);
    }
    const toolResult = await calculatorTool.invoke({ operation: "subtract", a: 100, b: 35 });
    if (toolResult !== "65") {
      throw new Error(`Expected "65", got "${toolResult}"`);
    }
    console.log(`${PASS} Test 3: Subtraction (100 - 35 = 65)`);
    passed++;
  } catch (err) {
    console.log(`${FAIL} Test 3: ${(err as Error).message}`);
    failed++;
  }

  // ── Test 4: Multiply Operation ────────────────────────────────────────────
  try {
    const directResult = calculate({ operation: "multiply", a: 7, b: 8 });
    if (directResult !== 56) {
      throw new Error(`Expected 56, got ${directResult}`);
    }
    const toolResult = await calculatorTool.invoke({ operation: "multiply", a: 7, b: 8 });
    if (toolResult !== "56") {
      throw new Error(`Expected "56", got "${toolResult}"`);
    }
    console.log(`${PASS} Test 4: Multiplication (7 * 8 = 56)`);
    passed++;
  } catch (err) {
    console.log(`${FAIL} Test 4: ${(err as Error).message}`);
    failed++;
  }

  // ── Test 5: Divide Operation ─────────────────────────────────────────────
  try {
    const directResult = calculate({ operation: "divide", a: 81, b: 9 });
    if (directResult !== 9) {
      throw new Error(`Expected 9, got ${directResult}`);
    }
    const toolResult = await calculatorTool.invoke({ operation: "divide", a: 81, b: 9 });
    if (toolResult !== "9") {
      throw new Error(`Expected "9", got "${toolResult}"`);
    }
    console.log(`${PASS} Test 5: Division (81 / 9 = 9)`);
    passed++;
  } catch (err) {
    console.log(`${FAIL} Test 5: ${(err as Error).message}`);
    failed++;
  }

  // ── Test 6: Division by Zero Error ───────────────────────────────────────
  try {
    let threw = false;
    try {
      calculate({ operation: "divide", a: 10, b: 0 });
    } catch {
      threw = true;
    }
    if (!threw) {
      throw new Error("Expected calculate to throw on division by zero");
    }
    console.log(`${PASS} Test 6: Division by zero properly throws error`);
    passed++;
  } catch (err) {
    console.log(`${FAIL} Test 6: ${(err as Error).message}`);
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
