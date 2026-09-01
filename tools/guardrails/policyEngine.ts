/**
 * tools/guardrails/policyEngine.ts
 *
 * Feature 24 — Tool Permissions / Guardrails
 *
 * Centralized policy engine for classifying tools/actions into risk categories,
 * detecting dangerous commands and path escapes, and returning explicit permission
 * decisions (ALLOW, REQUIRE_APPROVAL, BLOCK).
 */

import path from "path";
import {
  ToolCategory,
  PermissionDecision,
  PermissionEvaluationInput,
  PermissionEvaluationResult,
} from "./types";
import { createApprovalRequest } from "../../graph/edges/approvalGate";

/**
 * Dangerous pattern regex list for blocking destructive system commands.
 */
const DANGEROUS_COMMAND_PATTERNS = [
  /rm\s+-rf\s+[/~]/i,
  /del\s+\/[sfq]\s+[c-z]:/i,
  /format\s+[c-z]:/i,
  /mkfs/i,
  /:()\s*\{\s*:\|:&\s*\}\s*;/i, // Fork bomb
  /\b(shutdown|reboot|poweroff|init\s+0)\b/i,
  /sudo\s+rm\s+-rf/i,
  /chmod\s+-r\s+777\s+\//i,
  /\b(drop\s+database|truncate\s+table)\b/i,
  /\/etc\/(passwd|shadow|sudoers)/i,
  /c:\\windows\\system32/i,
];

/**
 * Read-only tool names and action identifiers.
 */
const READ_ONLY_ACTIONS = new Set([
  "read_file",
  "readfile",
  "read_dir",
  "readdir",
  "list_dir",
  "listdir",
  "view_file",
  "viewfile",
  "search",
  "search_docs",
  "calculate",
  "calculator",
  "get",
  "query_knowledge",
  // Feature 25 — GitHub Read Actions
  "get_repository",
  "list_branches",
  "get_branch",
  "list_contents",
  "get_file",
  "list_commits",
  "get_issue",
  "list_issues",
  "get_pull_request",
  "list_pull_requests",
]);

/**
 * Sensitive mutation actions.
 */
const SENSITIVE_MUTATION_ACTIONS = new Set([
  "write_file",
  "writefile",
  "delete_file",
  "deletefile",
  "execute_terminal",
  "executeterminal",
  "run_command",
  "runcommand",
  "deploy_production",
  "run_migration",
  "modify",
  "delete",
  // Feature 25 — GitHub Write Actions
  "create_or_update_file",
  "create_issue",
  "create_pull_request",
]);

/**
 * Check if an action or target matches dangerous/destructive patterns or path escape attempts.
 */
export function isDangerousAction(action: string, target?: string): { isDangerous: boolean; reason?: string } {
  // Check path escape patterns if target looks like a relative/absolute file path
  if (target) {
    if (target.includes("../") || target.includes("..\\") || target.includes("../..") || target.includes("..\\..")) {
      return {
        isDangerous: true,
        reason: `Path escape attempt blocked: "${target}" attempts to navigate outside sandbox root.`,
      };
    }
  }

  const combined = `${action} ${target || ""}`.trim();

  // Check dangerous command patterns
  for (const pattern of DANGEROUS_COMMAND_PATTERNS) {
    if (pattern.test(combined)) {
      return {
        isDangerous: true,
        reason: `Destructive operation blocked by Aegis security policy: "${combined}"`,
      };
    }
  }

  return { isDangerous: false };
}

/**
 * Classify a tool request into a clear ToolCategory.
 */
export function classifyToolAction(toolName: string, action: string, target?: string): ToolCategory {
  const dangerousCheck = isDangerousAction(action, target);
  if (dangerousCheck.isDangerous) {
    return "dangerous";
  }

  const actLower = action.toLowerCase();
  const toolLower = toolName.toLowerCase();

  if (READ_ONLY_ACTIONS.has(actLower) || READ_ONLY_ACTIONS.has(toolLower)) {
    return "read-only";
  }

  if (SENSITIVE_MUTATION_ACTIONS.has(actLower) || SENSITIVE_MUTATION_ACTIONS.has(toolLower)) {
    return "sensitive-mutation";
  }

  // Default to safe-mutation for unclassified mild mutations
  return "safe-mutation";
}

/**
 * Evaluate permission policy for a tool execution request.
 *
 * Returns explicit decision: ALLOW, REQUIRE_APPROVAL, or BLOCK.
 */
export function evaluatePermission(input: PermissionEvaluationInput): PermissionEvaluationResult {
  const { toolName, action, target, executionMode = "semi-auto", riskLevel, runId = "run_default" } = input;

  // 1. Dangerous action check -> ALWAYS BLOCK
  const dangerousCheck = isDangerousAction(action, target);
  if (dangerousCheck.isDangerous) {
    return {
      allowed: false,
      decision: "BLOCK",
      category: "dangerous",
      reason: dangerousCheck.reason || `Action "${action}" on target "${target || "N/A"}" is classified as dangerous.`,
      code: "ERR_DANGEROUS_ACTION_BLOCKED",
    };
  }

  const category = classifyToolAction(toolName, action, target);

  // 2. Read-only tools -> ALWAYS ALLOW
  if (category === "read-only") {
    return {
      allowed: true,
      decision: "ALLOW",
      category: "read-only",
      reason: `Read-only operation "${action}" allowed automatically.`,
    };
  }

  // 3. Safe mutation tools -> ALLOW in automatic and semi-auto
  if (category === "safe-mutation") {
    if (executionMode === "manual") {
      const apprReq = createApprovalRequest({
        runId,
        type: "file-mutation",
        action,
        title: `Manual Mode Approval: ${toolName}`,
        description: `Manual mode requires approval for safe-mutation action "${action}".`,
        target,
        riskLevel: "medium",
        requestedBy: toolName,
      });
      return {
        allowed: false,
        decision: "REQUIRE_APPROVAL",
        category: "safe-mutation",
        reason: `Manual execution mode requires human approval for mutation operation "${action}".`,
        approvalRequest: apprReq,
      };
    }
    return {
      allowed: true,
      decision: "ALLOW",
      category: "safe-mutation",
      reason: `Safe mutation operation "${action}" allowed.`,
    };
  }

  // 4. Sensitive mutation tools -> REQUIRE_APPROVAL in semi-auto or manual mode
  if (category === "sensitive-mutation") {
    if (executionMode === "automatic" && riskLevel !== "high" && riskLevel !== "critical") {
      return {
        allowed: true,
        decision: "ALLOW",
        category: "sensitive-mutation",
        reason: `Sensitive mutation operation "${action}" allowed under automatic execution mode.`,
      };
    }

    const apprReq = createApprovalRequest({
      runId,
      type: action.includes("file") ? "file-mutation" : "command-execution",
      action,
      title: `Approve sensitive operation: ${action}`,
      description: `Execution mode "${executionMode}" requires human approval before performing "${action}" on target "${target || "workspace"}".`,
      target,
      riskLevel: riskLevel || "high",
      requestedBy: toolName,
    });

    return {
      allowed: false,
      decision: "REQUIRE_APPROVAL",
      category: "sensitive-mutation",
      reason: `Sensitive operation "${action}" requires human approval under ${executionMode} execution mode.`,
      approvalRequest: apprReq,
    };
  }

  // Default fallback -> BLOCK safely
  return {
    allowed: false,
    decision: "BLOCK",
    category: "dangerous",
    reason: `Operation "${action}" denied by default fallback policy.`,
    code: "ERR_POLICY_FALLBACK_DENIED",
  };
}
