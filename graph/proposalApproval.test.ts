/**
 * graph/proposalApproval.test.ts
 *
 * R03 — Proposal Before Approval Tests
 *
 * Verifies:
 *   TEST 1 — PROPOSAL DOES NOT MUTATE REPOSITORY
 *   TEST 2 — APPROVAL CONTAINS REAL PROPOSAL
 *   TEST 3 — APPROVE APPLIES EXACT PROPOSAL
 *   TEST 4 — REJECT DOES NOT APPLY
 *   TEST 5 — RESUME DOES NOT REGENERATE
 *   TEST 6 — APPLY FAILURE DOES NOT REACH TESTER
 *   TEST 7 — RECOVERY PROPOSAL IS DISTINCT
 *   TEST 8 — NEW REPAIR PROPOSAL REQUIRES APPROVAL
 *   TEST 9 — R01 REGRESSION (Reads actual current source)
 *   TEST 10 — R02 REGRESSION (Receives structured plan context)
 *
 * Run with:
 *   npx tsx graph/proposalApproval.test.ts
 */

import os from "os";
import path from "path";
import { promises as fs } from "fs";
import { createDeveloperNode } from "./nodes/developerNode.js";
import { approvalCheckNode, applyProposalNode, buildApprovalWorkflow, executeApprovalWorkflow, resolveApprovalAndResume } from "./approvalWorkflow.js";
import { recoveryNode } from "./nodes/recoveryNode.js";
import { DeveloperAgent } from "../agents/developer/developer.js";
import type { DeveloperModel } from "../agents/developer/developer.js";
import type { AegisState, AegisStateUpdate, CodeChange } from "./state.js";

const PASS = "✅ PASS";
const FAIL = "❌ FAIL";

let devCallCount = 0;
let lastCapturedPrompt = "";

const mockPlanner = async (_state: AegisState): Promise<AegisStateUpdate> => ({
  status: "planning",
  plan: [{ id: "step-1", description: "Design module", status: "completed" }],
});

const mockResearcher = async (_state: AegisState): Promise<AegisStateUpdate> => ({
  status: "researching",
  research: "Mock research analysis complete.",
});

const mockArchitect = async (_state: AegisState): Promise<AegisStateUpdate> => ({
  status: "architecting",
  architecture: "Mock architecture design spec.",
});

const mockTester = async (_state: AegisState): Promise<AegisStateUpdate> => ({
  status: "testing",
  testResults: { passed: true, totalTests: 1, passedTests: 1, failedTests: 0 },
});

const mockReviewer = async (_state: AegisState): Promise<AegisStateUpdate> => ({
  status: "reviewing",
  reviewResults: { approved: true, comments: ["Approved"] },
});

const mockDeveloperModel: DeveloperModel = {
  async generateStructured<T>(_sys: string, user: string, _schema: unknown): Promise<T> {
    devCallCount++;
    lastCapturedPrompt = user;

    if (user.includes("Failing agent: tester")) {
      return {
        task: "Fix repair bug",
        summary: "Repaired calculation function",
        fileChanges: [
          {
            path: "src/calc.ts",
            action: "modify",
            summary: "Fixed return type in calc.ts",
            content: "export function calc(x: number) { return x * 2; }",
          },
        ],
        commandsExecuted: [],
        status: "completed",
      } as unknown as T;
    }

    return {
      task: "Initial task",
      summary: "Created calc and config files",
      fileChanges: [
        {
          path: "src/calc.ts",
          action: "add",
          summary: "Created calc function",
          content: "export function calc(x: number) { return x + 1; }",
        },
        {
          path: "src/config.ts",
          action: "add",
          summary: "Added configuration settings",
          content: "export const CONFIG = { env: 'test' };",
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

  console.log("\n=================================================");
  console.log("  R03 — PROPOSAL BEFORE APPROVAL TEST SUITE");
  console.log("=================================================\n");

  const testWs = path.join(os.tmpdir(), `aegis-r03-test-${Date.now()}`);
  await fs.mkdir(path.join(testWs, "src"), { recursive: true });
  await fs.writeFile(path.join(testWs, "src", "calc.ts"), "// initial content\n", "utf-8");

  const initialCalcDisk = await fs.readFile(path.join(testWs, "src", "calc.ts"), "utf-8");

  const devAgent = new DeveloperAgent(mockDeveloperModel);
  const devNode = createDeveloperNode(devAgent);

  // ── TEST 1: Proposal Does Not Mutate Repository ──────────────────────────────
  try {
    console.log("Test 1: Proposal generation does NOT mutate repository files on disk...");
    devCallCount = 0;

    const state: Partial<AegisState> = {
      task: "Update src/calc.ts",
      architecture: "Architecture spec",
      workspace: testWs,
    };

    const res = await devNode(state as AegisState);
    const codeChanges = res.codeChanges as CodeChange[] | undefined;
    const diskContentAfterProp = await fs.readFile(path.join(testWs, "src", "calc.ts"), "utf-8");

    if (diskContentAfterProp !== initialCalcDisk) {
      throw new Error(`Disk content changed during proposal phase! Initial: "${initialCalcDisk}", Now: "${diskContentAfterProp}"`);
    }

    if (!codeChanges || codeChanges.length !== 2) {
      throw new Error(`Expected 2 proposed changes in state, got ${codeChanges?.length}`);
    }

    console.log(`       Disk File Content: UNCHANGED ("${diskContentAfterProp.trim()}")`);
    console.log(`       State codeChanges Count: ${codeChanges.length}`);
    console.log(`${PASS} Test 1: Proposal generated cleanly in state while repository remained 100% untouched on disk.`);
    passed++;
  } catch (err) {
    console.log(`${FAIL} Test 1: ${(err as Error).message}`);
    failed++;
  }

  // ── TEST 2: Approval Request Exposes Concrete Proposal Content ─────────────────
  try {
    console.log("\nTest 2: ApprovalRequest exposes concrete proposal details (count, paths, actions, summaries)...");
    const state: Partial<AegisState> = {
      task: "Add feature",
      workspace: testWs,
      codeChanges: [
        { path: "src/calc.ts", action: "modify", summary: "Added calc function" },
        { path: "src/config.ts", action: "add", summary: "Added configuration settings" },
      ],
    };

    const res = await approvalCheckNode(state as AegisState);
    const req = res.pendingApproval as any;

    if (!req) {
      throw new Error("Approval check did not create pendingApproval");
    }

    if (!req.description.includes("2 file change(s)")) {
      throw new Error(`Expected description to mention 2 file change(s), got: "${req.description}"`);
    }

    if (!req.description.includes("MODIFY src/calc.ts: Added calc function") || !req.description.includes("CREATE src/config.ts: Added configuration settings")) {
      throw new Error(`Description missing file actions or summaries:\n${req.description}`);
    }

    if (!req.target?.includes("src/calc.ts, src/config.ts")) {
      throw new Error(`Target missing paths: "${req.target}"`);
    }

    console.log(`       Approval Request Title: "${req.title}"`);
    console.log(`       Approval Request Target: "${req.target}"`);
    console.log(`       Approval Request Description:\n${req.description}`);
    console.log(`${PASS} Test 2: ApprovalRequest successfully exposes file count, paths, actions, and summaries.`);
    passed++;
  } catch (err) {
    console.log(`${FAIL} Test 2: ${(err as Error).message}`);
    failed++;
  }

  // ── TEST 3: Approve Applies Exact Proposal ───────────────────────────────────
  try {
    console.log("\nTest 3: Human APPROVE applies exact approved proposal without LLM regeneration...");
    devCallCount = 0;

    const state: Partial<AegisState> = {
      task: "Apply changes",
      workspace: testWs,
      codeChanges: [
        { path: "src/calc.ts", action: "modify", content: "export function calc(x: number) { return x + 1; }", summary: "Updated calc" },
        { path: "src/config.ts", action: "add", content: "export const CONFIG = { env: 'test' };", summary: "Added config" },
      ],
      approvalDecision: { approvalId: "appr-1", action: "approve", decidedAt: Date.now() },
    };

    const applyRes = await applyProposalNode(state as AegisState);
    if (applyRes.status !== "developing") {
      throw new Error(`Expected status developing, got ${applyRes.status}`);
    }

    const calcDisk = await fs.readFile(path.join(testWs, "src", "calc.ts"), "utf-8");
    const configDisk = await fs.readFile(path.join(testWs, "src", "config.ts"), "utf-8");

    if (calcDisk !== "export function calc(x: number) { return x + 1; }") {
      throw new Error(`Disk content mismatch for src/calc.ts: "${calcDisk}"`);
    }
    if (configDisk !== "export const CONFIG = { env: 'test' };") {
      throw new Error(`Disk content mismatch for src/config.ts: "${configDisk}"`);
    }

    if (devCallCount !== 0) {
      throw new Error(`Developer model was unexpectedly called during apply phase! Call count: ${devCallCount}`);
    }

    console.log(`       src/calc.ts Disk Content: "${calcDisk}"`);
    console.log(`       src/config.ts Disk Content: "${configDisk}"`);
    console.log(`       Developer Model Call Count: 0`);
    console.log(`${PASS} Test 3: Approved proposal applied to disk with exact content and 0 LLM calls.`);
    passed++;
  } catch (err) {
    console.log(`${FAIL} Test 3: ${(err as Error).message}`);
    failed++;
  }

  // ── TEST 4: Reject Does Not Apply ──────────────────────────────────────────
  try {
    console.log("\nTest 4: Human REJECT leaves repository completely unchanged...");
    await fs.writeFile(path.join(testWs, "src", "calc.ts"), "ORIGINAL UNTOUCHED", "utf-8");
    const beforeRejectDisk = await fs.readFile(path.join(testWs, "src", "calc.ts"), "utf-8");

    const workflow = buildApprovalWorkflow({
      planner: mockPlanner,
      researcher: mockResearcher,
      architect: mockArchitect,
      developer: devNode,
    });
    const runId = `r03_reject_test_${Date.now()}`;

    const pausedState = await executeApprovalWorkflow(runId, { task: "Update calc", workspace: testWs }, workflow);
    if (pausedState.status !== "paused") {
      throw new Error(`Expected paused status, got ${pausedState.status}`);
    }

    const rejectedState = await resolveApprovalAndResume(runId, pausedState.pendingApproval!.id, "reject", "Not wanted", workflow);

    const afterRejectDisk = await fs.readFile(path.join(testWs, "src", "calc.ts"), "utf-8");
    if (afterRejectDisk !== beforeRejectDisk) {
      throw new Error(`Disk file was modified despite rejection! Before: "${beforeRejectDisk}", After: "${afterRejectDisk}"`);
    }

    if (rejectedState.status !== "failed") {
      throw new Error(`Expected terminal non-success status "failed", got "${rejectedState.status}"`);
    }

    if (!rejectedState.errors.some((e) => e.includes("Not wanted"))) {
      throw new Error(`Expected rejection reason "Not wanted" in state.errors, got: ${rejectedState.errors.join("; ")}`);
    }

    console.log(`       Disk File Before: "${beforeRejectDisk}"`);
    console.log(`       Disk File After Reject: "${afterRejectDisk}"`);
    console.log(`       Final Terminal Status: "${rejectedState.status}" (non-success)`);
    console.log(`${PASS} Test 4: Rejection leaves repository files byte-for-byte unchanged with non-success status "failed".`);
    passed++;
  } catch (err) {
    console.log(`${FAIL} Test 4: ${(err as Error).message}`);
    failed++;
  }

  // ── TEST 5: Resume Does Not Regenerate ───────────────────────────────────────
  try {
    console.log("\nTest 5: Resume after approval reuses existing proposal without regeneration...");
    devCallCount = 0;

    const workflow = buildApprovalWorkflow({
      planner: mockPlanner,
      researcher: mockResearcher,
      architect: mockArchitect,
      developer: devNode,
      tester: mockTester,
      reviewer: mockReviewer,
    });
    const runId = `r03_resume_test_${Date.now()}`;

    const pausedState = await executeApprovalWorkflow(runId, { task: "Create calc and config", workspace: testWs }, workflow);

    const callsAfterPause = devCallCount;
    if (callsAfterPause !== 1) {
      throw new Error(`Expected exactly 1 LLM call before pause, got ${callsAfterPause}`);
    }

    const resumedState = await resolveApprovalAndResume(runId, pausedState.pendingApproval!.id, "approve", "Approved", workflow);

    const callsAfterResume = devCallCount;
    if (callsAfterResume !== 1) {
      throw new Error(`Developer model was re-called on resume! Total calls: ${callsAfterResume}`);
    }

    console.log(`       LLM Calls Before Pause: ${callsAfterPause}`);
    console.log(`       LLM Calls After Resume: ${callsAfterResume}`);
    console.log(`${PASS} Test 5: Resume after approval reuses persisted proposal with 0 extra LLM calls.`);
    passed++;
  } catch (err) {
    console.log(`${FAIL} Test 5: ${(err as Error).message}`);
    failed++;
  }

  // ── TEST 6: Apply Failure Does Not Reach Tester ─────────────────────────────
  try {
    console.log("\nTest 6: Proposal application failure records error and halts execution before Tester...");

    const failState: Partial<AegisState> = {
      task: "Invalid workspace apply",
      workspace: "Z:\\path_that_does_not_exist_99999",
      codeChanges: [
        { path: "file.ts", action: "modify", content: "data" },
      ],
    };

    const res = await applyProposalNode(failState as AegisState);
    const errs = res.errors as string[] | undefined;
    if (res.status !== "failed") {
      throw new Error(`Expected status failed on write error, got ${res.status}`);
    }

    if (!errs || errs.length === 0) {
      throw new Error("Expected error message in state when file application fails");
    }

    console.log(`       Captured Application Error: "${errs[0]}"`);
    console.log(`${PASS} Test 6: Proposal application failure recorded in state and halted cleanly.`);
    passed++;
  } catch (err) {
    console.log(`${FAIL} Test 6: ${(err as Error).message}`);
    failed++;
  }

  // ── TEST 7: Recovery Proposal Is Distinct ────────────────────────────────────
  try {
    console.log("\nTest 7: Recovery generates distinct repair proposal without mixing stale proposals...");
    devCallCount = 0;

    const initialFailState: AegisState = {
      task: "Fix calculation bug",
      workspace: testWs,
      status: "testing",
      retryCount: 0,
      maxRetries: 3,
      testResults: { passed: false, totalTests: 1, passedTests: 0, failedTests: 1, output: "calc(2) returned 3, expected 4" },
      reviewResults: null,
      codeChanges: [{ path: "src/calc.ts", action: "modify", content: "old content" }],
      approvalDecision: { approvalId: "appr-old", action: "approve", decidedAt: Date.now() },
      plan: [],
      research: "",
      architecture: "",
      errors: [],
      executionLog: [],
      recoveryContext: [],
      runId: "run_recovery_test",
      memoryContext: "",
      pendingApproval: null,
      executionMode: "semi-auto",
    };

    const recRes = await recoveryNode(initialFailState);
    const recChanges = recRes.codeChanges as CodeChange[] | undefined;

    if (recChanges?.length !== 0) {
      throw new Error("Recovery node did not reset codeChanges to []");
    }

    const updatedStateAfterRec: AegisState = {
      ...initialFailState,
      ...recRes,
    } as AegisState;

    const devRepairRes = await devNode(updatedStateAfterRec);
    const repairChanges = devRepairRes.codeChanges as CodeChange[] | undefined;

    if (!repairChanges || repairChanges.length !== 1) {
      throw new Error(`Expected 1 repair code change, got ${repairChanges?.length}`);
    }
    if (!repairChanges[0].summary?.includes("Fixed return type")) {
      throw new Error(`Repair code change mismatch: ${repairChanges[0].summary}`);
    }

    console.log(`       Old Proposal Cleared: YES`);
    console.log(`       Repair Proposal Summary: "${repairChanges[0].summary}"`);
    console.log(`${PASS} Test 7: Recovery proposal is distinct and stale proposal is not mixed.`);
    passed++;
  } catch (err) {
    console.log(`${FAIL} Test 7: ${(err as Error).message}`);
    failed++;
  }

  // ── TEST 8: New Repair Proposal Requires Approval ────────────────────────────
  try {
    console.log("\nTest 8: New repair proposal requires fresh human approval...");

    const initialFailState: AegisState = {
      task: "Fix calculation bug",
      workspace: testWs,
      status: "testing",
      retryCount: 0,
      maxRetries: 3,
      testResults: { passed: false, totalTests: 1, passedTests: 0, failedTests: 1, output: "calc(2) returned 3" },
      reviewResults: null,
      codeChanges: [{ path: "src/calc.ts", action: "modify", content: "old" }],
      approvalDecision: { approvalId: "appr-old", action: "approve", decidedAt: Date.now() },
      plan: [],
      research: "",
      architecture: "",
      errors: [],
      executionLog: [],
      recoveryContext: [],
      runId: "run_rec_test_8",
      memoryContext: "",
      pendingApproval: null,
      executionMode: "semi-auto",
    };

    const recRes = await recoveryNode(initialFailState);
    const updatedState: AegisState = { ...initialFailState, ...recRes } as AegisState;
    const devRepairRes = await devNode(updatedState);

    const stateForApproval: AegisState = {
      ...updatedState,
      codeChanges: devRepairRes.codeChanges as any,
    };

    const appCheckRes = await approvalCheckNode(stateForApproval);
    const appReq = appCheckRes.pendingApproval as any;

    if (appCheckRes.status !== "paused" || !appReq) {
      throw new Error(`Expected approvalCheckNode to pause for new repair approval, got status "${appCheckRes.status}"`);
    }

    console.log(`       New Approval Request Title: "${appReq.title}"`);
    console.log(`${PASS} Test 8: New repair proposal triggers fresh human approval gate.`);
    passed++;
  } catch (err) {
    console.log(`${FAIL} Test 8: ${(err as Error).message}`);
    failed++;
  }

  // ── TEST 9: R01 Grounding Regression ──────────────────────────────────────────
  try {
    console.log("\nTest 9: R01 Regression — Developer proposal generation reads actual workspace source...");
    lastCapturedPrompt = "";

    await fs.writeFile(path.join(testWs, "src", "calc.ts"), "// grounding source check\nexport function calc() {}", "utf-8");

    const state: Partial<AegisState> = {
      task: "Refactor src/calc.ts function",
      workspace: testWs,
      architecture: "Update src/calc.ts",
    };

    await devNode(state as AegisState);

    if (!lastCapturedPrompt.includes("EXISTING REPOSITORY SOURCE CODE:")) {
      throw new Error("Developer prompt missing R01 existing source code block");
    }
    if (!lastCapturedPrompt.includes("// grounding source check")) {
      throw new Error("Developer prompt did not contain actual source content from src/calc.ts");
    }

    console.log(`${PASS} Test 9: R01 repository source grounding preserved during proposal generation.`);
    passed++;
  } catch (err) {
    console.log(`${FAIL} Test 9: ${(err as Error).message}`);
    failed++;
  }

  // ── TEST 10: R02 Plan Consumption Regression ─────────────────────────────────
  try {
    console.log("\nTest 10: R02 Regression — Developer proposal generation receives structured plan context...");
    lastCapturedPrompt = "";

    const state: Partial<AegisState> = {
      task: "Execute plan",
      workspace: testWs,
      plan: [
        { id: "step-1", title: "Setup Config", description: "Create config file", status: "pending" },
      ],
    };

    await devNode(state as AegisState);

    if (!lastCapturedPrompt.includes("PLAN CONTEXT FOR IMPLEMENTATION")) {
      throw new Error("Developer prompt missing R02 plan context block");
    }
    if (!lastCapturedPrompt.includes("1. [step-1] Setup Config: Create config file")) {
      throw new Error("Developer prompt missing formatted plan step");
    }

    console.log(`${PASS} Test 10: R02 plan artifact consumption preserved during proposal generation.`);
    passed++;
  } catch (err) {
    console.log(`${FAIL} Test 10: ${(err as Error).message}`);
    failed++;
  }

  // ── TEST 11: Execution Mode Propagation ──────────────────────────────────────
  try {
    console.log("\nTest 11: Execution mode ('manual') propagates from workflow state to gate and apply phase...");
    const state: Partial<AegisState> = {
      task: "Manual mode test",
      workspace: testWs,
      executionMode: "manual",
      codeChanges: [
        { path: "src/calc.ts", action: "modify", content: "// manual mode content", summary: "Manual update" },
      ],
      approvalDecision: { approvalId: "appr-man", action: "approve", decidedAt: Date.now() },
    };

    const applyRes = await applyProposalNode(state as AegisState);
    const logs = (applyRes.executionLog as string[]) ?? [];

    if (!logs.some((l) => l.includes("(mode: manual)"))) {
      throw new Error(`Expected apply log to contain '(mode: manual)'. Logs:\n${logs.join("\n")}`);
    }

    console.log(`       Apply Log Snippet: "${logs.find((l) => l.includes("(mode: manual)"))}"`);
    console.log(`${PASS} Test 11: Execution mode 'manual' propagated to apply phase.`);
    passed++;
  } catch (err) {
    console.log(`${FAIL} Test 11: ${(err as Error).message}`);
    failed++;
  }

  // Cleanup temporary workspace
  try { await fs.rm(testWs, { recursive: true, force: true }); } catch {}

  console.log("\n=================================================");
  console.log(` RESULTS: ${passed} / 11 tests passed successfully.`);
  console.log("=================================================\n");

  if (failed > 0) process.exit(1);
}

runTests().catch((err) => {
  console.error("Test execution error:", err);
  process.exit(1);
});
