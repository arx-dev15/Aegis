/**
 * testAll.ts
 *
 * Aegis Master Test Runner — Runs all unit and workflow test suites for Features 01–20.
 *
 * Command:
 *   npx tsx testAll.ts
 */

import { execSync } from "child_process";

const testFiles = [
  // Agent Unit Tests (Features 09–15)
  "src/workflows/agents/planner/test.ts",
  "src/workflows/agents/researcher/test.ts",
  "src/workflows/agents/architect/test.ts",
  "src/workflows/agents/developer/test.ts",
  "src/workflows/agents/tester/test.ts",
  "src/workflows/agents/reviewer/test.ts",
  "src/workflows/agents/security/test.ts",

  // Agent Node & Workflow Tests (Features 09–15)
  "src/workflows/plannerWorkflow.test.ts",
  "src/workflows/researcherWorkflow.test.ts",
  "src/workflows/architectWorkflow.test.ts",
  "src/workflows/developerWorkflow.test.ts",
  "src/workflows/testerWorkflow.test.ts",
  "src/workflows/reviewerWorkflow.test.ts",
  "src/workflows/securityWorkflow.test.ts",

  // Master Multi-Agent Workflow Test (Feature 16)
  "src/workflows/multiAgentWorkflow.test.ts",

  // Agent Routing & Conditional Execution Tests (Feature 17)
  "src/workflows/edges/agentRouter.test.ts",
  "src/workflows/dynamicRoutingWorkflow.test.ts",

  // Failure Recovery + Iteration Loops Tests (Feature 18)
  "src/workflows/failureRecovery.test.ts",

  // RAG Pipeline Tests (Feature 19)
  "src/context/rag/rag.test.ts",

  // Project Knowledge Retrieval Tests (Feature 20)
  "src/context/rag/projectKnowledge.test.ts",

  // Memory Layer Tests (Features 21 & 22)
  "src/context/memory/memory.test.ts",

  // Human-in-the-Loop Approval & Verification Tests (Feature 23 & R04)
  "src/runtime/approvalWorkflow.test.ts",
  "src/verification/workspaceEvidence.test.ts",

  // Tool Permissions / Guardrails Tests (Feature 24)
  "src/security/guardrails.test.ts",

  // GitHub Integration Tests (Feature 25)
  "src/tools/github/github.test.ts",

  // Repository Intelligence Engine Tests (Feature 26)
  "src/intelligence/repoIntelligence.test.ts",

  // Controlled Host Execution Tests (Feature 28)
  "src/tools/terminal/terminal.test.ts",
  "src/workflows/terminalWorkflow.test.ts",
  "tests/acceptance/execution-boundary.acceptance.test.ts",
  "tests/acceptance/sandbox-execution.acceptance.test.ts",
  "tests/acceptance/core-reliability-hardening.acceptance.test.ts",

  // Acceptance Tests: Native FIX and Self-Repair
  "tests/acceptance/native-fix-real-bug.acceptance.test.ts",
  "tests/acceptance/native-repair-loop.acceptance.test.ts",
  "tests/acceptance/cli-interactive.acceptance.test.ts",
  "tests/acceptance/cli-conversational.acceptance.test.ts",
  "tests/acceptance/api-canonical-lifecycle.acceptance.test.ts",
  "tests/acceptance/native-intelligence-context.acceptance.test.ts",
  "tests/acceptance/native-intelligence-coherence.acceptance.test.ts",
  "tests/acceptance/unified-system-integration.acceptance.test.ts",
  "tests/acceptance/cli-premium-terminal.acceptance.test.ts",
  "tests/acceptance/conversational-routing-repair.acceptance.test.ts",
  "tests/acceptance/universal-provider-protocol.acceptance.test.ts",
  "tests/acceptance/canonical-runtime-sprint01.acceptance.test.ts",
  "tests/acceptance/adversarial-execution-mechanics.acceptance.test.ts",
];

function runAll() {
  console.log("=================================================");
  console.log("  AEGIS MASTER TEST SUITE (Features 01 – 26)");
  console.log("=================================================\n");

  let totalPassed = 0;
  let totalFailed = 0;

  for (const file of testFiles) {
    process.stdout.write(`Running ${file.padEnd(38)} ... `);
    try {
      execSync(`npx tsx ${file}`, {
        cwd: __dirname,
        stdio: "pipe",
        timeout: 120_000,
      });
      console.log("✅ PASSED");
      totalPassed++;
    } catch (err) {
      console.log("❌ FAILED");
      const failure = err as {
        message?: string;
        stdout?: Buffer | string;
        stderr?: Buffer | string;
      };
      if (failure.message) console.error(`  ${failure.message}`);
      if (failure.stdout) process.stderr.write(String(failure.stdout));
      if (failure.stderr) process.stderr.write(String(failure.stderr));
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
