/**
 * testAll.ts
 *
 * Aegis Master Test Runner — Runs all unit and workflow test suites for Features 01–18.
 *
 * Command:
 *   npx tsx testAll.ts
 */

import { execSync } from "child_process";

const testFiles = [
  // Agent Unit Tests (Features 09–15)
  "agents/planner/test.ts",
  "agents/researcher/test.ts",
  "agents/architect/test.ts",
  "agents/developer/test.ts",
  "agents/tester/test.ts",
  "agents/reviewer/test.ts",
  "agents/security/test.ts",

  // Agent Node & Workflow Tests (Features 09–15)
  "graph/plannerWorkflow.test.ts",
  "graph/researcherWorkflow.test.ts",
  "graph/architectWorkflow.test.ts",
  "graph/developerWorkflow.test.ts",
  "graph/testerWorkflow.test.ts",
  "graph/reviewerWorkflow.test.ts",
  "graph/securityWorkflow.test.ts",

  // Master Multi-Agent Workflow Test (Feature 16)
  "graph/multiAgentWorkflow.test.ts",

  // Agent Routing & Conditional Execution Tests (Feature 17)
  "graph/edges/agentRouter.test.ts",
  "graph/dynamicRoutingWorkflow.test.ts",

  // Failure Recovery + Iteration Loops Tests (Feature 18)
  "graph/failureRecovery.test.ts",
];

function runAll() {
  console.log("=================================================");
  console.log("  AEGIS MASTER TEST SUITE (Features 01 – 18)");
  console.log("=================================================\n");

  let totalPassed = 0;
  let totalFailed = 0;

  for (const file of testFiles) {
    process.stdout.write(`Running ${file.padEnd(38)} ... `);
    try {
      execSync(`npx tsx ${file}`, { stdio: "pipe" });
      console.log("✅ PASSED");
      totalPassed++;
    } catch (err) {
      console.log("❌ FAILED");
      totalFailed++;
    }
  }

  console.log("\n=================================================");
  console.log(` SUMMARY: ${totalPassed} suites passed, ${totalFailed} suites failed.`);
  console.log("=================================================\n");

  if (totalFailed > 0) {
    process.exit(1);
  }
}

runAll();
