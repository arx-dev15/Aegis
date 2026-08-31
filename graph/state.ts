/**
 * graph/state.ts
 *
 * Feature 05 — LangGraph State
 * Feature 18 — RecoveryContext added
 *
 * Shared Aegis workflow state using LangGraph's Annotation API.
 * Provides the single source of truth passed across nodes/agents in the execution graph.
 */

import { Annotation } from "@langchain/langgraph";
import type { ApprovalRequest, ApprovalDecision } from "./approvalTypes.js";

// ── Supporting Types ─────────────────────────────────────────────────────────

export type ExecutionStatus =
  | "idle"
  | "planning"
  | "researching"
  | "architecting"
  | "developing"
  | "testing"
  | "reviewing"
  | "securing"
  | "paused"
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

/**
 * Structured record of a single recovery/retry event.
 * Appended each time the workflow loops back to a recovery agent.
 */
export interface RecoveryContext {
  /** Which agent's output triggered this recovery */
  failingAgent: "planner" | "researcher" | "architect" | "developer" | "tester" | "reviewer" | "security";
  /** Short human-readable reason for the retry */
  reason: string;
  /** Specific issues found (test names, review comments, vulnerability IDs) */
  details: string[];
  /** Which retry attempt this is (1-indexed) */
  attemptNumber: number;
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

  /**
   * Workspace directory path where the Developer agent writes files.
   * Tester agent runs commands here. Empty string = no real workspace (simulation mode).
   */
  workspace: Annotation<string>({
    reducer: (_, update) => update,
    default: () => "",
  }),

  /**
   * Log of real tool executions (file writes, terminal commands).
   * Appended by DeveloperNode and TesterNode when running in execution mode.
   */
  executionLog: Annotation<string[]>({
    reducer: (existing, update) => existing.concat(update),
    default: () => [],
  }),

  /**
   * Feature 18 — Ordered log of recovery events.
   * Each entry describes why we are retrying and which agent failed.
   * The most recent entry gives the Developer its repair context.
   */
  recoveryContext: Annotation<RecoveryContext[]>({
    reducer: (existing, update) => existing.concat(update),
    default: () => [],
  }),

  /**
   * Feature 21 — Unique identifier for current execution run for short-term memory scoping.
   */
  runId: Annotation<string>({
    reducer: (_, update) => update,
    default: () => "",
  }),

  /**
   * Feature 21/22 — Formatted memory context (short-term execution notes + long-term decisions).
   */
  memoryContext: Annotation<string>({
    reducer: (_, update) => update,
    default: () => "",
  }),

  /**
   * Feature 23 — Pending approval request when graph execution is paused for human decision.
   */
  pendingApproval: Annotation<ApprovalRequest | null>({
    reducer: (_, update) => update,
    default: () => null,
  }),

  /**
   * Feature 23 — Human approval decision (approve or reject) returned to resume graph execution.
   */
  approvalDecision: Annotation<ApprovalDecision | null>({
    reducer: (_, update) => update,
    default: () => null,
  }),
});

/** Full read state type for nodes */
export type AegisState = typeof AegisStateAnnotation.State;

/** State update type returned by nodes */
export type AegisStateUpdate = typeof AegisStateAnnotation.Update;
