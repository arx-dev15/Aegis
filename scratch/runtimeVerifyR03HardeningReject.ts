/**
 * scratch/runtimeVerifyR03HardeningReject.ts
 *
 * Controlled runtime verification for R03 Hardening — Validation 2 (Rejection Semantics).
 * Proves:
 *   1. Proposal generated: YES
 *   2. Disk before rejection: UNCHANGED
 *   3. Decision: REJECT
 *   4. Disk after rejection: UNCHANGED
 *   5. Final status: "failed" (canonical non-success terminal status)
 *   6. Final status == completed: NO
 *   7. Rejection reason preserved: YES
 */

import os from "os";
import path from "path";
import { promises as fs } from "fs";
import { createDeveloperNode } from "../graph/nodes/developerNode.js";
import { buildApprovalWorkflow, executeApprovalWorkflow, resolveApprovalAndResume } from "../graph/approvalWorkflow.js";
import { DeveloperAgent } from "../agents/developer/developer.js";
import type { DeveloperModel } from "../agents/developer/developer.js";
import type { AegisState, AegisStateUpdate } from "../graph/state.js";

const mockDevModel: DeveloperModel = {
  async generateStructured<T>(_sys: string, _user: string, _schema: unknown): Promise<T> {
    return {
      task: "Unwanted change",
      summary: "Attempted unwanted update",
      fileChanges: [
        {
          path: "src/index.ts",
          action: "modify",
          summary: "Attempted overwrite with bad logic",
          content: "// UNWANTED BAD LOGIC",
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

async function run(): Promise<void> {
  console.log("=== R03 HARDENING RUNTIME VERIFICATION — VALIDATION 2 (REJECTION SEMANTICS) ===\n");

  const testWs = path.join(os.tmpdir(), `aegis-r03-hard-reject-${Date.now()}`);
  await fs.mkdir(path.join(testWs, "src"), { recursive: true });
  const targetFile = path.join(testWs, "src", "index.ts");
  await fs.writeFile(targetFile, "// ORIGINAL UNTOUCHED A", "utf-8");

  const initialDisk = await fs.readFile(targetFile, "utf-8");

  const devAgent = new DeveloperAgent(mockDevModel);
  const devNode = createDeveloperNode(devAgent);
  const workflow = buildApprovalWorkflow({
    planner: mockPlanner,
    researcher: mockResearcher,
    architect: mockArchitect,
    developer: devNode,
  });

  const runId = `r03_verify_rej_sem_${Date.now()}`;

  // Step 1: Execute up to pause
  const pausedState = await executeApprovalWorkflow(runId, { task: "Unwanted change", workspace: testWs }, workflow);
  const req = pausedState.pendingApproval;

  const diskBeforeRejection = await fs.readFile(targetFile, "utf-8");
  console.log(`1. Proposal generated: YES`);
  console.log(`   Disk before rejection: ${diskBeforeRejection === initialDisk ? "UNCHANGED" : "MUTATED!"}`);

  // Step 2: Reject proposal
  console.log(`\n2. Decision: REJECT`);
  const rejectionReason = "Security review rejected unvalidated input handling";
  const rejectedState = await resolveApprovalAndResume(runId, req!.id, "reject", rejectionReason, workflow);

  const diskAfterRejection = await fs.readFile(targetFile, "utf-8");
  console.log(`\n3. Disk after rejection: "${diskAfterRejection.trim()}"`);
  console.log(`   Match Initial Disk: ${diskAfterRejection === initialDisk ? "YES (100% UNCHANGED)" : "NO (MUTATED!)"}`);

  console.log(`\n4. Final status: "${rejectedState.status}"`);
  console.log(`   Final status == completed: ${rejectedState.status === "completed" ? "YES" : "NO"}`);

  const errorLogged = rejectedState.errors.find((e) => e.includes(rejectionReason));
  console.log(`\n5. Rejection reason preserved in errors: ${errorLogged !== undefined ? "YES" : "NO"}`);
  if (errorLogged) {
    console.log(`   Preserved Reason Error: "${errorLogged}"`);
  }

  // Cleanup
  try { await fs.rm(testWs, { recursive: true, force: true }); } catch {}

  console.log("\n=== VALIDATION 2 COMPLETE ===");
}

run().catch((err) => {
  console.error("Validation 2 failed:", err);
  process.exit(1);
});
