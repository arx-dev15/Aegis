/**
 * graph/nodes/testerNode.ts
 *
 * Feature 13 — Tester Agent LangGraph Node
 *
 * Integrates TesterAgent into the Aegis LangGraph state machine.
 * Reads task and codeChanges from AegisState, invokes TesterAgent to run verification tests,
 * and updates state with test results and execution status.
 */

import type { AegisState, AegisStateUpdate, TestResult } from "../state.js";
import { TesterAgent } from "../../agents/tester/tester.js";

/**
 * Creates a tester node using a provided TesterAgent instance or defaults to standard TesterAgent.
 */
export function createTesterNode(agent?: TesterAgent) {
  const tester = agent ?? new TesterAgent();

  return async function testerNode(state: AegisState): Promise<AegisStateUpdate> {
    if (!state.task || state.task.trim() === "") {
      return {
        status: "failed",
        errors: ["Task input is empty in tester node"],
      };
    }

    try {
      const codeChangesContext = state.codeChanges.map((c) => c.path).join(", ");
      const result = await tester.test(state.task, codeChangesContext);

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
