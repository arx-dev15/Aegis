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
 * Analyze a terminal command string and determine its risk classification and permission decision.
 */
export function analyzeTerminalCommand(command: string): {
  category: ToolCategory;
  decision: PermissionDecision;
  reason: string;
} {
  const cmd = command.trim();

  // 1. Dangerous destructive commands & environment dumping -> BLOCK
  if (
    /rm\s+-rf/i.test(cmd) ||
    /del\s+\/[sfq]/i.test(cmd) ||
    /format\s+[c-z]:/i.test(cmd) ||
    /\b(shutdown|reboot|poweroff|init\s+0)\b/i.test(cmd) ||
    /\bsudo\b/i.test(cmd) ||
    /\bchmod\b/i.test(cmd) ||
    /\bchown\b/i.test(cmd) ||
    /^\s*(env|printenv|set)\s*$/i.test(cmd) ||
    /^\s*(env|printenv|set)\s*\|/i.test(cmd) ||
    /\/etc\/(passwd|shadow|sudoers)/i.test(cmd) ||
    /c:\\windows\\system32/i.test(cmd)
  ) {
    return {
      category: "dangerous",
      decision: "BLOCK",
      reason: `Command "${cmd}" blocked by security policy (destructive operation, privilege escalation, or environment secret dumping).`,
    };
  }

  // 2. Safe read-only / test / build inspection commands -> ALLOW
  const isSafeCommand =
    /^git\s+(status|diff|log|branch|show)\b/i.test(cmd) ||
    /^(npm|npx|pnpm|yarn)\s+(test|run\s+build|run\s+test|tsc\s+--noEmit|--version)\b/i.test(cmd) ||
    /^\s*npx\s+tsc\b/i.test(cmd) ||
    /^\s*(ls|dir|pwd|echo|node\s+--version|npm\s+--version|python\s+--version|python3\s+--version)\b/i.test(cmd);

  if (isSafeCommand) {
    return {
      category: "read-only",
      decision: "ALLOW",
      reason: `Safe inspection / build / test command "${cmd}" allowed automatically.`,
    };
  }

  // 3. Risky commands (script execution, package install, git mutations) -> REQUIRE_APPROVAL
  const isRiskyCommand =
    /^python\b/i.test(cmd) ||
    /^python3\b/i.test(cmd) ||
    /^node\s+[^-]/i.test(cmd) ||
    /^npm\s+(install|i|add|publish)\b/i.test(cmd) ||
    /^git\s+(push|reset|checkout|commit|rebase|merge)\b/i.test(cmd) ||
    /^\s*(touch|mkdir|cp|mv|rm)\b/i.test(cmd);

  if (isRiskyCommand) {
    return {
      category: "sensitive-mutation",
      decision: "REQUIRE_APPROVAL",
      reason: `Potentially risky script/package/repo execution command "${cmd}" requires human approval before execution.`,
    };
  }

  // Default terminal execution policy -> REQUIRE_APPROVAL for unclassified arbitrary commands
  return {
    category: "sensitive-mutation",
    decision: "REQUIRE_APPROVAL",
    reason: `Terminal execution of "${cmd}" requires human approval by default policy.`,
  };
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

  if (toolLower === "terminal" || actLower === "execute_terminal" || actLower === "run_command") {
    if (target) {
      return analyzeTerminalCommand(target).category;
    }
  }

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

  const actLower = action.toLowerCase();
  const toolLower = toolName.toLowerCase();

  // 1b. Specific granular check for terminal execution tool
  if (toolLower === "terminal" || actLower === "execute_terminal" || actLower === "run_command") {
    const termAnalysis = analyzeTerminalCommand(target || action);
    if (termAnalysis.decision === "BLOCK") {
      return {
        allowed: false,
        decision: "BLOCK",
        category: "dangerous",
        reason: termAnalysis.reason,
        code: "ERR_TERMINAL_COMMAND_BLOCKED",
      };
    }

    if (termAnalysis.decision === "ALLOW") {
      return {
        allowed: true,
        decision: "ALLOW",
        category: termAnalysis.category,
        reason: termAnalysis.reason,
      };
    }

    if (termAnalysis.decision === "REQUIRE_APPROVAL") {
      if (executionMode === "automatic" && riskLevel !== "critical") {
        return {
          allowed: true,
          decision: "ALLOW",
          category: "sensitive-mutation",
          reason: `Terminal command "${target || action}" allowed automatically under automatic execution mode.`,
        };
      }

      const apprReq = createApprovalRequest({
        runId,
        type: "command-execution",
        action: "execute_terminal",
        title: `Approve terminal command: ${target || action}`,
        description: termAnalysis.reason,
        target: target || action,
        riskLevel: riskLevel || "high",
        requestedBy: toolName,
      });

      return {
        allowed: false,
        decision: "REQUIRE_APPROVAL",
        category: "sensitive-mutation",
        reason: termAnalysis.reason,
        approvalRequest: apprReq,
      };
    }
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
