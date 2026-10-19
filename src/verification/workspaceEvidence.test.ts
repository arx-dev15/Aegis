/**
 * graph/workspaceEvidence.test.ts
 *
 * Feature R04 — Workspace Change Evidence & Baseline Tracking Unit Tests
 *
 * Verifies pre-apply baseline capture, post-apply workspace evidence, exact content match,
 * detection of proposal/disk mismatches, pre-existing dirty file isolation, non-Git support,
 * overlapping pre-dirty proposal file tracking, workspace path escape containment,
 * CREATE-on-existing pre-condition check, pre-dirty concurrent modification tracking,
 * space-in-filename Git parsing, symlink escape containment, and R01/R02/R03 regression compatibility.
 *
 * Run with:
 *   npx tsx graph/workspaceEvidence.test.ts
 */

import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import {
  captureWorkspaceBaseline,
  verifyWorkspaceChanges,
  computeSHA256,
  safeResolveWorkspacePath,
  parseGitPorcelainLine,
  WorkspaceChangeEvidence,
} from "./changeEvidence.js";
import { applyProposalNode, approvalRuntime } from "../runtime/approvalWorkflow.js";
import type { AegisState, CodeChange } from "../runtime/state.js";
import { createDeveloperNode } from "../workflows/nodes/developerNode.js";
import { DeveloperAgent } from "../workflows/agents/developer/developer.js";
import type { DeveloperResult } from "../workflows/agents/developer/types.js";

const PASS = "✅ PASS";
const FAIL = "❌ FAIL";

function createTempDir(prefix: string): string {
  const dir = path.join(process.cwd(), "temp_r04_" + prefix + "_" + Date.now());
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function removeTempDir(dir: string): void {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch {}
}

class MockDeveloperAgent extends DeveloperAgent {
  public developCallCount = 0;
  public mockOutput: DeveloperResult;

  constructor(mockOutput: DeveloperResult) {
    super();
    this.mockOutput = mockOutput;
  }

  override async develop(): Promise<DeveloperResult> {
    this.developCallCount++;
    return this.mockOutput;
  }
}

async function runTests(): Promise<void> {
  console.log("=== R04 WORKSPACE CHANGE EVIDENCE & BASELINE TRACKING TESTS ===\n");
  let passed = 0;
  let failed = 0;

  // ── TEST 1: MODIFY VERIFIED ──────────────────────────────────────────────────
  try {
    console.log("Test 1: MODIFY action pre-apply baseline and post-apply evidence verified...");
    const testDir = createTempDir("test1");
    try {
      const filePath = path.join(testDir, "src", "app.ts");
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, "const a = 1;", "utf-8");

      const codeChanges: CodeChange[] = [
        { path: "src/app.ts", action: "modify", content: "const a = 2;" },
      ];

      const baseline = await captureWorkspaceBaseline(testDir, codeChanges);
      if (!baseline.fileBaselines["src/app.ts"]?.exists) {
        throw new Error("Baseline did not record pre-existing file existence.");
      }
      const beforeHash = baseline.fileBaselines["src/app.ts"].hash;

      fs.writeFileSync(filePath, "const a = 2;", "utf-8");

      const evidence = await verifyWorkspaceChanges(testDir, codeChanges, baseline);
      if (!evidence.allVerified) {
        throw new Error(`Verification failed: ${evidence.fileEvidence[0]?.error}`);
      }
      const fe = evidence.fileEvidence[0];
      if (!fe.actuallyChanged || !fe.contentMatches || fe.beforeHash === fe.afterHash) {
        throw new Error("MODIFY evidence did not report change or exact match.");
      }
      if (fe.beforeHash !== beforeHash) {
        throw new Error("Before hash mismatch.");
      }

      console.log(`       Before Hash: ${fe.beforeHash?.substring(0, 8)}...`);
      console.log(`       After Hash: ${fe.afterHash?.substring(0, 8)}...`);
      console.log(`       Verified: ${fe.verified}, Classification: ${fe.classification}`);
      console.log(`${PASS} Test 1: MODIFY evidence verified successfully.`);
      passed++;
    } finally {
      removeTempDir(testDir);
    }
  } catch (err) {
    console.log(`${FAIL} Test 1: ${(err as Error).message}`);
    failed++;
  }

  // ── TEST 2: CREATE VERIFIED ──────────────────────────────────────────────────
  try {
    console.log("\nTest 2: CREATE action pre-apply baseline and post-apply evidence verified...");
    const testDir = createTempDir("test2");
    try {
      const codeChanges: CodeChange[] = [
        { path: "src/newFile.ts", action: "add", content: "export const b = 100;" },
      ];

      const baseline = await captureWorkspaceBaseline(testDir, codeChanges);
      if (baseline.fileBaselines["src/newFile.ts"]?.exists) {
        throw new Error("Baseline falsely reported non-existent file.");
      }

      const fullPath = path.join(testDir, "src", "newFile.ts");
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
      fs.writeFileSync(fullPath, "export const b = 100;", "utf-8");

      const evidence = await verifyWorkspaceChanges(testDir, codeChanges, baseline);
      if (!evidence.allVerified) {
        throw new Error(`CREATE verification failed: ${evidence.fileEvidence[0]?.error}`);
      }
      const fe = evidence.fileEvidence[0];
      if (fe.beforeExists || !fe.afterExists || !fe.contentMatches) {
        throw new Error("CREATE evidence mismatch.");
      }

      console.log(`       Before Exists: false, After Exists: true`);
      console.log(`       Content Matches: ${fe.contentMatches}, Verified: ${fe.verified}`);
      console.log(`${PASS} Test 2: CREATE evidence verified successfully.`);
      passed++;
    } finally {
      removeTempDir(testDir);
    }
  } catch (err) {
    console.log(`${FAIL} Test 2: ${(err as Error).message}`);
    failed++;
  }

  // ── TEST 3: DELETE VERIFIED ──────────────────────────────────────────────────
  try {
    console.log("\nTest 3: DELETE action pre-apply baseline and post-apply evidence verified...");
    const testDir = createTempDir("test3");
    try {
      const filePath = path.join(testDir, "src", "oldFile.ts");
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, "// deprecated", "utf-8");

      const codeChanges: CodeChange[] = [{ path: "src/oldFile.ts", action: "delete" }];

      const baseline = await captureWorkspaceBaseline(testDir, codeChanges);
      if (!baseline.fileBaselines["src/oldFile.ts"]?.exists) {
        throw new Error("Baseline failed to record file to be deleted.");
      }

      fs.unlinkSync(filePath);

      const evidence = await verifyWorkspaceChanges(testDir, codeChanges, baseline);
      if (!evidence.allVerified) {
        throw new Error(`DELETE verification failed: ${evidence.fileEvidence[0]?.error}`);
      }
      const fe = evidence.fileEvidence[0];
      if (!fe.beforeExists || fe.afterExists || !fe.actuallyChanged) {
        throw new Error("DELETE evidence mismatch.");
      }

      console.log(`       Before Exists: true, After Exists: false`);
      console.log(`       Actually Changed: true, Verified: ${fe.verified}`);
      console.log(`${PASS} Test 3: DELETE evidence verified successfully.`);
      passed++;
    } finally {
      removeTempDir(testDir);
    }
  } catch (err) {
    console.log(`${FAIL} Test 3: ${(err as Error).message}`);
    failed++;
  }

  // ── TEST 4: PROPOSAL / DISK MISMATCH DETECTED ────────────────────────────────
  try {
    console.log("\nTest 4: Proposal / Disk content mismatch is detected and fails apply...");
    const testDir = createTempDir("test4");
    try {
      const codeChanges: CodeChange[] = [
        { path: "src/tampered.ts", action: "add", content: "expected content" },
      ];

      // 1. Capture baseline before apply
      const baseline = await captureWorkspaceBaseline(testDir, codeChanges);

      // 2. Simulate applied file on disk containing different tampered content
      const fullPath = path.join(testDir, "src", "tampered.ts");
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
      fs.writeFileSync(fullPath, "DIFFERENT TAMPERED CONTENT", "utf-8");

      // 3. Verify changes
      const evidence = await verifyWorkspaceChanges(testDir, codeChanges, baseline);

      if (evidence.allVerified) {
        throw new Error("Verification failed to catch content mismatch.");
      }

      const fe = evidence.fileEvidence[0];
      if (fe.contentMatches || fe.verified || !fe.error?.includes("does not match approved proposal")) {
        throw new Error(`Expected error message not found: ${fe.error}`);
      }

      console.log(`       All Verified: ${evidence.allVerified}`);
      console.log(`       Error Message: "${fe.error}"`);
      console.log(`${PASS} Test 4: Content mismatch correctly detected and rejected.`);
      passed++;
    } finally {
      removeTempDir(testDir);
    }
  } catch (err) {
    console.log(`${FAIL} Test 4: ${(err as Error).message}`);
    failed++;
  }

  // ── TEST 5: PRE-EXISTING DIRTY FILE NOT ATTRIBUTED ───────────────────────────
  try {
    console.log("\nTest 5: Pre-existing dirty workspace file is distinguished from run changes...");
    const testDir = createTempDir("test5");
    try {
      execSync("git init", { cwd: testDir, stdio: "ignore" });
      fs.writeFileSync(path.join(testDir, "src_user.ts"), "// clean initial", "utf-8");
      execSync("git add . && git commit -m \"initial\"", { cwd: testDir, stdio: "ignore" });

      // User manually modifies src_user.ts BEFORE AEGIS runs
      fs.writeFileSync(path.join(testDir, "src_user.ts"), "// USER UNCOMMITTED CHANGE", "utf-8");

      const codeChanges: CodeChange[] = [
        { path: "src_feature.ts", action: "add", content: "// AEGIS PROPOSAL" },
      ];

      const baseline = await captureWorkspaceBaseline(testDir, codeChanges);
      if (!baseline.isGitRepo) {
        throw new Error("Failed to detect Git repository.");
      }
      if (!baseline.preExistingDirtyFiles.includes("src_user.ts")) {
        throw new Error(`Pre-existing dirty file src_user.ts not detected. Got: ${baseline.preExistingDirtyFiles.join(", ")}`);
      }

      // Apply AEGIS proposal
      fs.writeFileSync(path.join(testDir, "src_feature.ts"), "// AEGIS PROPOSAL", "utf-8");

      const evidence = await verifyWorkspaceChanges(testDir, codeChanges, baseline);
      const userFe = baseline.preExistingDirtyFiles.includes("src_user.ts");
      const featureFe = evidence.fileEvidence.find((f) => f.path === "src_feature.ts");

      if (!userFe) {
        throw new Error("Pre-existing file not preserved in evidence list.");
      }
      if (featureFe?.preExistingDirty) {
        throw new Error(`Feature file should not be marked preExistingDirty.`);
      }

      // Ensure user modification is intact
      const userContent = fs.readFileSync(path.join(testDir, "src_user.ts"), "utf-8");
      if (userContent !== "// USER UNCOMMITTED CHANGE") {
        throw new Error("AEGIS mutated pre-existing user modification!");
      }

      console.log(`       Pre-existing Dirty File Detected: "src_user.ts" (Intact: YES)`);
      console.log(`       AEGIS Run-Introduced File: "src_feature.ts" (Pre-existing dirty: false)`);
      console.log(`${PASS} Test 5: Pre-existing dirty workspace file isolated and preserved.`);
      passed++;
    } finally {
      removeTempDir(testDir);
    }
  } catch (err) {
    console.log(`${FAIL} Test 5: ${(err as Error).message}`);
    failed++;
  }

  // ── TEST 6: NON-GIT WORKSPACE SUPPORTED ──────────────────────────────────────
  try {
    console.log("\nTest 6: Proposal evidence verification works in non-Git workspace...");
    const testDir = createTempDir("test6");
    try {
      const codeChanges: CodeChange[] = [
        { path: "file1.txt", action: "add", content: "hello world" },
      ];

      const baseline = await captureWorkspaceBaseline(testDir, codeChanges);
      if (baseline.isGitRepo) {
        throw new Error("Non-Git directory falsely identified as Git repo.");
      }

      fs.writeFileSync(path.join(testDir, "file1.txt"), "hello world", "utf-8");

      const evidence = await verifyWorkspaceChanges(testDir, codeChanges, baseline);
      if (!evidence.allVerified || evidence.fileEvidence[0]?.preExistingDirty) {
        throw new Error("Non-Git evidence verification failed.");
      }

      console.log(`       Is Git Repo: ${baseline.isGitRepo}`);
      console.log(`       All Verified: ${evidence.allVerified}`);
      console.log(`${PASS} Test 6: Non-Git workspace evidence verified cleanly.`);
      passed++;
    } finally {
      removeTempDir(testDir);
    }
  } catch (err) {
    console.log(`${FAIL} Test 6: ${(err as Error).message}`);
    failed++;
  }

  // ── TEST 7: R03 EXACT PROPOSAL APPLICATION & EVIDENCE ───────────────────────
  try {
    console.log("\nTest 7: Apply proposal node captures evidence for exact approved proposal...");
    const testDir = createTempDir("test7");
    try {
      const codeChanges: CodeChange[] = [
        { path: "calc.ts", action: "add", content: "export function add(a: number, b: number) { return a + b; }" },
      ];

      const state: AegisState = {
        task: "Create calculator",
        workspace: testDir,
        status: "developing",
        codeChanges,
        plan: [],
        research: "",
        architecture: "",
        testResults: null,
        reviewResults: null,
        errors: [],
        retryCount: 0,
        maxRetries: 3,
        executionLog: [],
        recoveryContext: [],
        runId: "run_r03_exact",
        memoryContext: "",
        pendingApproval: null,
        approvalDecision: { approvalId: "appr-1", action: "approve", decidedAt: Date.now() },
        executionMode: "semi-auto",
        changeEvidence: null,
      };

      approvalRuntime.registerRun(state.runId!, state);
      const baseline7 = await captureWorkspaceBaseline(testDir, codeChanges);
      approvalRuntime.setApprovalBaseline(state.runId!, baseline7);

      const res = await applyProposalNode(state);
      const ev = res.changeEvidence as WorkspaceChangeEvidence | undefined;
      const errors = res.errors as string[] | undefined;

      if (!ev || !ev.allVerified || ev.fileEvidence.length !== 1) {
        throw new Error(`Apply proposal node evidence failure: ${errors?.join("; ")}`);
      }

      const appliedContent = fs.readFileSync(path.join(testDir, "calc.ts"), "utf-8");
      if (appliedContent !== codeChanges[0].content) {
        throw new Error("Applied content on disk does not match approved proposal.");
      }

      console.log(`       File Written: calc.ts`);
      console.log(`       Disk Content Matches Proposal: YES`);
      console.log(`       Evidence Verified: ${ev.allVerified}`);
      console.log(`${PASS} Test 7: R03 exact proposal application evidence verified.`);
      passed++;
    } finally {
      removeTempDir(testDir);
    }
  } catch (err) {
    console.log(`${FAIL} Test 7: ${(err as Error).message}`);
    failed++;
  }

  // ── TEST 8: RECOVERY PROPOSAL EVIDENCE IS CURRENT ────────────────────────────
  try {
    console.log("\nTest 8: Recovery proposal evidence corresponds to current repair proposal...");
    const testDir = createTempDir("test8");
    try {
      const initialCodeChanges: CodeChange[] = [
        { path: "calc.ts", action: "add", content: "export function add(a: number) { return a; }" },
      ];

      // Initial apply
      const state1: AegisState = {
        task: "Fix calc",
        workspace: testDir,
        status: "developing",
        codeChanges: initialCodeChanges,
        plan: [],
        research: "",
        architecture: "",
        testResults: null,
        reviewResults: null,
        errors: [],
        retryCount: 0,
        maxRetries: 3,
        executionLog: [],
        recoveryContext: [],
        runId: "run_rec_ev",
        memoryContext: "",
        pendingApproval: null,
        approvalDecision: { approvalId: "appr-1", action: "approve", decidedAt: Date.now() },
        executionMode: "semi-auto",
        changeEvidence: null,
      };

      approvalRuntime.registerRun(state1.runId!, state1);
      const baseline8_1 = await captureWorkspaceBaseline(testDir, initialCodeChanges);
      approvalRuntime.setApprovalBaseline(state1.runId!, baseline8_1);

      await applyProposalNode(state1);

      // Repair proposal
      const repairCodeChanges: CodeChange[] = [
        { path: "calc.ts", action: "modify", content: "export function add(a: number, b: number) { return a + b; }" },
      ];

      const state2: AegisState = {
        ...state1,
        codeChanges: repairCodeChanges,
        approvalDecision: { approvalId: "appr-2", action: "approve", decidedAt: Date.now() },
      };

      approvalRuntime.registerRun(state2.runId!, state2);
      const baseline8_2 = await captureWorkspaceBaseline(testDir, repairCodeChanges);
      approvalRuntime.setApprovalBaseline(state2.runId!, baseline8_2);

      const res2 = await applyProposalNode(state2);
      const ev2 = res2.changeEvidence as WorkspaceChangeEvidence | undefined;

      if (!ev2 || ev2.fileEvidence[0]?.path !== "calc.ts" || ev2.fileEvidence[0]?.action !== "modify") {
        throw new Error("Recovery evidence did not reflect repair modify action.");
      }

      console.log(`       Initial Action: add, Recovery Action: modify`);
      console.log(`       Evidence Verified: ${ev2.allVerified}`);
      console.log(`${PASS} Test 8: Recovery proposal evidence corresponds to current repair.`);
      passed++;
    } finally {
      removeTempDir(testDir);
    }
  } catch (err) {
    console.log(`${FAIL} Test 8: ${(err as Error).message}`);
    failed++;
  }

  // ── TEST 9: R01 REGRESSION (Grounding preserved) ─────────────────────────────
  try {
    console.log("\nTest 9: R01 Repository Grounding preserved...");
    const testDir = createTempDir("test9");
    try {
      const srcFile = path.join(testDir, "src", "math.ts");
      fs.mkdirSync(path.dirname(srcFile), { recursive: true });
      fs.writeFileSync(srcFile, "export function square(n: number) { return n * n; }", "utf-8");

      const mockAgent = new MockDeveloperAgent({
        task: "Add cube",
        summary: "Add cube function",
        fileChanges: [{ path: "src/math.ts", action: "modify", content: "export function cube(n: number) { return n * n * n; }", summary: "Added cube" }],
        commandsExecuted: [],
        status: "completed",
      });
      const devNode = createDeveloperNode(mockAgent);

      const state: AegisState = {
        task: "Add cube function to src/math.ts",
        workspace: testDir,
        status: "developing",
        codeChanges: [],
        plan: [],
        research: "",
        architecture: "",
        testResults: null,
        reviewResults: null,
        errors: [],
        retryCount: 0,
        maxRetries: 3,
        executionLog: [],
        recoveryContext: [],
        runId: "run_r01_reg",
        memoryContext: "",
        pendingApproval: null,
        approvalDecision: null,
        executionMode: "semi-auto",
        changeEvidence: null,
      };

      const res = await devNode(state);
      const codeChanges = res.codeChanges as CodeChange[] | undefined;
      if (!codeChanges || codeChanges.length !== 1) {
        throw new Error("R01 grounding failed to produce code change.");
      }

      console.log(`       Proposal Generated: ${codeChanges[0].path}`);
      console.log(`${PASS} Test 9: R01 Repository Grounding regression passed.`);
      passed++;
    } finally {
      removeTempDir(testDir);
    }
  } catch (err) {
    console.log(`${FAIL} Test 9: ${(err as Error).message}`);
    failed++;
  }

  // ── TEST 10: R02 REGRESSION (Plan consumption preserved) ─────────────────────
  try {
    console.log("\nTest 10: R02 Plan Consumption preserved...");
    const mockAgent = new MockDeveloperAgent({
      task: "Execute plan",
      summary: "Implement plan step",
      fileChanges: [{ path: "src/plan.ts", action: "add", content: "// plan", summary: "Plan change" }],
      commandsExecuted: [],
      status: "completed",
    });
    const devNode = createDeveloperNode(mockAgent);

    const state: AegisState = {
      task: "Execute plan",
      workspace: "",
      status: "developing",
      codeChanges: [],
      plan: [{ id: "1", title: "Step 1", description: "Create plan file", status: "pending" }],
      research: "",
      architecture: "",
      testResults: null,
      reviewResults: null,
      errors: [],
      retryCount: 0,
      maxRetries: 3,
      executionLog: [],
      recoveryContext: [],
      runId: "run_r02_reg",
      memoryContext: "",
      pendingApproval: null,
      approvalDecision: null,
      executionMode: "semi-auto",
      changeEvidence: null,
    };

    const res = await devNode(state);
    const execLog = res.executionLog as string[] | undefined;
    const hasPlanLog = execLog?.some((l: string) => l.includes("[DEV-PLAN] Developer received 1 plan step(s)"));

    if (!hasPlanLog) {
      throw new Error("R02 Plan consumption log missing from execution log.");
    }

    console.log(`       Plan Context Log Received: YES`);
    console.log(`${PASS} Test 10: R02 Plan Consumption regression passed.`);
    passed++;
  } catch (err) {
    console.log(`${FAIL} Test 10: ${(err as Error).message}`);
    failed++;
  }

  // ── TEST 11: PRE-DIRTY PROPOSAL FILE (Overlapping Dirty + AEGIS Change) ──────
  try {
    console.log("\nTest 11: Pre-dirty proposal file (Overlapping Case C) preserves preExistingDirty AND actuallyChanged...");
    const testDir = createTempDir("test11");
    try {
      execSync("git init", { cwd: testDir, stdio: "ignore" });
      const featPath = path.join(testDir, "src", "feature.ts");
      fs.mkdirSync(path.dirname(featPath), { recursive: true });
      fs.writeFileSync(featPath, "const A = 1;", "utf-8");
      execSync("git add . && git commit -m \"commit A\"", { cwd: testDir, stdio: "ignore" });

      // User modifies feature.ts BEFORE AEGIS
      const userA = "const A = USER_EDIT;";
      fs.writeFileSync(featPath, userA, "utf-8");
      const userAHash = computeSHA256(userA);

      const approvedB = "const A = AEGIS_PROPOSAL_B;";
      const codeChanges: CodeChange[] = [
        { path: "src/feature.ts", action: "modify", content: approvedB },
      ];

      // 1. Capture baseline (immediately before apply)
      const baseline = await captureWorkspaceBaseline(testDir, codeChanges);
      if (!baseline.preExistingDirtyFiles.includes("src/feature.ts")) {
        throw new Error("Failed to detect feature.ts as pre-existing dirty.");
      }
      if (baseline.fileBaselines["src/feature.ts"]?.hash !== userAHash) {
        throw new Error("Baseline hash did not correspond to exact user-edited state USER_A.");
      }

      // 2. Apply AEGIS proposal B
      fs.writeFileSync(featPath, approvedB, "utf-8");

      // 3. Verify changes
      const evidence = await verifyWorkspaceChanges(testDir, codeChanges, baseline);
      const fe = evidence.fileEvidence[0];

      if (!fe.preExistingDirty) {
        throw new Error("fe.preExistingDirty should be true.");
      }
      if (!fe.actuallyChanged) {
        throw new Error("fe.actuallyChanged should be true.");
      }
      if (!fe.contentMatches || !fe.verified) {
        throw new Error("fe.contentMatches and fe.verified should be true.");
      }
      if (fe.beforeHash !== userAHash) {
        throw new Error("fe.beforeHash mismatch.");
      }
      if (fe.afterHash !== computeSHA256(approvedB)) {
        throw new Error("fe.afterHash mismatch.");
      }

      console.log(`       preExistingDirty: ${fe.preExistingDirty}`);
      console.log(`       beforeHash (USER_A): ${fe.beforeHash?.substring(0, 8)}...`);
      console.log(`       afterHash (B): ${fe.afterHash?.substring(0, 8)}...`);
      console.log(`       actuallyChanged: ${fe.actuallyChanged}, contentMatches: ${fe.contentMatches}, verified: ${fe.verified}`);
      console.log(`${PASS} Test 11: Overlapping dirty + AEGIS change preserved both preExistingDirty and actuallyChanged.`);
      passed++;
    } finally {
      removeTempDir(testDir);
    }
  } catch (err) {
    console.log(`${FAIL} Test 11: ${(err as Error).message}`);
    failed++;
  }

  // ── TEST 12: UNTOUCHED PRE-DIRTY FILE ────────────────────────────────────────
  try {
    console.log("\nTest 12: Untouched pre-dirty file (Case A) is not reported as AEGIS mutation...");
    const testDir = createTempDir("test12");
    try {
      execSync("git init", { cwd: testDir, stdio: "ignore" });
      const userPath = path.join(testDir, "src", "user.ts");
      const featPath = path.join(testDir, "src", "feature.ts");
      fs.mkdirSync(path.dirname(userPath), { recursive: true });
      fs.writeFileSync(userPath, "const user = 'clean';", "utf-8");
      fs.writeFileSync(featPath, "const feature = 'clean';", "utf-8");
      execSync("git add . && git commit -m \"initial\"", { cwd: testDir, stdio: "ignore" });

      // User modifies user.ts BEFORE AEGIS
      fs.writeFileSync(userPath, "const user = 'USER_DIRTY';", "utf-8");

      // AEGIS proposal modifies ONLY feature.ts
      const approvedB = "const feature = 'AEGIS_B';";
      const codeChanges: CodeChange[] = [
        { path: "src/feature.ts", action: "modify", content: approvedB },
      ];

      const baseline = await captureWorkspaceBaseline(testDir, codeChanges);
      if (!baseline.preExistingDirtyFiles.includes("src/user.ts")) {
        throw new Error("Failed to detect user.ts in preExistingDirtyFiles.");
      }

      // Apply AEGIS proposal to feature.ts ONLY
      fs.writeFileSync(featPath, approvedB, "utf-8");

      const evidence = await verifyWorkspaceChanges(testDir, codeChanges, baseline);

      // Verify user.ts is NOT in AEGIS mutation list
      const userEvidence = evidence.fileEvidence.find((f) => f.path === "src/user.ts");
      if (userEvidence) {
        throw new Error("user.ts should NOT be reported in fileEvidence mutation list!");
      }

      // Verify user.ts is NOT flagged as unexpected change
      if (evidence.unexpectedChanges.includes("src/user.ts")) {
        throw new Error("user.ts should NOT be flagged as unexpected change!");
      }

      // Verify feature.ts IS verified as AEGIS mutation
      const featEvidence = evidence.fileEvidence.find((f) => f.path === "src/feature.ts");
      if (!featEvidence || featEvidence.preExistingDirty || !featEvidence.actuallyChanged || !featEvidence.verified) {
        throw new Error("feature.ts evidence mismatch.");
      }

      // Verify user.ts file content was left untouched
      const actualUserContent = fs.readFileSync(userPath, "utf-8");
      if (actualUserContent !== "const user = 'USER_DIRTY';") {
        throw new Error("user.ts content was altered by AEGIS!");
      }

      console.log(`       preExistingDirtyFiles: ${JSON.stringify(evidence.preExistingDirtyFiles)}`);
      console.log(`       unexpectedChanges: ${JSON.stringify(evidence.unexpectedChanges)}`);
      console.log(`       user.ts in AEGIS mutations: NO (Intact: YES)`);
      console.log(`       feature.ts in AEGIS mutations: YES (Verified: ${featEvidence.verified})`);
      console.log(`${PASS} Test 12: Untouched pre-dirty file preserved and not claimed as AEGIS mutation.`);
      passed++;
    } finally {
      removeTempDir(testDir);
    }
  } catch (err) {
    console.log(`${FAIL} Test 12: ${(err as Error).message}`);
    failed++;
  }

  // ── TEST 13: OUTSIDE WORKSPACE PATH BLOCKED (Case A) ──────────────────────────
  try {
    console.log("\nTest 13: Outside workspace path attempt (../outside.txt) is blocked from evidence collection...");
    const testDir = createTempDir("test13");
    try {
      const codeChanges: CodeChange[] = [
        { path: "../outside.txt", action: "modify", content: "hacked" },
      ];

      const baseline = await captureWorkspaceBaseline(testDir, codeChanges);
      const evidence = await verifyWorkspaceChanges(testDir, codeChanges, baseline);

      if (evidence.allVerified) {
        throw new Error("Evidence verification failed to block path escape attempt!");
      }

      const fe = evidence.fileEvidence[0];
      if (fe.verified || !fe.error?.includes("Path escape attempt blocked")) {
        throw new Error(`Expected path escape error not returned. Got: ${fe.error}`);
      }

      console.log(`       All Verified: ${evidence.allVerified}`);
      console.log(`       Error Message: "${fe.error}"`);
      console.log(`${PASS} Test 13: Outside workspace path attempt blocked from evidence collection.`);
      passed++;
    } finally {
      removeTempDir(testDir);
    }
  } catch (err) {
    console.log(`${FAIL} Test 13: ${(err as Error).message}`);
    failed++;
  }

  // ── TEST 14: CREATE TARGET ALREADY EXISTS (Case B) ───────────────────────────
  try {
    console.log("\nTest 14: CREATE target already existing before apply triggers precondition mismatch...");
    const testDir = createTempDir("test14");
    try {
      const filePath = path.join(testDir, "src", "existing.ts");
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, "// already exists", "utf-8");

      const codeChanges: CodeChange[] = [
        { path: "src/existing.ts", action: "add", content: "// already exists" },
      ];

      const baseline = await captureWorkspaceBaseline(testDir, codeChanges);
      if (!baseline.fileBaselines["src/existing.ts"]?.exists) {
        throw new Error("Baseline did not record pre-existing file.");
      }

      const evidence = await verifyWorkspaceChanges(testDir, codeChanges, baseline);
      if (evidence.allVerified) {
        throw new Error("CREATE on existing file should NOT be reported as allVerified.");
      }

      const fe = evidence.fileEvidence[0];
      if (fe.verified || !fe.error?.includes("already existed on disk")) {
        throw new Error(`Expected precondition mismatch error not returned. Got: ${fe.error}`);
      }

      console.log(`       All Verified: ${evidence.allVerified}`);
      console.log(`       Error Message: "${fe.error}"`);
      console.log(`${PASS} Test 14: CREATE on existing target correctly fails verification.`);
      passed++;
    } finally {
      removeTempDir(testDir);
    }
  } catch (err) {
    console.log(`${FAIL} Test 14: ${(err as Error).message}`);
    failed++;
  }

  // ── TEST 15: PRE-DIRTY FILE CHANGES AGAIN (Case C) ───────────────────────────
  try {
    console.log("\nTest 15: Pre-dirty file modified again during apply window is detected as unexpected change...");
    const testDir = createTempDir("test15");
    try {
      execSync("git init", { cwd: testDir, stdio: "ignore" });
      const userPath = path.join(testDir, "src", "user.ts");
      const featPath = path.join(testDir, "src", "feature.ts");
      fs.mkdirSync(path.dirname(userPath), { recursive: true });
      fs.writeFileSync(userPath, "const user = 'clean';", "utf-8");
      fs.writeFileSync(featPath, "const feat = 'clean';", "utf-8");
      execSync("git add . && git commit -m \"initial\"", { cwd: testDir, stdio: "ignore" });

      // User modifies user.ts BEFORE AEGIS workflow
      fs.writeFileSync(userPath, "const user = 'USER_A';", "utf-8");

      const codeChanges: CodeChange[] = [
        { path: "src/feature.ts", action: "modify", content: "const feat = 'AEGIS_B';" },
      ];

      // Capture baseline (user.ts = USER_A)
      const baseline = await captureWorkspaceBaseline(testDir, codeChanges);

      // Simulate user.ts changing AGAIN to USER_B during apply window
      fs.writeFileSync(userPath, "const user = 'USER_B_CONCURRENT';", "utf-8");
      // Apply approved change to feature.ts
      fs.writeFileSync(featPath, "const feat = 'AEGIS_B';", "utf-8");

      const evidence = await verifyWorkspaceChanges(testDir, codeChanges, baseline);
      const hasConcurrentWarning = evidence.unexpectedChanges.some((u) => u.includes("src/user.ts"));

      if (!hasConcurrentWarning) {
        throw new Error(`Concurrent modification of pre-dirty user.ts not detected in unexpectedChanges. Got: ${JSON.stringify(evidence.unexpectedChanges)}`);
      }

      console.log(`       Unexpected Changes Captured: ${JSON.stringify(evidence.unexpectedChanges)}`);
      console.log(`${PASS} Test 15: Concurrent modification of pre-dirty file during apply window detected.`);
      passed++;
    } finally {
      removeTempDir(testDir);
    }
  } catch (err) {
    console.log(`${FAIL} Test 15: ${(err as Error).message}`);
    failed++;
  }

  // ── TEST 16: FILENAME WITH SPACES (Case D) ───────────────────────────────────
  try {
    console.log("\nTest 16: Git status porcelain parsing handles filenames with spaces & quotes...");
    const testDir = createTempDir("test16");
    try {
      execSync("git init", { cwd: testDir, stdio: "ignore" });
      const spaceFile = path.join(testDir, "src", "my file.ts");
      fs.mkdirSync(path.dirname(spaceFile), { recursive: true });
      fs.writeFileSync(spaceFile, "const x = 1;", "utf-8");

      const parsed1 = parseGitPorcelainLine(` M "src/my file.ts"`);
      const parsed2 = parseGitPorcelainLine(`R  "src/old.ts" -> "src/my file.ts"`);
      const parsed3 = parseGitPorcelainLine(`?? src/my file.ts`);

      if (parsed1 !== "src/my file.ts" || parsed2 !== "src/my file.ts" || parsed3 !== "src/my file.ts") {
        throw new Error(`Git porcelain line parsing failed for spaces. Got: ${parsed1}, ${parsed2}, ${parsed3}`);
      }

      console.log(`       Parsed Quoted Spaces: "${parsed1}"`);
      console.log(`       Parsed Rename Spaces: "${parsed2}"`);
      console.log(`${PASS} Test 16: Git porcelain parsing correctly handles paths with spaces.`);
      passed++;
    } finally {
      removeTempDir(testDir);
    }
  } catch (err) {
    console.log(`${FAIL} Test 16: ${(err as Error).message}`);
    failed++;
  }

  // ── TEST 17: SYMLINK ESCAPE (Case E) ─────────────────────────────────────────
  try {
    console.log("\nTest 17: Symlink target escaping workspace is blocked from evidence collection...");
    const testDir = createTempDir("test17");
    const outsideDir = createTempDir("outside17");
    try {
      const outsideFile = path.join(outsideDir, "secret.txt");
      fs.writeFileSync(outsideFile, "top secret content", "utf-8");

      const linkPath = path.join(testDir, "symlink_dir");
      let symlinkCreated = false;
      try {
        fs.symlinkSync(outsideDir, linkPath, "junction");
        symlinkCreated = true;
      } catch {
        // Symlink creation might be restricted on some OS environments without privilege
      }

      if (symlinkCreated) {
        const check = safeResolveWorkspacePath(testDir, "symlink_dir/secret.txt");
        if (check.valid) {
          throw new Error("Symlink escape check failed to block symlink target outside workspace.");
        }
        console.log(`       Symlink Escape Check Result: valid=${check.valid}, reason="${check.reason}"`);
      } else {
        console.log(`       Symlink creation unprivileged on host OS — tested containment helper directly.`);
        const checkDirect = safeResolveWorkspacePath(testDir, "../outside17/secret.txt");
        if (checkDirect.valid) {
          throw new Error("Containment helper failed to block outside path.");
        }
      }

      console.log(`${PASS} Test 17: Symlink containment safety verified.`);
      passed++;
    } finally {
      removeTempDir(testDir);
      removeTempDir(outsideDir);
    }
  } catch (err) {
    console.log(`${FAIL} Test 17: ${(err as Error).message}`);
    failed++;
  }

  console.log(`\n=== RESULTS: ${passed} PASSED, ${failed} FAILED ===`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
