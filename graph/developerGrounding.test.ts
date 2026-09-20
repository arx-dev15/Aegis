/**
 * graph/developerGrounding.test.ts
 *
 * R01 — Repository-Grounded Developer Tests
 *
 * Verifies:
 *   TEST 1 — REAL WORKSPACE GROUNDING: Existing source files are read and passed to DeveloperAgent
 *   TEST 2 — BOUNDED CONTEXT: 30KB total budget limit and max 5 files limit enforced
 *   TEST 3 — EMPTY WORKSPACE: Workspace empty mode does not call readFile, preserving simulation mode
 *   TEST 4 — STALE/MISSING FILE: Missing candidate files do not crash the workflow and log warnings
 *   TEST 5 — RECOVERY RE-READ: Retry re-reads current workspace source from disk
 *
 * Run with:
 *   npx tsx graph/developerGrounding.test.ts
 */

import os from "os";
import path from "path";
import { promises as fs } from "fs";
import { createDeveloperNode, discoverAndReadExistingCode } from "./nodes/developerNode.js";
import { DeveloperAgent } from "../agents/developer/developer.js";
import type { DeveloperModel } from "../agents/developer/developer.js";
import type { AegisState } from "./state.js";

const PASS = "✅ PASS";
const FAIL = "❌ FAIL";

let lastCapturedPrompt = "";

const trackingDeveloperModel: DeveloperModel = {
  async generateStructured<T>(_systemPrompt: string, userPrompt: string, _schema: unknown): Promise<T> {
    lastCapturedPrompt = userPrompt;
    return {
      task: "Grounded Task",
      summary: "Grounded implementation",
      fileChanges: [
        {
          path: "src/math.ts",
          action: "modify",
          summary: "Added validation to add()",
          content: "export function add(a: number, b: number) {\n  if (typeof a !== 'number' || typeof b !== 'number') throw new TypeError();\n  return a + b;\n}",
        },
      ],
      commandsExecuted: [],
      status: "completed",
    } as unknown as T;
  },
};

async function runTests(): Promise<void> {
  let passed = 0;
  let failed = 0;

  console.log("\n=== R01 — Repository-Grounded Developer Tests ===\n");

  // Create temporary test workspace directory
  const testWs = path.join(os.tmpdir(), `aegis-r01-test-${Date.now()}`);
  await fs.mkdir(path.join(testWs, "src"), { recursive: true });

  const testFile1 = path.join("src", "math.ts");
  const initialCode = "export function add(a: number, b: number) {\n  return a + b;\n}";
  await fs.writeFile(path.join(testWs, testFile1), initialCode, "utf-8");

  const developerAgent = new DeveloperAgent(trackingDeveloperModel);
  const developerNode = createDeveloperNode(developerAgent);

  // ── TEST 1: Real Workspace Grounding ─────────────────────────────────────────
  try {
    console.log("Test 1: Real Workspace Grounding — Existing file read & passed to DeveloperAgent...");
    lastCapturedPrompt = "";

    const initialState: Partial<AegisState> = {
      task: "Add input validation to src/math.ts while keeping add(a, b) export",
      architecture: "Update src/math.ts to validate numbers",
      workspace: testWs,
      approvalDecision: { approvalId: "app-test", action: "approve", decidedAt: Date.now() },
    };

    const res = await developerNode(initialState as AegisState);
    const logs = (res.executionLog as string[]) ?? [];

    if (!logs.some((l: string) => l.includes("[DEV-INSPECT] Read src/math.ts"))) {
      throw new Error(`Execution log did not record reading src/math.ts. Log:\n${logs.join("\n")}`);
    }

    if (!lastCapturedPrompt.includes("EXISTING REPOSITORY SOURCE CODE:")) {
      throw new Error("Developer prompt did not contain 'EXISTING REPOSITORY SOURCE CODE:' block");
    }

    if (!lastCapturedPrompt.includes("export function add(a: number, b: number)")) {
      throw new Error("Developer prompt did not contain actual source code content from src/math.ts");
    }

    console.log(`       Captured Prompt Snippet: "${lastCapturedPrompt.slice(lastCapturedPrompt.indexOf("EXISTING REPOSITORY SOURCE CODE:"), 200)}..."`);
    console.log(`${PASS} Test 1: Workspace file discovered, read via readFile(), and content passed into Developer prompt.`);
    passed++;
  } catch (err) {
    console.log(`${FAIL} Test 1: ${(err as Error).message}`);
    failed++;
  }

  // ── TEST 2: Bounded Context (30KB & Max 5 Files) ─────────────────────────────
  try {
    console.log("\nTest 2: Bounded Context — Max files and 30KB budget limits...");

    // Create 7 files, one of which is 40KB
    for (let i = 1; i <= 7; i++) {
      const fPath = path.join(testWs, "src", `module${i}.ts`);
      const content = i === 1 ? "X".repeat(40_000) : `export const mod${i} = ${i};`;
      await fs.writeFile(fPath, content, "utf-8");
    }

    const execLog: string[] = [];
    const context = await discoverAndReadExistingCode(
      testWs,
      "Update src/module1.ts src/module2.ts src/module3.ts src/module4.ts src/module5.ts src/module6.ts src/module7.ts",
      "Refactor all modules",
      execLog
    );

    if (!context) {
      throw new Error("Expected existing code context to be returned");
    }

    const readLogs = execLog.filter((l) => l.includes("[DEV-INSPECT] Read"));
    if (readLogs.length > 5) {
      throw new Error(`Expected at most 5 files read, got ${readLogs.length}`);
    }

    if (!execLog.some((l) => l.includes("budget limit") || l.includes("partially truncated"))) {
      throw new Error(`Expected log entry noting budget truncation or limit reached. Logs:\n${execLog.join("\n")}`);
    }

    console.log(`       Files Read Count: ${readLogs.length}`);
    console.log(`       Budget Truncation Logged: YES`);
    console.log(`${PASS} Test 2: Bounded context limits enforced (max 5 files, 30KB limit).`);
    passed++;
  } catch (err) {
    console.log(`${FAIL} Test 2: ${(err as Error).message}`);
    failed++;
  }

  // ── TEST 3: Empty Workspace (Simulation Mode) ────────────────────────────────
  try {
    console.log("\nTest 3: Empty Workspace — Simulation mode compatibility...");
    lastCapturedPrompt = "";

    const res = await developerNode({
      task: "Simulated task without workspace",
      architecture: "Simulated arch",
      workspace: "",
    } as AegisState);

    const logs3 = (res.executionLog as string[]) ?? [];
    if (logs3.some((l: string) => l.includes("[DEV-INSPECT] Read"))) {
      throw new Error("ReadFile logs should not exist when workspace is empty");
    }

    if (lastCapturedPrompt.includes("EXISTING REPOSITORY SOURCE CODE:")) {
      throw new Error("Prompt should not contain existing code block when workspace is empty");
    }

    console.log(`${PASS} Test 3: Empty workspace preserves simulation mode with zero filesystem reads.`);
    passed++;
  } catch (err) {
    console.log(`${FAIL} Test 3: ${(err as Error).message}`);
    failed++;
  }

  // ── TEST 4: Missing / Stale Candidate File ───────────────────────────────────
  try {
    console.log("\nTest 4: Missing / Stale File — ENOENT gracefully handled...");
    const execLog: string[] = [];
    await discoverAndReadExistingCode(
      testWs,
      "Update non_existent_file.ts and src/math.ts",
      "",
      execLog
    );

    if (!execLog.some((l) => l.includes("[DEV-INSPECT] Skipped missing/stale candidate file: non_existent_file.ts"))) {
      throw new Error(`Expected log for missing file. Logs:\n${execLog.join("\n")}`);
    }

    console.log(`${PASS} Test 4: Missing candidate file logged as skipped without throwing error.`);
    passed++;
  } catch (err) {
    console.log(`${FAIL} Test 4: ${(err as Error).message}`);
    failed++;
  }

  // ── TEST 5: Recovery Re-read ─────────────────────────────────────────────────
  try {
    console.log("\nTest 5: Recovery Re-read — Re-reads updated workspace source on retry...");
    lastCapturedPrompt = "";

    // Modify src/math.ts on disk to simulate previous attempt edits
    const updatedCode = "export function add(a: number, b: number) {\n  // Modified on disk\n  return (a + b) | 0;\n}";
    await fs.writeFile(path.join(testWs, testFile1), updatedCode, "utf-8");

    const recoveryState: Partial<AegisState> = {
      task: "Fix type error in src/math.ts",
      workspace: testWs,
      approvalDecision: { approvalId: "app-test-2", action: "approve", decidedAt: Date.now() },
      recoveryContext: [
        {
          failingAgent: "tester",
          reason: "Type mismatch",
          details: ["add(1, 2) failed"],
          attemptNumber: 1,
        },
      ],
    };

    await developerNode(recoveryState as AegisState);

    if (!lastCapturedPrompt.includes("// Modified on disk")) {
      throw new Error("Developer retry prompt did not contain updated file content from disk");
    }

    console.log(`${PASS} Test 5: Developer retry attempt re-reads current workspace source from disk.`);
    passed++;
  } catch (err) {
    console.log(`${FAIL} Test 5: ${(err as Error).message}`);
    failed++;
  }

  // Cleanup temp test workspace
  try { await fs.rm(testWs, { recursive: true, force: true }); } catch {}

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
  if (failed > 0) process.exit(1);
}

runTests().catch((err) => {
  console.error("Unexpected test runner error:", err);
  process.exit(1);
});
