/**
 * graph/plannerWorkflow.test.ts
 *
 * Feature 09 — Planner Agent Graph Workflow Tests
 *
 * Run with:
 *   npx tsx graph/plannerWorkflow.test.ts
 */

import { buildPlannerWorkflow } from "./plannerWorkflow.js";
import { createPlannerNode } from "./nodes/plannerNode.js";
import { PlannerAgent } from "../agents/planner/planner.js";
import type { PlannerModel } from "../agents/planner/planner.js";

const PASS = "✅ PASS";
const FAIL = "❌ FAIL";

const mockPlannerModel: PlannerModel = {
  async generateStructured<T>(_systemPrompt: string, _userPrompt: string, _schema: unknown): Promise<T> {
    return {
      goal: "Implement authentication system",
      summary: "Add JWT-based user authentication and route protection.",
      steps: [
        {
          id: "step-1",
          title: "Design JWT Auth Schema",
          description: "Define user data structure and payload schema.",
          dependencies: [],
          verification: "Verify Zod types for payload.",
        },
        {
          id: "step-2",
          title: "Implement Auth Middleware",
          description: "Add request header token verification.",
          dependencies: ["step-1"],
          verification: "Run auth middleware unit tests.",
        },
      ],
      risks: ["Token expiration handling might cause session drops."],
      verificationStrategy: ["Run middleware tests.", "Run API endpoint tests."],
    } as unknown as T;
  },
};

async function runTests(): Promise<void> {
  let passed = 0;
  let failed = 0;

  console.log("\n=== Feature 09 — Planner Agent Graph Workflow Tests ===\n");

  const mockPlannerAgent = new PlannerAgent(mockPlannerModel);
  const mockPlannerNode = createPlannerNode(mockPlannerAgent);
  const testGraph = buildPlannerWorkflow(mockPlannerNode).compile();

  // ── Test 1: Successful plan generation through graph ─────────────────────
  try {
    console.log('Test 1: Graph execution for planning goal ("Implement authentication system")...');
    const result = await testGraph.invoke({ task: "Implement authentication system" });

    if (result.status !== "planning") {
      throw new Error(`Expected status "planning", got "${result.status}"`);
    }
    if (!result.plan || result.plan.length !== 2) {
      throw new Error(`Expected 2 plan steps, got ${result.plan?.length}`);
    }
    if (result.plan[0].id !== "step-1" || !result.plan[0].description.includes("Design JWT Auth Schema")) {
      throw new Error(`Step 1 content mismatch: ${JSON.stringify(result.plan[0])}`);
    }
    if (!result.research || !result.research.includes("Plan Goal: Implement authentication system")) {
      throw new Error(`Research content mismatch: ${result.research}`);
    }

    console.log(`       Final Status: "${result.status}"`);
    console.log(`       Plan Steps: ${result.plan.length} steps generated`);
    console.log(`${PASS} Test 1: Task entered graph -> Planner generated structured plan -> steps & research stored in AegisState`);
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
