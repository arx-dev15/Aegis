/**
 * graph/nodes/securityNode.ts
 *
 * Feature 15 — Security Agent LangGraph Node
 *
 * Integrates SecurityAgent into the Aegis LangGraph state machine.
 * Reads task, codeChanges, and architecture from AegisState, invokes SecurityAgent to perform a security audit,
 * and updates state with security findings and execution status.
 */

import type { AegisState, AegisStateUpdate } from "../state.js";
import { SecurityAgent } from "../../agents/security/security.js";

/**
 * Creates a security node using a provided SecurityAgent instance or defaults to standard SecurityAgent.
 */
export function createSecurityNode(agent?: SecurityAgent) {
  const securityAgent = agent ?? new SecurityAgent();

  return async function securityNode(state: AegisState): Promise<AegisStateUpdate> {
    if (!state.task || state.task.trim() === "") {
      return {
        status: "failed",
        errors: ["Task input is empty in security node"],
      };
    }

    try {
      const codeChangesContext = state.codeChanges.map((c) => c.path).join(", ");
      const result = await securityAgent.audit(state.task, codeChangesContext, state.architecture);

      const securitySummaryFormatted = [
        `Security Status: ${result.secure ? "SECURE" : "UNSECURE"}`,
        `Summary: ${result.summary}`,
        `Vulnerabilities: ${result.vulnerabilities.map((v) => `[${v.severity.toUpperCase()}] ${v.vulnerability} - ${v.remediation}`).join("; ")}`,
        `Recommendations: ${result.recommendations.join("; ")}`,
      ].join("\n");

      return {
        status: result.secure ? "completed" : "failed",
        research: `${state.research}\n\n${securitySummaryFormatted}`.trim(),
        errors: result.secure
          ? state.errors
          : state.errors.concat(result.vulnerabilities.map((v) => `[SECURITY - ${v.severity.toUpperCase()}] ${v.vulnerability}`)),
      };
    } catch (err) {
      return {
        status: "failed",
        errors: [(err as Error).message],
      };
    }
  };
}

/**
 * Default Security Agent node function for standard graph workflows.
 */
export const securityNode = createSecurityNode();
