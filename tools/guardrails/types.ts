/**
 * tools/guardrails/types.ts
 *
 * Feature 24 — Tool Permissions / Guardrails
 *
 * Data types and interfaces for tool classification, safety policies,
 * and guardrail enforcement decisions in Aegis.
 */

import { ApprovalRequest, ApprovalRiskLevel } from "../../graph/approvalTypes";

export type ToolCategory =
  | "read-only"
  | "safe-mutation"
  | "sensitive-mutation"
  | "dangerous";

export type PermissionDecision = "ALLOW" | "REQUIRE_APPROVAL" | "BLOCK";

export interface PermissionEvaluationInput {
  /** Tool identifier or command name */
  toolName: string;
  /** Specific action or sub-command requested */
  action: string;
  /** Target file path, command string, database target, etc. */
  target?: string;
  /** Current execution mode */
  executionMode?: "automatic" | "semi-auto" | "manual";
  /** Assessed risk level */
  riskLevel?: ApprovalRiskLevel;
  /** Associated active execution run ID */
  runId?: string;
  /** Additional contextual metadata */
  context?: Record<string, any>;
}

export interface PermissionEvaluationResult {
  /** Whether the tool execution is permitted to proceed immediately */
  allowed: boolean;
  /** Explicit permission policy decision */
  decision: PermissionDecision;
  /** Tool classification category */
  category: ToolCategory;
  /** Explanation or reason for the decision */
  reason: string;
  /** Unique error code if blocked */
  code?: string;
  /** Approval request if decision is REQUIRE_APPROVAL */
  approvalRequest?: ApprovalRequest;
}

export interface GuardrailOptions {
  /** Root directory for workspace sandbox verification */
  rootDir?: string;
  /** Override execution mode */
  executionMode?: "automatic" | "semi-auto" | "manual";
}
