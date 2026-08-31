/**
 * graph/edges/approvalGate.ts
 *
 * Feature 23 — Human-in-the-Loop
 *
 * Evaluates whether an action requires human approval based on execution mode,
 * risk level, and tool action type. Creates standardized approval requests when needed.
 */

import {
  ApprovalRequest,
  ApprovalRiskLevel,
  CreateApprovalRequestOptions,
} from "../approvalTypes";

export interface RequiresApprovalPolicyOptions {
  executionMode?: "automatic" | "semi-auto" | "manual";
  riskLevel?: ApprovalRiskLevel;
  isMutating?: boolean;
}

/**
  * List of action strings that perform mutating/destructive operations.
  */
const MUTATING_ACTIONS = new Set([
  "delete_file",
  "write_file",
  "modify_file",
  "execute_terminal",
  "deploy_production",
  "run_migration",
  "delete",
  "modify",
  "add",
]);

/**
  * Evaluates whether an action requires human approval.
  *
  * Policy Rules:
  * 1. Execution mode 'manual' requires approval for all mutating/high-risk actions.
  * 2. Execution mode 'semi-auto' requires approval for mutating actions (write/delete/execute) or high/critical risk.
  * 3. Risk levels 'high' or 'critical' always require approval regardless of mode.
  * 4. Safe read-only operations ('low' risk, no mutation) proceed automatically.
  */
export function requiresApproval(
  action: string,
  options: RequiresApprovalPolicyOptions = {}
): boolean {
  const mode = options.executionMode ?? "semi-auto";
  const risk = options.riskLevel ?? "medium";
  const isMutating = options.isMutating ?? MUTATING_ACTIONS.has(action.toLowerCase());

  // Automatic mode bypasses low/medium risk approval checks (unless explicitly critical)
  if (mode === "automatic" && risk !== "critical") {
    return false;
  }

  // High or Critical risk always requires approval
  if (risk === "high" || risk === "critical") {
    return true;
  }

  // Manual mode requires approval for any mutating action
  if (mode === "manual" && isMutating) {
    return true;
  }

  // Semi-auto mode requires approval for mutating actions (delete, write, production changes)
  if (mode === "semi-auto" && isMutating) {
    return true;
  }

  return false;
}

/**
  * Factory helper to create a standardized ApprovalRequest object.
  */
export function createApprovalRequest(
  options: CreateApprovalRequestOptions
): ApprovalRequest {
  const now = Date.now();
  return {
    id: `appr_${now}_${Math.random().toString(36).substring(2, 7)}`,
    runId: options.runId,
    type: options.type,
    action: options.action,
    title: options.title,
    description: options.description,
    target: options.target,
    riskLevel: options.riskLevel ?? "high",
    requestedBy: options.requestedBy ?? "aegis-runtime",
    status: "pending",
    requestedAt: now,
  };
}
