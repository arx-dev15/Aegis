/**
 * graph/state.ts
 *
 * Feature 05 — LangGraph State
 *
 * Shared Aegis workflow state using LangGraph's Annotation API.
 * Provides the single source of truth passed across nodes/agents in the execution graph.
 */

import { Annotation } from "@langchain/langgraph";

// ── Supporting Types ─────────────────────────────────────────────────────────

export type ExecutionStatus =
  | "idle"
  | "planning"
  | "researching"
  | "architecting"
  | "developing"
  | "testing"
  | "reviewing"
  | "completed"
  | "failed";

export interface PlanStep {
  id: string;
  description: string;
  status: "pending" | "in_progress" | "completed" | "failed";
}

export interface CodeChange {
  path: string;
  action: "add" | "modify" | "delete";
  content?: string;
  summary?: string;
}

export interface TestResult {
  passed: boolean;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  output?: string;
}

export interface ReviewResult {
  approved: boolean;
  comments: string[];
  suggestedFixes?: string[];
}

// ── State Annotation Definition ──────────────────────────────────────────────

/**
 * AegisStateAnnotation defines the graph state schema for LangGraph.
 */
export const AegisStateAnnotation = Annotation.Root({
  /** User task or goal description */
  task: Annotation<string>({
    reducer: (_, update) => update,
    default: () => "",
  }),

  /** Current execution plan steps */
  plan: Annotation<PlanStep[]>({
    reducer: (_, update) => update,
    default: () => [],
  }),

  /** Research notes and contextual information */
  research: Annotation<string>({
    reducer: (existing, update) => (update ? `${existing}\n${update}`.trim() : existing),
    default: () => "",
  }),

  /** Architectural specifications and design notes */
  architecture: Annotation<string>({
    reducer: (_, update) => update,
    default: () => "",
  }),

  /** File changes generated during development */
  codeChanges: Annotation<CodeChange[]>({
    reducer: (existing, update) => existing.concat(update),
    default: () => [],
  }),

  /** Test results from automated testing */
  testResults: Annotation<TestResult | null>({
    reducer: (_, update) => update,
    default: () => null,
  }),

  /** Review findings and approval state */
  reviewResults: Annotation<ReviewResult | null>({
    reducer: (_, update) => update,
    default: () => null,
  }),

  /** Accumulated error log messages */
  errors: Annotation<string[]>({
    reducer: (existing, update) => existing.concat(update),
    default: () => [],
  }),

  /** Overall workflow execution status */
  status: Annotation<ExecutionStatus>({
    reducer: (_, update) => update,
    default: () => "idle",
  }),

  /** Current retry attempt count for loop/retry control */
  retryCount: Annotation<number>({
    reducer: (_, update) => update,
    default: () => 0,
  }),

  /** Maximum allowed retry attempts */
  maxRetries: Annotation<number>({
    reducer: (_, update) => update,
    default: () => 3,
  }),
});

/** Full read state type for nodes */
export type AegisState = typeof AegisStateAnnotation.State;

/** State update type returned by nodes */
export type AegisStateUpdate = typeof AegisStateAnnotation.Update;
