/**
 * agents/agent.ts
 *
 * Feature 04 — First Tool-Calling Agent
 *
 * A simple tool-calling agent that:
 *  1. Accepts a user prompt and a set of LangChain StructuredTools
 *  2. Asks Gemini to process the message with tool declarations
 *  3. Executes tool call(s) if Gemini requests them
 *  4. Feeds tool execution results back to Gemini
 *  5. Returns the final synthesized text answer along with tool execution traces
 */

import { FunctionDeclaration, Content } from "@google/genai";
import { StructuredTool } from "../tools/types.js";
import { getClient, zodToGoogleSchema, GeminiConfig } from "../models/gemini/index.js";

export interface ToolExecutionRecord {
  name: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  args: any;
  output: string;
}

export interface AgentResult {
  text: string;
  toolCallsExecuted: ToolExecutionRecord[];
  steps: number;
}

/**
 * Convert a LangChain StructuredTool into a Google GenAI FunctionDeclaration.
 */
export function toolToFunctionDeclaration(tool: StructuredTool): FunctionDeclaration {
  return {
    name: tool.name,
    description: tool.description,
    parameters: zodToGoogleSchema(tool.schema),
  };
}

/**
 * Run a tool-calling agent cycle on a user prompt with available tools.
 */
export async function runToolAgent(
  userPrompt: string,
  tools: StructuredTool[],
  config: GeminiConfig = {}
): Promise<AgentResult> {
  const client = getClient();
  const modelName = config.model ?? process.env.GEMINI_MODEL ?? "gemini-3.6-flash";

  // Build function declarations for Gemini
  const functionDeclarations = tools.map(toolToFunctionDeclaration);
  const toolMap = new Map(tools.map((t) => [t.name, t]));

  // Initial user content turn
  const userTurn: Content = {
    role: "user",
    parts: [{ text: userPrompt }],
  };

  const initialRes = await client.models.generateContent({
    model: modelName,
    contents: [userTurn],
    config: {
      temperature: config.temperature ?? 0.2,
      tools: functionDeclarations.length > 0 ? [{ functionDeclarations }] : undefined,
    },
  });

  const functionCalls = initialRes.functionCalls;

  // Case 1: No tool call requested — return direct answer
  if (!functionCalls || functionCalls.length === 0) {
    return {
      text: initialRes.text ?? "",
      toolCallsExecuted: [],
      steps: 1,
    };
  }

  // Case 2: Tool call(s) requested — execute tools and send output back to model
  const toolCallsExecuted: ToolExecutionRecord[] = [];
  const functionResponseParts = [];

  for (const fc of functionCalls) {
    const toolName = fc.name ?? "";
    const targetTool = toolMap.get(toolName);
    if (!targetTool) {
      throw new Error(`Agent attempted to call unknown tool: "${toolName}"`);
    }

    const output = await targetTool.invoke(fc.args ?? {});
    const resultString = typeof output === "string" ? output : JSON.stringify(output);

    toolCallsExecuted.push({
      name: toolName,
      args: fc.args,
      output: resultString,
    });

    functionResponseParts.push({
      functionResponse: {
        name: toolName,
        response: { result: resultString },
      },
    });
  }

  // Model content turn (preserves thought/parts context)
  const modelTurn = initialRes.candidates?.[0]?.content ?? {
    role: "model",
    parts: functionCalls.map((fc) => ({ functionCall: fc })),
  };

  // Response turn containing tool outputs
  const toolResponseTurn: Content = {
    role: "user",
    parts: functionResponseParts,
  };

  const finalRes = await client.models.generateContent({
    model: modelName,
    contents: [userTurn, modelTurn, toolResponseTurn],
  });

  return {
    text: finalRes.text ?? "",
    toolCallsExecuted,
    steps: 2,
  };
}
