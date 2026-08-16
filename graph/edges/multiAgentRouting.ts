/**
 * graph/edges/multiAgentRouting.ts
 *
 * Feature 16 — Multi-Agent Conditional Routing Edges
 *
 * Provides conditional routing decision functions connecting the 7 Aegis specialized agents:
 * Planner -> Researcher -> Architect -> Developer -> Tester -> Reviewer -> Security -> END
 * Includes feedback loop routing back to Developer via retryLoop when validation fails.
 */

import { END } from "@langchain/langgraph";
import type { AegisState } from "../state.js";

/** Route decision after Planner node */
export function routeAfterPlanner(state: AegisState): "researcher" | "errorHandler" {
  if (state.status === "failed") return "errorHandler";
  return "researcher";
}

/** Route decision after Researcher node */
export function routeAfterResearcher(state: AegisState): "architect" | "errorHandler" {
  if (state.status === "failed") return "errorHandler";
  return "architect";
}

/** Route decision after Architect node */
export function routeAfterArchitect(state: AegisState): "developer" | "errorHandler" {
  if (state.status === "failed") return "errorHandler";
  return "developer";
}

/** Route decision after Developer node */
export function routeAfterDeveloper(state: AegisState): "tester" | "errorHandler" {
  if (state.status === "failed") return "errorHandler";
  return "tester";
}

/**
 * Route decision after Tester node:
 * - If testPassed -> route to "reviewer"
 * - If testFailed and retryCount < maxRetries -> route to "retryLoop" (repair)
 * - Else (max retries reached or terminal error) -> route to "errorHandler"
 */
export function routeAfterTester(state: AegisState): "reviewer" | "retryLoop" | "errorHandler" {
  if (state.status === "failed") return "errorHandler";

  const passed = state.testResults ? state.testResults.passed : true;
  if (passed) return "reviewer";

  const retries = state.retryCount ?? 0;
  const maxRetries = state.maxRetries ?? 3;
  if (retries < maxRetries) return "retryLoop";

  return "errorHandler";
}

/**
 * Route decision after Reviewer node:
 * - If approved -> route to "security"
 * - If rejected and retryCount < maxRetries -> route to "retryLoop" (repair)
 * - Else -> route to "errorHandler"
 */
export function routeAfterReviewer(state: AegisState): "security" | "retryLoop" | "errorHandler" {
  if (state.status === "failed") return "errorHandler";

  const approved = state.reviewResults ? state.reviewResults.approved : true;
  if (approved) return "security";

  const retries = state.retryCount ?? 0;
  const maxRetries = state.maxRetries ?? 3;
  if (retries < maxRetries) return "retryLoop";

  return "errorHandler";
}

/**
 * Route decision after Security node:
 * - If completed (secure) -> route to END
 * - If unsecure and retryCount < maxRetries -> route to "retryLoop" (repair)
 * - Else -> route to "errorHandler"
 */
export function routeAfterSecurity(state: AegisState): typeof END | "retryLoop" | "errorHandler" {
  if (state.status === "completed") return END;

  const retries = state.retryCount ?? 0;
  const maxRetries = state.maxRetries ?? 3;
  if (retries < maxRetries) return "retryLoop";

  return "errorHandler";
}
