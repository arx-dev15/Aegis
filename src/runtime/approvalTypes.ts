/**
 * graph/approvalTypes.ts
 *
 * Feature 23 — Human-in-the-Loop
 *
 * Data types and interfaces for human approval requests, decisions,
 * and execution policies in Aegis.
 */

export type ApprovalType =
  | "code-review"
  | "deployment"
  | "security-check"
  | "file-mutation"
  | "command-execution";

export type ApprovalRiskLevel = "low" | "medium" | "high" | "critical";

export interface ApprovalRequest {
  /** Unique ID for the approval request */
  id: string;
  /** Active run/execution ID */
  runId: string;
  /** Category of approval */
  type: ApprovalType;
  /** Action identifier requiring approval (e.g. "delete_file", "write_file", "execute_terminal") */
  action: string;
  /** Short human-readable title */
  title: string;
  /** Contextual explanation for the human reviewer */
  description: string;
  /** Relevant target (file path, command string, deployment target) */
  target?: string;
  /** Assessed risk level */
  riskLevel?: ApprovalRiskLevel;
  /** Agent or system component requesting approval */
  requestedBy: string;
  /** Current status of the approval gate */
  status: "pending" | "approved" | "rejected";
  /** Timestamp created (Epoch MS) */
  requestedAt: number;
}

export interface ApprovalDecision {
  /** ID of the approval request being resolved */
  approvalId: string;
  /** Human decision: approve or reject */
  action: "approve" | "reject";
  /** Optional explanation or reasoning from the human reviewer */
  reason?: string;
  /** Timestamp resolved (Epoch MS) */
  decidedAt: number;
}

export interface CreateApprovalRequestOptions {
  runId: string;
  type: ApprovalType;
  action: string;
  title: string;
  description: string;
  target?: string;
  riskLevel?: ApprovalRiskLevel;
  requestedBy?: string;
}
