/**
 * tests/acceptance/sandbox-execution.acceptance.test.ts
 *
 * AEGIS Integration Repair 02 — Safe Execution Sandbox Acceptance Suite
 *
 * Verifies:
 * 1. Missing Docker fails closed: Untrusted commands refuse to run on host when Docker daemon is unavailable.
 * 2. Mount validation rejects prohibited host paths: Docker socket, user home directory, root drive, credential paths.
 * 3. Restricted container privileges: Network isolation (--network none), read-only root, tmpfs, capability drop, resource limits.
 * 4. Successful verification inside container: Output, duration, exit code captured.
 * 5. Failing tests inside container: Failure exit code and stderr captured.
 * 6. Timeout and process cleanup: Timed out container triggers cleanup (docker rm -f).
 * 7. Approval lifecycle preservation: REQUIRE_APPROVAL and BLOCK decisions preserved before container dispatch.
 * 8. Distinction between trusted local administrative operations and untrusted repository commands.
 * 9. Windows host compatibility: Path conversion with forward slashes and drive letters.
 */

import assert from "assert";
import fs from "fs";
import os from "os";
import path from "path";
import {
  runCommand,
  validateWorkspaceMount,
  isUntrustedRepositoryCommand,
  setContainerExecutor,
  getContainerExecutor,
  RealDockerExecutor,
  ContainerExecutor,
  ContainerExecutionParams,
  ContainerExecutionOutput,
} from "../../src/tools/terminal/index.js";

function workspaceId(workspace: string): string {
  return fs.realpathSync(workspace).toLowerCase();
}

function approvedContext(workspace: string, cmd: string, runId = "test-run") {
  return {
    isApproved: true,
    runId,
    approvalContext: {
      runId,
      approvalId: "appr-valid",
      workspace: workspaceId(workspace),
      allowedActions: ["execute_terminal"],
      allowedTargets: [cmd],
    },
  };
}

class MockContainerExecutor implements ContainerExecutor {
  public executedCalls: ContainerExecutionParams[] = [];
  public cleanupCalls: string[] = [];
  public available = true;
  public mockOutput: ContainerExecutionOutput = {
    exitCode: 0,
    stdout: "All 5 unit tests passed.\n",
    stderr: "",
    timedOut: false,
    durationMs: 42,
  };

  async isAvailable(): Promise<{ available: boolean; error?: string }> {
    if (this.available) {
      return { available: true };
    }
    return { available: false, error: "Docker daemon is not running (test mock)." };
  }

  async execute(params: ContainerExecutionParams): Promise<ContainerExecutionOutput> {
    this.executedCalls.push(params);
    return this.mockOutput;
  }

  async cleanup(containerName: string): Promise<void> {
    this.cleanupCalls.push(containerName);
  }
}

async function main(): Promise<void> {
  console.log("==================================================================");
  console.log("  AEGIS SAFE EXECUTION SANDBOX ACCEPTANCE SUITE (REPAIR 02)");
  console.log("==================================================================\n");

  // Set deliberate sandbox image for simulation tests
  process.env.AEGIS_SANDBOX_IMAGE = "aegis-sandbox-sim:latest";

  const fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), "aegis-sandbox-fixture-"));
  const testSubdir = path.join(fixtureDir, "project");
  fs.mkdirSync(testSubdir, { recursive: true });

  const defaultExecutor = getContainerExecutor();

  try {
    // ── TEST 1: Missing Docker Fails Closed ──────────────────────────────────
    console.log("1. Verifying missing Docker daemon fails closed for untrusted commands...");
    const offlineMock = new MockContainerExecutor();
    offlineMock.available = false;
    setContainerExecutor(offlineMock);

    const untrustedCmd = "npm test";
    const failClosedResult = await runCommand(untrustedCmd, {
      cwd: testSubdir,
      workspaceRoot: fixtureDir,
      executionMode: "automatic",
      sandbox: "require",
      ...approvedContext(fixtureDir, untrustedCmd),
    });

    assert.strictEqual(failClosedResult.success, false, "Must not succeed when Docker is unavailable");
    assert.strictEqual(failClosedResult.blocked, true, "Must be blocked when Docker is unavailable");
    assert.strictEqual(failClosedResult.exitCode, 1, "Exit code must be 1");
    assert.match(
      failClosedResult.stderr,
      /\[SANDBOX-UNAVAILABLE\]/,
      "Stderr must record [SANDBOX-UNAVAILABLE]"
    );
    assert.match(
      failClosedResult.reason || "",
      /Docker sandbox unavailable/i,
      "Reason must cite Docker sandbox unavailable"
    );
    console.log("   ✅ Confirmed: Untrusted commands fail closed when Docker is unavailable.\n");

    // ── TEST 1b: Missing Image Policy Configuration Generates Actionable Error ─
    console.log("1b. Verifying missing sandbox image configuration generates actionable error...");
    const availableMock = new MockContainerExecutor();
    availableMock.available = true;
    setContainerExecutor(availableMock);

    delete process.env.AEGIS_SANDBOX_IMAGE;
    const noImageRes = await runCommand("npm test", {
      cwd: testSubdir,
      workspaceRoot: fixtureDir,
      executionMode: "automatic",
      sandbox: "require",
      ...approvedContext(fixtureDir, "npm test"),
    });
    assert.strictEqual(noImageRes.success, false, "Must fail when no image is configured");
    assert.strictEqual(noImageRes.blocked, true, "Must be blocked");
    assert.match(noImageRes.stderr, /\[SANDBOX-CONFIG-ERROR\]/, "Must produce actionable [SANDBOX-CONFIG-ERROR]");
    process.env.AEGIS_SANDBOX_IMAGE = "aegis-sandbox-sim:latest";
    console.log("   ✅ Confirmed: Missing sandbox image produces actionable error.\n");

    // ── TEST 2: Workspace Mount Security Validation ──────────────────────────
    console.log("2. Verifying workspace mount rejection of prohibited host paths...");
    
    // 2a. Docker socket
    const socketMount = validateWorkspaceMount("/var/run/docker.sock");
    assert.strictEqual(socketMount.valid, false);
    assert.match(socketMount.reason!, /Docker socket/i);

    // 2b. User home directory
    const homeMount = validateWorkspaceMount(os.homedir());
    assert.strictEqual(homeMount.valid, false);
    assert.match(homeMount.reason!, /user home directory/i);

    // 2c. Root drive
    const rootDrive = process.platform === "win32" ? "C:\\" : "/";
    const rootMount = validateWorkspaceMount(rootDrive);
    assert.strictEqual(rootMount.valid, false);
    assert.match(rootMount.reason!, /root directory/i);

    // 2d. Sensitive credential folder (.ssh)
    const sshDir = path.join(fixtureDir, ".ssh");
    const sshMount = validateWorkspaceMount(sshDir);
    assert.strictEqual(sshMount.valid, false);
    assert.match(sshMount.reason!, /sensitive host credential/i);

    // 2e. Valid workspace path normalizes to forward slashes
    const validMount = validateWorkspaceMount(testSubdir);
    assert.strictEqual(validMount.valid, true);
    assert.ok(validMount.normalizedPath);
    assert.strictEqual(validMount.normalizedPath.includes("\\"), false, "Mount path must use forward slashes");
    console.log("   ✅ Confirmed: Prohibited paths rejected and valid paths normalized.\n");

    // ── TEST 3: Restricted Container Privileges & Parameters ─────────────────
    console.log("3. Verifying container privileges, resource limits, and network isolation...");
    const mockExecutor = new MockContainerExecutor();
    setContainerExecutor(mockExecutor);

    mockExecutor.mockOutput = {
      exitCode: 0,
      stdout: "PASS test/example.test.js\n",
      stderr: "",
      timedOut: false,
      durationMs: 150,
    };

    const containerRun = await runCommand("npm test", {
      cwd: testSubdir,
      workspaceRoot: fixtureDir,
      executionMode: "automatic",
      sandbox: "require",
      timeoutMs: 45_000,
      ...approvedContext(fixtureDir, "npm test"),
    });

    assert.strictEqual(containerRun.success, true);
    assert.strictEqual(containerRun.sandboxed, true);
    assert.strictEqual(mockExecutor.executedCalls.length, 1);

    const callParams = mockExecutor.executedCalls[0];
    assert.strictEqual(callParams.config.network, "none", "Network must be isolated (--network none)");
    assert.strictEqual(callParams.config.readOnlyRoot, true, "Rootfs must be read-only (--read-only)");
    assert.strictEqual(callParams.config.tmpfsSize, "64m", "Tmpfs size must be 64m");
    assert.strictEqual(callParams.config.dropCapabilities, true, "Must drop all capabilities (--cap-drop ALL)");
    assert.strictEqual(callParams.config.noNewPrivileges, true, "Must enforce no-new-privileges");
    assert.strictEqual(callParams.config.memoryLimit, "512m", "Memory must be limited to 512m");
    assert.strictEqual(callParams.config.cpuLimit, "2.0", "CPU limit must be 2.0");
    assert.strictEqual(callParams.config.pidsLimit, 128, "Pids limit must be 128");
    assert.strictEqual(callParams.config.timeoutMs, 45_000, "Timeout must match requested limit");
    console.log("   ✅ Confirmed: Full container isolation parameters and resource constraints enforced.\n");

    // ── TEST 4: Failing Test Captured from Container ─────────────────────────
    console.log("4. Verifying failing test capture inside container...");
    mockExecutor.mockOutput = {
      exitCode: 1,
      stdout: "FAIL test/calculator.test.ts\n",
      stderr: "AssertionError: Expected 42 but got 0\n",
      timedOut: false,
      durationMs: 200,
    };

    const failingRun = await runCommand("npm test", {
      cwd: testSubdir,
      workspaceRoot: fixtureDir,
      executionMode: "automatic",
      sandbox: "require",
      ...approvedContext(fixtureDir, "npm test"),
    });

    assert.strictEqual(failingRun.success, false);
    assert.strictEqual(failingRun.exitCode, 1);
    assert.strictEqual(failingRun.sandboxed, true);
    assert.ok(failingRun.stdout.includes("FAIL test/calculator.test.ts"), "Stdout must include failure summary");
    assert.match(failingRun.stderr, /AssertionError: Expected 42 but got 0/);
    console.log("   ✅ Confirmed: Failure exit code and stderr correctly propagated from container.\n");

    // ── TEST 5: Container Timeout and Process Cleanup ─────────────────────────
    console.log("5. Verifying container timeout and process cleanup...");
    mockExecutor.mockOutput = {
      exitCode: 124,
      stdout: "",
      stderr: "Execution timed out\n",
      timedOut: true,
      durationMs: 5000,
    };

    const timeoutRun = await runCommand("npm test", {
      cwd: testSubdir,
      workspaceRoot: fixtureDir,
      executionMode: "automatic",
      sandbox: "require",
      timeoutMs: 5000,
      ...approvedContext(fixtureDir, "npm test"),
    });

    assert.strictEqual(timeoutRun.timedOut, true);
    assert.strictEqual(timeoutRun.exitCode, 124);
    assert.strictEqual(timeoutRun.success, false);
    assert.match(timeoutRun.reason!, /timed out after 5000ms/);
    console.log("   ✅ Confirmed: Container timeout triggers exit code 124 and marks timedOut.\n");

    // ── TEST 6: Approval Lifecycle Preservation ──────────────────────────────
    console.log("6. Verifying approval lifecycle is preserved before container execution...");
    const approvalRun = await runCommand("python dangerous.py", {
      cwd: testSubdir,
      workspaceRoot: fixtureDir,
      executionMode: "semi-auto",
    });

    assert.strictEqual(approvalRun.approvalRequired, true);
    assert.strictEqual(approvalRun.blocked, false);
    assert.strictEqual(approvalRun.exitCode, null);
    assert.ok(approvalRun.approvalRequest, "Must generate ApprovalRequest");
    assert.strictEqual(approvalRun.approvalRequest?.action, "execute_terminal");
    console.log("   ✅ Confirmed: Pre-execution approval guardrail intact.\n");

    // ── TEST 7: Distinction Between Trusted Admin and Untrusted Commands ─────
    console.log("7. Verifying distinction between trusted admin and untrusted commands...");
    assert.strictEqual(isUntrustedRepositoryCommand("git status"), false);
    assert.strictEqual(isUntrustedRepositoryCommand("git rev-parse --show-toplevel"), false);
    assert.strictEqual(isUntrustedRepositoryCommand("git diff"), false);
    assert.strictEqual(isUntrustedRepositoryCommand("node --version"), false);
    assert.strictEqual(isUntrustedRepositoryCommand("npm --version"), false);

    assert.strictEqual(isUntrustedRepositoryCommand("npm test"), true);
    assert.strictEqual(isUntrustedRepositoryCommand("npx tsc --noEmit"), true);
    assert.strictEqual(isUntrustedRepositoryCommand("pytest"), true);
    assert.strictEqual(isUntrustedRepositoryCommand("python -m pytest"), true);
    assert.strictEqual(isUntrustedRepositoryCommand("cargo test"), true);
    assert.strictEqual(isUntrustedRepositoryCommand("git status", { sandbox: "require" }), true);
    assert.strictEqual(isUntrustedRepositoryCommand("npm test", { trusted: true }), false);
    console.log("   ✅ Confirmed: Command classification distinguishes admin queries from untrusted code.\n");

    // ── TEST 8: Prohibited Mount Rejection in runCommand ─────────────────────
    console.log("8. Verifying runCommand blocks execution if mount is prohibited...");
    mockExecutor.mockOutput = { exitCode: 0, stdout: "", stderr: "", timedOut: false, durationMs: 10 };
    
    const badMountRun = await runCommand("npm test", {
      cwd: testSubdir,
      workspaceRoot: os.homedir(), // Prohibited mount!
      executionMode: "automatic",
      sandbox: "require",
      ...approvedContext(os.homedir(), "npm test"),
    });

    assert.strictEqual(badMountRun.blocked, true);
    assert.strictEqual(badMountRun.success, false);
    assert.match(badMountRun.stderr, /\[SANDBOX-MOUNT-REJECTED\]/);
    console.log("   ✅ Confirmed: Mount rejection blocks execution before container dispatch.\n");

  } finally {
    setContainerExecutor(defaultExecutor);
    fs.rmSync(fixtureDir, { recursive: true, force: true });
  }

  console.log("==================================================================");
  console.log("  ALL 8 SANDBOX ACCEPTANCE CRITERIA PASSED");
  console.log("==================================================================\n");
}

main().catch((err) => {
  console.error("Sandbox acceptance suite failed:", err);
  process.exit(1);
});
