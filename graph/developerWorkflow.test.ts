/**
 * graph/developerWorkflow.test.ts
 *
 * Feature 12 — Developer Agent Graph Workflow Tests
 *
 * Run with:
 *   npx tsx graph/developerWorkflow.test.ts
 */

import { buildDeveloperWorkflow } from "./developerWorkflow.js";
import { createDeveloperNode } from "./nodes/developerNode.js";
import { DeveloperAgent } from "../agents/developer/developer.js";
import type { DeveloperModel } from "../agents/developer/developer.js";

const PASS = "✅ PASS";
const FAIL = "❌ FAIL";

const mockDeveloperModel: DeveloperModel = {
  async generateStructured<T>(_systemPrompt: string, _userPrompt: string, _schema: unknown): Promise<T> {
    return {
      task: "Implement JWT Token Middleware",
      summary: "Added auth middleware verifying Bearer tokens.",
      fileChanges: [
        {
          path: "apps/api/middleware/auth.ts",
          action: "add",
          summary: "Created JWT middleware function.",
          content: "export function authMiddleware() {}",
        },
      ],
      commandsExecuted: ["npx tsc --noEmit"],
      status: "completed",
    } as unknown as T;
  },
};

async function runTests(): Promise<void> {
  let passed = 0;
  let failed = 0;

  console.log("\n=== Feature 12 — Developer Agent Graph Workflow Tests ===\n");

  const mockDeveloperAgent = new DeveloperAgent(mockDeveloperModel);
  const mockDeveloperNode = createDeveloperNode(mockDeveloperAgent);
  const testGraph = buildDeveloperWorkflow(mockDeveloperNode).compile();

  // ── Test 1: Successful code changes generation through graph ──────────
  try {
    console.log('Test 1: Graph execution for developer task ("Implement JWT Token Middleware")...');
    const result = await testGraph.invoke({ task: "Implement JWT Token Middleware" });

    if (result.status !== "developing") {
      throw new Error(`Expected status "developing", got "${result.status}"`);
    }
    if (!result.codeChanges || result.codeChanges.length !== 1) {
      throw new Error(`Expected 1 code change, got ${result.codeChanges?.length}`);
    }
    if (result.codeChanges[0].path !== "apps/api/middleware/auth.ts") {
      throw new Error(`Code change path mismatch: ${result.codeChanges[0].path}`);
    }

    console.log(`       Final Status: "${result.status}"`);
    console.log(`       Code Changes Count: ${result.codeChanges.length}`);
    console.log(`${PASS} Test 1: Task entered graph -> Developer generated file changes -> stored in AegisState.codeChanges`);
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
