/**
 * tools/terminal/terminal.test.ts
 *
 * Feature 28 — Controlled Host Execution Unit & Safety Tests
 *
 * Verifies all 17 acceptance criteria at unit and tool level:
 * - Granular policy classification (ALLOW, REQUIRE_APPROVAL, BLOCK)
 * - Python / script execution policy enforcement
 * - Pre-execution approval request generation
 * - Process timeout & cleanup
 * - Output truncation (100KB limits)
 * - Workspace containment validation
 * - Environment secret scrubbing
 * - Structured CommandResult formatting
 * - LangChain tool integration (terminalTool)
 */

import path from "path";
import {
  runCommand,
  terminalTool,
  scrubSecrets,
  verifyWorkspaceContainment,
} from "./index.js";
import {
  analyzeTerminalCommand,
} from "../guardrails/policyEngine.js";

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

export async function runTerminalUnitTests(): Promise<void> {
  console.log("=================================================");
  console.log("  AEGIS CONTROLLED HOST EXECUTION UNIT TESTS (F28)");
  console.log("=================================================\n");

  let passed = 0;

  // ── Test 1: Policy Classification ──────────────────────────────────────────
  {
    console.log("Test 1: Policy Classification for Safe, Blocked, and Risky Commands...");
    const safeCmds = ["git status", "git diff", "npm test", "npx tsc --noEmit", "npm run build", "node --version"];
    for (const cmd of safeCmds) {
      const res = analyzeTerminalCommand(cmd);
      assert(res.decision === "ALLOW", `Expected ALLOW for "${cmd}", got ${res.decision}`);
      assert(res.category === "read-only", `Expected read-only for "${cmd}"`);
    }

    const dangerousCmds = ["rm -rf /", "del /s c:\\windows", "sudo rm -rf /etc", "chmod 777 /", "env", "printenv", "set"];
    for (const cmd of dangerousCmds) {
      const res = analyzeTerminalCommand(cmd);
      assert(res.decision === "BLOCK", `Expected BLOCK for "${cmd}", got ${res.decision}`);
      assert(res.category === "dangerous", `Expected dangerous for "${cmd}"`);
    }

    const riskyCmds = ["python script.py", "python3 main.py", "npm install express", "git push origin main"];
    for (const cmd of riskyCmds) {
      const res = analyzeTerminalCommand(cmd);
      assert(res.decision === "REQUIRE_APPROVAL", `Expected REQUIRE_APPROVAL for "${cmd}", got ${res.decision}`);
      assert(res.category === "sensitive-mutation", `Expected sensitive-mutation for "${cmd}"`);
    }

    console.log("  ✅ Passed Policy Classification\n");
    passed++;
  }

  // ── Test 2: ALLOW Command Execution ───────────────────────────────────────
  {
    console.log("Test 2: ALLOW Command Execution & Structured Result...");
    const res = await runCommand("node --version", { cwd: process.cwd() });

    assert(res.blocked === false, "Execution should not be blocked");
    assert(res.approvalRequired === false, "Approval should not be required");
    assert(res.exitCode === 0, "Exit code should be 0");
    assert(res.success === true, "Success should be true");
    assert(res.timedOut === false, "Should not time out");
    assert(res.durationMs > 0, "Duration should be > 0");
    assert(res.stdout.includes("v"), "Stdout should contain version");

    console.log("  ✅ Passed ALLOW Command Execution\n");
    passed++;
  }

  // ── Test 3: BLOCK Command Execution ───────────────────────────────────────
  {
    console.log("Test 3: BLOCK Command Execution without Child Spawning...");
    const res = await runCommand("rm -rf /", { cwd: process.cwd() });

    assert(res.blocked === true, "Must be blocked");
    assert(res.success === false, "Success must be false");
    assert(res.exitCode === 1, "Exit code should be 1");
    assert(res.stderr.includes("[GUARDRAIL-BLOCKED]"), "Stderr should record block reason");

    console.log("  ✅ Passed BLOCK Command Execution\n");
    passed++;
  }

  // ── Test 4: REQUIRE_APPROVAL Before Execution ──────────────────────────────
  {
    console.log("Test 4: REQUIRE_APPROVAL Generates ApprovalRequest...");
    const res = await runCommand("python script.py", {
      cwd: process.cwd(),
      executionMode: "semi-auto",
    });

    assert(res.approvalRequired === true, "Should require approval");
    assert(res.blocked === false, "Not blocked");
    assert(res.success === false, "Success false before approval");
    assert(res.exitCode === null, "Exit code null before approval");
    assert(res.approvalRequest !== undefined, "Approval request must be defined");
    assert(res.approvalRequest?.action === "execute_terminal", "Action should be execute_terminal");

    console.log("  ✅ Passed REQUIRE_APPROVAL Before Execution\n");
    passed++;
  }

  // ── Test 5: Workspace Containment Validation ──────────────────────────────
  {
    console.log("Test 5: Workspace Containment Validation...");
    const root = process.cwd();
    const outside = path.resolve(root, "..");

    const check = verifyWorkspaceContainment(outside, root);
    assert(check.valid === false, "Outside directory must be invalid");
    assert(check.reason!.includes("Workspace escape attempt blocked"), "Reason must cite workspace escape");

    const res = await runCommand("node --version", {
      cwd: outside,
      workspaceRoot: root,
    });

    assert(res.blocked === true, "Run command outside workspace must be blocked");
    assert(res.stderr.includes("WORKSPACE-ESCAPE-BLOCKED"), "Stderr must record containment block");

    console.log("  ✅ Passed Workspace Containment Validation\n");
    passed++;
  }

  // ── Test 6: Process Timeout & Cleanup ─────────────────────────────────────
  {
    console.log("Test 6: Process Timeout & Tree Cleanup...");
    const start = Date.now();
    const res = await runCommand("node -e process.stdin.resume()", {
      cwd: process.cwd(),
      timeoutMs: 300,
      executionMode: "automatic",
    });
    const elapsed = Date.now() - start;

    assert(res.timedOut === true, "Must mark timedOut = true");
    assert(res.exitCode === 124, "Exit code should be 124");
    assert(res.success === false, "Success must be false");
    assert(elapsed < 3000, "Process should be killed within timeout grace period");

    console.log("  ✅ Passed Process Timeout & Tree Cleanup\n");
    passed++;
  }

  // ── Test 7: Output Size Limits & Truncation ────────────────────────────────
  {
    console.log("Test 7: Output Size Limits & Truncation...");
    const res = await runCommand("node -e process.stdout.write(Buffer.alloc(20000,65))", {
      cwd: process.cwd(),
      maxOutputBytes: 1024,
      executionMode: "automatic",
    });

    assert(res.truncated === true, "Truncated must be true");
    assert(res.stdout.includes("[OUTPUT TRUNCATED - MAX 100KB EXCEEDED]"), "Must append truncation warning");
    assert(res.stdout.length < 3000, "Output length must be bounded");

    console.log("  ✅ Passed Output Size Limits & Truncation\n");
    passed++;
  }

  // ── Test 8: Secret Scrubbing ───────────────────────────────────────────────
  {
    console.log("Test 8: Environment Secret Scrubbing...");
    const raw = "Output: ghp_123456789012345678901234567890123456 and Bearer secret_token_abc";
    const scrubbed = scrubSecrets(raw);

    assert(!scrubbed.includes("ghp_123456789012345678901234567890123456"), "PAT token must be scrubbed");
    assert(scrubbed.includes("ghp_***MASKED***"), "Mask tag must be inserted");
    assert(scrubbed.includes("Bearer ***MASKED***"), "Bearer token must be scrubbed");

    console.log("  ✅ Passed Environment Secret Scrubbing\n");
    passed++;
  }

  // ── Test 9: LangChain Tool Invocation ──────────────────────────────────────
  {
    console.log("Test 9: LangChain Tool Registration & Invocation...");
    const jsonStr = await terminalTool.invoke({ command: "node --version" });
    const parsed = JSON.parse(jsonStr as string);

    assert(parsed.command === "node --version", "Tool command matches");
    assert(parsed.exitCode === 0, "Tool exit code is 0");
    assert(parsed.success === true, "Tool execution success");

    console.log("  ✅ Passed LangChain Tool Registration\n");
    passed++;
  }

  console.log("=================================================");
  console.log(` SUMMARY: ${passed} / 9 unit test blocks passed successfully.`);
  console.log("=================================================\n");
}

// Allow direct execution via npx tsx tools/terminal/terminal.test.ts
if (process.argv[1] && process.argv[1].includes("terminal.test")) {
  runTerminalUnitTests().catch((err) => {
    console.error("❌ Test suite failed with error:", err);
    process.exit(1);
  });
}
