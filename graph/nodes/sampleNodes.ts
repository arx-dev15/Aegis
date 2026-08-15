/**
 * graph/nodes/sampleNodes.ts
 *
 * Feature 06 — LangGraph Nodes
 *
 * Example workflow nodes that read and update the shared Aegis state.
 */

import type { AegisState, AegisStateUpdate } from "../state.js";

/**
 * Node 1: Input Processor Node
 * Processes the incoming task, updates status to "planning", and adds initial research.
 */
export async function inputProcessorNode(state: AegisState): Promise<AegisStateUpdate> {
  if (!state.task || state.task.trim() === "") {
    return {
      status: "failed",
      errors: ["Task input is empty"],
    };
  }

  return {
    status: "planning",
    research: `Analyzed task: "${state.task.trim()}"`,
    plan: [
      { id: "step-1", description: "Analyze requirements", status: "completed" },
      { id: "step-2", description: "Execute development node", status: "pending" },
    ],
  };
}

/**
 * Node 2: Task Executer Node
 * Executes the planned task, updates status to "completed", and records architectural notes & code changes.
 */
export async function taskExecuterNode(state: AegisState): Promise<AegisStateUpdate> {
  return {
    status: "completed",
    architecture: `Architecture designed for task: "${state.task}"`,
    codeChanges: [
      {
        path: "graph/workflow.ts",
        action: "add",
        summary: "Created LangGraph state graph workflow",
      },
    ],
  };
}

/**
 * Node 3: Error Handler Node
 * Handles workflow errors and updates status to "failed".
 */
export async function errorHandlerNode(_state: AegisState): Promise<AegisStateUpdate> {
  return {
    status: "failed",
  };
}
