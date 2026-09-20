/**
 * graph/nodes/recoveryNode.ts
 *
 * Feature 18 — Failure Recovery + Iteration Loops
 *
 * The recovery node is the smart replacement for `retryLoopNode` in the
 * dynamic routing workflow (Feature 17+).
 *
 * Unlike `retryLoopNode` (which only increments retryCount), the recoveryNode:
 *   1. Reads failure evidence from state (testResults, reviewResults, security errors).
 *   2. Builds a structured RecoveryContext entry describing exactly what failed.
 *   3. Appends it to state.recoveryContext so the Developer node knows what to fix.
 *   4. Increments retryCount as before.
 *
 * The `retryLoopNode` in multiAgentNodes.ts is left unchanged for Feature 16
 * backward compatibility.
 */

import type { AegisState, AegisStateUpdate, RecoveryContext } from "../state.js";

/**
 * Extracts structured failure details from current state to build a RecoveryContext.
 *
 * Precedence:
 *   1. Testing failure  (status === "testing"  and testResults exists)
 *   2. Review rejection (status === "reviewing" and reviewResults exists)
 *   3. Security issue   (status === "securing"  — vulnerabilities found)
 *   4. Generic fallback (errors array)
 */
function buildRecoveryContext(state: AegisState): RecoveryContext {
  const attemptNumber = (state.retryCount ?? 0) + 1;

  // ── Tester failure ──────────────────────────────────────────────────────────
  if (state.status === "testing" && state.testResults && !state.testResults.passed) {
    const details: string[] = [];
    if (state.testResults.output) {
      details.push(state.testResults.output);
    }
    details.push(
      `${state.testResults.failedTests} of ${state.testResults.totalTests} tests failed`
    );

    return {
      failingAgent: "tester",
      reason: `Test suite failed: ${state.testResults.failedTests}/${state.testResults.totalTests} tests failed`,
      details,
      attemptNumber,
    };
  }

  // ── Reviewer rejection ──────────────────────────────────────────────────────
  if (state.status === "reviewing" && state.reviewResults && !state.reviewResults.approved) {
    const details: string[] = [
      ...state.reviewResults.comments,
      ...(state.reviewResults.suggestedFixes ?? []),
    ];

    return {
      failingAgent: "reviewer",
      reason: `Code review rejected: ${state.reviewResults.comments.length} issue(s) found`,
      details,
      attemptNumber,
    };
  }

  // ── Security vulnerability ──────────────────────────────────────────────────
  if (state.status === "securing") {
    const securityErrors = state.errors
      .filter((e) => e.startsWith("[SECURITY"))
      .slice(-10);

    return {
      failingAgent: "security",
      reason: `Security audit found vulnerabilities requiring remediation`,
      details: securityErrors.length > 0 ? securityErrors : ["Security vulnerabilities detected"],
      attemptNumber,
    };
  }

  // ── Research failure ────────────────────────────────────────────────────────
  if (state.status === "researching") {
    return {
      failingAgent: "researcher",
      reason: "Research objective execution failed or produced insufficient findings",
      details: state.errors.slice(-5),
      attemptNumber,
    };
  }

  // ── Architect failure ───────────────────────────────────────────────────────
  if (state.status === "architecting") {
    return {
      failingAgent: "architect",
      reason: "Architecture design generation failed or was rejected",
      details: state.errors.slice(-5),
      attemptNumber,
    };
  }

  // ── Developer failure ───────────────────────────────────────────────────────
  if (state.status === "developing") {
    return {
      failingAgent: "developer",
      reason: "Implementation generation failed or produced invalid code changes",
      details: state.errors.slice(-5),
      attemptNumber,
    };
  }

  // ── Planner failure ─────────────────────────────────────────────────────────
  if (state.status === "planning") {
    return {
      failingAgent: "planner",
      reason: "Planning phase failed or generated an empty plan",
      details: state.errors.slice(-5),
      attemptNumber,
    };
  }

  // ── Generic fallback ────────────────────────────────────────────────────────
  const lastErrors = state.errors.slice(-5);
  return {
    failingAgent: "tester",
    reason: "Agent output was insufficient — retrying",
    details: lastErrors,
    attemptNumber,
  };
}

/**
 * Recovery Node function.
 *
 * Builds a structured RecoveryContext from current failure state and
 * increments the retry counter. The Developer node reads this context
 * on its next run to understand exactly what to fix.
 */
export async function recoveryNode(state: AegisState): Promise<AegisStateUpdate> {
  const currentRetries = state.retryCount ?? 0;
  const maxRetries = state.maxRetries ?? 3;
  const nextRetries = currentRetries + 1;

  const context = buildRecoveryContext(state);

  return {
    retryCount: nextRetries,
    recoveryContext: [context],
    codeChanges: [],
    approvalDecision: null,
    errors: [
      `[RECOVERY] Attempt ${nextRetries}/${maxRetries} — ${context.failingAgent} failed: ${context.reason}`,
    ],
  };
}
