/**
 * scratch/runtimeVerifyR03Reject.ts
 *
 * Controlled runtime verification for R03 — Reject Path.
 * Proves:
 *   1. Initial workspace disk file: "ORIGINAL A"
 *   2. Developer generates proposal -> state receives proposal B
 *   3. Approval Request generated
 *   4. Human REJECT resolved
 *   5. Final disk state remains "ORIGINAL A" (0 bytes modified, no write/delete)
 *   6. Workflow terminates cleanly with status: "completed" and human refusal logged
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
      task: "Unwanted update to index.ts",
      summary: "Attempted file overwrite",
      fileChanges: [
        {
          path: "src/index.ts",
          action: "modify",
          summary: "Attempted overwrite with B",
          content: "// OVERWRITE B",
        },
      ],
      commandsExecuted: [],
      status: "completed",
    } as unknown as T;
  },
};

const mockPlanner = async (_s: AegisState): Promise<AegisStateUpdate> => ({
  status: "planning",
  plan: [{ id: "step-1", description: "Unwanted step", status: "completed" }],
});

const mockResearcher = async (_s: AegisState): Promise<AegisStateUpdate> => ({
  status: "researching",
  research: "Unwanted research",
});

const mockArchitect = async (_s: AegisState): Promise<AegisStateUpdate> => ({
  status: "architecting",
  architecture: "Unwanted architecture",
});

async function run(): Promise<void> {
  console.log("=== R03 RUNTIME VERIFICATION — REJECT PATH ===\n");

  const testWs = path.join(os.tmpdir(), `aegis-r03-reject-${Date.now()}`);
  await fs.mkdir(path.join(testWs, "src"), { recursive: true });
  const targetFile = path.join(testWs, "src", "index.ts");
  await fs.writeFile(targetFile, "// ORIGINAL A\nexport function featureA() { return 'A'; }", "utf-8");

  const initialDiskContent = await fs.readFile(targetFile, "utf-8");
  console.log("1. Disk before proposal generation:");
  console.log(`   File: src/index.ts`);
  console.log(`   Content:\n${initialDiskContent.trim()}`);

  const devAgent = new DeveloperAgent(mockDevModel);
  const devNode = createDeveloperNode(devAgent);
  const workflow = buildApprovalWorkflow({
    planner: mockPlanner,
    researcher: mockResearcher,
    architect: mockArchitect,
    developer: devNode,
  });

  const runId = `r03_verify_reject_${Date.now()}`;

  // Step 1: Initial run up to approval gate pause
  console.log("\n2. Invoking Aegis Workflow...");
  const pausedState = await executeApprovalWorkflow(runId, { task: "Unwanted update", workspace: testWs }, workflow);

  const req = pausedState.pendingApproval;
  console.log("\n3. ApprovalRequest generated:");
  console.log(`   Title: ${req?.title}`);
  console.log(`   Description:\n${req?.description}`);

  // Step 2: Human rejects proposal
  console.log("\n4. Resolving approval with decision: REJECT...");
  const rejectedState = await resolveApprovalAndResume(runId, req!.id, "reject", "User rejected proposal", workflow);

  const finalDiskContent = await fs.readFile(targetFile, "utf-8");
  console.log("\n5. Disk state AFTER rejection:");
  console.log(`   File: src/index.ts`);
  console.log(`   Content:\n${finalDiskContent.trim()}`);
  console.log(`   Match Initial Disk: ${finalDiskContent === initialDiskContent ? "YES (100% UNCHANGED)" : "NO (MUTATED!)"}`);

  console.log(`\n6. Final Workflow Status: ${rejectedState.status}`);
  console.log(`   Rejection Error Logged: ${rejectedState.errors[0]}`);

  // Cleanup
  try { await fs.rm(testWs, { recursive: true, force: true }); } catch {}

  console.log("\n=== REJECT PATH RUNTIME VERIFICATION COMPLETE ===");
}

run().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
