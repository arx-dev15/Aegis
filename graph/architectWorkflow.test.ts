/**
 * graph/architectWorkflow.test.ts
 *
 * Feature 11 — Architect Agent Graph Workflow Tests
 *
 * Run with:
 *   npx tsx graph/architectWorkflow.test.ts
 */

import { buildArchitectWorkflow } from "./architectWorkflow.js";
import { createArchitectNode } from "./nodes/architectNode.js";
import { ArchitectAgent } from "../agents/architect/architect.js";
import type { ArchitectModel } from "../agents/architect/architect.js";

const PASS = "✅ PASS";
const FAIL = "❌ FAIL";

const mockArchitectModel: ArchitectModel = {
  async generateStructured<T>(_systemPrompt: string, _userPrompt: string, _schema: unknown): Promise<T> {
    return {
      title: "Microservice Auth Architecture",
      summary: "Designed auth service using OAuth2 JWT specification.",
      components: [
        {
          name: "AuthServer",
          type: "new",
          description: "Issues JWT access tokens.",
          responsibilities: ["Authenticate user", "Sign JWT"],
        },
      ],
      dataFlow: ["Client -> AuthServer -> Client (token)"],
      dependencies: ["jose"],
      risks: ["Token signing key leakage"],
      verificationPlan: ["Unit test token generation"],
    } as unknown as T;
  },
};

async function runTests(): Promise<void> {
  let passed = 0;
  let failed = 0;

  console.log("\n=== Feature 11 — Architect Agent Graph Workflow Tests ===\n");

  const mockArchitectAgent = new ArchitectAgent(mockArchitectModel);
  const mockArchitectNode = createArchitectNode(mockArchitectAgent);
  const testGraph = buildArchitectWorkflow(mockArchitectNode).compile();

  // ── Test 1: Successful design generation through graph ─────────────────
  try {
    console.log('Test 1: Graph execution for architecture task ("Design Auth Service")...');
    const result = await testGraph.invoke({ task: "Design Auth Service" });

    if (result.status !== "architecting") {
      throw new Error(`Expected status "architecting", got "${result.status}"`);
    }
    if (!result.architecture || !result.architecture.includes("Title: Microservice Auth Architecture")) {
      throw new Error(`Architecture content mismatch: ${result.architecture}`);
    }
    if (!result.architecture.includes("AuthServer")) {
      throw new Error(`Expected component "AuthServer" in architecture state`);
    }

    console.log(`       Final Status: "${result.status}"`);
    console.log(`       Architecture Length: ${result.architecture.length} chars`);
    console.log(`${PASS} Test 1: Task entered graph -> Architect generated design -> architecture stored in AegisState`);
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
