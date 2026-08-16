/**
 * runDemo.ts
 *
 * Aegis Live Multi-Agent Workflow Runner
 *
 * Runs the compiled multiAgentGraph with live Gemini AI models and outputs
 * formatted results for all 7 specialized engineering agents.
 *
 * Command to run:
 *   npx tsx runDemo.ts
 */

import { multiAgentGraph } from "./graph/index.js";

async function runLiveMission() {
  const mission = "Build a rate-limiting middleware for Express API routes using Redis";

  console.log("=================================================");
  console.log("  AEGIS MULTI-AGENT ENGINE — LIVE MISSION");
  console.log("=================================================");
  console.log(`Mission Goal: "${mission}"\n`);
  console.log("Executing 7-Agent Orchestration Flow (Planner -> Researcher -> Architect -> Developer -> Tester -> Reviewer -> Security)...\n");

  const startTime = Date.now();

  try {
    const result = await multiAgentGraph.invoke({ task: mission });
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log("\n=================================================");
    console.log(` MISSION COMPLETE (${duration}s) — STATUS: ${result.status.toUpperCase()}`);
    console.log("=================================================\n");

    console.log("-------------------------------------------------");
    console.log("1. PLANNER AGENT OUTPUT");
    console.log("-------------------------------------------------");
    console.log(`Steps (${result.plan.length}):`);
    result.plan.forEach((step, idx) => {
      console.log(`  ${idx + 1}. [${step.status.toUpperCase()}] ${step.description}`);
    });

    console.log("\n-------------------------------------------------");
    console.log("2. RESEARCHER AGENT OUTPUT");
    console.log("-------------------------------------------------");
    console.log(result.research || "No research findings recorded.");

    console.log("\n-------------------------------------------------");
    console.log("3. ARCHITECT AGENT OUTPUT");
    console.log("-------------------------------------------------");
    console.log(result.architecture || "No architecture specification recorded.");

    console.log("\n-------------------------------------------------");
    console.log("4. DEVELOPER AGENT OUTPUT");
    console.log("-------------------------------------------------");
    console.log(`File Changes (${result.codeChanges.length}):`);
    result.codeChanges.forEach((change, idx) => {
      console.log(`\n--- Change #${idx + 1}: ${change.path} (${change.action.toUpperCase()}) ---`);
      if (change.summary) console.log(`Summary: ${change.summary}`);
      if (change.content) console.log(`Content Preview:\n${change.content.slice(0, 300)}...`);
    });

    console.log("\n-------------------------------------------------");
    console.log("5. TESTER AGENT OUTPUT");
    console.log("-------------------------------------------------");
    if (result.testResults) {
      console.log(`Status: ${result.testResults.passed ? "PASSED" : "FAILED"}`);
      console.log(`Tests: ${result.testResults.passedTests}/${result.testResults.totalTests} passed`);
      console.log(`Summary: ${result.testResults.output}`);
    } else {
      console.log("No test results recorded.");
    }

    console.log("\n-------------------------------------------------");
    console.log("6. REVIEWER AGENT OUTPUT");
    console.log("-------------------------------------------------");
    if (result.reviewResults) {
      console.log(`Approved: ${result.reviewResults.approved}`);
      console.log("Comments:");
      result.reviewResults.comments.forEach((comment) => console.log(`  - ${comment}`));
    } else {
      console.log("No review results recorded.");
    }

    console.log("\n=================================================");
    console.log("  END OF MISSION REPORT");
    console.log("=================================================\n");
  } catch (err) {
    console.error("\n❌ Mission execution failed:", (err as Error).message);
  }
}

runLiveMission();
