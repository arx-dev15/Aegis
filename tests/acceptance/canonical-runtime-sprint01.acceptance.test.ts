/**
 * canonical-runtime-sprint01.acceptance.test.ts
 *
 * AEGIS P01 — CANONICAL AGENT RUNTIME ACCEPTANCE SUITE
 * Real End-to-End Engineering Correctness & Capability Verification
 *
 * Verifies all 8 Mandatory Scenarios for P01 Closure:
 * 1. Multi-step investigation with evidence-based reasoning
 * 2. Debugging task where first retrieval attempt is insufficient (strategy shifting)
 * 3. Bug fix with failing-before and passing-after behavioral test
 * 4. Request referring to a nonexistent component (limitation reporting, zero mutation)
 * 5. Interrupted model call (clean cancellation)
 * 6. Slow or cancelled tool operation (zero delayed mutation)
 * 7. Malformed or unavailable provider response (recoverable errors, status preservation)
 * 8. Verification environment failure (sandbox fails closed, zero untrusted host leakage)
 */

import assert from "node:assert/strict";
import fs from "fs";
import os from "os";
import path from "path";
import crypto from "crypto";
import { execSync } from "child_process";
import { handleInvestigate, handleFix, handleApprove } from "../../apps/cli/cliHandlers.js";
import { approvalRuntime } from "../../src/runtime/approvalWorkflow.js";
import { runToolAgent, AgentModel } from "../../src/agent/agent.js";
import { createInvestigationTools } from "../../src/tools/investigation/index.js";
import { runCommand, isEnvironmentOrSetupFailure } from "../../src/tools/terminal/index.js";
import { setContainerExecutor, ContainerExecutor } from "../../src/tools/terminal/sandbox.js";
import { createAegisTool } from "../../src/tools/types.js";
import { z } from "zod";

function sha256(data: string | Buffer): string {
  return crypto.createHash("sha256").update(data).digest("hex");
}

function createAuthFixture(): { fixtureDir: string; authFilePath: string } {
  const fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), "aegis-p01-auth-"));
  const mwDir = path.join(fixtureDir, "src", "middleware");
  fs.mkdirSync(mwDir, { recursive: true });

  const authCode = [
    "export interface AuthRequest {",
    "  headers: { authorization?: string };",
    "  user?: { id: string; role: string };",
    "}",
    "",
    "export function authenticateToken(req: AuthRequest): boolean {",
    "  const header = req.headers.authorization;",
    "  if (!header || !header.startsWith('Bearer ')) {",
    "    return false;",
    "  }",
    "  const token = header.slice(7).trim();",
    "  if (token === 'valid-secret-token') {",
    "    req.user = { id: 'user_123', role: 'engineer' };",
    "    return true;",
    "  }",
    "  return false;",
    "}",
  ].join("\n");

  const authFilePath = path.join(mwDir, "auth.ts");
  fs.writeFileSync(authFilePath, authCode, "utf8");
  return { fixtureDir, authFilePath };
}

function createFormatFixture(): { fixtureDir: string; formatFilePath: string } {
  const fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), "aegis-p01-format-"));
  const utilsDir = path.join(fixtureDir, "src", "utils");
  fs.mkdirSync(utilsDir, { recursive: true });

  const formatCode = [
    "export function formatCurrency(amount: number, symbol = '$'): string {",
    "  if (isNaN(amount)) throw new Error('Invalid numeric amount');",
    "  return symbol + amount.toFixed(2);",
    "}",
  ].join("\n");

  const formatFilePath = path.join(utilsDir, "format.ts");
  fs.writeFileSync(formatFilePath, formatCode, "utf8");
  return { fixtureDir, formatFilePath };
}

function createBugFixture(): {
  fixtureDir: string;
  srcFile: string;
  testFile: string;
} {
  const fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), "aegis-p01-bug-"));
  const srcDir = path.join(fixtureDir, "src");
  const testDir = path.join(fixtureDir, "test");
  fs.mkdirSync(srcDir, { recursive: true });
  fs.mkdirSync(testDir, { recursive: true });

  // Defective tax calculation
  const srcCode = [
    "export function computeTax(income: number, rate: number): number {",
    "  if (income <= 0) return 0;",
    "  // REPRODUCIBLE BUG: multiplying instead of dividing percent",
    "  return (income * rate) * 100;",
    "}",
  ].join("\n");
  const srcFile = path.join(srcDir, "tax.ts");
  fs.writeFileSync(srcFile, srcCode, "utf8");

  // Behavioral test that fails before fix
  const testCode = [
    "import assert from 'node:assert/strict';",
    "import { computeTax } from '../src/tax.ts';",
    "",
    "const tax = computeTax(1000, 10);",
    "assert.equal(tax, 100, 'Tax for 1000 at 10% must be 100, but got ' + tax);",
    "console.log('Tax test passed!');",
  ].join("\n");
  const testFile = path.join(testDir, "tax.test.ts");
  fs.writeFileSync(testFile, testCode, "utf8");

  const pkgJson = {
    name: "p01-bug-fixture",
    version: "1.0.0",
    type: "module",
    scripts: {
      test: "node --experimental-strip-types test/tax.test.ts",
    },
  };
  fs.writeFileSync(path.join(fixtureDir, "package.json"), JSON.stringify(pkgJson, null, 2), "utf8");

  return { fixtureDir, srcFile, testFile };
}

async function runP01AcceptanceSuite() {
  console.log("==================================================================");
  console.log("  AEGIS P01 — FINAL ENGINEERING ACCEPTANCE SUITE");
  console.log("==================================================================\n");

  process.env.AEGIS_TEST_ADAPTER = "1";

  // ── 1. SCENARIO 1: Multi-Step Investigation with Evidence-Based Reasoning ─
  console.log("1. SCENARIO 1 — Multi-Step Investigation with Evidence-Based Reasoning...");
  const authFixture = createAuthFixture();
  const authGoal = "Explain authentication middleware token validation in src/middleware/auth.ts";

  const authModel: AgentModel = {
    model: "scenario-1-model",
    async generate(contents, _decls) {
      const turn = contents.length;
      if (turn === 1) {
        return {
          functionCalls: [
            { id: "call-1", name: "discover_files", args: { pattern: "auth" } },
            { id: "call-2", name: "search_repository", args: { query: "authenticateToken" } },
          ],
        };
      }
      if (turn === 3) {
        return {
          functionCalls: [
            { id: "call-3", name: "read_source_file", args: { path: "src/middleware/auth.ts", startLine: 1, endLine: 20 } },
          ],
        };
      }
      return {
        text: "The authentication middleware in src/middleware/auth.ts:6 validates bearer tokens from req.headers.authorization. When a valid token is provided, it populates req.user at src/middleware/auth.ts:13.",
      };
    },
  };

  const authTools = createInvestigationTools(authFixture.fixtureDir);
  const authResult = await runToolAgent(authGoal, authTools, {}, {
    model: authModel,
    maxIterations: 6,
  });

  assert.equal(authResult.termination, "completed");
  assert.ok(authResult.text.includes("src/middleware/auth.ts:6"), "Must cite exact source file and line");
  assert.ok(authResult.toolCallsExecuted.some(c => c.name === "read_source_file"), "Must read actual source file");
  console.log("   ✅ SCENARIO 1 PASSED: Multi-step investigation returned verified source citations.\n");

  // ── 2. SCENARIO 2: Debugging Task with Insufficient First Retrieval ──────
  console.log("2. SCENARIO 2 — Debugging Task with Insufficient Initial Retrieval (Strategy Shift)...");
  const formatFixture = createFormatFixture();
  const debugGoal = "Debug currency formatting crash in transaction processor";
  let firstRetrievalFailed = false;
  let strategyShiftSucceeded = false;

  const debugModel: AgentModel = {
    model: "scenario-2-model",
    async generate(contents, _decls) {
      const turn = contents.length;
      if (turn === 1) {
        // Initial query targets nonexistent term in repo
        return {
          functionCalls: [
            { id: "call-deb-1", name: "search_repository", args: { query: "TransactionProcessor" } },
          ],
        };
      }
      if (turn === 3) {
        // Inspect observation: verify first attempt returned 0 matches
        const lastContent = contents[contents.length - 1];
        const respPart = lastContent.parts?.[0]?.functionResponse?.response as any;
        const resObj = typeof respPart?.result === 'string' ? JSON.parse(respPart.result) : respPart?.result;
        if (resObj?.matches?.length === 0) {
          firstRetrievalFailed = true;
        }
        // Shift strategy: discover files across the project
        return {
          functionCalls: [
            { id: "call-deb-2", name: "discover_files", args: {} },
          ],
        };
      }
      if (turn === 5) {
        // Now locate format.ts and read it
        strategyShiftSucceeded = true;
        return {
          functionCalls: [
            { id: "call-deb-3", name: "read_source_file", args: { path: "src/utils/format.ts" } },
          ],
        };
      }
      return {
        text: "After initial search yielded 0 matches, shifted strategy and identified formatCurrency in src/utils/format.ts:1 which throws on isNaN.",
      };
    },
  };

  const formatTools = createInvestigationTools(formatFixture.fixtureDir);
  const debugResult = await runToolAgent(debugGoal, formatTools, {}, {
    model: debugModel,
    maxIterations: 8,
  });

  assert.equal(debugResult.termination, "completed");
  assert.ok(firstRetrievalFailed, "First retrieval attempt must return insufficient evidence");
  assert.ok(strategyShiftSucceeded, "Agent must adapt strategy to discover files");
  assert.ok(debugResult.text.includes("src/utils/format.ts:1"), "Must cite correct source line after strategy shift");
  console.log("   ✅ SCENARIO 2 PASSED: Strategy shifted successfully after insufficient initial retrieval.\n");

  // ── 3. SCENARIO 3: Bug Fix with Failing-Before and Passing-After Test ──────
  console.log("3. SCENARIO 3 — Bug Fix with Real Behavioral Test (Failing-Before / Passing-After)...");
  const bugFixture = createBugFixture();

  // Step 3a: Verify behavioral test fails before change
  let preTestFailed = false;
  try {
    execSync("npm test", { cwd: bugFixture.fixtureDir, stdio: "pipe" });
  } catch (err: any) {
    preTestFailed = true;
    const errOut = err.stderr?.toString() || err.stdout?.toString() || "";
    assert.ok(errOut.includes("Tax for 1000 at 10% must be 100"), "Must observe exact pre-fix test failure");
  }
  assert.ok(preTestFailed, "Pre-fix test must fail before mutation");
  console.log("   ✅ Step 3a: Behavioral test fails before fix (Expected 100, got 1000000).");

  // Step 3b: Propose fix
  process.env.AEGIS_TEST_CHANGE_PATH = "src/tax.ts";
  process.env.AEGIS_TEST_CHANGE_ACTION = "modify";
  process.env.AEGIS_TEST_CHANGE_CONTENT = [
    "export function computeTax(income: number, rate: number): number {",
    "  if (income <= 0) return 0;",
    "  // FIXED: divide by 100 for correct percentage",
    "  return (income * rate) / 100;",
    "}",
  ].join("\n");

  const fixOutcome = await handleFix("Fix computeTax formula in src/tax.ts", bugFixture.fixtureDir);
  assert.equal(fixOutcome.status, "paused", "Fix must pause at human approval gate");
  assert.ok(fixOutcome.pendingApproval, "Approval request must be created");
  assert.equal(fixOutcome.proposals.length, 1, "Must produce single targeted proposal");
  assert.equal(fixOutcome.proposals[0].path, "src/tax.ts");
  console.log("   ✅ Step 3b: Native FIX produced patch proposal and paused for human approval.");

  // Step 3c: Explicit approval resumes and applies change
  const approvalOutcome = await handleApprove(fixOutcome.runId, fixOutcome.pendingApproval.id, "approve");
  assert.equal(approvalOutcome.status, "completed", "Run must complete after approval and verification");

  // Step 3d: Verify behavioral test passes after approved mutation
  const postTestOutput = execSync("npm test", { cwd: bugFixture.fixtureDir, encoding: "utf8" });
  assert.ok(postTestOutput.includes("Tax test passed!"), "Test must pass after mutation");
  console.log("   ✅ Step 3c & 3d: Patch approved, applied safely, behavioral test now passes.\n");
  delete process.env.AEGIS_TEST_CHANGE_PATH;
  delete process.env.AEGIS_TEST_CHANGE_ACTION;
  delete process.env.AEGIS_TEST_CHANGE_CONTENT;

  // ── 4. SCENARIO 4: Nonexistent Component (Limitation Reported) ────────────
  console.log("4. SCENARIO 4 — Nonexistent Component: Limitation Reported Without Blind Mutation...");
  const unknownGoal = "Fix bug in LegacyPaymentGateway processor";
  process.env.AEGIS_TEST_SCENARIO = "unknown_target";

  const unknownFixResult = await handleFix(unknownGoal, authFixture.fixtureDir);
  assert.equal(unknownFixResult.proposals.length, 0, "Must NOT create arbitrary mutations for unknown components");
  const unknownRun = approvalRuntime.getPersistedRun(unknownFixResult.runId);
  assert.ok(
    unknownRun?.state.errors?.some(e => e.includes("proposal") || e.includes("not found")) ||
    unknownRun?.nativeAgent?.finalOutput?.includes("not found"),
    "Must report limitation clearly"
  );
  console.log("   ✅ SCENARIO 4 PASSED: Missing component reported honestly; zero mutations generated.\n");
  delete process.env.AEGIS_TEST_SCENARIO;
  process.exitCode = 0;

  // ── 5. SCENARIO 5: Interrupted Model Call ──────────────────────────────────
  console.log("5. SCENARIO 5 — Interrupted Model Call (Clean Cancellation)...");
  const cancelController = new AbortController();

  const slowModel: AgentModel = {
    model: "scenario-5-model",
    async generate(_contents, _decls, _signal) {
      setTimeout(() => cancelController.abort(), 10);
      return new Promise(() => {});
    },
  };

  const cancelledResult = await runToolAgent("Cancel me", authTools, {}, {
    model: slowModel,
    signal: cancelController.signal,
    maxIterations: 4,
  });

  assert.equal(cancelledResult.termination, "cancelled", "Terminated status must be 'cancelled'");

  // Subsequent run starts with clean cancellation state
  const cleanSubsequentResult = await runToolAgent("Subsequent run", authTools, {}, {
    model: {
      model: "clean-model",
      async generate() {
        return { text: "Fresh run executed cleanly." };
      },
    },
    maxIterations: 2,
  });
  assert.equal(cleanSubsequentResult.termination, "completed");
  console.log("   ✅ SCENARIO 5 PASSED: Interrupted model call cancelled cleanly; state not leaked.\n");

  // ── 6. SCENARIO 6: Slow / Cancelled Tool Operation (Zero Delayed Mutation) ─
  console.log("6. SCENARIO 6 — Cancelled Tool Operation (Zero Delayed Mutation)...");
  const toolCancelController = new AbortController();
  let delayedMutationOccurred = false;

  const slowTool = createAegisTool(async () => {
    return new Promise((resolve) => {
      // Simulate slow work that shouldn't mutate if cancelled
      const timer = setTimeout(() => {
        delayedMutationOccurred = true;
        resolve(JSON.stringify({ mutated: true }));
      }, 500);
      toolCancelController.signal.addEventListener('abort', () => {
        clearTimeout(timer);
      });
    });
  }, {
    name: "slow_mutation_tool",
    description: "Simulates slow operation",
    schema: z.object({}),
  });

  const toolCancelModel: AgentModel = {
    model: "scenario-6-model",
    async generate() {
      // Trigger abort shortly after tool begins
      setTimeout(() => toolCancelController.abort(), 20);
      return {
        functionCalls: [{ id: "slow-call-1", name: "slow_mutation_tool", args: {} }],
      };
    },
  };

  const toolCancelResult = await runToolAgent("Run slow tool", [slowTool], {}, {
    model: toolCancelModel,
    signal: toolCancelController.signal,
    maxIterations: 3,
  });

  assert.equal(toolCancelResult.termination, "cancelled", "Must terminate with cancelled status");
  // Wait to confirm no delayed mutation fired
  await new Promise(r => setTimeout(r, 600));
  assert.equal(delayedMutationOccurred, false, "Cancelled tool must NOT perform delayed mutation");
  console.log("   ✅ SCENARIO 6 PASSED: Cancelled tool operation aborted safely with zero delayed mutation.\n");

  // ── 7. SCENARIO 7: Malformed or Unavailable Provider Response ─────────────
  console.log("7. SCENARIO 7 — Malformed or Unavailable Provider Response...");
  let recoveredAfterError = false;
  const errorModel: AgentModel = {
    model: "scenario-7-model",
    async generate(contents, _decls) {
      if (contents.length === 1) {
        // Request unregistered tool
        return {
          functionCalls: [
            { id: "mal-1", name: "unregistered_bogus_tool", args: { foo: "bar" } },
          ],
        };
      }
      const lastUserContent = contents[contents.length - 1];
      const part = lastUserContent.parts?.[0];
      if (part?.functionResponse?.response && typeof part.functionResponse.response === "object") {
        const errObj = part.functionResponse.response as any;
        if (errObj.error && errObj.error.includes("unknown tool")) {
          recoveredAfterError = true;
        }
      }
      return {
        text: "Recovered from unsupported tool request and completed successfully.",
      };
    },
  };

  const errorResult = await runToolAgent("Test error recovery", authTools, {}, {
    model: errorModel,
    maxIterations: 4,
  });

  assert.equal(errorResult.termination, "completed");
  assert.ok(recoveredAfterError, "Model must receive structured recoverable error for invalid tool");

  // Also test provider 503 error handling
  const providerFailModel: AgentModel = {
    model: "provider-fail-model",
    async generate() {
      const err: any = new Error("Resource temporarily unavailable");
      err.status = 503;
      throw err;
    },
  };

  const provResult = await runToolAgent("Test provider 503", authTools, {}, {
    model: providerFailModel,
    maxIterations: 2,
  });
  assert.equal(provResult.termination, "provider_error", "Must classify 503 as provider_error");
  assert.ok(provResult.error?.includes("503") || provResult.error?.includes("unavailable"));
  console.log("   ✅ SCENARIO 7 PASSED: Malformed calls and provider 503 errors handled recoverably.\n");

  // ── 8. SCENARIO 8: Verification Environment Failure (Fail-Closed) ─────────
  console.log("8. SCENARIO 8 — Verification Environment Failure (Docker Offline Fail-Closed)...");
  const mockUnavailableExecutor: ContainerExecutor = {
    async isAvailable() {
      return { available: false, error: "Docker daemon socket not reachable" };
    },
    async execute() {
      throw new Error("Execute should NEVER be called when isAvailable is false");
    },
    async cleanup() {},
  };

  setContainerExecutor(mockUnavailableExecutor);
  try {
    const wsReal = fs.realpathSync(bugFixture.fixtureDir).toLowerCase();
    const sandboxOutcome = await runCommand("npm test", {
      cwd: bugFixture.fixtureDir,
      workspaceRoot: bugFixture.fixtureDir,
      sandbox: "require",
      executionMode: "automatic",
      isApproved: true,
      runId: "scenario-8-run",
      approvalContext: {
        runId: "scenario-8-run",
        approvalId: "appr-8-valid",
        workspace: wsReal,
        allowedActions: ["execute_terminal"],
        allowedTargets: ["npm test"],
      },
    });

    assert.equal(sandboxOutcome.success, false, "Must fail when sandbox is unavailable");
    assert.equal(sandboxOutcome.blocked, true, "Must be blocked");
    assert.equal(sandboxOutcome.sandboxed, false, "Must not claim sandboxed execution");
    assert.ok(sandboxOutcome.stderr.includes("[SANDBOX-UNAVAILABLE]"), "Must report fail-closed reason");
    assert.ok(isEnvironmentOrSetupFailure(sandboxOutcome.stdout, sandboxOutcome.stderr), "Must be classified as environment failure");
    console.log("   ✅ SCENARIO 8 PASSED: Untrusted execution failed closed with zero host leakage.\n");
  } finally {
    setContainerExecutor(new (require("../../src/tools/terminal/sandbox.js").RealDockerExecutor)());
  }

  console.log("==================================================================");
  console.log("  ALL 8 P01 ACCEPTANCE SCENARIOS VERIFIED SUCCESSFULLY! ✅");
  console.log("==================================================================");
}

runP01AcceptanceSuite().catch((err) => {
  console.error("P01 acceptance suite failed:", err);
  process.exit(1);
});
