/**
 * graph/securityWorkflow.test.ts
 *
 * Feature 15 — Security Agent Graph Workflow Tests
 *
 * Run with:
 *   npx tsx graph/securityWorkflow.test.ts
 */

import { buildSecurityWorkflow } from "./securityWorkflow.js";
import { createSecurityNode } from "./nodes/securityNode.js";
import { SecurityAgent } from "../agents/security/security.js";
import type { SecurityModel } from "../agents/security/security.js";

const PASS = "✅ PASS";
const FAIL = "❌ FAIL";

const mockSecurityModel: SecurityModel = {
  async generateStructured<T>(_systemPrompt: string, _userPrompt: string, _schema: unknown): Promise<T> {
    return {
      task: "Audit Auth Middleware Implementation",
      summary: "Security audit clean.",
      secure: true,
      vulnerabilities: [],
      recommendations: ["Use HTTPS"],
    } as unknown as T;
  },
};

async function runTests(): Promise<void> {
  let passed = 0;
  let failed = 0;

  console.log("\n=== Feature 15 — Security Agent Graph Workflow Tests ===\n");

  const mockSecurityAgent = new SecurityAgent(mockSecurityModel);
  const mockSecurityNode = createSecurityNode(mockSecurityAgent);
  const testGraph = buildSecurityWorkflow(mockSecurityNode).compile();

  // ── Test 1: Successful security audit results generation through graph ─────
  try {
    console.log('Test 1: Graph execution for security audit task ("Audit Auth Middleware Implementation")...');
    const result = await testGraph.invoke({ task: "Audit Auth Middleware Implementation" });

    if (result.status !== "completed") {
      throw new Error(`Expected status "completed", got "${result.status}"`);
    }
    if (!result.research || !result.research.includes("Security Status: SECURE")) {
      throw new Error(`Expected Security Status: SECURE in state.research, got: ${result.research}`);
    }

    console.log(`       Final Status: "${result.status}"`);
    console.log(`       Research Output Contains Security Audit: true`);
    console.log(`${PASS} Test 1: Task entered graph -> Security Agent audited implementation -> stored in AegisState`);
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
