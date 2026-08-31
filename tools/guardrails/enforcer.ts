/**
 * tools/guardrails/enforcer.ts
 *
 * Feature 24 — Tool Permissions / Guardrails
 *
 * Single enforcement entry point for intercepting tool execution requests,
 * evaluating policy decisions, and seamlessly integrating with Feature 23 Human-in-the-Loop.
 */

import {
  PermissionEvaluationInput,
  PermissionEvaluationResult,
  GuardrailOptions,
} from "./types";
import { evaluatePermission } from "./policyEngine";

export class GuardrailEnforcer {
  /**
   * Enforce tool permissions for a requested tool action.
   *
   * Flow:
   * 1. Evaluates permission policy.
   * 2. If ALLOW -> returns result with allowed: true.
   * 3. If REQUIRE_APPROVAL -> returns result with allowed: false & Feature 23 ApprovalRequest.
   * 4. If BLOCK -> returns result with allowed: false & structured error code.
   */
  public enforce(
    input: PermissionEvaluationInput,
    options: GuardrailOptions = {}
  ): PermissionEvaluationResult {
    const effectiveMode = options.executionMode || input.executionMode || "semi-auto";

    const evalInput: PermissionEvaluationInput = {
      ...input,
      executionMode: effectiveMode,
    };

    return evaluatePermission(evalInput);
  }
}

export const guardrailEnforcer = new GuardrailEnforcer();

/**
 * Public helper function to enforce guardrail check on any tool call.
 */
export function enforceToolGuardrail(
  input: PermissionEvaluationInput,
  options?: GuardrailOptions
): PermissionEvaluationResult {
  return guardrailEnforcer.enforce(input, options);
}
