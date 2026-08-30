/**
 * graph/edges/agentRouter.ts
 *
 * Feature 17 — Agent Routing + Conditional Execution
 * Feature 18 — Routes validation failures to "recovery" node for context-aware retry
 *
 * Provides deterministic, state-based agent routing for Aegis workflows.
 * Evaluates current AegisState to dynamically determine the next appropriate specialized agent:
 *   Planner → Researcher → Architect → Developer → Tester → Reviewer → Security → END
 *
 * Supports conditional execution & artifact skipping:
 *   - Evaluates active node status (planning, researching, architecting, developing, testing, reviewing, securing).
 *   - Automatically skips completed agent stages when required state artifacts are pre-populated.
 *   - Directs failing validation (Tester, Reviewer, Security) to recoveryNode or errorHandler.
 *   - Gracefully handles empty/invalid tasks or failed states.
 */

import { END } from "@langchain/langgraph";
import type { AegisState } from "../state.js";

/** Valid target agent node identifiers in the Aegis multi-agent graph */
export type TargetAgentNode =
  | "planner"
  | "researcher"
  | "architect"
  | "developer"
  | "tester"
  | "reviewer"
  | "security"
  | "retryLoop"
  | "recovery"
  | "errorHandler"
  | typeof END;

/**
 * Core Routing Function: Determines the next agent node based on current AegisState.
 *
 * Decision Order:
 *  1. Terminal Guards (invalid task, status === "failed" → "errorHandler"; status === "completed" → END)
 *  2. Node Completion Transitions (evaluates status set by the node that just executed)
 *  3. Initial State Artifact Inspection (for fresh runs or pre-filled state skipping)
 */
export function determineNextAgent(state: AegisState): TargetAgentNode {
  // 1. Terminal Error / Empty Task Guard
  if (!state || !state.task || state.task.trim() === "" || state.status === "failed") {
    return "errorHandler";
  }

  // 2. Terminal Success Guard
  if (state.status === "completed") {
    return END;
  }

  const retries = state.retryCount ?? 0;
  const maxRetries = state.maxRetries ?? 3;

  // 3. Status-Based Execution Transitions (Evaluated immediately after a node completes)
  if (state.status === "planning") {
    return "researcher";
  }

  if (state.status === "researching") {
    return "architect";
  }

  if (state.status === "architecting") {
    return "developer";
  }

  if (state.status === "developing") {
    // Developer just finished generating/repairing code → next stage is ALWAYS Tester
    return "tester";
  }

  if (state.status === "testing") {
    // Tester node just ran → evaluate test results
    if (state.testResults && !state.testResults.passed) {
      // Feature 18: route to "recovery" (context-aware) instead of "retryLoop" (blunt)
      return retries < maxRetries ? "recovery" : "errorHandler";
    }
    return "reviewer";
  }

  if (state.status === "reviewing") {
    // Reviewer node just ran → evaluate review results
    if (state.reviewResults && !state.reviewResults.approved) {
      // Feature 18: route to "recovery" (context-aware) instead of "retryLoop" (blunt)
      return retries < maxRetries ? "recovery" : "errorHandler";
    }
    return "security";
  }

  if (state.status === "securing") {
    // Security audit found vulnerabilities
    // Feature 18: route to "recovery" (context-aware) instead of "retryLoop" (blunt)
    return retries < maxRetries ? "recovery" : "errorHandler";
  }

  // 4. Initial State Inspection (for fresh runs with status "idle" or pre-filled artifact skipping)
  if (!state.plan || state.plan.length === 0) {
    return "planner";
  }

  if (!state.research || state.research.trim() === "") {
    return "researcher";
  }

  if (!state.architecture || state.architecture.trim() === "") {
    return "architect";
  }

  if (!state.codeChanges || state.codeChanges.length === 0) {
    return "developer";
  }

  if (!state.testResults) {
    return "tester";
  }

  if (!state.testResults.passed) {
    return retries < maxRetries ? "recovery" : "errorHandler";
  }

  if (!state.reviewResults) {
    return "reviewer";
  }

  if (!state.reviewResults.approved) {
    return retries < maxRetries ? "recovery" : "errorHandler";
  }

  return "security";
}

// ── Node-Specific Conditional Edge Routing Helpers ───────────────────────────

/** Route decision after Planner node */
export function routeFromPlanner(state: AegisState): TargetAgentNode {
  return determineNextAgent(state);
}

/** Route decision after Researcher node */
export function routeFromResearcher(state: AegisState): TargetAgentNode {
  return determineNextAgent(state);
}

/** Route decision after Architect node */
export function routeFromArchitect(state: AegisState): TargetAgentNode {
  return determineNextAgent(state);
}

/** Route decision after Developer node */
export function routeFromDeveloper(state: AegisState): TargetAgentNode {
  return determineNextAgent(state);
}

/** Route decision after Tester node */
export function routeFromTester(state: AegisState): TargetAgentNode {
  return determineNextAgent(state);
}

/** Route decision after Reviewer node */
export function routeFromReviewer(state: AegisState): TargetAgentNode {
  return determineNextAgent(state);
}

/** Route decision after Security node */
export function routeFromSecurity(state: AegisState): TargetAgentNode {
  return determineNextAgent(state);
}

/**
 * Route decision after Recovery node.
 * Determines which agent should receive execution based on the latest RecoveryContext:
 *   - Research failure -> Researcher
 *   - Architecture failure/rejection -> Architect
 *   - Planner failure -> Planner
 *   - Developer/Tester/Reviewer/Security -> Developer (for code repair)
 */
export function routeFromRecovery(state: AegisState): TargetAgentNode {
  const latestContext = state.recoveryContext && state.recoveryContext.length > 0
    ? state.recoveryContext[state.recoveryContext.length - 1]
    : null;

  if (!latestContext) {
    return "developer";
  }

  switch (latestContext.failingAgent) {
    case "planner":
      return "planner";
    case "researcher":
      return "researcher";
    case "architect":
      return "architect";
    case "developer":
    case "tester":
    case "reviewer":
    case "security":
    default:
      return "developer";
  }
}
