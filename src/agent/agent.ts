/**
 * Native bounded tool-calling runtime.
 *
 * The provider adapter is deliberately injectable so deterministic tests and
 * offline CLI demonstrations use the same loop and tools as live execution.
 */
import { FunctionDeclaration, Content } from "@google/genai";
import { StructuredTool } from "../tools/types.js";
import { getClient, zodToGoogleSchema, GeminiConfig } from "./models/gemini/index.js";
import { createUniversalAgentModel } from "./models/universalModel.js";
import type { GroundedContextPacket } from "../context/groundedContext.js";

export interface ToolExecutionRecord {
  id: string;
  name: string;
  args: unknown;
  output: string;
  durationMs: number;
  policyDecision: "ALLOW" | "REQUIRE_APPROVAL" | "BLOCK";
  error?: string;
}

export interface AgentResult {
  text: string;
  toolCallsExecuted: ToolExecutionRecord[];
  steps: number;
  iterations: number;
  termination: "completed" | "iteration_limit" | "tool_call_limit" | "timeout" | "cancelled" | "provider_error" | "model_error";
  error?: string;
  elapsedMs?: number;
  skillsOffered?: string[];
  skillsLoaded?: string[];
  promptChars?: number;
}

export interface AgentModelResponse {
  text?: string;
  functionCalls?: Array<{ id?: string; name?: string; args?: unknown }>;
  content?: Content;
}

export interface AgentModel {
  model: string;
  generate(contents: Content[], functionDeclarations: FunctionDeclaration[], signal?: AbortSignal): Promise<AgentModelResponse>;
}

export interface RunToolAgentOptions {
  model?: AgentModel;
  maxIterations?: number;
  maxToolCalls?: number;
  timeoutMs?: number;
  signal?: AbortSignal;
  onToolExecution?: (record: ToolExecutionRecord) => void;
  groundedContext?: GroundedContextPacket | string;
  maxToolOutputChars?: number;
  maxHistoryChars?: number;
}

function toResultString(value: unknown): string {
  return typeof value === "string" ? value : JSON.stringify(value);
}

function isTransientModelError(err: any): boolean {
  if (!err) return false;
  const status = err.status || err.code || err.statusCode;
  if (status === 503 || status === 429 || status === "UNAVAILABLE" || status === "RESOURCE_EXHAUSTED") {
    return true;
  }
  const msg = String(err.message || err).toLowerCase();
  return (
    msg.includes("503") ||
    msg.includes("unavailable") ||
    msg.includes("high demand") ||
    msg.includes("rate limit") ||
    msg.includes("quota") ||
    msg.includes("resource_exhausted") ||
    msg.includes("econnreset") ||
    msg.includes("etimedout") ||
    msg.includes("fetch failed")
  );
}

function extractRetryDelayMs(err: any): number {
  if (typeof err?.retryDelay === "number" && err.retryDelay > 0) {
    return Math.min(err.retryDelay, 3000);
  }
  const match = String(err?.message || "").match(/retry\s+in\s+([0-9.]+)\s*s/i);
  if (match) {
    return Math.min(3000, Math.round(parseFloat(match[1]) * 1000));
  }
  return 0;
}

const READ_ONLY_TOOLS = new Set([
  "discover_files",
  "search_repository",
  "read_source_file",
  "list_available_skills",
  "load_skill",
  "recall_memory",
  "search_web",
  "fetch_web_page",
  "repository_intelligence",
  "repo_explorer_tool",
  "calculator",
]);

export function isReadOnlyTool(toolName: string, args?: unknown): boolean {
  if (toolName === "github" && args && typeof args === "object") {
    const action = (args as any).action;
    return action === "get_repo" || action === "list_branches" || action === "get_commit" || action === "get_file_contents";
  }
  return READ_ONLY_TOOLS.has(toolName);
}

function createGeminiModel(config: GeminiConfig): AgentModel {
  const client = getClient();
  const model = config.model ?? process.env.GEMINI_MODEL ?? "gemini-3.6-flash";
  return {
    model,
    async generate(contents, functionDeclarations, signal) {
      const maxRetries = 2; // Initial attempt + 2 bounded retries
      let attempt = 0;
      let lastError: any;

      while (attempt <= maxRetries) {
        if (signal?.aborted) throw cancelError("Execution cancelled.");
        try {
          const response = await client.models.generateContent({
            model,
            contents,
            config: {
              temperature: config.temperature ?? 0.2,
              ...(config.maxOutputTokens ? { maxOutputTokens: config.maxOutputTokens } : {}),
              tools: functionDeclarations.length > 0 ? [{ functionDeclarations }] : undefined,
            },
          });

          // Safe extraction from candidate parts: prevents SDK non-text warnings when functionCall parts are present
          const candidate = response.candidates?.[0];
          const parts = candidate?.content?.parts ?? [];
          const textParts = parts
            .filter((p: any) => typeof p?.text === "string")
            .map((p: any) => p.text);
          const text = textParts.join("");

          const rawCalls: any[] = [];
          if (Array.isArray(response.functionCalls) && response.functionCalls.length > 0) {
            rawCalls.push(...response.functionCalls);
          } else {
            for (const part of parts) {
              if (part.functionCall) {
                rawCalls.push(part.functionCall);
              }
            }
          }

          const functionCalls = rawCalls.length > 0
            ? rawCalls.map((call, idx) => {
                const assignedId = call.id || `call_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 7)}`;
                call.id = assignedId;
                return {
                  id: assignedId,
                  name: call.name,
                  args: call.args,
                };
              })
            : undefined;

          return {
            text,
            functionCalls,
            content: candidate?.content,
          };
        } catch (err: any) {
          lastError = err;
          if (attempt < maxRetries && isTransientModelError(err)) {
            attempt++;
            const serverDelay = extractRetryDelayMs(err);
            const backoff = serverDelay > 0 ? serverDelay : Math.min(2000, 300 * Math.pow(2, attempt) + Math.random() * 200);
            await new Promise((res, rej) => {
              if (signal?.aborted) return rej(cancelError("Execution cancelled."));
              const timer = setTimeout(res, backoff);
              signal?.addEventListener('abort', () => {
                clearTimeout(timer);
                rej(cancelError("Execution cancelled."));
              }, { once: true });
            });
            continue;
          }
          throw err;
        }
      }
      throw lastError;
    },
  };
}

export function toolToFunctionDeclaration(tool: StructuredTool): FunctionDeclaration {
  return {
    name: tool.name,
    description: tool.description,
    parameters: zodToGoogleSchema(tool.schema),
  };
}

function cancelError(message = "Execution cancelled."): Error {
  return new Error(`[AGENT-CANCELLED] ${message}`);
}

function timeoutError(message: string): Error {
  return new Error(`[AGENT-TIMEOUT] ${message}`);
}

async function withTimeout<T>(
  operation: Promise<T>,
  timeoutMs: number,
  signal?: AbortSignal
): Promise<T> {
  if (signal?.aborted) throw cancelError("Execution cancelled.");
  return new Promise<T>((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        reject(timeoutError(`Execution timed out after ${timeoutMs}ms.`));
      }
    }, timeoutMs);
    const onAbort = () => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        reject(cancelError("Execution cancelled."));
      }
    };
    signal?.addEventListener("abort", onAbort, { once: true });
    operation.catch(() => {});
    operation.then(
      (value) => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          signal?.removeEventListener("abort", onAbort);
          resolve(value);
        }
      },
      (error) => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          signal?.removeEventListener("abort", onAbort);
          reject(error);
        }
      }
    );
  });
}

function pruneHistoryIfNeeded(contents: Content[], maxChars: number) {
  let totalChars = 0;
  for (const c of contents) {
    for (const p of c.parts || []) {
      if (p.text) totalChars += p.text.length;
      if (p.functionResponse) totalChars += JSON.stringify(p.functionResponse).length;
    }
  }

  if (totalChars > maxChars && contents.length > 3) {
    // Retain initial objective/grounded context (index 0) and the last 2 turns
    for (let i = 1; i < contents.length - 2; i++) {
      const c = contents[i];
      for (const p of c.parts || []) {
        if (p.functionResponse && typeof p.functionResponse.response === "object") {
          const res = p.functionResponse.response as Record<string, unknown>;
          if (typeof res.result === "string" && res.result.length > 200) {
            res.result = res.result.slice(0, 150) + "... [earlier tool output pruned for conversation history budget]";
          }
        }
      }
    }
  }
}

export async function runToolAgent(
  userPrompt: string,
  tools: StructuredTool[],
  config: GeminiConfig = {},
  options: RunToolAgentOptions = {}
): Promise<AgentResult> {
  if (!userPrompt.trim()) throw new Error("Agent prompt must not be empty.");
  const model = options.model ?? createUniversalAgentModel(config.model ? { model: config.model } : undefined);
  const maxIterations = options.maxIterations ?? 8;
  const maxToolCalls = options.maxToolCalls ?? 24;
  const timeoutMs = options.timeoutMs ?? 60_000;
  const maxToolOutputChars = options.maxToolOutputChars ?? 8_000;
  const maxHistoryChars = options.maxHistoryChars ?? 40_000;

  if (maxIterations < 1 || maxToolCalls < 1 || timeoutMs < 1) {
    throw new Error("Agent limits must be positive.");
  }

  const groundedPrefix = options.groundedContext
    ? typeof options.groundedContext === "string"
      ? options.groundedContext
      : options.groundedContext.formattedContext
    : "";

  const initialPrompt = groundedPrefix
    ? `${groundedPrefix}\n\n[USER OBJECTIVE]\n${userPrompt}`
    : userPrompt;

  const skillsOffered: string[] = [];
  const skillsLoaded: string[] = [];

  if (options.groundedContext && typeof options.groundedContext !== "string") {
    skillsOffered.push(...options.groundedContext.availableSkills.map((s) => s.name));
  }

  const declarations = tools.map(toolToFunctionDeclaration);
  const toolMap = new Map(tools.map((tool) => [tool.name, tool]));
  const contents: Content[] = [{ role: "user", parts: [{ text: initialPrompt }] }];
  const executions: ToolExecutionRecord[] = [];

  let totalToolCalls = 0;
  let iterations = 0;
  const startedAt = Date.now();
  const deadline = startedAt + timeoutMs;
  const remainingBudget = (): number => Math.max(1, deadline - Date.now());

  while (iterations < maxIterations) {
    if (Date.now() >= deadline) {
      return {
        text: "Agent stopped after reaching the overall execution timeout.",
        toolCallsExecuted: executions,
        steps: iterations + executions.length,
        iterations,
        termination: "timeout",
        elapsedMs: Date.now() - startedAt,
        skillsOffered,
        skillsLoaded,
        promptChars: initialPrompt.length,
      };
    }
    iterations++;

    pruneHistoryIfNeeded(contents, maxHistoryChars);

    let response: AgentModelResponse;
    try {
      response = await withTimeout(
        model.generate(contents, declarations, options.signal),
        Math.min(timeoutMs, remainingBudget()),
        options.signal
      );
    } catch (err: any) {
      if (err.message?.includes("[AGENT-CANCELLED]") || options.signal?.aborted) {
        return {
          text: "Agent execution was cancelled.",
          toolCallsExecuted: executions,
          steps: iterations + executions.length,
          iterations,
          termination: "cancelled",
          elapsedMs: Date.now() - startedAt,
          skillsOffered,
          skillsLoaded,
          promptChars: initialPrompt.length,
          error: err.message,
        };
      }
      if (err.message?.includes("[AGENT-TIMEOUT]") || err.message?.includes("timed out")) {
        return {
          text: `Agent stopped after reaching the execution timeout: ${err.message}`,
          toolCallsExecuted: executions,
          steps: iterations + executions.length,
          iterations,
          termination: "timeout",
          elapsedMs: Date.now() - startedAt,
          skillsOffered,
          skillsLoaded,
          promptChars: initialPrompt.length,
          error: err.message,
        };
      }
      const isProvider =
        err.status === 401 ||
        err.status === 403 ||
        err.status === 429 ||
        err.status >= 500 ||
        err.code === "ECONNREFUSED" ||
        err.code === "ENOTFOUND" ||
        err.message?.includes("fetch failed") ||
        err.message?.includes("API_KEY") ||
        err.message?.includes("quota") ||
        err.message?.includes("rate limit") ||
        err.name === "GoogleGenAIError" ||
        err.name === "ProviderError";

      const errType = isProvider ? "provider_error" : "model_error";
      return {
        text: `Model generation failed (${errType}): ${err.message}`,
        toolCallsExecuted: executions,
        steps: iterations + executions.length,
        iterations,
        termination: errType,
        elapsedMs: Date.now() - startedAt,
        skillsOffered,
        skillsLoaded,
        promptChars: initialPrompt.length,
        error: err.message,
      };
    }

    const calls = response.functionCalls ?? [];
    if (calls.length === 0) {
      return {
        text: response.text ?? "",
        toolCallsExecuted: executions,
        steps: iterations + executions.length,
        iterations,
        termination: "completed",
        skillsOffered,
        skillsLoaded,
        promptChars: initialPrompt.length,
      };
    }
    if (totalToolCalls + calls.length > maxToolCalls) {
      return {
        text: response.text ?? "",
        toolCallsExecuted: executions,
        steps: iterations + executions.length,
        iterations,
        termination: "tool_call_limit",
        skillsOffered,
        skillsLoaded,
        promptChars: initialPrompt.length,
      };
    }

    let modelContent: Content;
    if (response.content) {
      modelContent = response.content;
      let callIdx = 0;
      for (const part of modelContent.parts || []) {
        if (part.functionCall) {
          if (!part.functionCall.id && calls[callIdx]?.id) {
            part.functionCall.id = calls[callIdx].id;
          }
          callIdx++;
        }
      }
    } else {
      modelContent = {
      role: "model",
      parts: calls.map((call) => ({
        functionCall: {
          id: call.id,
          name: call.name,
          args: call.args && typeof call.args === "object"
            ? call.args as Record<string, unknown>
            : undefined,
        },
      })),
      };
    }
    contents.push(modelContent);
    const responseParts: Content["parts"] = [];

    // Track repeated identical calls across iterations to prevent runaway tool loops
    if (!('toolCallHistory' in options)) {
      (options as any).toolCallHistory = new Map<string, number>();
      (options as any).readHashes = new Map<string, string>();
    }
    const toolCallHistory: Map<string, number> = (options as any).toolCallHistory;
    const readHashes: Map<string, string> = (options as any).readHashes;

    interface SingleExecutionResult {
      record?: ToolExecutionRecord;
      responsePart?: NonNullable<Content["parts"]>[number];
      skillLoaded?: string;
      cancelled?: string;
      timedOut?: string;
    }

    async function executeSingleCall(
      call: { id?: string; name?: string; args?: unknown },
      callIdx: number
    ): Promise<SingleExecutionResult> {
      const id = call.id ?? `tool_call_${totalToolCalls + callIdx + 1}`;
      const toolName = call.name ?? "";
      const callSignature = `${toolName}:${JSON.stringify(call.args ?? {})}`;
      const prevCalls = toolCallHistory.get(callSignature) || 0;
      toolCallHistory.set(callSignature, prevCalls + 1);

      // Rule: do NOT block repeated reads if the file content was modified
      const isRead = toolName === "read_source_file";
      let allowRepeatedRead = false;
      if (isRead && call.args && typeof call.args === 'object' && 'path' in call.args) {
        const filePath = String((call.args as any).path);
        // If file content changed since last read, allow it!
        const prevHash = readHashes.get(filePath);
        if (prevHash && prevHash === "MODIFIED") {
          allowRepeatedRead = true;
        }
      }

      if (prevCalls >= 2 && !allowRepeatedRead) {
        const loopNotice = `[LOOP-BOUNDED] Repeated call to "${toolName}" with identical parameters was already executed ${prevCalls} times without new findings. Bounding duplicate call to preserve iteration budget. Shift investigation strategy, inspect specific lines, or conclude your analysis.`;
        const record: ToolExecutionRecord = {
          id,
          name: toolName || "loop_bounded",
          args: call.args ?? {},
          output: JSON.stringify({ error: loopNotice, bounded: true }),
          durationMs: 0,
          policyDecision: "BLOCK",
          error: loopNotice,
        };
        return {
          record,
          responsePart: { functionResponse: { id, name: toolName || "loop_bounded", response: { error: loopNotice, bounded: true } } },
        };
      }
      if (!toolName) {
        const errMsg = "Malformed model tool call with empty tool name.";
        const record: ToolExecutionRecord = {
          id,
          name: "malformed",
          args: {},
          output: JSON.stringify({ error: errMsg }),
          durationMs: 0,
          policyDecision: "BLOCK",
          error: errMsg,
        };
        return {
          record,
          responsePart: { functionResponse: { id, name: "malformed", response: { error: errMsg } } },
        };
      }

      const tool = toolMap.get(toolName);
      if (!tool) {
        const errMsg = `Agent attempted to call unknown tool "${toolName}". Available tools: ${Array.from(toolMap.keys()).join(", ")}`;
        const record: ToolExecutionRecord = {
          id,
          name: toolName,
          args: call.args ?? {},
          output: JSON.stringify({ error: errMsg }),
          durationMs: 0,
          policyDecision: "BLOCK",
          error: errMsg,
        };
        return {
          record,
          responsePart: { functionResponse: { id, name: toolName, response: { error: errMsg } } },
        };
      }

      const started = Date.now();

      try {
        let toolArgs: unknown = call.args;
        let jsonParseError: string | null = null;
        if (typeof toolArgs === "string") {
          try {
            toolArgs = JSON.parse(toolArgs);
          } catch (jsonErr: any) {
            jsonParseError = "Malformed JSON in tool arguments: " + jsonErr.message;
          }
        }

        // 1 & 2. Reject malformed JSON with a structured recoverable observation
        if (jsonParseError) {
          const errMsg = jsonParseError;
          const record: ToolExecutionRecord = {
            id,
            name: toolName,
            args: typeof call.args === "string" ? { raw: call.args } : (call.args ?? {}),
            output: JSON.stringify({ error: errMsg, status: "malformed_arguments" }),
            durationMs: 0,
            policyDecision: "BLOCK",
            error: errMsg,
          };
          return {
            record,
            responsePart: { functionResponse: { id, name: toolName, response: { error: errMsg, status: "malformed_arguments" } } },
          };
        }

        // 3. Reject non-object arguments when the tool requires an object (or when primitives/arrays are passed)
        const toolExpectsObject = Boolean(tool.schema);
        if (toolExpectsObject && (toolArgs === null || typeof toolArgs !== "object" || Array.isArray(toolArgs))) {
          const errMsg = `Tool "${toolName}" requires an object argument dictionary, but received ${toolArgs === null ? "null" : Array.isArray(toolArgs) ? "array" : typeof toolArgs}.`;
          const record: ToolExecutionRecord = {
            id,
            name: toolName,
            args: typeof call.args === "string" ? { raw: call.args } : (call.args && typeof call.args === "object" ? call.args : { raw: call.args }),
            output: JSON.stringify({ error: errMsg, status: "invalid_tool_arguments" }),
            durationMs: 0,
            policyDecision: "BLOCK",
            error: errMsg,
          };
          return {
            record,
            responsePart: { functionResponse: { id, name: toolName, response: { error: errMsg, status: "invalid_tool_arguments" } } },
          };
        }

        // 4. Validate parsed arguments against registered tool schema before invocation
        if (typeof (tool.schema as any)?.safeParse === "function") {
          const parseRes = (tool.schema as any).safeParse(toolArgs ?? {});
          if (!parseRes.success) {
            const schemaErrMsg = "Invalid arguments for tool " + toolName + ": " + parseRes.error.issues.map((it: any) => (it.path.join(".") || "root") + ": " + it.message).join(", ");
            const record: ToolExecutionRecord = {
              id,
              name: toolName,
              args: toolArgs as any,
              output: JSON.stringify({ error: schemaErrMsg, status: "invalid_tool_arguments" }),
              durationMs: 0,
              policyDecision: "BLOCK",
              error: schemaErrMsg,
            };
            return {
              record,
              responsePart: { functionResponse: { id, name: toolName, response: { error: schemaErrMsg, status: "invalid_tool_arguments" } } },
            };
          }
          toolArgs = parseRes.data;
        }

        // 5 & 6. Execute only validated arguments
        if (toolArgs === null || toolArgs === undefined) toolArgs = {};
        const output = await withTimeout(tool.invoke(toolArgs as any), Math.min(timeoutMs, remainingBudget()), options.signal);
        const record: ToolExecutionRecord = {
          id,
          name: toolName,
          args: call.args ?? {},
          output: toResultString(output),
          durationMs: Date.now() - started,
          policyDecision: "ALLOW",
        };

        // Record skill loading only upon successful execution
        let skillLoaded: string | undefined;
        if (toolName === "load_skill" && call.args && typeof call.args === "object" && "name" in call.args) {
          skillLoaded = String((call.args as any).name);
        }

        // Budget tool output for model prompt without corrupting structured results
        let safeOutput = record.output;
        if (safeOutput.length > maxToolOutputChars) {
          let isJson = false;
          try {
            const parsed = JSON.parse(safeOutput);
            if (typeof parsed === "object" && parsed !== null) {
              isJson = true;
              const boundedObj = { ...parsed, truncated: true, totalBytes: record.output.length };
              if (Array.isArray(boundedObj.matches)) {
                const totalMatches = boundedObj.matches.length;
                while (JSON.stringify(boundedObj).length > maxToolOutputChars && boundedObj.matches.length > 1) {
                  boundedObj.matches = boundedObj.matches.slice(0, Math.max(1, Math.floor(boundedObj.matches.length * 0.7)));
                }
                boundedObj.notice = `Results truncated from ${totalMatches} to ${boundedObj.matches.length} matches (budget: ${maxToolOutputChars} chars). Refine query for more precision.`;
              } else if (Array.isArray(boundedObj.files)) {
                const totalFiles = boundedObj.files.length;
                while (JSON.stringify(boundedObj).length > maxToolOutputChars && boundedObj.files.length > 1) {
                  boundedObj.files = boundedObj.files.slice(0, Math.max(1, Math.floor(boundedObj.files.length * 0.7)));
                }
                boundedObj.notice = `Results truncated from ${totalFiles} to ${boundedObj.files.length} files (budget: ${maxToolOutputChars} chars). Refine pattern for more precision.`;
              } else if (typeof boundedObj.content === "string") {
                const availChars = Math.max(200, maxToolOutputChars - 300);
                boundedObj.content = boundedObj.content.slice(0, availChars) + "\n... [TRUNCATED: Use startLine and endLine filters to view remaining lines]";
                boundedObj.notice = `Content bounded to ${maxToolOutputChars} characters for context budget. Request specific line ranges to view more.`;
              } else {
                boundedObj.notice = `Output bounded to ${maxToolOutputChars} characters for context budget.`;
              }

              safeOutput = JSON.stringify(boundedObj);
              if (safeOutput.length > maxToolOutputChars) {
                safeOutput = JSON.stringify({
                  truncated: true,
                  totalBytes: record.output.length,
                  notice: `Output exceeded budget (${maxToolOutputChars} characters). Refine arguments to narrow results.`,
                });
              }
            }
          } catch {}
          if (!isJson) {
            safeOutput = safeOutput.slice(0, maxToolOutputChars) + `\n\n[TRUNCATED: Output exceeded character budget of ${maxToolOutputChars} chars. Request specific line ranges or filter to view more.]`;
          }
        }

        const responsePayload: Record<string, unknown> = { result: safeOutput };
        return {
          record,
          responsePart: { functionResponse: { id, name: toolName, response: responsePayload } },
          skillLoaded,
        };
      } catch (error) {
        const message = (error as Error).message;
        if (message.includes("[AGENT-CANCELLED]") || options.signal?.aborted) {
          return { cancelled: message };
        }
        if (message.includes("[AGENT-TIMEOUT]")) {
          return { timedOut: message };
        }
        const record: ToolExecutionRecord = {
          id,
          name: toolName,
          args: call.args ?? {},
          output: JSON.stringify({ error: message }),
          durationMs: Date.now() - started,
          policyDecision: message.includes("GUARDRAIL-BLOCKED") ? "BLOCK" : "ALLOW",
          error: message,
        };
        return {
          record,
          responsePart: { functionResponse: { id, name: toolName, response: { error: message } } },
        };
      }
    }

    // Partition calls into batches: bounded concurrency (up to 3) for independent read-only tools,
    // sequential execution for any mutating or process-execution tools.
    const MAX_CONCURRENT_READ_TOOLS = 3;
    const batches: Array<Array<{ call: typeof calls[0]; index: number }>> = [];
    let currentBatch: Array<{ call: typeof calls[0]; index: number }> = [];

    for (let i = 0; i < calls.length; i++) {
      const call = calls[i];
      const readOnly = isReadOnlyTool(call.name ?? "", call.args);
      if (readOnly) {
        currentBatch.push({ call, index: i });
        if (currentBatch.length >= MAX_CONCURRENT_READ_TOOLS) {
          batches.push(currentBatch);
          currentBatch = [];
        }
      } else {
        if (currentBatch.length > 0) {
          batches.push(currentBatch);
          currentBatch = [];
        }
        batches.push([{ call, index: i }]);
      }
    }
    if (currentBatch.length > 0) {
      batches.push(currentBatch);
    }

    for (const batch of batches) {
      const results = await Promise.all(
        batch.map(({ call, index }) => executeSingleCall(call, index))
      );

      for (const res of results) {
        if (res.cancelled) {
          return {
            text: "Agent execution was cancelled during tool operation.",
            toolCallsExecuted: executions,
            steps: iterations + executions.length,
            iterations,
            termination: "cancelled",
            elapsedMs: Date.now() - startedAt,
            skillsOffered,
            skillsLoaded,
            promptChars: initialPrompt.length,
            error: res.cancelled,
          };
        }
        if (res.timedOut) {
          return {
            text: `Agent stopped after reaching the execution timeout: ${res.timedOut}`,
            toolCallsExecuted: executions,
            steps: iterations + executions.length,
            iterations,
            termination: "timeout",
            elapsedMs: Date.now() - startedAt,
            skillsOffered,
            skillsLoaded,
            promptChars: initialPrompt.length,
            error: res.timedOut,
          };
        }
        if (res.record) {
          executions.push(res.record);
          options.onToolExecution?.(res.record);
        }
        if (res.skillLoaded && !skillsLoaded.includes(res.skillLoaded)) {
          skillsLoaded.push(res.skillLoaded);
        }
        if (res.responsePart) {
          responseParts.push(res.responsePart);
        }
        totalToolCalls++;
      }
    }
    contents.push({ role: "user", parts: responseParts });
  }

  return {
    text: "Agent stopped after reaching the iteration limit.",
    toolCallsExecuted: executions,
    steps: iterations + executions.length,
    iterations,
    termination: "iteration_limit",
    elapsedMs: Date.now() - startedAt,
    skillsOffered,
    skillsLoaded,
    promptChars: initialPrompt.length,
  };
}
