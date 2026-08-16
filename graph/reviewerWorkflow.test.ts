/**
 * graph/reviewerWorkflow.test.ts
 *
 * Feature 14 — Reviewer Agent Graph Workflow Tests
 *
 * Run with:
 *   npx tsx graph/reviewerWorkflow.test.ts
 */

import { buildReviewerWorkflow } from "./reviewerWorkflow.js";
import { createReviewerNode } from "./nodes/reviewerNode.js";
import { ReviewerAgent } from "../agents/reviewer/reviewer.js";
import type { ReviewerModel } from "../agents/reviewer/reviewer.js";

const PASS = "✅ PASS";
const FAIL = "❌ FAIL";

const mockReviewerModel: ReviewerModel = {
  async generateStructured<T>(_systemPrompt: string, _userPrompt: string, _schema: unknown): Promise<T> {
    return {
      task: "Review Auth Middleware Implementation",
      summary: "Approved with minor suggestions.",
      approved: true,
      findings: [
        {
          id: "finding-1",
          severity: "suggestion",
          issue: "Unused import",
          recommendation: "Remove unused import.",
        },
      ],
      acceptedAspects: ["Good type safety"],
      recommendation: "approve",
    } as unknown as T;
  },
};

async function runTests(): Promise<void> {
  let passed = 0;
  let failed = 0;

  console.log("\n=== Feature 14 — Reviewer Agent Graph Workflow Tests ===\n");

  const mockReviewerAgent = new ReviewerAgent(mockReviewerModel);
  const mockReviewerNode = createReviewerNode(mockReviewerAgent);
  const testGraph = buildReviewerWorkflow(mockReviewerNode).compile();

  // ── Test 1: Successful review results generation through graph ───────────
  try {
    console.log('Test 1: Graph execution for reviewer task ("Review Auth Middleware Implementation")...');
    const result = await testGraph.invoke({ task: "Review Auth Middleware Implementation" });

    if (result.status !== "reviewing") {
      throw new Error(`Expected status "reviewing", got "${result.status}"`);
    }
    if (!result.reviewResults || !result.reviewResults.approved) {
      throw new Error(`Expected reviewResults.approved = true, got ${JSON.stringify(result.reviewResults)}`);
    }
    if (result.reviewResults.comments.length !== 1) {
      throw new Error(`Expected 1 comment, got ${result.reviewResults.comments.length}`);
    }

    console.log(`       Final Status: "${result.status}"`);
    console.log(`       Review Approved: ${result.reviewResults.approved}`);
    console.log(`${PASS} Test 1: Task entered graph -> Reviewer generated review output -> stored in AegisState.reviewResults`);
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
