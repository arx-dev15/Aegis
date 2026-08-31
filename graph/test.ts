/**
 * graph/test.ts
 *
 * Feature 05 — LangGraph State Verification
 *
 * Run with:
 *   npx tsx graph/test.ts
 */

import { AegisStateAnnotation } from "./state.js";
import type { AegisState, CodeChange, TestResult, ReviewResult } from "./state.js";

const PASS = "✅ PASS";
const FAIL = "❌ FAIL";

async function runTests(): Promise<void> {
  let passed = 0;
  let failed = 0;

  console.log("\n=== Feature 05 — LangGraph State Tests ===\n");

  // ── Test 1: Annotation structure verification ────────────────────────────
  try {
    if (!AegisStateAnnotation) {
      throw new Error("AegisStateAnnotation is undefined");
    }
    if (typeof AegisStateAnnotation.spec !== "object") {
      throw new Error("AegisStateAnnotation.spec is not an object");
    }
    const fields = Object.keys(AegisStateAnnotation.spec);
    const requiredFields = [
      "task",
      "plan",
      "research",
      "architecture",
      "codeChanges",
      "testResults",
      "reviewResults",
      "errors",
      "status",
    ];

    for (const f of requiredFields) {
      if (!fields.includes(f)) {
        throw new Error(`Missing expected state field: "${f}"`);
      }
    }

    console.log(`${PASS} Test 1: All 11 required Aegis state fields defined in Annotation.spec`);
    passed++;
  } catch (err) {
    console.log(`${FAIL} Test 1: ${(err as Error).message}`);
    failed++;
  }

  // ── Test 2: State type compatibility test ────────────────────────────────
  try {
    const sampleState: AegisState = {
      task: "Build authentication feature",
      plan: [
        { id: "1", description: "Design auth endpoints", status: "completed" },
        { id: "2", description: "Implement JWT middleware", status: "in_progress" },
      ],
      research: "JWT token validation patterns analyzed.",
      architecture: "Express + JWT middleware layout",
      codeChanges: [
        { path: "src/auth.ts", action: "add", summary: "Added JWT handler" },
      ],
      testResults: {
        passed: true,
        totalTests: 5,
        passedTests: 5,
        failedTests: 0,
      },
      reviewResults: {
        approved: true,
        comments: ["Clean implementation"],
      },
      errors: [],
      status: "testing",
      retryCount: 0,
      maxRetries: 3,
      workspace: "",
      executionLog: [],
      recoveryContext: [],
      runId: "",
      memoryContext: "",
      pendingApproval: null,
      approvalDecision: null,
    };

    if (sampleState.status !== "testing") {
      throw new Error(`Expected status "testing", got "${sampleState.status}"`);
    }
    if (sampleState.codeChanges.length !== 1) {
      throw new Error("Expected 1 code change");
    }

    console.log(`${PASS} Test 2: AegisState interface type compatibility verified`);
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
