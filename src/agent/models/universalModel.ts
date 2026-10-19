/**
 * src/agent/models/universalModel.ts
 *
 * Universal Provider-Agnostic Model Adapter.
 *
 * Adapts between AEGIS native AgentModel interface and:
 * 1. Google Gemini via native @google/genai SDK
 * 2. Any OpenAI-compatible provider (Groq, OpenAI, OpenRouter, DeepSeek, Ollama, etc.) via native fetch
 *
 * Provides full support for:
 * - Function calling / tool execution declarations
 * - Multi-turn conversation content format
 * - Bounded retry on 429 rate limit / 503 transient errors
 * - Secret redaction
 */

import { Content, FunctionDeclaration } from "@google/genai";
import { AgentModel, AgentModelResponse } from "../agent.js";
import { getActiveProviderConfig, ResolvedProviderConfig } from "./providerConfig.js";
import { getClient as getGeminiClient } from "./gemini/model.js";

function cancelError(message: string): Error {
  const err = new Error(message);
  err.name = "AbortError";
  return err;
}

function isTransientError(status: number, message: string): boolean {
  if (status === 429 || status === 503 || status === 502 || status === 504) return true;
  const m = message.toLowerCase();
  return (
    m.includes("rate limit") ||
    m.includes("quota") ||
    m.includes("resource_exhausted") ||
    m.includes("high demand") ||
    m.includes("econnreset") ||
    m.includes("etimedout")
  );
}

// ── OpenAI-Compatible Adapter ────────────────────────────────────────────────

interface OpenAIMessage {
  role: "system" | "user" | "assistant" | "tool";
  content?: string | null;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }>;
  tool_call_id?: string;
  name?: string;
}

interface OpenAITool {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  };
}

function googleDeclarationToOpenAITool(decl: FunctionDeclaration): OpenAITool {
  return {
    type: "function",
    function: {
      name: decl.name || "",
      description: decl.description,
      parameters: (decl.parameters as Record<string, unknown>) || { type: "object", properties: {} },
    },
  };
}

function googleContentsToOpenAIMessages(contents: Content[]): OpenAIMessage[] {
  const messages: OpenAIMessage[] = [];

  for (const item of contents) {
    const role = item.role;
    const parts = item.parts || [];

    if (role === "user") {
      // Check if this user turn contains function responses (tool responses)
      for (const part of parts) {
        if (part.functionResponse) {
          const resp = part.functionResponse;
          messages.push({
            role: "tool",
            tool_call_id: resp.id || `call_${resp.name}`,
            content: typeof resp.response === "string" ? resp.response : JSON.stringify(resp.response),
          });
        } else if (typeof part.text === "string") {
          messages.push({ role: "user", content: part.text });
        }
      }
    } else if (role === "model") {
      const toolCalls: OpenAIMessage["tool_calls"] = [];
      let text = "";

      let callIdx = 0;
      for (const part of parts) {
        if (part.functionCall) {
          const callId = part.functionCall.id || `call_${callIdx}_${part.functionCall.name}`;
          toolCalls.push({
            id: callId,
            type: "function",
            function: {
              name: part.functionCall.name || "",
              arguments: JSON.stringify(part.functionCall.args || {}),
            },
          });
          callIdx++;
        } else if (typeof part.text === "string") {
          text += part.text;
        }
      }

      messages.push({
        role: "assistant",
        content: text || null,
        tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
      });
    }
  }

  return messages;
}

function createOpenAICompatibleModel(config: ResolvedProviderConfig): AgentModel {
  const endpoint = `${(config.baseUrl || "https://api.openai.com/v1").replace(/\/$/, "")}/chat/completions`;

  return {
    model: config.model,
    async generate(contents, functionDeclarations, signal) {
      if (!config.apiKey && config.provider !== "ollama") {
        throw new Error(
          `Missing API key for provider "${config.provider}". ` +
          `Set ${config.provider.toUpperCase()}_API_KEY or LLM_API_KEY in .env.`
        );
      }

      const tools: OpenAITool[] = functionDeclarations.map(googleDeclarationToOpenAITool);
      const messages = googleContentsToOpenAIMessages(contents);

      const payload: Record<string, unknown> = {
        model: config.model,
        messages,
        temperature: 0.2,
      };

      if (tools.length > 0) {
        payload.tools = tools;
        payload.tool_choice = "auto";
      }

      const maxRetries = 2;
      let attempt = 0;
      let lastErr: any;

      while (attempt <= maxRetries) {
        if (signal?.aborted) throw cancelError("Execution cancelled.");

        try {
          const res = await fetch(endpoint, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${config.apiKey}`,
              ...(config.provider === "openrouter" ? { "HTTP-Referer": "https://github.com/arx-dev15/Aegis", "X-Title": "AEGIS" } : {}),
            },
            body: JSON.stringify(payload),
            signal,
          });

          if (!res.ok) {
            const errText = await res.text();
            let parsedErr: any;
            try { parsedErr = JSON.parse(errText); } catch {}
            const errMsg = parsedErr?.error?.message || errText || `HTTP ${res.status}`;

            if (attempt < maxRetries && isTransientError(res.status, errMsg)) {
              attempt++;
              const backoff = Math.min(2000, 400 * Math.pow(2, attempt) + Math.random() * 200);
              await new Promise((r) => setTimeout(r, backoff));
              continue;
            }

            const error = new Error(`[${config.provider.toUpperCase()}-ERROR] ${errMsg}`);
            (error as any).status = res.status;
            throw error;
          }

          const data = (await res.json()) as any;
          const choice = data.choices?.[0];
          const assistantMsg = choice?.message || {};
          const text = assistantMsg.content || "";

          let functionCalls: Array<{ id?: string; name?: string; args?: unknown }> | undefined;
          if (Array.isArray(assistantMsg.tool_calls) && assistantMsg.tool_calls.length > 0) {
            functionCalls = assistantMsg.tool_calls.map((tc: any, tcIdx: number) => {
              let rawArgs = tc.function?.arguments;
              let parsedArgs: unknown = rawArgs;
              if (typeof rawArgs === "string") {
                try {
                  parsedArgs = JSON.parse(rawArgs);
                } catch {
                  // Keep as raw string so agent.ts runToolAgent can reject with structured malformed_arguments
                  parsedArgs = rawArgs;
                }
              }
              const assignedId = tc.id || `call_tc_${Date.now()}_${tcIdx}_${Math.random().toString(36).substring(2, 7)}`;
              return {
                id: assignedId,
                name: tc.function?.name,
                args: parsedArgs,
              };
            });
          }

          // Build canonical Gemini-compatible Content structure for conversation history
          const parts: Content["parts"] = [];
          if (text) parts.push({ text });
          if (functionCalls) {
            for (const fc of functionCalls) {
              parts.push({
                functionCall: {
                  id: fc.id,
                  name: fc.name,
                  args: fc.args as Record<string, unknown>,
                },
              });
            }
          }

          return {
            text,
            functionCalls,
            content: { role: "model", parts },
          };
        } catch (err: any) {
          lastErr = err;
          if (err.name === "AbortError" || signal?.aborted) throw cancelError("Execution cancelled.");
          if (attempt < maxRetries && isTransientError(err.status || 0, err.message || "")) {
            attempt++;
            await new Promise((r) => setTimeout(r, 500));
            continue;
          }
          throw err;
        }
      }

      throw lastErr;
    },
  };
}

// ── Gemini Native Adapter ───────────────────────────────────────────────────

function createGeminiNativeModel(config: ResolvedProviderConfig): AgentModel {
  const client = getGeminiClient();
  const model = config.model;

  return {
    model,
    async generate(contents, functionDeclarations, signal) {
      const maxRetries = 2;
      let attempt = 0;
      let lastError: any;

      while (attempt <= maxRetries) {
        if (signal?.aborted) throw cancelError("Execution cancelled.");
        try {
          const response = await client.models.generateContent({
            model,
            contents,
            config: {
              temperature: 0.2,
              tools: functionDeclarations.length > 0 ? [{ functionDeclarations }] : undefined,
            },
          });

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
                  args: call.args ?? {},
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
          if (attempt < maxRetries && isTransientError(err.status || 0, err.message || "")) {
            attempt++;
            await new Promise((r) => setTimeout(r, 600));
            continue;
          }
          throw err;
        }
      }

      throw lastError;
    },
  };
}

// ── Public Factory ───────────────────────────────────────────────────────────

/**
 * Creates the active AgentModel based on resolved environment configuration.
 * Automatically delegates to Gemini native or OpenAI-compatible (Groq, OpenAI, Ollama, etc.).
 */
export function createUniversalAgentModel(overrideConfig?: Partial<ResolvedProviderConfig>): AgentModel {
  const resolved = { ...getActiveProviderConfig(), ...overrideConfig };

  if (resolved.isOpenAICompatible) {
    return createOpenAICompatibleModel(resolved);
  }
  return createGeminiNativeModel(resolved);
}
