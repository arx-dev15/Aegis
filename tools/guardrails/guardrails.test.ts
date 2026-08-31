/**
 * tools/guardrails/guardrails.test.ts
 *
 * Feature 24 — Tool Permissions / Guardrails Unit Tests
 *
 * Verifies tool action classification, policy evaluation (ALLOW, REQUIRE_APPROVAL, BLOCK),
 * dangerous command blocking, path escape prevention, and Feature 23 approval integration.
 */

import {
  classifyToolAction,
  isDangerousAction,
  evaluatePermission,
  enforceToolGuardrail,
} from "./index";
import {
  executeApprovalWorkflow,
  resolveApprovalAndResume,
  buildApprovalWorkflow,
} from "../../graph/approvalWorkflow";
import type { AegisState, AegisStateUpdate } from "../../graph/state";

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function runTests(): Promise<void> {
  console.log("=================================================");
  console.log("  AEGIS GUARDRAILS & PERMISSIONS TESTS (F24)");
  console.log("=================================================\n");

  let passed = 0;

  // ── Test 1: Read-Only Actions Allowed Automatically ────────────────────────
  {
    console.log("Test 1: Read-Only Actions Allowed Automatically...");
    const cat = classifyToolAction("filesystem", "readFile", "src/index.ts");
    assert(cat === "read-only", "readFile should be classified as read-only");

    const res = enforceToolGuardrail({
      toolName: "filesystem",
      action: "readFile",
      target: "src/index.ts",
      executionMode: "semi-auto",
    });

    assert(res.allowed === true, "Read-only action should be allowed");
    assert(res.decision === "ALLOW", "Decision should be ALLOW");
    assert(res.category === "read-only", "Category should be read-only");

    console.log("  ✅ Passed Read-Only Actions Allowed Automatically\n");
    passed++;
  }

  // ── Test 2: Safe Mutation Actions Allowed in Semi-Auto ────────────────────
  {
    console.log("Test 2: Safe Mutation Actions Allowed in Semi-Auto...");
    const res = enforceToolGuardrail({
      toolName: "filesystem",
      action: "createDir",
      target: "dist/build",
      executionMode: "semi-auto",
    });

    assert(res.allowed === true, "Safe mutation should be allowed in semi-auto");
    assert(res.decision === "ALLOW", "Decision should be ALLOW");
    assert(res.category === "safe-mutation", "Category should be safe-mutation");

    console.log("  ✅ Passed Safe Mutation Actions Allowed\n");
    passed++;
  }

  // ── Test 3: Sensitive Mutation Requires Approval in Semi-Auto ──────────────
  {
    console.log("Test 3: Sensitive Mutation Requires Approval...");
    const res = enforceToolGuardrail({
      toolName: "filesystem",
      action: "deleteFile",
      target: "src/config.ts",
      executionMode: "semi-auto",
    });

    assert(res.allowed === false, "Sensitive mutation should NOT be allowed immediately");
    assert(res.decision === "REQUIRE_APPROVAL", "Decision should be REQUIRE_APPROVAL");
    assert(res.category === "sensitive-mutation", "Category should be sensitive-mutation");
    assert(res.approvalRequest !== undefined, "Should attach Feature 23 ApprovalRequest");
    assert(res.approvalRequest?.action === "deleteFile", "Approval request action should match");

    console.log("  ✅ Passed Sensitive Mutation Requires Approval\n");
    passed++;
  }

  // ── Test 4: Dangerous Commands Blocked (rm -rf /, format C:) ───────────────
  {
    console.log("Test 4: Dangerous Commands Blocked Outright...");
    const resRm = enforceToolGuardrail({
      toolName: "terminal",
      action: "execute_terminal",
      target: "rm -rf /",
      executionMode: "automatic", // Even automatic mode blocks dangerous ops
    });

    assert(resRm.allowed === false, "rm -rf / must be blocked");
    assert(resRm.decision === "BLOCK", "Decision must be BLOCK");
    assert(resRm.category === "dangerous", "Category must be dangerous");
    assert(resRm.code === "ERR_DANGEROUS_ACTION_BLOCKED", "Error code must be ERR_DANGEROUS_ACTION_BLOCKED");

    const resFormat = enforceToolGuardrail({
      toolName: "terminal",
      action: "execute_terminal",
      target: "format C:",
      executionMode: "semi-auto",
    });

    assert(resFormat.allowed === false, "format C: must be blocked");
    assert(resFormat.decision === "BLOCK", "Decision must be BLOCK");

    console.log("  ✅ Passed Dangerous Commands Blocked Outright\n");
    passed++;
  }

  // ── Test 5: Path Escape Attempts Blocked ──────────────────────────────────
  {
    console.log("Test 5: Path Escape Attempts Blocked...");
    const resPath = enforceToolGuardrail({
      toolName: "filesystem",
      action: "readFile",
      target: "../../etc/passwd",
      executionMode: "semi-auto",
    });

    assert(resPath.allowed === false, "Path escape attempt must be blocked");
    assert(resPath.decision === "BLOCK", "Decision must be BLOCK");
    assert(resPath.category === "dangerous", "Category must be dangerous");
    assert(resPath.reason.includes("Path escape attempt blocked"), "Reason should explain path escape");

    console.log("  ✅ Passed Path Escape Attempts Blocked\n");
    passed++;
  }

  // ── Test 6: Feature 23 Approval Integration (Approve -> Execute) ────────────
  {
    console.log("Test 6: Approval Integration — Approved Action Executes...");
    const runId = `run_gdr_${Date.now()}_appr`;

    const mockDeveloper = async (state: AegisState): Promise<AegisStateUpdate> => ({
      status: "developing",
      executionLog: ["[GUARDRAIL-EXEC] Approved file deletion executed safely."],
    });

    const testGraph = buildApprovalWorkflow({
      planner: async () => ({ status: "planning" }),
      researcher: async () => ({ status: "researching" }),
      architect: async () => ({
        status: "architecting",
        codeChanges: [{ path: "old_config.ts", action: "delete" }],
      }),
      developer: mockDeveloper,
    });

    // 1. Start run -> triggers approval check gate and pauses
    const pausedState = await executeApprovalWorkflow(runId, { task: "Delete old config file" }, testGraph);
    assert(pausedState.status === "paused", "Execution should pause at approval gate");

    const approvalId = pausedState.pendingApproval!.id;

    // 2. Approve -> resumes and executes
    const resumedState = await resolveApprovalAndResume(runId, approvalId, "approve", undefined, testGraph);
    assert(resumedState.status === "developing", "Resumed status should be developing");
    assert(resumedState.executionLog.some((l) => l.includes("Approved file deletion")), "Approved action should execute");

    console.log("  ✅ Passed Approval Integration — Approved Action Executes\n");
    passed++;
  }

  // ── Test 7: Feature 23 Approval Integration (Reject -> Block Action) ────────
  {
    console.log("Test 7: Approval Integration — Rejected Action Blocked...");
    const runId = `run_gdr_${Date.now()}_rej`;

    const mockDeveloper = async (state: AegisState): Promise<AegisStateUpdate> => ({
      status: "developing",
      executionLog: ["SHOULD_NOT_BE_REACHED"],
    });

    const testGraph = buildApprovalWorkflow({
      planner: async () => ({ status: "planning" }),
      researcher: async () => ({ status: "researching" }),
      architect: async () => ({
        status: "architecting",
        codeChanges: [{ path: "production_db.ts", action: "delete" }],
      }),
      developer: mockDeveloper,
    });

    // 1. Start run -> triggers approval gate and pauses
    const pausedState = await executeApprovalWorkflow(runId, { task: "Delete production DB config" }, testGraph);
    assert(pausedState.status === "paused", "Execution should pause");

    const approvalId = pausedState.pendingApproval!.id;

    // 2. Reject -> resumes, skips action, and logs refusal
    const rejectedState = await resolveApprovalAndResume(
      runId,
      approvalId,
      "reject",
      "Rejecting production file deletion",
      testGraph
    );

    assert(rejectedState.status === "completed", "Rejected status should be completed safely");
    assert(!rejectedState.executionLog.some((l) => l.includes("SHOULD_NOT_BE_REACHED")), "Developer must NOT execute");
    assert(rejectedState.executionLog.some((l) => l.includes("HUMAN-APPROVAL-REJECTED")), "Rejection logged");

    console.log("  ✅ Passed Approval Integration — Rejected Action Blocked\n");
    passed++;
  }

  // ── Test 8: Direct Tool Invocation Guardrail Interception ───────────────────
  {
    console.log("Test 8: Direct Tool Invocation Guardrail Interception...");
    const { runCommand } = await import("../terminal/index.js");

    const cmdRes = await runCommand("rm -rf /");
    assert(cmdRes.success === false, "runCommand must fail on dangerous command");
    assert(cmdRes.stderr.includes("[GUARDRAIL-BLOCKED]"), "stderr must record guardrail block");

    console.log("  ✅ Passed Direct Tool Invocation Guardrail Interception\n");
    passed++;
  }

  console.log("=================================================");
  console.log(` SUMMARY: ${passed} / 8 test blocks passed successfully.`);
  console.log("=================================================\n");
}

runTests().catch((err) => {
  console.error("❌ Test suite failed with error:", err);
  process.exit(1);
});
