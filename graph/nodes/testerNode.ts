/**
 * graph/nodes/testerNode.ts
 *
 * Feature 13 (upgraded in Feature 16) — Tester Agent LangGraph Node
 *
 * Two-phase execution:
 *
 *   Phase 1 — Real terminal execution (when workspace is set):
 *     Runs the configured testCommand inside state.workspace using the
 *     terminal tool. Captures real stdout/stderr/exit code.
 *
 *   Phase 2 — LLM interpretation:
 *     Feeds real output (or code change context in simulation mode)
 *     to TesterAgent to produce a structured TesterResult.
 *
 * When workspace is empty, behaves exactly as before — all existing tests pass.
 */

import type { AegisState, AegisStateUpdate, TestResult } from "../state.js";
import { TesterAgent, TerminalRunner } from "../../agents/tester/tester.js";
import { runCommand } from "../../tools/terminal/index.js";

// ── Real terminal runner backed by the terminal tool ─────────────────────────

const realTerminalRunner: TerminalRunner = {
  async run(command: string, cwd: string) {
    return runCommand(command, { cwd, timeoutMs: 120_000 });
  },
};

// ── Default test command ──────────────────────────────────────────────────────

/**
 * The command the Tester runs in the workspace.
 * Can be overridden by setting AEGIS_TEST_COMMAND in environment.
 */
const DEFAULT_TEST_COMMAND =
  process.env["AEGIS_TEST_COMMAND"] ?? "npx tsx --version";

/**
 * Creates a tester node using a provided TesterAgent instance or defaults to standard TesterAgent.
 *
 * @param agent          - Optional TesterAgent to inject (used in tests for mock models).
 * @param testCommand    - Command to run in the workspace. Defaults to AEGIS_TEST_COMMAND env var.
 */
export function createTesterNode(
  agent?: TesterAgent,
  testCommand: string = DEFAULT_TEST_COMMAND
) {
  // Only inject the real terminal runner for the default (non-test) agent.
  // When an agent is explicitly injected (tests), the caller controls the model.
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

      if (workspace) {
        executionLog.push(`[TEST-TOOL] Running: ${testCommand} in ${workspace}`);
      }

      const result = await tester.test(state.task, codeChangesContext, {
        workspace,
        testCommand: workspace ? testCommand : undefined,
      });

      if (workspace) {
        executionLog.push(
          `[TEST-TOOL] Result: ${result.passed ? "PASSED" : "FAILED"} — ${result.passedTests}/${result.totalTests} tests`
        );
      }

      const testResultState: TestResult = {
        passed: result.passed,
        totalTests: result.totalTests,
        passedTests: result.passedTests,
        failedTests: result.failedTests,
        output: result.summary,
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
