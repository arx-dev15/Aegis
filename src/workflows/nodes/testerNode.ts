/**
 * graph/nodes/testerNode.ts
 *
 * Feature 13 (upgraded in Feature 16) — Tester Agent LangGraph Node
 *
 * Two-phase execution:
 *
 *   Phase 1 — Real terminal execution (when workspace is set):
 *     Detects the project's actual test command from package.json "test" script,
 *     pyproject.toml, pytest.ini, etc. Falls back to AEGIS_TEST_COMMAND env var.
 *     Runs the detected command inside state.workspace using the terminal tool.
 *     Captures real stdout/stderr/exit code.
 *
 *   Phase 2 — LLM interpretation:
 *     Feeds real output (or code change context in simulation mode)
 *     to TesterAgent to produce a structured TesterResult.
 *
 * When workspace is empty, behaves exactly as before — all existing tests pass.
 */

import fs from "fs";
import path from "path";
import type { AegisState, AegisStateUpdate, TestResult } from "../../runtime/state.js";
import { TesterAgent, TerminalRunner } from "../agents/tester/tester.js";
import { runCommand, isEnvironmentOrSetupFailure } from "../../tools/terminal/index.js";
import type { VerificationRecord } from "../../runtime/state.js";

// ── Real terminal runner backed by the terminal tool ─────────────────────────

const realTerminalRunner: TerminalRunner = {
  async run(command: string, cwd: string) {
    return runCommand(command, { cwd, workspaceRoot: cwd, timeoutMs: 120_000, executionMode: "automatic", sandbox: "require" });
  },
};

// ── Test Command Detection ────────────────────────────────────────────────────

/**
 * Detect the real test command for a given workspace directory.
 *
 * Detection priority:
 *   1. AEGIS_TEST_COMMAND env var (explicit override)
 *   2. package.json "scripts.test" (Node.js projects)
 *   3. pyproject.toml / setup.cfg / pytest.ini (Python projects)
 *   4. Makefile with a "test" target
 *   5. Fallback: "npm test"
 */
export function detectTestCommand(workspace: string): string {
  if (process.env["AEGIS_TEST_COMMAND"]) {
    return process.env["AEGIS_TEST_COMMAND"];
  }

  // 1. Node.js — package.json test script
  const pkgPath = path.join(workspace, "package.json");
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
      const testScript: string | undefined = pkg?.scripts?.test;
      if (testScript && testScript !== "echo \"Error: no test specified\" && exit 1") {
        // Use npm test to run it via npm script runner
        return "npm test";
      }
    } catch {}
    // package.json exists but no test script — still prefer npm test (will report no tests)
    return "npm test";
  }

  // 2. Python — pyproject.toml / pytest.ini / setup.cfg
  if (
    fs.existsSync(path.join(workspace, "pyproject.toml")) ||
    fs.existsSync(path.join(workspace, "pytest.ini")) ||
    fs.existsSync(path.join(workspace, "setup.cfg"))
  ) {
    return "python -m pytest --tb=short -q";
  }

  // 3. Makefile with test target
  const makefilePath = path.join(workspace, "Makefile");
  if (fs.existsSync(makefilePath)) {
    try {
      const makefile = fs.readFileSync(makefilePath, "utf-8");
      if (/^test:/m.test(makefile)) {
        return "make test";
      }
    } catch {}
  }

  // Default fallback
  return "npm test";
}

/**
 * Creates a tester node using a provided TesterAgent instance or defaults to standard TesterAgent.
 *
 * @param agent          - Optional TesterAgent to inject (used in tests for mock models).
 * @param testCommand    - Command override. When not provided, auto-detects from workspace.
 */
export function createTesterNode(
  agent?: TesterAgent,
  testCommand?: string
) {
  // Only inject the real terminal runner for the default (non-test) agent.
  const tester = agent ?? new TesterAgent(undefined, realTerminalRunner);

  return async function testerNode(state: AegisState): Promise<AegisStateUpdate> {
    if (!state.task || state.task.trim() === "") {
      return {
        status: "failed",
        errors: ["Task input is empty in tester node"],
      };
    }

    try {
      // Build a human-readable summary of code changes for LLM context
      const codeChangesContext = state.codeChanges
        .map((c) => {
          const lines = c.content ? `\n${c.content.slice(0, 500)}` : "";
          return `[${c.action.toUpperCase()}] ${c.path}: ${c.summary}${lines}`;
        })
        .join("\n\n");

      const executionLog: string[] = [];

      // ── Real execution: only when workspace is configured ───────────────
      const workspace =
        state.workspace && state.workspace.trim() !== ""
          ? state.workspace.trim()
          : undefined;

      // Bridge 2: auto-detect test command from workspace project type
      const resolvedTestCommand = testCommand ?? (workspace ? detectTestCommand(workspace) : "npm test");

      // Production verification is a deterministic infrastructure operation, not an
      // LLM classification task. An unavailable model must never erase a successful
      // sandbox test, and a fluent model response must never invent a test pass.
      // Explicitly injected TesterAgent instances retain their historical behavior
      // for the isolated workflow/agent fixtures.
      if (workspace && !agent) {
        const effectiveRunId = state.runId || "run_default";
        let approvalWorkspace = workspace;
        try {
          approvalWorkspace = fs.realpathSync(path.resolve(workspace)).toLowerCase();
        } catch {}
        const approvalContext = {
          runId: effectiveRunId,
          approvalId: state.approvalDecision?.approvalId || `verify-${effectiveRunId}`,
          workspace: approvalWorkspace,
          allowedActions: ["execute_terminal"],
          allowedTargets: [resolvedTestCommand],
        };

        const commandResult = await runCommand(resolvedTestCommand, {
          cwd: workspace,
          workspaceRoot: workspace,
          runId: effectiveRunId,
          timeoutMs: 120_000,
          executionMode: "automatic",
          isApproved: true,
          approvalContext,
          sandbox: "require",
        });
        const attemptedInSandbox = commandResult.sandboxed === true;
        const environmentFailure = isEnvironmentOrSetupFailure(
          commandResult.stdout, commandResult.stderr
        );
        const passed = attemptedInSandbox && !environmentFailure && !commandResult.blocked &&
          !commandResult.approvalRequired && !commandResult.timedOut &&
          commandResult.success && commandResult.exitCode === 0;
        const status: VerificationRecord["status"] = environmentFailure
          ? "environment_failure"
          : !attemptedInSandbox || commandResult.blocked || commandResult.approvalRequired
            ? "blocked"
            : passed ? "passed" : "failed";
        const verificationRecord: VerificationRecord = {
          command: resolvedTestCommand,
          workspace,
          exitCode: commandResult.exitCode,
          stdout: commandResult.stdout,
          stderr: commandResult.stderr,
          durationMs: commandResult.durationMs,
          timeoutMs: 120_000,
          status,
          executedAt: Date.now(),
        };
        return {
          status: "testing",
          testResults: {
            passed,
            totalTests: 1,
            passedTests: passed ? 1 : 0,
            failedTests: passed ? 0 : 1,
            output: [commandResult.stdout, commandResult.stderr].filter(Boolean).join("\n"),
            verificationRecord,
          },
          executionLog: [
            `[TEST-TOOL] Executed ${resolvedTestCommand} inside sandbox: ${status} (exit ${commandResult.exitCode ?? "not executed"})`,
          ],
        };
      }

      if (workspace) {
        executionLog.push(`[TEST-TOOL] Detected test command: ${resolvedTestCommand}`);
        executionLog.push(`[TEST-TOOL] Running: ${resolvedTestCommand} in ${workspace}`);
      }

      const result = await tester.test(state.task, codeChangesContext, {
        workspace,
        testCommand: workspace ? resolvedTestCommand : undefined,
      });

      if (workspace) {
        executionLog.push(
          `[TEST-TOOL] Result: ${result.passed ? "PASSED" : "FAILED"} — ${result.passedTests}/${result.totalTests} tests`
        );
      }

      const termRes = (tester as any).lastTerminalResult;
      const isEnvFailure = termRes
        ? isEnvironmentOrSetupFailure(termRes.stdout, termRes.stderr)
        : isEnvironmentOrSetupFailure(result.summary);

      const verificationRecord: VerificationRecord = {
        command: resolvedTestCommand,
        workspace: workspace || state.workspace || process.cwd(),
        exitCode: termRes?.exitCode ?? (result.passed ? 0 : 1),
        stdout: termRes?.stdout ?? "",
        stderr: termRes?.stderr ?? "",
        durationMs: termRes?.durationMs ?? 0,
        timeoutMs: 120_000,
        status: isEnvFailure
          ? "environment_failure"
          : result.passed
          ? "passed"
          : "failed",
        executedAt: Date.now(),
      };

      const testResultState: TestResult = {
        passed: result.passed,
        totalTests: result.totalTests,
        passedTests: result.passedTests,
        failedTests: result.failedTests,
        output: result.summary,
        verificationRecord,
      };

      return {
        status: "testing",
        testResults: testResultState,
        executionLog,
      };
    } catch (err) {
      return {
        status: "failed",
        errors: [(err as Error).message],
      };
    }
  };
}

/**
 * Default Tester Agent node function for standard graph workflows.
 */
export const testerNode = createTesterNode();

