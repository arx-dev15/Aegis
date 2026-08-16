/**
 * graph/researcherWorkflow.test.ts
 *
 * Feature 10 — Researcher Agent Graph Workflow Tests
 *
 * Run with:
 *   npx tsx graph/researcherWorkflow.test.ts
 */

import { buildResearcherWorkflow } from "./researcherWorkflow.js";
import { createResearcherNode } from "./nodes/researcherNode.js";
import { ResearcherAgent } from "../agents/researcher/researcher.js";
import type { ResearcherModel } from "../agents/researcher/researcher.js";

const PASS = "✅ PASS";
const FAIL = "❌ FAIL";

const mockResearcherModel: ResearcherModel = {
  async generateStructured<T>(_systemPrompt: string, _userPrompt: string, _schema: unknown): Promise<T> {
    return {
      objective: "Investigate authentication options",
      summary: "Evaluated OAuth2 vs JWT for user session auth.",
      findings: [
        {
          id: "finding-1",
          topic: "JWT Statelessness",
          finding: "JWT tokens allow stateless authorization.",
          evidence: "Standard RFC 7519 specification.",
        },
      ],
      constraints: ["Tokens must expire within 15 minutes."],
      unknowns: ["Refresh token storage mechanism."],
      risks: ["Secret key leaks compromise token signatures."],
    } as unknown as T;
  },
};

async function runTests(): Promise<void> {
  let passed = 0;
  let failed = 0;

  console.log("\n=== Feature 10 — Researcher Agent Graph Workflow Tests ===\n");

  const mockResearcherAgent = new ResearcherAgent(mockResearcherModel);
  const mockResearcherNode = createResearcherNode(mockResearcherAgent);
  const testGraph = buildResearcherWorkflow(mockResearcherNode).compile();

  // ── Test 1: Successful research generation through graph ─────────────────
  try {
    console.log('Test 1: Graph execution for research objective ("Investigate authentication options")...');
    const result = await testGraph.invoke({ task: "Investigate authentication options" });

    if (result.status !== "researching") {
      throw new Error(`Expected status "researching", got "${result.status}"`);
    }
    if (!result.research || !result.research.includes("Research Objective: Investigate authentication options")) {
      throw new Error(`Research content mismatch: ${result.research}`);
    }
    if (!result.research.includes("JWT Statelessness")) {
      throw new Error(`Expected finding "JWT Statelessness" in research state`);
    }

    console.log(`       Final Status: "${result.status}"`);
    console.log(`       Research Text Length: ${result.research.length} chars`);
    console.log(`${PASS} Test 1: Task entered graph -> Researcher generated findings -> research stored in AegisState`);
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
