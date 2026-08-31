/**
 * graph/approvalWorkflow.test.ts
 *
 * Feature 23 — Human-in-the-Loop Unit Tests
 *
 * Verifies safe action execution, protected action detection & approval request creation,
 * workflow interruption/pausing, approve-resume execution, reject-prevent execution,
 * and state preservation across pause/resume cycles.
 */

import { requiresApproval } from "./edges/approvalGate.js";
import {
  buildApprovalWorkflow,
  executeApprovalWorkflow,
  resolveApprovalAndResume,
} from "./approvalWorkflow.js";
import type { AegisState, AegisStateUpdate } from "./state.js";

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

// ── Mock Nodes for Fast Deterministic Testing ─────────────────────────────────

const mockPlanner = async (state: AegisState): Promise<AegisStateUpdate> => ({
  status: "planning",
  plan: [{ id: "step-1", description: "Design module", status: "completed" }],
});

const mockResearcher = async (state: AegisState): Promise<AegisStateUpdate> => ({
  status: "researching",
  research: "Mock research analysis complete.",
});

const mockArchitect = async (state: AegisState): Promise<AegisStateUpdate> => ({
  status: "architecting",
  architecture: "Mock architecture design spec.",
  codeChanges: [
    { path: "src/auth.ts", action: "modify", summary: "Update auth middleware" },
  ],
});

const mockDeveloper = async (state: AegisState): Promise<AegisStateUpdate> => ({
  status: "developing",
  executionLog: ["[DEV-TOOL] Executed file changes safely"],
});

// Compiled workflow with fast deterministic mock nodes
const testApprovalWorkflow = buildApprovalWorkflow({
  planner: mockPlanner,
  researcher: mockResearcher,
  architect: mockArchitect,
  developer: mockDeveloper,
});

async function runTests(): Promise<void> {
  console.log("=================================================");
  console.log("  AEGIS HUMAN-IN-THE-LOOP TESTS (Feature 23)");
  console.log("=================================================\n");

  let passed = 0;

  // ── Test 1: Safe Action Detection Policy ───────────────────────────────────
  {
    console.log("Test 1: Safe Action Detection Policy...");
    const safeRead = requiresApproval("read_file", { executionMode: "semi-auto", riskLevel: "low" });
    assert(safeRead === false, "Safe read action should NOT require approval");

    const safeSearch = requiresApproval("search_docs", { executionMode: "semi-auto", riskLevel: "low" });
    assert(safeSearch === false, "Safe search action should NOT require approval");

    console.log("  ✅ Passed Safe Action Detection Policy\n");
    passed++;
  }

  // ── Test 2: Protected Action Triggers Approval & Pauses Workflow ─────────────
  {
    console.log("Test 2: Protected Action Triggers Approval & Pauses Workflow...");
    const runId = `run_appr_${Date.now()}_1`;

    const state = await executeApprovalWorkflow(
      runId,
      { task: "Refactor database connection module", workspace: "dummy_workspace" },
      testApprovalWorkflow
    );

    assert(state.status === "paused", `Workflow should pause with status 'paused', got '${state.status}'`);
    assert(state.pendingApproval !== null, "pendingApproval should be created");
    assert(state.pendingApproval?.action === "write_file", "Action requiring approval should be write_file");
    assert(state.pendingApproval?.riskLevel === "high", "Risk level should be high");

    console.log("  ✅ Passed Protected Action Approval & Graph Pause\n");
    passed++;
  }

  // ── Test 3: Human Decision APPROVE Resumes and Executes Action ─────────────
  {
    console.log("Test 3: Human Decision APPROVE Resumes Execution...");
    const runId = `run_appr_${Date.now()}_2`;

    // 1. Initial execution pauses at approval gate
    const pausedState = await executeApprovalWorkflow(
      runId,
      { task: "Add security headers middleware" },
      testApprovalWorkflow
    );

    assert(pausedState.status === "paused", "State should be paused");
    const approvalId = pausedState.pendingApproval!.id;

    // 2. Human approves decision
    const resumedState = await resolveApprovalAndResume(
      runId,
      approvalId,
      "approve",
      "Approved by Security Lead",
      testApprovalWorkflow
    );

    assert(resumedState.status === "developing", `Resumed status should be 'developing', got '${resumedState.status}'`);
    assert(resumedState.pendingApproval === null, "pendingApproval should be cleared");
    assert(resumedState.approvalDecision?.action === "approve", "Decision should be approve");

    console.log("  ✅ Passed Human Decision APPROVE Resumes Execution\n");
    passed++;
  }

  // ── Test 4: Human Decision REJECT Resumes & Prevents Action Execution ────────
  {
    console.log("Test 4: Human Decision REJECT Prevents Action Execution...");
    const runId = `run_appr_${Date.now()}_3`;

    // 1. Initial execution pauses at approval gate
    const pausedState = await executeApprovalWorkflow(
      runId,
      { task: "Delete legacy authentication routes" },
      testApprovalWorkflow
    );

    assert(pausedState.status === "paused", "State should be paused");
    const approvalId = pausedState.pendingApproval!.id;

    // 2. Human rejects decision
    const rejectedState = await resolveApprovalAndResume(
      runId,
      approvalId,
      "reject",
      "Rejecting file deletion: legacy routes are still needed for backwards compatibility.",
      testApprovalWorkflow
    );

    assert(rejectedState.status === "completed", `Rejected status should terminate safely as 'completed', got '${rejectedState.status}'`);
    assert(rejectedState.approvalDecision?.action === "reject", "Decision should be reject");
    assert(
      rejectedState.executionLog.some((log) => log.includes("HUMAN-APPROVAL-REJECTED")),
      "Execution log should record human rejection refusal"
    );
    assert(
      rejectedState.errors.some((err) => err.includes("legacy routes are still needed")),
      "Errors list should record rejection reason"
    );

    console.log("  ✅ Passed Human Decision REJECT Prevents Action Execution\n");
    passed++;
  }

  // ── Test 5: State Preservation Across Pause & Resume Cycle ──────────────────
  {
    console.log("Test 5: State Preservation Across Pause & Resume...");
    const runId = `run_appr_${Date.now()}_4`;

    const initialTask = "Implement user session timeout handler";
    const pausedState = await executeApprovalWorkflow(
      runId,
      { task: initialTask },
      testApprovalWorkflow
    );

    assert(pausedState.task === initialTask, "Task description should be preserved on pause");
    assert(pausedState.plan.length > 0, "Plan steps generated prior to pause should be preserved");
    assert(pausedState.research.length > 0, "Research findings should be preserved");
    assert(pausedState.architecture.length > 0, "Architecture spec should be preserved");

    const approvalId = pausedState.pendingApproval!.id;
    const resumedState = await resolveApprovalAndResume(
      runId,
      approvalId,
      "approve",
      undefined,
      testApprovalWorkflow
    );

    assert(resumedState.task === initialTask, "Task description should be preserved after resume");
    assert(resumedState.plan.length > 0, "Plan steps should remain intact after resume");
    assert(resumedState.research.length > 0, "Research findings should remain intact after resume");

    console.log("  ✅ Passed State Preservation Across Pause & Resume\n");
    passed++;
  }

  console.log("=================================================");
  console.log(` SUMMARY: ${passed} / 5 test blocks passed successfully.`);
  console.log("=================================================\n");
}

runTests().catch((err) => {
  console.error("❌ Test suite failed with error:", err);
  process.exit(1);
});
