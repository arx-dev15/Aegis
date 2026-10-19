/**
 * native-fix-real-bug.acceptance.test.ts
 *
 * AEGIS Native FIX Real-Bug Acceptance Suite
 *
 * Demonstrates the complete transition:
 * Failing test -> native investigation -> corrective proposal -> persisted approval pause
 *   -> separate-process approval -> authorized mutation -> passing test -> persisted verification evidence.
 */

import assert from "node:assert/strict";
import fs from "fs";
import os from "os";
import path from "path";
import crypto from "crypto";
import { execSync } from "child_process";

function sha256(content: string | Buffer): string {
  return crypto.createHash("sha256").update(content).digest("hex");
}

function createFixture(): {
  fixtureDir: string;
  testFilePath: string;
  discountFilePath: string;
  currencyFilePath: string;
  currencyHash: string;
} {
  const fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), "aegis-fix-fixture-"));
  const srcDir = path.join(fixtureDir, "src");
  const testDir = path.join(fixtureDir, "test");
  fs.mkdirSync(srcDir, { recursive: true });
  fs.mkdirSync(testDir, { recursive: true });

  // 1. Defective source file: src/discount.ts (adds instead of subtracting)
  const discountContent = [
    "export function calculateDiscount(price: number, discountPercent: number): number {",
    "  if (price < 0 || discountPercent < 0 || discountPercent > 100) {",
    "    throw new Error(\"Invalid price or discount percentage\");",
    "  }",
    "  const discountAmount = (price * discountPercent) / 100;",
    "  // BUG: adds discountAmount instead of subtracting it",
    "  return price + discountAmount;",
    "}",
    "",
  ].join("\n");
  const discountFilePath = path.join(srcDir, "discount.ts");
  fs.writeFileSync(discountFilePath, discountContent, "utf-8");

  // 2. Unrelated source file: src/currency.ts (Must remain completely untouched)
  const currencyContent = [
    "export function formatCurrency(amount: number, symbol = \"$\"): string {",
    "  return symbol + amount.toFixed(2);",
    "}",
    "",
  ].join("\n");
  const currencyFilePath = path.join(srcDir, "currency.ts");
  fs.writeFileSync(currencyFilePath, currencyContent, "utf-8");
  const currencyHash = sha256(currencyContent);

  // 3. Failing regression test: test/discount.test.ts
  const testContent = [
    "import assert from \"node:assert/strict\";",
    "import { calculateDiscount } from \"../src/discount.ts\";",
    "",
    "const result = calculateDiscount(100, 20);",
    "assert.equal(result, 80, \"Expected discounted price 80, but got \" + result);",
    "console.log(\"Discount test passed!\");",
    "",
  ].join("\n");
  const testFilePath = path.join(testDir, "discount.test.ts");
  fs.writeFileSync(testFilePath, testContent, "utf-8");

  // 4. package.json with test script
  const packageJson = {
    name: "disposable-fixture-repo",
    version: "1.0.0",
    type: "module",
    scripts: {
      test: "node --experimental-strip-types test/discount.test.ts",
    },
  };
  fs.writeFileSync(path.join(fixtureDir, "package.json"), JSON.stringify(packageJson, null, 2), "utf-8");

  // Initialize git repository so git status and baseline evidence work
  execSync("git init", { cwd: fixtureDir, stdio: "ignore" });
  execSync("git config user.name \"Acceptance Tester\"", { cwd: fixtureDir, stdio: "ignore" });
  execSync("git config user.email \"test@example.com\"", { cwd: fixtureDir, stdio: "ignore" });
  execSync("git add . && git commit -m \"Initial commit\"", { cwd: fixtureDir, stdio: "ignore" });

  return { fixtureDir, testFilePath, discountFilePath, currencyFilePath, currencyHash };
}

async function main(): Promise<void> {
  console.log("==================================================================");
  console.log("  AEGIS NATIVE FIX REAL-BUG ACCEPTANCE SUITE");
  console.log("==================================================================\n");

  const aegisRoot = fs.existsSync(path.resolve('.', 'cli.ts')) ? path.resolve('.') : path.resolve(__dirname, '../..');
  const { fixtureDir, discountFilePath, currencyFilePath, currencyHash } = createFixture();

  try {
    // ── STEP 1: Verify Genuine Failing Regression Test Before Patch ─────────
    console.log("1. Running pre-fix regression test in fixture...");
    let preFixFailed = false;
    let preFixOutput = "";
    try {
      execSync("node --experimental-strip-types test/discount.test.ts", {
        cwd: fixtureDir,
        stdio: "pipe",
        encoding: "utf-8",
      });
    } catch (err: any) {
      preFixFailed = true;
      preFixOutput = (err.stdout || "") + (err.stderr || "") + (err.message || "");
    }

    assert.equal(preFixFailed, true, "Pre-fix test must fail due to genuine logic bug");
    assert.match(preFixOutput, /Expected discounted price 80, but got 120/);
    console.log("   ✅ Confirmed failing test: Expected 80, but got 120.\n");

    // ── STEP 2: Exercise Native FIX CLI (Investigation & Proposal) ──────────
    console.log("2. Running native FIX CLI on fixture...");
    const fixCmd = "npx tsx cli.ts fix \"Fix calculateDiscount logic bug\" --workspace \"" + fixtureDir + "\"";
    const fixOutput = execSync(fixCmd, {
      cwd: aegisRoot,
      env: {
        ...process.env,
        AEGIS_TEST_ADAPTER: "1",
        AEGIS_TEST_COMMAND: "node --experimental-strip-types test/discount.test.ts",
      },
      encoding: "utf-8",
    });

    const runIdMatch = fixOutput.match(/Run ID:\s+([a-zA-Z0-9_]+)/);
    const approvalIdMatch = fixOutput.match(/Approval ID:\s+([a-zA-Z0-9_-]+)/);

    assert.ok(runIdMatch, "Run ID must be output: " + fixOutput);
    assert.ok(approvalIdMatch, "Approval ID must be output: " + fixOutput);

    const runId = runIdMatch[1];
    const approvalId = approvalIdMatch[1];
    console.log("   ✅ Native FIX proposed change. Run ID: " + runId + ", Approval ID: " + approvalId);

    // Verify run record on disk
    const runFilePath = path.join(aegisRoot, ".aegis", "runs", runId + ".json");
    assert.ok(fs.existsSync(runFilePath), "Persisted run record must exist on disk");
    const runRecord = JSON.parse(fs.readFileSync(runFilePath, "utf-8"));

    assert.equal(runRecord.state.status, "paused", "Run status must be paused pending approval");
    assert.equal(runRecord.pendingApproval?.id, approvalId, "Pending approval ID must match");
    assert.equal(runRecord.state.codeChanges?.length, 1, "Must have exactly 1 proposed code change");

    const proposal = runRecord.state.codeChanges[0];
    assert.equal(proposal.path, "src/discount.ts", "Proposal must target the defective source file");
    assert.equal(proposal.action, "modify", "Proposal action must be modify");
    assert.ok(proposal.content.includes("return price - discountAmount;"), "Proposal must fix the addition defect");

    // ── STEP 3: Confirm Disk is Untouched Before Approval ───────────────────
    console.log("3. Verifying fixture disk is completely unchanged before approval...");
    const discountBeforeApprove = fs.readFileSync(discountFilePath, "utf-8");
    assert.ok(discountBeforeApprove.includes("return price + discountAmount;"), "Source file must not change before approval");
    assert.equal(sha256(fs.readFileSync(currencyFilePath, "utf-8")), currencyHash, "Unrelated file must remain untouched");
    console.log("   ✅ Confirmed zero disk mutations prior to human approval.\n");

    // ── STEP 4: Test Approval Gates (Rejection, Stale Workspace, Replay) ────
    console.log("4. Testing approval security gates...");

    // 4a. Rejection gate
    console.log("   4a. Testing rejection decision...");
    const rejOutput = execSync("npx tsx cli.ts fix \"Reject test run\" --workspace \"" + fixtureDir + "\"", {
      cwd: aegisRoot,
      env: { ...process.env, AEGIS_TEST_ADAPTER: "1" },
      encoding: "utf-8",
    });
    const rejRunId = rejOutput.match(/Run ID:\s+([a-zA-Z0-9_]+)/)![1];
    const rejApprId = rejOutput.match(/Approval ID:\s+([a-zA-Z0-9_-]+)/)![1];

    execSync("npx tsx cli.ts approve " + rejRunId + " " + rejApprId + " reject", {
      cwd: aegisRoot,
      env: { ...process.env, AEGIS_TEST_ADAPTER: "1" },
      encoding: "utf-8",
    });

    const rejRecord = JSON.parse(fs.readFileSync(path.join(aegisRoot, ".aegis", "runs", rejRunId + ".json"), "utf-8"));
    assert.equal(rejRecord.state.status, "failed", "Rejected run must transition to failed");
    assert.ok(fs.readFileSync(discountFilePath, "utf-8").includes("return price + discountAmount;"), "Rejection must leave disk unchanged");
    console.log("       ✅ Rejection safely terminated without disk mutation.");

    // 4b. Stale / mismatched workspace gate
    console.log("   4b. Testing stale workspace rejection...");
    const staleOutput = execSync("npx tsx cli.ts fix \"Stale test run\" --workspace \"" + fixtureDir + "\"", {
      cwd: aegisRoot,
      env: { ...process.env, AEGIS_TEST_ADAPTER: "1" },
      encoding: "utf-8",
    });
    const staleRunId = staleOutput.match(/Run ID:\s+([a-zA-Z0-9_]+)/)![1];
    const staleApprId = staleOutput.match(/Approval ID:\s+([a-zA-Z0-9_-]+)/)![1];

    // Alter discount.ts to simulate concurrent modification during approval window
    fs.appendFileSync(discountFilePath, "// Concurrent user edit\n");
    let staleFailedClosed = false;
    try {
      execSync("npx tsx cli.ts approve " + staleRunId + " " + staleApprId + " approve", {
        cwd: aegisRoot,
        env: { ...process.env, AEGIS_TEST_ADAPTER: "1" },
        encoding: "utf-8",
        stdio: "pipe",
      });
    } catch (err: any) {
      staleFailedClosed = true;
      const msg = (err.stderr || "") + (err.message || "");
      assert.match(msg, /Workspace changed after approval request/);
    }
    assert.equal(staleFailedClosed, true, "Mismatched workspace baseline must fail closed");
    // Restore discountFilePath to original buggy state for clean run
    fs.writeFileSync(discountFilePath, discountBeforeApprove, "utf-8");
    console.log("       ✅ Stale workspace baseline failed closed.");

    // 4c. Separate CLI process approval of original run
    console.log("   4c. Executing separate-process approval of genuine run...");
    const approveOutput = execSync("npx tsx cli.ts approve " + runId + " " + approvalId + " approve", {
      cwd: aegisRoot,
      env: {
        ...process.env,
        AEGIS_TEST_ADAPTER: "1",
        AEGIS_TEST_COMMAND: "node --experimental-strip-types test/discount.test.ts",
      },
      encoding: "utf-8",
    });
    assert.match(approveOutput, /WORKFLOW RESUMED AND EXECUTED/);
    console.log("       ✅ Approval resolved in separate CLI process.");

    // 4d. Replay protection gate
    console.log("   4d. Testing replay protection...");
    let replayBlocked = false;
    try {
      execSync("npx tsx cli.ts approve " + runId + " " + approvalId + " approve", {
        cwd: aegisRoot,
        env: { ...process.env, AEGIS_TEST_ADAPTER: "1" },
        encoding: "utf-8",
        stdio: "pipe",
      });
    } catch (err: any) {
      replayBlocked = true;
      const msg = (err.stderr || "") + (err.message || "");
      assert.match(msg, /is not pending for run/);
    }
    assert.equal(replayBlocked, true, "Replayed approval must be rejected");
    console.log("       ✅ Replay attempt blocked cleanly.\n");

    // ── STEP 5: Verify Repaired Disk and Regression Test ────────────────────
    console.log("5. Verifying repaired fixture on disk and regression test...");

    // Check disk content of repaired file
    const discountAfterApprove = fs.readFileSync(discountFilePath, "utf-8");
    assert.ok(discountAfterApprove.includes("return price - discountAmount;"), "Defective line must be replaced with subtraction");

    // Verify unrelated file is completely intact
    const currencyAfter = fs.readFileSync(currencyFilePath, "utf-8");
    assert.equal(sha256(currencyAfter), currencyHash, "Unrelated source file must remain bit-for-bit identical");

    // Run regression test again
    const postFixResult = execSync("node --experimental-strip-types test/discount.test.ts", {
      cwd: fixtureDir,
      encoding: "utf-8",
    });
    assert.match(postFixResult, /Discount test passed!/);
    console.log("   ✅ Regression test PASSED with exit code 0.");
    console.log("   ✅ Unrelated source file src/currency.ts verified bit-for-bit unchanged.\n");

    // ── STEP 6: Verify Persisted Run Record & Evidence ──────────────────────
    console.log("6. Inspecting persisted run record verification evidence...");
    const finalRun = JSON.parse(fs.readFileSync(runFilePath, "utf-8"));

    assert.equal(finalRun.state.testResults?.passed, true, "Persisted testResults must show passed: true");
    assert.match(finalRun.state.testResults?.output, /Discount test passed!/);
    assert.equal(finalRun.state.changeEvidence?.allVerified, true, "Persisted changeEvidence must show allVerified: true");
    assert.equal(finalRun.nativeAgent?.verification, "supported", "Native agent verification must be recorded as 'supported'");

    console.log("   ✅ Persisted test output: \"" + finalRun.state.testResults.output + "\"");
    console.log("   ✅ Persisted verification evidence: " + finalRun.nativeAgent.verification);
    console.log("   ✅ Change evidence allVerified: " + finalRun.state.changeEvidence.allVerified + "\n");

    console.log("==================================================================");
    console.log("  ALL ACCEPTANCE CHECKS PASSED (6 / 6) ✅");
    console.log("==================================================================\n");
  } finally {
    fs.rmSync(fixtureDir, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error("❌ Acceptance test failed:", err);
  process.exit(1);
});
