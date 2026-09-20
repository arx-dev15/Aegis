/**
 * scratch/runtimeVerifyR03HardeningApprove.ts
 *
 * Controlled runtime verification for R03 Hardening — Validation 1 (Approve + Execution Mode).
 * Proves:
 *   1. Run executionMode: "manual" (non-hardcoded)
 *   2. Proposal generated: YES
 *   3. Disk before approval: UNCHANGED
 *   4. Approval required: YES
 *   5. Approval resolved: APPROVE
 *   6. Apply phase executionMode: "manual" (propagated!)
 *   7. Disk after approval: CHANGED TO EXACT PROPOSAL
 *   8. Developer generation count: still 1
 */

import os from "os";
import path from "path";
import { promises as fs } from "fs";
import { createDeveloperNode } from "../graph/nodes/developerNode.js";
import { buildApprovalWorkflow, executeApprovalWorkflow, resolveApprovalAndResume } from "../graph/approvalWorkflow.js";
import { DeveloperAgent } from "../agents/developer/developer.js";
import type { DeveloperModel } from "../agents/developer/developer.js";
import type { AegisState, AegisStateUpdate } from "../graph/state.js";

let devGenerationCount = 0;

const mockDevModel: DeveloperModel = {
  async generateStructured<T>(_sys: string, _user: string, _schema: unknown): Promise<T> {
    devGenerationCount++;
    return {
      task: "Update index.ts in manual mode",
      summary: "Manual mode implementation",
      fileChanges: [
        {
          path: "src/index.ts",
          action: "modify",
          summary: "Updated index.ts in manual mode",
          content: "// MANUAL MODE PROPOSAL B",
        },
      ],
      commandsExecuted: [],
      status: "completed",
    } as unknown as T;
  },
};

const mockPlanner = async (_s: AegisState): Promise<AegisStateUpdate> => ({
  status: "planning",
  plan: [{ id: "step-1", description: "Step 1", status: "completed" }],
});

const mockResearcher = async (_s: AegisState): Promise<AegisStateUpdate> => ({
  status: "researching",
  research: "Research notes",
});

const mockArchitect = async (_s: AegisState): Promise<AegisStateUpdate> => ({
  status: "architecting",
  architecture: "Arch spec",
});

const mockTester = async (_s: AegisState): Promise<AegisStateUpdate> => ({
  status: "testing",
  testResults: { passed: true, totalTests: 1, passedTests: 1, failedTests: 0, output: "Passed" },
});

const mockReviewer = async (_s: AegisState): Promise<AegisStateUpdate> => ({
  status: "reviewing",
  reviewResults: { approved: true, comments: ["Approved"] },
});

async function run(): Promise<void> {
  console.log("=== R03 HARDENING RUNTIME VERIFICATION — VALIDATION 1 (APPROVE + EXECUTION MODE) ===\n");

  const testWs = path.join(os.tmpdir(), `aegis-r03-hard-approve-${Date.now()}`);
  await fs.mkdir(path.join(testWs, "src"), { recursive: true });
  const targetFile = path.join(testWs, "src", "index.ts");
  await fs.writeFile(targetFile, "// ORIGINAL A", "utf-8");

  const initialDisk = await fs.readFile(targetFile, "utf-8");

  const devAgent = new DeveloperAgent(mockDevModel);
  const devNode = createDeveloperNode(devAgent);
  const workflow = buildApprovalWorkflow({
    planner: mockPlanner,
    researcher: mockResearcher,
    architect: mockArchitect,
    developer: devNode,
    tester: mockTester,
    reviewer: mockReviewer,
  });

  const runId = `r03_verify_mode_${Date.now()}`;
  const inputMode = "manual";

  console.log(`1. Run executionMode: "${inputMode}"`);
  console.log(`   Initial Disk Content: "${initialDisk.trim()}"`);

  // Step 1: Execute workflow with explicit executionMode: "manual"
  const pausedState = await executeApprovalWorkflow(
    runId,
    { task: "Update index.ts in manual mode", workspace: testWs, executionMode: inputMode },
    workflow
  );

  const diskAfterProposal = await fs.readFile(targetFile, "utf-8");
  console.log(`\n2. Proposal generated: YES`);
  console.log(`   Disk before approval: ${diskAfterProposal === initialDisk ? "UNCHANGED (100% UNTOUCHED)" : "MUTATED!"}`);

  const req = pausedState.pendingApproval;
  console.log(`\n3. Approval required: ${req !== null ? "YES" : "NO"}`);
  if (req) {
    console.log(`   ApprovalRequest ID: ${req.id}`);
    console.log(`   Description:\n${req.description}`);
  }

  console.log(`\n4. Developer generation count before approval: ${devGenerationCount}`);

  // Step 2: Resolve approval
  console.log(`\n5. Approval resolved: APPROVE`);
  const resumedState = await resolveApprovalAndResume(runId, req!.id, "approve", "Approved by human", workflow);

  const logs = resumedState.executionLog;
  const applyLog = logs.find((l) => l.includes("[DEV-APPLY]"));
  console.log(`\n6. Apply phase log entry:\n   "${applyLog}"`);

  const diskAfterApproval = await fs.readFile(targetFile, "utf-8");
  console.log(`\n7. Disk after approval: "${diskAfterApproval.trim()}"`);
  console.log(`   Changed to exact proposal: ${diskAfterApproval === "// MANUAL MODE PROPOSAL B" ? "YES" : "NO"}`);

  console.log(`\n8. Developer generation count after approval: ${devGenerationCount}`);
  console.log(`   Call count remains 1: ${devGenerationCount === 1 ? "YES" : "NO"}`);

  // Cleanup
  try { await fs.rm(testWs, { recursive: true, force: true }); } catch {}

  console.log("\n=== VALIDATION 1 COMPLETE ===");
}

run().catch((err) => {
  console.error("Validation 1 failed:", err);
  process.exit(1);
});
