/**
 * graph/nodes/developerNode.ts
 *
 * Feature 12 — Developer Agent LangGraph Node
 *
 * Integrates DeveloperAgent into the Aegis LangGraph state machine.
 * Reads task and architecture from AegisState, invokes DeveloperAgent to generate implementation code changes,
 * and updates state with code changes and execution status.
 */

import type { AegisState, AegisStateUpdate, CodeChange } from "../state.js";
import { DeveloperAgent } from "../../agents/developer/developer.js";

/**
 * Creates a developer node using a provided DeveloperAgent instance or defaults to standard DeveloperAgent.
 */
export function createDeveloperNode(agent?: DeveloperAgent) {
  const developer = agent ?? new DeveloperAgent();

  return async function developerNode(state: AegisState): Promise<AegisStateUpdate> {
    if (!state.task || state.task.trim() === "") {
      return {
        status: "failed",
        errors: ["Task input is empty in developer node"],
      };
    }

    try {
      const result = await developer.develop(state.task, state.architecture);

      const newCodeChanges: CodeChange[] = result.fileChanges.map((fc) => ({
        path: fc.path,
        action: fc.action,
        summary: fc.summary,
        content: fc.content,
      }));

      return {
        status: "developing",
        codeChanges: newCodeChanges,
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
 * Default Developer Agent node function for standard graph workflows.
 */
export const developerNode = createDeveloperNode();
