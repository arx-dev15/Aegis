/**
 * tests/acceptance/core-reliability-hardening.acceptance.test.ts
 *
 * AEGIS Core Reliability Hardening Acceptance Suite
 *
 * Verifies Part B fixes:
 * 1. Cancellation races: Running processes aborted, cancelled run cannot resume approval, terminal state respected.
 * 2. Concurrent run updates & atomic persistence: Atomic temp write with rename prevents state corruption.
 * 3. Approval identity, replay protection & cross-workspace authorization:
 *    Lock files prevent replay, cross-workspace approval context rejected.
 * 4. Verification evidence consistency & environment failure routing:
 *    Missing dependencies classified as environment_failure; autonomous repair skipped.
 * 5. Model tool argument validation & sandbox bypass prevention:
 *    Empty strings, whitespace, null bytes rejected by Zod schema.
 * 6. Trusted-command classification:
 *    Indirect shell executions (sh, bash, cmd, powershell) strictly forced to sandbox.
 * 7. Ground truth enforcement:
 *    Tester agent cannot report passed = true when actual terminal execution failed.
 */

import assert from "assert";
import fs from "fs";
import os from "os";
import path from "path";
import {
  runCommand,
  isUntrustedRepositoryCommand,
  isEnvironmentOrSetupFailure,
  TerminalInputSchema,
  abortRunningCommand,
} from "../../src/tools/terminal/index.js";
import {
  approvalRuntime,
  resolveApprovalAndResume,
} from "../../src/runtime/approvalWorkflow.js";
import { enforceToolGuardrail } from "../../src/security/index.js";
import { TesterAgent, TerminalRunner, TesterModel } from "../../src/workflows/agents/tester/tester.js";

async function main(): Promise<void> {
  console.log("==================================================================");
  console.log("  AEGIS CORE RELIABILITY HARDENING ACCEPTANCE SUITE");
  console.log("==================================================================\n");

  const fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), "aegis-hardening-fixture-"));

  try {
    // ── CHECK 1: Cancellation Races & Running Process Cleanup ─────────────────
    console.log("1. Verifying cancellation races and active process abortion...");
    const runId1 = `cancel-run-${Date.now()}`;
    approvalRuntime.registerRun(runId1, {
      task: "Cancellation test task",
      workspace: fixtureDir,
      status: "running",
      codeChanges: [],
      executionKind: "WORKFLOW",
      plan: [],
      errors: [],
      executionLog: [],
    });

    // Start a running command with runId
    const cmdPromise = runCommand("node -e \"setTimeout(() => {}, 30000)\"", {
      cwd: fixtureDir,
      workspaceRoot: fixtureDir,
      runId: runId1,
      timeoutMs: 30_000,
      sandbox: "none",
      trusted: true,
    });

    // Allow process to spawn
    await new Promise((r) => setTimeout(r, 200));

    // Cancel run via canonical approval runtime
    const cancelled = approvalRuntime.cancelRun(runId1);
    assert.strictEqual(cancelled.state.status, "cancelled", "Run status must be cancelled");

    // Command should finish promptly because cancelRun called abortRunningCommand
    const cmdResult = await cmdPromise;
    assert.strictEqual(cmdResult.success, false, "Aborted command must not report success");

    // Attempting to resolve approval on cancelled run must throw
    await assert.rejects(
      async () => {
        await resolveApprovalAndResume(runId1, "dummy-approval", "approve");
      },
      /Cannot resume cancelled run/i,
      "Cannot resume cancelled run"
    );

    // Attempting to cancel already cancelled run must throw
    assert.throws(
      () => {
        approvalRuntime.cancelRun(runId1);
      },
      /terminal status "cancelled"/i,
      "Cannot cancel run with terminal status"
    );
    console.log("   ✅ Confirmed: Active process aborted, cancelled run cannot resume, terminal status enforced.\n");

    // ── CHECK 2: Concurrent Run Updates & Atomic Persistence ─────────────────
    console.log("2. Verifying atomic run persistence and concurrent updates...");
    const runId2 = `concurrent-run-${Date.now()}`;
    approvalRuntime.registerRun(runId2, {
      task: "Concurrency test",
      workspace: fixtureDir,
      status: "running",
      codeChanges: [],
      executionKind: "WORKFLOW",
      plan: [],
      errors: [],
      executionLog: [],
    });

    // Fire 10 concurrent state updates
    const updates = Array.from({ length: 10 }, (_, i) => {
      return Promise.resolve().then(() => {
        approvalRuntime.updateRunState(runId2, {
          task: "Concurrency test",
          workspace: fixtureDir,
          status: "running",
          codeChanges: [],
          executionKind: "WORKFLOW",
          plan: [],
          errors: [],
          executionLog: [`Update-${i}`],
        });
      });
    });
    await Promise.all(updates);

    const persisted = approvalRuntime.getPersistedRun(runId2);
    assert.ok(persisted, "Persisted run must exist");
    assert.ok(persisted.events.length >= 10, "All concurrent events must be recorded without corrupting JSON");
    console.log("   ✅ Confirmed: Atomic temp writes with rename prevent persistent file corruption.\n");

    // ── CHECK 3: Approval Identity & Cross-Workspace Authorization ────────────
    console.log("3. Verifying approval replay protection and cross-workspace isolation...");
    const foreignWorkspace = path.join(os.tmpdir(), "foreign-workspace");
    if (!fs.existsSync(foreignWorkspace)) fs.mkdirSync(foreignWorkspace);

    const guardResult = enforceToolGuardrail({
      toolName: "terminal",
      action: "execute_terminal",
      target: "npm test",
      executionMode: "semi-auto",
      runId: "auth-run-1",
      isApproved: true,
      approvalContext: {
        runId: "auth-run-1",
        approvalId: "appr-valid",
        workspace: fs.realpathSync(fixtureDir).toLowerCase(),
        allowedActions: ["execute_terminal"],
        allowedTargets: ["npm test"],
      },
      context: {
        // Different workspace!
        workspaceIdentity: fs.realpathSync(foreignWorkspace).toLowerCase(),
      },
    });

    // Cross-workspace execution MUST NOT be authorized by approval for another workspace
    assert.strictEqual(guardResult.decision, "REQUIRE_APPROVAL", "Cross-workspace approval must be rejected");
    assert.strictEqual(guardResult.allowed, false, "Must not be allowed across workspaces");

    // Replay protection: claiming approval twice must throw conflict
    const claimRunId = `claim-run-${Date.now()}`;
    approvalRuntime.registerRun(claimRunId, {
      task: "Claim test",
      workspace: fixtureDir,
      status: "paused",
      codeChanges: [],
      executionKind: "WORKFLOW",
      plan: [],
      errors: [],
      executionLog: [],
    });
    const lock1 = approvalRuntime.claimApproval(claimRunId, "appr-123");
    assert.ok(fs.existsSync(lock1), "Lock file must be created on first claim");
    assert.throws(
      () => {
        approvalRuntime.claimApproval(claimRunId, "appr-123");
      },
      /already being resolved/i,
      "Second claim must fail with conflict"
    );
    approvalRuntime.releaseApprovalClaim(lock1);
    console.log("   ✅ Confirmed: Cross-workspace authorization rejected and approval replay prevented.\n");

    // ── CHECK 4: Environment Failure Classification & Repair Protection ───────
    console.log("4. Verifying environment failure classification and autonomous repair skipping...");
    assert.strictEqual(isEnvironmentOrSetupFailure("Error: Cannot find module 'express'"), true);
    assert.strictEqual(isEnvironmentOrSetupFailure("MODULE_NOT_FOUND"), true);
    assert.strictEqual(isEnvironmentOrSetupFailure("npm ERR! missing: typescript@^5.0.0"), true);
    assert.strictEqual(isEnvironmentOrSetupFailure("sh: 1: pytest: not found"), true);
    assert.strictEqual(isEnvironmentOrSetupFailure("[SANDBOX-CONFIG-ERROR] No image"), true);
    assert.strictEqual(isEnvironmentOrSetupFailure("Docker execution error: daemon down"), true);
    // Real code failures are NOT environment failures:
    assert.strictEqual(isEnvironmentOrSetupFailure("AssertionError: expected 5 to equal 6"), false);
    assert.strictEqual(isEnvironmentOrSetupFailure("1 of 12 tests failed: math.test.js"), false);
    console.log("   ✅ Confirmed: Missing dependencies correctly separated from code defects.\n");

    // ── CHECK 5: Model Tool Argument Validation & Sandbox Bypass Prevention ───
    console.log("5. Verifying tool argument schema validation...");
    assert.throws(() => TerminalInputSchema.parse({ command: "" }), /cannot be empty/i);
    assert.throws(() => TerminalInputSchema.parse({ command: "    " }), /cannot be whitespace/i);
    assert.throws(() => TerminalInputSchema.parse({ command: "npm test\0; rm -rf /" }), /null bytes/i);
    assert.ok(TerminalInputSchema.parse({ command: "npm test" }), "Valid command passes schema");
    console.log("   ✅ Confirmed: Null bytes, empty and whitespace commands rejected before execution.\n");

    // ── CHECK 6: Trusted-Command Classification & Indirect Shell Execution ────
    console.log("6. Verifying indirect shell execution classification...");
    assert.strictEqual(isUntrustedRepositoryCommand("sh -c 'git status'"), true, "Indirect sh must be untrusted");
    assert.strictEqual(isUntrustedRepositoryCommand("bash -c 'npm test'"), true, "Indirect bash must be untrusted");
    assert.strictEqual(isUntrustedRepositoryCommand("cmd /c dir"), true, "Indirect cmd must be untrusted");
    assert.strictEqual(isUntrustedRepositoryCommand("cmd.exe /c whoami"), true, "Indirect cmd.exe must be untrusted");
    assert.strictEqual(isUntrustedRepositoryCommand("powershell -Command Get-ChildItem"), true, "Indirect powershell must be untrusted");
    assert.strictEqual(isUntrustedRepositoryCommand("pwsh -c ls"), true, "Indirect pwsh must be untrusted");
    assert.strictEqual(isUntrustedRepositoryCommand("git status"), false, "Clean git status is trusted admin");
    assert.strictEqual(isUntrustedRepositoryCommand("git diff"), false, "Clean git diff is trusted admin");
    console.log("   ✅ Confirmed: Indirect shell wrappers forced to sandbox container.\n");

    // ── CHECK 7: Ground Truth Enforcement (Failed Execution Cannot Pass) ──────
    console.log("7. Verifying ground truth enforcement (tester agent cannot report pass on failed run)...");
    const failingTerminalRunner: TerminalRunner = {
      async run() {
        return {
          stdout: "1 test failed",
          stderr: "AssertionError: Expected true to be false",
          exitCode: 1,
          durationMs: 40,
          success: false,
        };
      },
    };

    // Mock model that falsely claims tests passed
    const hallucinatingModel: TesterModel = {
      async generateStructured() {
        return {
          task: "Verify fix",
          passed: true, // Falsely claiming pass
          totalTests: 1,
          passedTests: 1,
          failedTests: 0,
          testRuns: [{ name: "math.test.js", passed: true }],
          coverageGaps: [],
          summary: "All tests passed cleanly!",
        };
      },
    };

    const agent = new TesterAgent(hallucinatingModel, failingTerminalRunner);
    const result = await agent.test("Verify fix", "diff", {
      workspace: fixtureDir,
      testCommand: "npm test",
    });

    assert.strictEqual(result.passed, false, "Ground truth must override hallucinated pass when terminal failed");
    assert.ok(result.failedTests >= 1, "Failed tests count must be at least 1");
    console.log("   ✅ Confirmed: Ground truth enforced; failed terminal execution cannot return success.\n");

    console.log("==================================================================");
    console.log("  ALL 7 CORE RELIABILITY HARDENING CHECKS PASSED SUCCESSFULLY! ✅");
    console.log("==================================================================\n");
  } finally {
    try {
      fs.rmSync(fixtureDir, { recursive: true, force: true });
    } catch {}
  }
}

main().catch((err) => {
  console.error("❌ Hardening acceptance test failed:", err);
  process.exit(1);
});
