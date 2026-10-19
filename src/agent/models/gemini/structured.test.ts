/**
 * models/gemini/structured.test.ts
 *
 * Feature 02 — Structured Output verification.
 *
 * Run with:
 *   npx tsx models/gemini/structured.test.ts
 *
 * Tests:
 *  1. Simple flat object schema — title + confidence score
 *  2. Nested object with an array — a minimal task plan
 *  3. Schema with an enum field
 *  4. Optional field handling
 */

import { z } from "zod";
import { callStructured } from "./structured.js";

const PASS = "✅ PASS";
const FAIL = "❌ FAIL";

async function runTests(): Promise<void> {
  let passed = 0;
  let failed = 0;

  console.log("\n=== Feature 02 — Structured Output Tests ===\n");

  // ── Test 1: Simple flat object ────────────────────────────────────────────
  const SummarySchema = z.object({
    title:      z.string(),
    confidence: z.number(),
  });

  try {
    console.log("Test 1: Simple flat object (title + confidence)...");
    const result = await callStructured(
      "Describe the purpose of a code linter in one sentence. " +
      "Return a title and a confidence score (0.0–1.0) for your answer.",
      SummarySchema,
    );

    if (typeof result.title !== "string" || result.title.length === 0) {
      throw new Error(`title is not a non-empty string: ${JSON.stringify(result.title)}`);
    }
    if (typeof result.confidence !== "number") {
      throw new Error(`confidence is not a number: ${JSON.stringify(result.confidence)}`);
    }

    console.log(`       title:      "${result.title}"`);
    console.log(`       confidence: ${result.confidence}`);
    console.log(`${PASS} Test 1: Simple schema returned correctly typed object`);
    passed++;
  } catch (err) {
    console.log(`${FAIL} Test 1: ${(err as Error).message}`);
    failed++;
  }

  // ── Test 2: Nested object with array ─────────────────────────────────────
  const TaskPlanSchema = z.object({
    goal:  z.string(),
    steps: z.array(z.string()),
    estimatedMinutes: z.number(),
  });

  try {
    console.log("\nTest 2: Nested object with array (task plan)...");
    const result = await callStructured(
      "Create a short plan (3 steps) to add unit tests to an Express API route.",
      TaskPlanSchema,
    );

    if (!Array.isArray(result.steps) || result.steps.length === 0) {
      throw new Error(`steps is not a non-empty array: ${JSON.stringify(result.steps)}`);
    }
    if (typeof result.estimatedMinutes !== "number") {
      throw new Error(`estimatedMinutes is not a number`);
    }

    console.log(`       goal:  "${result.goal}"`);
    console.log(`       steps: ${result.steps.length} steps`);
    console.log(`       time:  ${result.estimatedMinutes} mins`);
    console.log(`${PASS} Test 2: Nested schema with array returned correctly`);
    passed++;
  } catch (err) {
    console.log(`${FAIL} Test 2: ${(err as Error).message}`);
    failed++;
  }

  // ── Test 3: Enum field ────────────────────────────────────────────────────
  const ReviewSchema = z.object({
    verdict:  z.enum(["approve", "request_changes", "comment"]),
    reason:   z.string(),
  });

  try {
    console.log("\nTest 3: Enum field (code review verdict)...");
    const result = await callStructured(
      "Review this code change: a developer added a console.log() to production code. " +
      "Give a code review verdict and a brief reason.",
      ReviewSchema,
    );

    const validVerdicts = ["approve", "request_changes", "comment"];
    if (!validVerdicts.includes(result.verdict)) {
      throw new Error(`verdict "${result.verdict}" not in enum`);
    }

    console.log(`       verdict: "${result.verdict}"`);
    console.log(`       reason:  "${result.reason}"`);
    console.log(`${PASS} Test 3: Enum field returned a valid enum value`);
    passed++;
  } catch (err) {
    console.log(`${FAIL} Test 3: ${(err as Error).message}`);
    failed++;
  }

  // ── Test 4: Optional field ────────────────────────────────────────────────
  const AgentResultSchema = z.object({
    success:    z.boolean(),
    output:     z.string(),
    errorMessage: z.optional(z.string()),
  });

  try {
    console.log("\nTest 4: Optional field (agent result with optional error)...");
    const result = await callStructured(
      "Simulate a successful agent run that generated a README file. " +
      "Return success=true, a short output message, and no errorMessage.",
      AgentResultSchema,
    );

    if (typeof result.success !== "boolean") {
      throw new Error(`success is not a boolean`);
    }

    console.log(`       success:      ${result.success}`);
    console.log(`       output:       "${result.output}"`);
    console.log(`       errorMessage: ${result.errorMessage ?? "(not set)"}`);
    console.log(`${PASS} Test 4: Optional field handled correctly`);
    passed++;
  } catch (err) {
    console.log(`${FAIL} Test 4: ${(err as Error).message}`);
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
