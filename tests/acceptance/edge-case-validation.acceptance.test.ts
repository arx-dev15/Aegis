/**
 * tests/acceptance/edge-case-validation.acceptance.test.ts
 *
 * AEGIS Final Core Integrity Edge-Case Validation Suite
 *
 * Exercises the three specific risks requested:
 * 1. Cross-platform dependency compatibility:
 *    - Windows native binary (.node) mounted into Linux container causes ELF / exec format error.
 *    - Verified that it is classified as environment_failure, preserving offline/restricted network
 *      and not mistaken for a code defect.
 * 2. Cross-process cancellation:
 *    - Two independent OS processes sharing the canonical run store (.aegis/runs/<id>.json).
 *    - Process B cancels a running execution started by Process A.
 *    - Running subprocess/container is killed via disk execution descriptor.
 *    - Process A does not overwrite terminal "cancelled" state with "completed".
 *    - Already applied changes are preserved.
 * 3. Concurrent multi-process persistence:
 *    - Two independent processes simultaneously update the same run.
 *    - Mutex locking prevents lost updates, JSON corruption, and conflicting transitions.
 *    - Terminal status ("cancelled") cannot be overwritten by delayed callbacks.
 *    - Simultaneous approval claims enforce replay protection (one winner, one conflict).
 */

import assert from "assert";
import { spawn } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import {
  runCommand,
  isEnvironmentOrSetupFailure,
  RealDockerExecutor,
} from "../../src/tools/terminal/index.js";
import { approvalRuntime } from "../../src/runtime/approvalWorkflow.js";

const tsxCli = path.resolve("node_modules/tsx/dist/cli.mjs");

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function main(): Promise<void> {
  console.log("==================================================================");
  console.log("  AEGIS FINAL CORE INTEGRITY EDGE-CASE VALIDATION SUITE");
  console.log("==================================================================\n");

  const fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), "aegis-edge-cases-"));

  try {
    // ── SECTION 1: Cross-Platform Dependency Incompatibility ─────────────────
    console.log("Section 1: Verifying cross-platform native binary incompatibility detection...");
    
    // Create a fixture containing a Windows PE native binary (.node with MZ header)
    const nativeModuleDir = path.join(fixtureDir, "node_modules", "fake-native-win32");
    fs.mkdirSync(nativeModuleDir, { recursive: true });
    // Write fake Windows PE binary
    fs.writeFileSync(
      path.join(nativeModuleDir, "addon.node"),
      Buffer.from([0x4D, 0x5A, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00])
    );
    fs.writeFileSync(
      path.join(nativeModuleDir, "package.json"),
      JSON.stringify({ name: "fake-native-win32", main: "addon.node" })
    );

    const testScript = path.join(fixtureDir, "test-native.js");
    fs.writeFileSync(
      testScript,
      'try { require("fake-native-win32"); } catch (e) { console.error("ERR_SHARED_LIB:", e.message); process.exit(1); }',
      "utf-8"
    );

    const dockerExecutor = new RealDockerExecutor();
    const dockerAvail = await dockerExecutor.isAvailable();

    if (dockerAvail.available) {
      console.log("   Running real Docker test to observe native ELF/exec format failure...");
      const targetImage = process.env.AEGIS_SANDBOX_IMAGE || "aegis-sandbox-node:22";
      const cmd = "node test-native.js";
      const res = await runCommand(cmd, {
        cwd: fixtureDir,
        workspaceRoot: fixtureDir,
        executionMode: "automatic",
        sandbox: "require",
        trusted: false,
        isApproved: true,
        runId: "native-binary-test",
        approvalContext: {
          runId: "native-binary-test",
          approvalId: "appr-native",
          workspace: fs.realpathSync(fixtureDir).toLowerCase(),
          allowedActions: ["execute_terminal"],
          allowedTargets: [cmd],
        },
        sandboxConfig: { image: targetImage },
      });

      assert.strictEqual(res.success, false, "Execution must fail on native binary incompatibility");
      const isEnvFail = isEnvironmentOrSetupFailure(res.stdout, res.stderr);
      assert.strictEqual(isEnvFail, true, "Native binary incompatibility must be classified as environment_failure");
      console.log("   ✅ Confirmed: Real Docker reported native binary incompatibility as environment_failure.\n");
    } else {
      console.log("   Docker unavailable; testing deterministic error string classification...");
      assert.strictEqual(isEnvironmentOrSetupFailure("", "Error: addon.node: invalid ELF header"), true);
      assert.strictEqual(isEnvironmentOrSetupFailure("", "Error loading shared library: Exec format error"), true);
      assert.strictEqual(isEnvironmentOrSetupFailure("", "was compiled against a different Node.js version"), true);
      console.log("   ✅ Confirmed: Native binary error signatures correctly classified as environment_failure.\n");
    }

    // ── SECTION 2: Cross-Process Cancellation ────────────────────────────────
    console.log("Section 2: Verifying cross-process cancellation coordination...");
    const crossRunId = `cross-proc-cancel-${Date.now()}`;

    approvalRuntime.registerRun(crossRunId, {
      task: "Long running process in Process A",
      workspace: fixtureDir,
      status: "running",
      codeChanges: [{
        path: "src/applied.txt",
        action: "add",
        content: "Already applied prior to cancellation\n",
        summary: "Already applied change",
      }],
      executionKind: "WORKFLOW",
      plan: [],
      errors: [],
      executionLog: [],
    });

    const sleepScript = path.join(fixtureDir, "sleep_task.js");
    fs.writeFileSync(sleepScript, "setTimeout(() => {}, 20000);\n", "utf-8");

    // Helper script that runs a long task in Process A
    const procAScript = path.join(fixtureDir, "procA.ts");
    fs.writeFileSync(
      procAScript,
      `import { runCommand } from "${path.resolve("src/tools/terminal/index.js").replace(/\\/g, "/")}";
import { approvalRuntime } from "${path.resolve("src/runtime/approvalWorkflow.js").replace(/\\/g, "/")}";
import fs from "fs";

async function main() {
  const cmd = "node sleep_task.js";
  const res = await runCommand(cmd, {
    cwd: "${fixtureDir.replace(/\\/g, "/")}",
    workspaceRoot: "${fixtureDir.replace(/\\/g, "/")}",
    runId: "${crossRunId}",
    timeoutMs: 20000,
    sandbox: "none",
    trusted: true,
    isApproved: true,
    executionMode: "automatic",
    approvalContext: {
      runId: "${crossRunId}",
      approvalId: "appr-valid",
      workspace: fs.realpathSync("${fixtureDir.replace(/\\/g, "/")}").toLowerCase(),
      allowedActions: ["execute_terminal"],
      allowedTargets: [cmd],
    },
  });

  // Process A attempts to transition to completed after runCommand
  const current = approvalRuntime.getRun("${crossRunId}");
  approvalRuntime.updateRunState("${crossRunId}", {
    ...current.state,
    status: "completed",
    executionLog: [...current.state.executionLog, "Process A finished"],
  });
  process.exit(res.success ? 0 : 2);
}
main();
`,
      "utf-8"
    );

    // Launch Process A in background using tsx
    const procA = spawn(process.execPath, [tsxCli, procAScript], {
      cwd: process.cwd(),
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });

    procA.stdout?.on("data", (d) => process.stdout.write("[ProcA stdout] " + d));
    procA.stderr?.on("data", (d) => process.stderr.write("[ProcA stderr] " + d));

    // Wait for Process A to register active execution on disk (polling up to 4s)
    const coordFile = path.join(process.cwd(), ".aegis", "runs", `${crossRunId}.exec.json`);
    let foundCoord = false;
    for (let i = 0; i < 40; i++) {
      if (fs.existsSync(coordFile)) {
        foundCoord = true;
        break;
      }
      await sleep(100);
    }
    assert.strictEqual(foundCoord, true, "Execution coordination descriptor must exist on disk");

    // Process B (Current Process) executes cancelRun
    console.log("   Process B issuing cancellation request for Process A's run...");
    const cancelledRecord = approvalRuntime.cancelRun(crossRunId);
    assert.strictEqual(cancelledRecord.state.status, "cancelled", "Run status must be cancelled");

    // Wait for Process A to terminate
    const procAExitCode = await new Promise<number>((resolve) => {
      procA.on("close", (code) => resolve(code ?? 1));
      procA.on("error", () => resolve(1));
    });

    assert.strictEqual(procAExitCode, 2, "Process A command was terminated by Process B");

    // Inspect canonical run store on disk
    const finalRunOnDisk = approvalRuntime.loadRunFromDisk(crossRunId);
    assert.strictEqual(finalRunOnDisk.state.status, "cancelled", "Status on disk must remain cancelled");
    assert.strictEqual(
      finalRunOnDisk.state.codeChanges.length,
      1,
      "Already applied changes must be preserved after cancellation"
    );
    assert.strictEqual(
      finalRunOnDisk.state.codeChanges[0].path,
      "src/applied.txt",
      "Applied change path must match"
    );

    console.log("   ✅ Confirmed: Process B cancelled Process A, terminated subprocess, preserved changes, protected terminal state.\n");

    // ── SECTION 3: Concurrent Multi-Process Persistence ─────────────────────
    console.log("Section 3: Verifying concurrent multi-process persistence and lock serialization...");
    const concurrentRunId = `concurrent-multi-${Date.now()}`;

    approvalRuntime.registerRun(concurrentRunId, {
      task: "Concurrent multi-process run",
      workspace: fixtureDir,
      status: "running",
      codeChanges: [],
      executionKind: "WORKFLOW",
      plan: [],
      errors: [],
      executionLog: [],
    });

    // Helper script for concurrent updater
    const workerScript = path.join(fixtureDir, "worker.ts");
    fs.writeFileSync(
      workerScript,
      `import { approvalRuntime } from "${path.resolve("src/runtime/approvalWorkflow.js").replace(/\\/g, "/")}";

async function main() {
  const workerId = process.argv[2];
  for (let i = 0; i < 5; i++) {
    const run = approvalRuntime.getRun("${concurrentRunId}");
    approvalRuntime.updateRunState("${concurrentRunId}", {
      ...run.state,
      status: "running",
      executionLog: [...run.state.executionLog, \`Worker-\${workerId}-step-\${i}\`],
    });
  }
}
main();
`,
      "utf-8"
    );

    // Spawn 2 independent processes updating simultaneously
    const w1 = spawn(process.execPath, [tsxCli, workerScript, "1"], { cwd: process.cwd(), stdio: "inherit", windowsHide: true });
    const w2 = spawn(process.execPath, [tsxCli, workerScript, "2"], { cwd: process.cwd(), stdio: "inherit", windowsHide: true });

    await Promise.all([
      new Promise<void>((r) => w1.on("close", () => r())),
      new Promise<void>((r) => w2.on("close", () => r())),
    ]);

    // Inspect file on disk
    const runFile = path.join(process.cwd(), ".aegis", "runs", `${concurrentRunId}.json`);
    assert.strictEqual(fs.existsSync(runFile), true, "Run file must exist");
    const rawContent = fs.readFileSync(runFile, "utf-8");

    // Must be valid, uncorrupted JSON
    let parsedRun: any;
    assert.doesNotThrow(() => {
      parsedRun = JSON.parse(rawContent);
    }, "Persisted run must be valid parseable JSON without partial write corruption");

    assert.strictEqual(parsedRun.version, 1, "Schema version must be 1");
    assert.ok(parsedRun.events.length >= 10, "Events must reflect serialized updates: " + parsedRun.events.length);
    console.log("   ✅ Confirmed: Valid JSON and zero lost updates across independent Node processes.\n");

    // Test terminal state protection: delayed callback cannot overwrite cancelled state
    console.log("   Testing delayed callback cannot overwrite terminal state...");
    approvalRuntime.cancelRun(concurrentRunId);

    // Delayed callback attempts to set status = "completed"
    const currentRun = approvalRuntime.getRun(concurrentRunId);
    approvalRuntime.updateRunState(concurrentRunId, {
      ...currentRun.state,
      status: "completed",
    });

    const checkFinal = approvalRuntime.loadRunFromDisk(concurrentRunId);
    assert.strictEqual(checkFinal.state.status, "cancelled", "Terminal cancelled status must NEVER be overwritten by delayed callback");
    console.log("   ✅ Confirmed: Terminal state protected against delayed completion callback.\n");

    // Test simultaneous approval claims (one winner, one conflict)
    console.log("   Testing simultaneous approval claim isolation...");
    const claimRunId = `simul-claim-${Date.now()}`;
    approvalRuntime.registerRun(claimRunId, {
      task: "Simultaneous claim test",
      workspace: fixtureDir,
      status: "paused",
      codeChanges: [],
      executionKind: "WORKFLOW",
      plan: [],
      errors: [],
      executionLog: [],
    });

    const claimScript = path.join(fixtureDir, "claimWorker.ts");
    fs.writeFileSync(
      claimScript,
      `import { approvalRuntime } from "${path.resolve("src/runtime/approvalWorkflow.js").replace(/\\/g, "/")}";
async function main() {
  try {
    const lock = approvalRuntime.claimApproval("${claimRunId}", "appr-simul-1");
    console.log("CLAIM_SUCCESS");
  } catch (e) {
    console.log("CLAIM_CONFLICT");
  }
}
main();
`,
      "utf-8"
    );

    const c1 = spawn(process.execPath, [tsxCli, claimScript], { cwd: process.cwd(), stdio: ["ignore", "pipe", "pipe"] });
    const c2 = spawn(process.execPath, [tsxCli, claimScript], { cwd: process.cwd(), stdio: ["ignore", "pipe", "pipe"] });

    let out1 = "";
    let out2 = "";
    c1.stdout.on("data", (d) => { out1 += d.toString(); });
    c2.stdout.on("data", (d) => { out2 += d.toString(); });

    await Promise.all([
      new Promise<void>((r) => c1.on("close", () => r())),
      new Promise<void>((r) => c2.on("close", () => r())),
    ]);

    const hasSuccess = out1.includes("CLAIM_SUCCESS") || out2.includes("CLAIM_SUCCESS");
    const hasConflict = out1.includes("CLAIM_CONFLICT") || out2.includes("CLAIM_CONFLICT");
    assert.ok(hasSuccess, "One process must claim approval successfully");
    assert.ok(hasConflict, "Other process must receive conflict error");
    console.log("   ✅ Confirmed: Approval claim concurrency enforces mutual exclusion (1 winner, 1 conflict).\n");

    console.log("==================================================================");
    console.log("  ALL EDGE-CASE VALIDATION CHECKS PASSED SUCCESSFULLY! ✅");
    console.log("==================================================================\n");
  } finally {
    try {
      fs.rmSync(fixtureDir, { recursive: true, force: true });
    } catch {}
  }
}

main().catch((err) => {
  console.error("❌ Edge-case validation failed:", err);
  process.exit(1);
});
