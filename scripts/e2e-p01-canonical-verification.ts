/**
 * scripts/e2e-p01-canonical-verification.ts
 *
 * Real end-to-end acceptance of AEGIS P01:
 * - Real configured provider (Gemini 2.5 / 3.6 flash via universalModel) - NO test adapter.
 * - Disposable git repository with real logic bug.
 * - Canonical CLI invocation: `cli.ts fix`.
 * - Model autonomous investigation & file change proposal.
 * - Human approval pause with persisted state and zero mutation prior to approval.
 * - Canonical CLI approval: `cli.ts approve`.
 * - Mutation application followed by AEGIS's OWN Docker sandbox verification.
 * - Authoritative container execution evidence (exit code 0, container stdout).
 * - Persisted run terminal state: completed.
 */

import assert from "node:assert/strict";
import fs from "fs";
import os from "os";
import path from "path";
import { execSync } from "child_process";

async function main() {
  console.log("==================================================================");
  console.log("  AEGIS P01 — REAL CANONICAL E2E ACCEPTANCE WITH DOCKER & REAL LLM");
  console.log("==================================================================\n");

  const aegisRoot = path.resolve(".");

  // 1. Create disposable fixture repository
  const fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), "aegis-p01-e2e-"));
  const srcDir = path.join(fixtureDir, "src");
  const testDir = path.join(fixtureDir, "test");
  fs.mkdirSync(srcDir, { recursive: true });
  fs.mkdirSync(testDir, { recursive: true });

  const calcJs = [
    "export function add(a, b) {",
    "  // BUG: subtracts instead of adding",
    "  return a - b;",
    "}",
    "",
  ].join("\n");
  fs.writeFileSync(path.join(srcDir, "calc.js"), calcJs, "utf-8");

  const testJs = [
    "import assert from 'node:assert/strict';",
    "import { add } from '../src/calc.js';",
    "",
    "const result = add(2, 3);",
    "assert.equal(result, 5, 'Expected 2 + 3 = 5, but got ' + result);",
    "console.log('PASS: add(2, 3) === 5');",
    "",
  ].join("\n");
  fs.writeFileSync(path.join(testDir, "calc.test.js"), testJs, "utf-8");

  const packageJson = {
    name: "p01-disposable-e2e",
    version: "1.0.0",
    type: "module",
    scripts: {
      test: "node test/calc.test.js",
    },
  };
  fs.writeFileSync(path.join(fixtureDir, "package.json"), JSON.stringify(packageJson, null, 2), "utf-8");

  // Initialize git repo
  execSync("git init", { cwd: fixtureDir, stdio: "ignore" });
  execSync("git config user.name \"P01 Acceptance Tester\"", { cwd: fixtureDir, stdio: "ignore" });
  execSync("git config user.email \"tester@aegis.dev\"", { cwd: fixtureDir, stdio: "ignore" });
  execSync("git add . && git commit -m \"initial commit\"", { cwd: fixtureDir, stdio: "ignore" });

  console.log(`1. Disposable repository prepared at:\n   ${fixtureDir}\n`);

  // 2. Confirm pre-fix test fails
  console.log("2. Running pre-fix test (must fail)...");
  let preTestFailed = false;
  try {
    execSync("npm test", { cwd: fixtureDir, stdio: "pipe" });
  } catch (err: any) {
    preTestFailed = true;
    console.log(`   ✅ Confirmed: pre-fix test fails as expected with logic error.`);
  }
  assert.ok(preTestFailed, "Pre-fix test must fail");

  // 3. Run canonical CLI fix with REAL model (NO AEGIS_TEST_ADAPTER)
  console.log("\n3. Invoking Canonical CLI fix with REAL Model Provider...");
  const fixEnv = { ...process.env };
  delete fixEnv.AEGIS_TEST_ADAPTER;
  delete fixEnv.AEGIS_TEST_SCENARIO;
  fixEnv.GEMINI_MODEL = "gemini-3.1-flash-lite";
  fixEnv.LLM_MODEL = "gemini-3.1-flash-lite";
  fixEnv.AEGIS_REQUIRE_SANDBOX = "1";
  fixEnv.AEGIS_SANDBOX_IMAGE = "aegis-sandbox-node:22";

  const fixCmd = `npx tsx cli.ts fix "Fix the logic bug in src/calc.js so that add(2, 3) equals 5" --workspace "${fixtureDir}"`;
  console.log(`   Running: ${fixCmd}`);
  
  const fixOutput = execSync(fixCmd, {
    cwd: aegisRoot,
    env: fixEnv,
    encoding: "utf-8",
    timeout: 120_000,
  });

  console.log("\n   CLI Fix Output:\n" + fixOutput);

  const runIdMatch = fixOutput.match(/Run ID:\s+([a-zA-Z0-9_]+)/);
  const approvalIdMatch = fixOutput.match(/Approval ID:\s+([a-zA-Z0-9_-]+)/);

  assert.ok(runIdMatch, "Run ID must be present in output");
  assert.ok(approvalIdMatch, "Approval ID must be present in output");

  const runId = runIdMatch[1];
  const approvalId = approvalIdMatch[1];
  console.log(`   ✅ Run ID: ${runId}`);
  console.log(`   ✅ Approval ID: ${approvalId}\n`);

  // 4. Verify run JSON on disk and zero disk mutation before approval
  console.log("4. Verifying persisted run state and mutation safety...");
  const runFile = path.join(aegisRoot, ".aegis", "runs", `${runId}.json`);
  assert.ok(fs.existsSync(runFile), `Run file must exist at ${runFile}`);
  const runData = JSON.parse(fs.readFileSync(runFile, "utf-8"));

  assert.equal(runData.state.status, "paused", "Run must be paused awaiting approval");
  assert.equal(runData.pendingApproval?.id, approvalId, "Approval ID must match");
  assert.ok(runData.state.codeChanges && runData.state.codeChanges.length > 0, "Model must propose code changes");
  
  // Verify disk is untouched
  const currentContent = fs.readFileSync(path.join(srcDir, "calc.js"), "utf-8");
  assert.equal(currentContent, calcJs, "Source file must NOT be modified before human approval!");
  console.log("   ✅ Confirmed: Workspace untouched prior to approval. Run state paused.");

  // 5. Run canonical CLI approve with Docker sandbox
  console.log("\n5. Invoking Canonical CLI approve (executing mutation and Docker sandbox verification)...");
  const approveCmd = `npx tsx cli.ts approve ${runId} ${approvalId} approve`;
  console.log(`   Running: ${approveCmd}`);

  const approveOutput = execSync(approveCmd, {
    cwd: aegisRoot,
    env: fixEnv,
    encoding: "utf-8",
    timeout: 180_000,
  });

  console.log("\n   CLI Approve Output:\n" + approveOutput);

  // 6. Inspect final persisted run state
  console.log("6. Inspecting final persisted run record...");
  const finalRunData = JSON.parse(fs.readFileSync(runFile, "utf-8"));

  console.log(`   Final Status      : ${finalRunData.state.status}`);
  console.log(`   Verification Stat : ${finalRunData.state.testResults?.verificationRecord?.status}`);
  console.log(`   Exit Code         : ${finalRunData.state.testResults?.verificationRecord?.exitCode}`);
  console.log(`   Executed Command  : ${finalRunData.state.testResults?.verificationRecord?.command}`);
  console.log(`   Container Output  : ${finalRunData.state.testResults?.verificationRecord?.stdout?.trim()}`);

  assert.equal(finalRunData.state.status, "completed", "Run must reach completed terminal state");
  assert.ok(finalRunData.state.testResults?.passed, "Tests must have passed");
  assert.equal(finalRunData.state.testResults?.verificationRecord?.exitCode, 0, "Sandbox exit code must be 0");
  assert.equal(finalRunData.state.testResults?.verificationRecord?.status, "passed", "Verification status must be passed");
  assert.ok(
    finalRunData.state.testResults?.verificationRecord?.stdout?.includes("PASS: add(2, 3) === 5"),
    "Sandbox output must contain test success message"
  );

  // 7. Clean up disposable fixture
  fs.rmSync(fixtureDir, { recursive: true, force: true });

  console.log("\n==================================================================");
  console.log("  REAL CANONICAL E2E ACCEPTANCE PASSED SUCCESSFULLY! ✅");
  console.log("==================================================================\n");
}

main().catch((err) => {
  console.error("❌ E2E Acceptance Failed:", err);
  process.exit(1);
});
