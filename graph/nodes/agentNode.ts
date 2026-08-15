/**
 * graph/nodes/agentNode.ts
 *
 * Feature 07 — Single-Agent Graph Node
 *
 * Wraps the Feature 04 tool-calling agent inside a LangGraph node.
 * Reads the task from AegisState, delegates execution to runToolAgent,
 * and updates state with the agent's research/findings and status.
 */

import type { AegisState, AegisStateUpdate } from "../state.js";
import { runToolAgent } from "../../agents/agent.js";
import { calculatorTool } from "../../tools/index.js";

/**
 * Agent Node function for LangGraph.
 * Integrates tool-calling capabilities with state graph execution.
 */
export async function toolAgentNode(state: AegisState): Promise<AegisStateUpdate> {
  if (!state.task || state.task.trim() === "") {
    return {
      status: "failed",
      errors: ["Task input is empty in single-agent graph node"],
    };
  }

  try {
    // Run the Feature 04 tool-calling agent with available tools
    const agentResult = await runToolAgent(state.task, [calculatorTool]);

    return {
      status: "completed",
      research: agentResult.text,
    };
  } catch (err) {
    // Single retry for transient model network errors
    try {
      await new Promise((r) => setTimeout(r, 1500));
      const agentResult = await runToolAgent(state.task, [calculatorTool]);

      return {
        status: "completed",
        research: agentResult.text,
      };
    } catch (retryErr) {
      return {
        status: "failed",
        errors: [(retryErr as Error).message],
      };
    }
  }
}
