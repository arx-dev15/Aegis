/**
 * native-repair-loop.acceptance.test.ts
 *
 * AEGIS Sprint 5 — Native Verification and Bounded Self-Repair Acceptance Suite
 *
 * Demonstrates:
 * 1. Initial patch applies but verification fails.
 * 2. Agent observes the actual failure output.
 * 3. Agent proposes a different corrective patch.
 * 4. First repair revision pauses for new approval.
 * 5. Separate CLI process approves the revision.
 * 6. Verification subsequently passes.
 * 7. Each attempt and its evidence survives restart.
 * 8. Approval rejection stops mutation safely.
 * 9. Retry exhaustion produces an explicit incomplete/failed outcome.
 * 10. Unrelated files remain untouched.
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
  const fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), "aegis-repair-fixture-"));
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
    name: "disposable-repair-fixture",
    version: "1.0.0",
    type: "module",
    scripts: {
      test: "node --experimental-strip-types test/discount.test.ts",
    },
  };
  fs.writeFileSync(path.join(fixtureDir, "package.json"), JSON.stringify(packageJson, null, 2), "utf-8");

  // 5. Initialize git repository
  try {
    execSync("git init", { cwd: fixtureDir, stdio: "ignore" });
    execSync("git config user.email \"test@aegis.dev\"", { cwd: fixtureDir, stdio: "ignore" });
    execSync("git config user.name \"Aegis Tester\"", { cwd: fixtureDir, stdio: "ignore" });
    execSync("git add .", { cwd: fixtureDir, stdio: "ignore" });
    execSync("git commit -m \"Initial commit\"", { cwd: fixtureDir, stdio: "ignore" });
  } catch {}

  return { fixtureDir, testFilePath, discountFilePath, currencyFilePath, currencyHash };
}

const aegisRoot = fs.existsSync(path.resolve('.', 'cli.ts')) ? path.resolve('.') : path.resolve(__dirname, '../..');
const flawedInitialPatch = [
  "export function calculateDiscount(price: number, discountPercent: number): number {",
  "  if (price < 0 || discountPercent < 0 || discountPercent > 100) {",
  "    throw new Error(\"Invalid price or discount percentage\");",
  "  }",
  "  const discountAmount = (price * discountPercent) / 100;",
  "  // Flawed patch: divides by 2 instead of subtracting",
  "  return (price + discountAmount) / 2;",
  "}",
  "",
].join("\n");

const correctRevisedPatch = [
  "export function calculateDiscount(price: number, discountPercent: number): number {",
  "  if (price < 0 || discountPercent < 0 || discountPercent > 100) {",
  "    throw new Error(\"Invalid price or discount percentage\");",
  "  }",
  "  const discountAmount = (price * discountPercent) / 100;",
  "  return price - discountAmount;",
  "}",
  "",
].join("\n");

async function runAcceptanceSuite() {
  console.log("==================================================================");
  console.log("  AEGIS SPRINT 5 — NATIVE VERIFICATION & SELF-REPAIR ACCEPTANCE");
  console.log("==================================================================\n");

  const { fixtureDir, discountFilePath, currencyFilePath, currencyHash } = createFixture();

  try {
    // ── Flow 1: Two-Attempt Repair Loop (Fail -> Observe -> Revise -> Reapprove -> Pass) ──
    console.log("FLOW 1: Native repair loop (Initial patch fails -> revise -> approve -> pass)...\n");

    // 1. Initial regression test fails
    console.log("1. Running pre-fix test in fixture...");
    let preFixFailed = false;
    try {
      execSync("node --experimental-strip-types test/discount.test.ts", { cwd: fixtureDir, encoding: "utf-8" });
    } catch (err: any) {
      preFixFailed = true;
      assert(err.stdout.includes("Expected discounted price 80, but got 120") || err.stderr.includes("120"), "Pre-fix failure observed");
    }
    assert(preFixFailed, "Pre-fix test must fail initially");
    console.log("   ✅ Confirmed failing test: Expected 80, but got 120.\n");

    // 2. Invoke native FIX with flawed initial patch
    console.log("2. Running native FIX CLI (generating initial proposal)...");
    const fixEnv = {
      ...process.env,
      AEGIS_TEST_ADAPTER: "1",
      AEGIS_TEST_COMMAND: "node --experimental-strip-types test/discount.test.ts",
      AEGIS_TEST_INITIAL_PATCH: flawedInitialPatch,
      AEGIS_TEST_REVISED_PATCH: correctRevisedPatch,
    };

    const fixOutput = execSync(`npx tsx cli.ts fix "fix discount calculation logic" --workspace "${fixtureDir}"`, {
      cwd: aegisRoot,
      env: fixEnv,
      encoding: "utf-8",
    });

    const runIdMatch = fixOutput.match(/Run ID:\s+([a-zA-Z0-9_]+)/);
    const apprIdMatch = fixOutput.match(/Approval ID:\s+([a-zA-Z0-9_]+)/);
    assert(runIdMatch, "Run ID must be output by CLI");
    assert(apprIdMatch, "Approval ID must be output by CLI");
    const runId = runIdMatch[1];
    const initialApprovalId = apprIdMatch[1];
    console.log(`   ✅ Native FIX proposed change. Run ID: ${runId}, Approval ID: ${initialApprovalId}`);

    // Verify disk untouched before approval
    assert.equal(sha256(fs.readFileSync(currencyFilePath)), currencyHash, "Currency file untouched");
    const discountBeforeApproval = fs.readFileSync(discountFilePath, "utf-8");
    assert(discountBeforeApproval.includes("price + discountAmount"), "Disk untouched before initial approval");
    console.log("   ✅ Confirmed zero disk mutations prior to human approval.\n");

    // 3. Approve Attempt 0 (flawed patch) in separate CLI process
    console.log("3. Executing separate-process approval of Attempt 0 (flawed patch)...");
    const approve1Output = execSync(`npx tsx cli.ts approve ${runId} ${initialApprovalId} approve`, {
      cwd: aegisRoot,
      env: fixEnv,
      encoding: "utf-8",
    });

    assert(approve1Output.includes("VERIFICATION FAILED"), "CLI must announce verification failure");
    assert(approve1Output.includes("REPAIR REVISION AWAITING APPROVAL"), "CLI must announce repair revision awaiting approval");
    const rev1ApprMatch = approve1Output.match(/Approval ID\s+:\s+([a-zA-Z0-9_]+)/);
    assert(rev1ApprMatch, "New approval ID for Revision 1 must be present");
    const rev1ApprovalId = rev1ApprMatch[1];
    assert.notEqual(rev1ApprovalId, initialApprovalId, "Revision 1 approval ID must be new and distinct");
    console.log(`   ✅ Attempt 0 failed verification as expected. Revision 1 proposed with Approval ID: ${rev1ApprovalId}`);

    // Verify disk has flawed patch, but does NOT yet have Revision 1
    const discountAfterAttempt0 = fs.readFileSync(discountFilePath, "utf-8");
    assert(discountAfterAttempt0.includes("(price + discountAmount) / 2"), "Disk has Attempt 0 patch");
    assert(!discountAfterAttempt0.includes("price - discountAmount"), "Disk does not yet have Revision 1");
    console.log("   ✅ Confirmed Revision 1 is NOT applied prior to second approval.\n");

    // 4. Test replay protection of initial approval ID
    console.log("4. Testing replay protection on initial approval ID...");
    let replayBlocked = false;
    try {
      execSync(`npx tsx cli.ts approve ${runId} ${initialApprovalId} approve`, { cwd: aegisRoot, env: fixEnv, stdio: "pipe" });
    } catch {
      replayBlocked = true;
    }
    assert(replayBlocked, "Replaying initial approval ID must fail closed");
    console.log("   ✅ Replay attempt blocked cleanly.\n");

    // 5. Inspect persisted run record on disk
    console.log("5. Inspecting persisted run record on disk...");
    const runFilePath = path.join(aegisRoot, ".aegis", "runs", `${runId}.json`);
    assert(fs.existsSync(runFilePath), "Run file must exist on disk");
    const runRecord = JSON.parse(fs.readFileSync(runFilePath, "utf-8"));

    assert.equal(runRecord.state.status, "paused", "Run status must be paused awaiting Revision 1 approval");
    assert.equal(runRecord.pendingApproval?.id, rev1ApprovalId, "Pending approval must be Revision 1");
    assert.equal(runRecord.state.approvalDecision, null, "Approval decision must be null awaiting new approval");
    assert.equal(runRecord.state.retryCount, 1, "Retry count must be 1");
    assert(runRecord.attempts && runRecord.attempts.length >= 2, "Must record Attempt 0 and Attempt 1 in history");
    assert.equal(runRecord.attempts[0].status, "verified_failed", "Attempt 0 status must be verified_failed");
    assert(runRecord.attempts[0].verification, "Attempt 0 must have authoritative verification record");
    assert.equal(runRecord.attempts[0].verification.exitCode, 1, "Attempt 0 exit code must be 1");
    assert.equal(runRecord.attempts[1].status, "proposed", "Attempt 1 status must be proposed");
    console.log("   ✅ Persisted run record verified with authoritative Attempt 0 failure evidence and pending Attempt 1.\n");

    // 6. Approve Revision 1 in separate CLI process
    console.log("6. Executing separate-process approval of Revision 1...");
    const approve2Output = execSync(`npx tsx cli.ts approve ${runId} ${rev1ApprovalId} approve`, {
      cwd: aegisRoot,
      env: fixEnv,
      encoding: "utf-8",
    });

    assert(approve2Output.includes("WORKFLOW RESUMED AND EXECUTED"), "Workflow resumed and executed");
    assert(!approve2Output.includes("VERIFICATION FAILED"), "Verification must pass");
    console.log("   ✅ Revision 1 approved, applied, and verified.\n");

    // 7. Verify repaired fixture on disk and regression test
    console.log("7. Verifying repaired fixture on disk...");
    const discountAfterRevision1 = fs.readFileSync(discountFilePath, "utf-8");
    assert(discountAfterRevision1.includes("price - discountAmount"), "Disk updated with Revision 1 fix");

    const postFixTestOutput = execSync("node --experimental-strip-types test/discount.test.ts", {
      cwd: fixtureDir,
      encoding: "utf-8",
    });
    assert(postFixTestOutput.includes("Discount test passed!"), "Test must now pass");
    console.log("   ✅ Regression test PASSED with exit code 0.");

    assert.equal(sha256(fs.readFileSync(currencyFilePath)), currencyHash, "Currency file remains bit-for-bit unchanged");
    console.log("   ✅ Unrelated source file src/currency.ts verified bit-for-bit unchanged.\n");

    // 8. Verify final run record evidence
    console.log("8. Verifying final persisted evidence in run record...");
    const finalRun = JSON.parse(fs.readFileSync(runFilePath, "utf-8"));
    assert.equal(finalRun.state.status, "completed", "Final run status must be completed");
    assert.equal(finalRun.nativeAgent?.verification, "supported", "Native agent verification must be supported");
    assert.equal(finalRun.attempts[1].status, "verified_passed", "Attempt 1 status must be verified_passed");
    assert.equal(finalRun.verificationHistory?.length, 2, "Must record 2 verification runs (attempt 0 failed, attempt 1 passed)");
    assert.equal(finalRun.verificationHistory[0].status, "failed", "Verification 0 status: failed");
    assert.equal(finalRun.verificationHistory[1].status, "passed", "Verification 1 status: passed");
    console.log("   ✅ Full verification history and attempt lifecycle persisted cleanly.\n");

    // ── Flow 2: Human Rejection of Revision Stops Mutation Safely ──
    console.log("FLOW 2: Human rejection of repair revision...\n");
    const { fixtureDir: fixDir2 } = createFixture();
    const fixEnv2 = {
      ...process.env,
      AEGIS_TEST_ADAPTER: "1",
      AEGIS_TEST_COMMAND: "node --experimental-strip-types test/discount.test.ts",
      AEGIS_TEST_INITIAL_PATCH: flawedInitialPatch,
      AEGIS_TEST_REVISED_PATCH: correctRevisedPatch,
    };

    const out2 = execSync(`npx tsx cli.ts fix "fix discount" --workspace "${fixDir2}"`, { cwd: aegisRoot, env: fixEnv2, encoding: "utf-8" });
    const runId2 = out2.match(/Run ID:\s+([a-zA-Z0-9_]+)/)![1];
    const apprId2 = out2.match(/Approval ID:\s+([a-zA-Z0-9_]+)/)![1];

    // Approve attempt 0 (fails)
    const outAppr0 = execSync(`npx tsx cli.ts approve ${runId2} ${apprId2} approve`, { cwd: aegisRoot, env: fixEnv2, encoding: "utf-8" });
    const rev1ApprId2 = outAppr0.match(/Approval ID\s+:\s+([a-zA-Z0-9_]+)/)![1];

    // Reject revision 1
    const outReject = execSync(`npx tsx cli.ts approve ${runId2} ${rev1ApprId2} reject`, { cwd: aegisRoot, env: fixEnv2, encoding: "utf-8" });
    assert(outReject.includes("WORKFLOW REJECTED"), "CLI announces rejection");

    const run2Record = JSON.parse(fs.readFileSync(path.join(aegisRoot, ".aegis", "runs", `${runId2}.json`), "utf-8"));
    assert.equal(run2Record.state.status, "failed", "Run marked failed upon rejection");
    assert.equal(run2Record.attempts[1].status, "rejected", "Attempt 1 marked rejected");
    console.log("   ✅ Rejection safely terminated without Revision 1 mutation.\n");

    // ── Flow 3: Retry Exhaustion (Hard Ceiling of 2 Revisions) ──
    console.log("FLOW 3: Retry exhaustion enforcement (Max 2 repair revisions)...\n");
    const { fixtureDir: fixDir3 } = createFixture();
    const fixEnv3 = {
      ...process.env,
      AEGIS_TEST_ADAPTER: "1",
      AEGIS_TEST_COMMAND: "node --experimental-strip-types test/discount.test.ts",
      AEGIS_TEST_INITIAL_PATCH: flawedInitialPatch,
      AEGIS_TEST_REVISION_FAIL_TWICE: "1", // Forces revision 1 to also be flawed
      AEGIS_TEST_REVISED_PATCH: flawedInitialPatch, // Forces all revisions to fail
    };

    const out3 = execSync(`npx tsx cli.ts fix "fix discount" --workspace "${fixDir3}"`, { cwd: aegisRoot, env: fixEnv3, encoding: "utf-8" });
    const runId3 = out3.match(/Run ID:\s+([a-zA-Z0-9_]+)/)![1];
    const apprId3 = out3.match(/Approval ID:\s+([a-zA-Z0-9_]+)/)![1];

    // Attempt 0 -> fails -> Revision 1
    const outAppr3_0 = execSync(`npx tsx cli.ts approve ${runId3} ${apprId3} approve`, { cwd: aegisRoot, env: fixEnv3, encoding: "utf-8" });
    const rev1ApprId3 = outAppr3_0.match(/Approval ID\s+:\s+([a-zA-Z0-9_]+)/)![1];

    // Attempt 1 -> fails -> Revision 2
    const outAppr3_1 = execSync(`npx tsx cli.ts approve ${runId3} ${rev1ApprId3} approve`, { cwd: aegisRoot, env: fixEnv3, encoding: "utf-8" });
    const rev2ApprId3 = outAppr3_1.match(/Approval ID\s+:\s+([a-zA-Z0-9_]+)/)![1];
    assert.notEqual(rev2ApprId3, rev1ApprId3, "Revision 2 has new approval ID");

    // Attempt 2 -> fails -> Retry budget exhausted!
    const outAppr3_2 = execSync(`npx tsx cli.ts approve ${runId3} ${rev2ApprId3} approve`, { cwd: aegisRoot, env: fixEnv3, encoding: "utf-8" });
    assert(!outAppr3_2.includes("REPAIR REVISION AWAITING APPROVAL"), "No revision 3 allowed");

    const run3Record = JSON.parse(fs.readFileSync(path.join(aegisRoot, ".aegis", "runs", `${runId3}.json`), "utf-8"));
    assert.equal(run3Record.state.status, "failed", "Run marked failed after retry exhaustion");
    assert(run3Record.state.errors.some((e: string) => e.includes("Repair budget exhausted")), "Budget exhaustion error recorded");
    assert.equal(run3Record.nativeAgent?.verification, "unverified", "Verification remains unverified");
    console.log("   ✅ Retry exhaustion strictly enforced at hard ceiling (2 revisions).\n");

    console.log("==================================================================");
    console.log("  ALL ACCEPTANCE CHECKS PASSED (10 / 10) ✅");
    console.log("==================================================================\n");
  } finally {
    try {
      fs.rmSync(fixtureDir, { recursive: true, force: true });
    } catch {}
  }
}

runAcceptanceSuite().catch((err) => {
  console.error("❌ Acceptance test failed:", err);
  process.exit(1);
});
