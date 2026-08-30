/**
 * runDemo.ts
 *
 * Aegis Live Multi-Agent Workflow Runner
 *
 * Demonstrates the full 7-agent orchestration with TWO execution modes:
 *
 * Mode 1 — Real Execution (default):
 *   - Developer agent writes actual files to a temporary workspace directory.
 *   - Tester agent runs a real shell command and captures stdout/stderr.
 *   - Gemini interprets real output into structured results.
 *
 * Mode 2 — Simulation:
 *   - Set AEGIS_SIMULATE=true in environment to skip real I/O.
 *   - Gemini generates descriptions without writing or running anything.
 *   - Useful for quick demos without a configured project.
 *
 * Command:
 *   npx tsx runDemo.ts
 *   AEGIS_SIMULATE=true npx tsx runDemo.ts
 */

import { multiAgentGraph, buildMultiAgentWorkflow } from "./graph/index.js";
import os from "os";
import path from "path";
import { promises as fs } from "fs";

const SIMULATE = process.env["AEGIS_SIMULATE"] === "true";

async function runLiveMission() {
  const mission =
    "Build a rate-limiting middleware for Express API routes using an in-memory token bucket";

  console.log("=================================================");
  console.log("  AEGIS MULTI-AGENT ENGINE — LIVE MISSION");
  console.log("=================================================");
  console.log(`Mission Goal: "${mission}"`);
  console.log(
    `Execution Mode: ${SIMULATE ? "SIMULATION (no disk writes)" : "REAL EXECUTION (files + terminal)"}`
  );
  console.log(
    "Flow: Planner → Researcher → Architect → Developer → Tester → Reviewer → Security\n"
  );

  // ── Workspace setup (real execution only) ────────────────────────────────
  let workspace = "";

  if (!SIMULATE) {
    workspace = path.join(os.tmpdir(), `aegis-mission-${Date.now()}`);
    await fs.mkdir(workspace, { recursive: true });
    console.log(`📂 Workspace: ${workspace}\n`);
  }

  const startTime = Date.now();

  try {
    const graph = SIMULATE
      ? multiAgentGraph
      : buildMultiAgentWorkflow(
          {},
          {
            // Developer uses lower temperature for precise code generation
            developer: { temperature: 0.1 },
            // Tester slightly more analytical
            tester: { temperature: 0.2 },
          }
        ).compile();

    const result = await graph.invoke({
      task: mission,
      workspace, // empty string = simulation, real path = execution mode
    });

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log("\n=================================================");
    console.log(` MISSION COMPLETE (${duration}s) — STATUS: ${result.status.toUpperCase()}`);
    console.log("=================================================\n");

    // ── 1. Planner ───────────────────────────────────────────────────────
    console.log("-------------------------------------------------");
    console.log("1. PLANNER AGENT OUTPUT");
    console.log("-------------------------------------------------");
    console.log(`Steps (${result.plan.length}):`);
    result.plan.forEach((step, idx) => {
      console.log(`  ${idx + 1}. [${step.status.toUpperCase()}] ${step.description}`);
    });

    // ── 2. Researcher ────────────────────────────────────────────────────
    console.log("\n-------------------------------------------------");
    console.log("2. RESEARCHER + CONTEXT OUTPUT");
    console.log("-------------------------------------------------");
    console.log(result.research || "No research findings recorded.");

    // ── 3. Architect ─────────────────────────────────────────────────────
    console.log("\n-------------------------------------------------");
    console.log("3. ARCHITECT AGENT OUTPUT");
    console.log("-------------------------------------------------");
    console.log(result.architecture || "No architecture specification recorded.");

    // ── 4. Developer ─────────────────────────────────────────────────────
    console.log("\n-------------------------------------------------");
    console.log("4. DEVELOPER AGENT OUTPUT");
    console.log("-------------------------------------------------");
    console.log(`File Changes Planned (${result.codeChanges.length}):`);
    result.codeChanges.forEach((change, idx) => {
      console.log(`\n--- Change #${idx + 1}: ${change.path} (${change.action.toUpperCase()}) ---`);
      if (change.summary) console.log(`Summary: ${change.summary}`);
      if (change.content) {
        console.log(`Content Preview:\n${change.content.slice(0, 400)}${change.content.length > 400 ? "\n..." : ""}`);
      }
    });

    // ── 5. Tester ────────────────────────────────────────────────────────
    console.log("\n-------------------------------------------------");
    console.log("5. TESTER AGENT OUTPUT");
    console.log("-------------------------------------------------");
    if (result.testResults) {
      console.log(`Status: ${result.testResults.passed ? "✅ PASSED" : "❌ FAILED"}`);
      console.log(`Tests: ${result.testResults.passedTests}/${result.testResults.totalTests} passed`);
      console.log(`Summary: ${result.testResults.output}`);
    } else {
      console.log("No test results recorded.");
    }

    // ── 6. Reviewer ──────────────────────────────────────────────────────
    console.log("\n-------------------------------------------------");
    console.log("6. REVIEWER AGENT OUTPUT");
    console.log("-------------------------------------------------");
    if (result.reviewResults) {
      console.log(`Approved: ${result.reviewResults.approved ? "✅ YES" : "❌ NO"}`);
      console.log("Comments:");
      result.reviewResults.comments.forEach((comment) => console.log(`  - ${comment}`));
    } else {
      console.log("No review results recorded.");
    }

    // ── 7. Execution Log (real mode only) ────────────────────────────────
    if (result.executionLog && result.executionLog.length > 0) {
      console.log("\n-------------------------------------------------");
      console.log("7. REAL TOOL EXECUTION LOG");
      console.log("-------------------------------------------------");
      result.executionLog.forEach((entry) => console.log(entry));
    }

    // ── Errors (if any) ──────────────────────────────────────────────────
    if (result.errors && result.errors.length > 0) {
      console.log("\n-------------------------------------------------");
      console.log("⚠️  ERRORS / WARNINGS");
      console.log("-------------------------------------------------");
      result.errors.forEach((e) => console.log(`  • ${e}`));
    }

    // ── Workspace summary ────────────────────────────────────────────────
    if (workspace) {
      console.log("\n-------------------------------------------------");
      console.log("📂 WORKSPACE CONTENTS");
      console.log("-------------------------------------------------");
      console.log(`Location: ${workspace}`);
      try {
        const entries = await fs.readdir(workspace, { recursive: true } as Parameters<typeof fs.readdir>[1]);
        if (entries.length > 0) {
          (entries as string[]).forEach((f) => console.log(`  ${f}`));
        } else {
          console.log("  (empty — Developer agent may not have generated file content)");
        }
      } catch {
        console.log("  (unable to list workspace)");
      }
    }

    console.log("\n=================================================");
    console.log(`  RETRY CYCLES: ${result.retryCount ?? 0}`);
    console.log("  END OF MISSION REPORT");
    console.log("=================================================\n");
  } catch (err) {
    console.error("\n❌ Mission execution failed:", (err as Error).message);
    console.error((err as Error).stack);
  }
}

runLiveMission();
