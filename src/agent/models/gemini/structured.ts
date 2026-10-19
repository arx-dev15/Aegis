/**
 * models/gemini/structured.ts
 *
 * Universal Structured Output Engine — Feature 02
 *
 * Provides `callStructured<T>()` — calls the active LLM provider with a Zod schema and
 * returns a fully-typed, validated structured object.
 *
 * Supports:
 *  - Google Gemini (native responseSchema)
 *  - Any OpenAI-compatible provider (Groq, OpenAI, OpenRouter, DeepSeek, Ollama) via json_object mode
 */

import { z } from "zod";
import { Type, type Schema } from "@google/genai";
import { getClient } from "./model.js";
import type { GeminiConfig } from "./model.js";
import { getActiveProviderConfig } from "../providerConfig.js";

// ── Zod → Google Schema converter ───────────────────────────────────────────

export function zodToGoogleSchema(zSchema: any): Schema {
  if (zSchema instanceof z.ZodOptional) {
    return zodToGoogleSchema(zSchema.unwrap());
  }

  if (zSchema instanceof z.ZodObject) {
    const shape = zSchema.shape as Record<string, any>;
    const properties: Record<string, Schema> = {};
    const required: string[] = [];

    for (const [key, value] of Object.entries(shape)) {
      properties[key] = zodToGoogleSchema(value);
      if (!(value instanceof z.ZodOptional)) {
        required.push(key);
      }
    }

    return {
      type: Type.OBJECT,
      properties,
      ...(required.length > 0 ? { required } : {}),
    };
  }

  if (zSchema instanceof z.ZodString) {
    return { type: Type.STRING };
  }

  if (zSchema instanceof z.ZodNumber) {
    return { type: Type.NUMBER };
  }

  if (zSchema instanceof z.ZodBoolean) {
    return { type: Type.BOOLEAN };
  }

  if (zSchema instanceof z.ZodArray) {
    return {
      type: Type.ARRAY,
      items: zodToGoogleSchema(zSchema.element),
    };
  }

  if (zSchema instanceof z.ZodEnum) {
    return {
      type: Type.STRING,
      enum: zSchema.options as string[],
    };
  }

  return { type: Type.STRING };
}

// ── Helper: strip null values recursively ────────────────────────────────────

function stripNulls(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stripNulls);
  }
  if (value !== null && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v !== null) {
        result[k] = stripNulls(v);
      }
    }
    return result;
  }
  return value;
}

// ── OpenAI-Compatible Structured Calling ─────────────────────────────────────

async function callStructuredOpenAI<T extends z.ZodTypeAny>(
  prompt: string,
  schema: T,
  config: GeminiConfig = {}
): Promise<z.infer<T>> {
  const providerCfg = getActiveProviderConfig();
  const endpoint = `${(providerCfg.baseUrl || "https://api.openai.com/v1").replace(/\/$/, "")}/chat/completions`;
  const model = config.model || providerCfg.model;

  const systemPrompt =
    "You are a strict JSON generator. You must respond ONLY with valid JSON conforming to the requested schema. " +
    "Do not include markdown code fences or conversational text.";

  const fullPrompt = `${prompt}\n\nPlease respond with a JSON object that satisfies this requirement.`;

  const payload: Record<string, unknown> = {
    model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: fullPrompt },
    ],
    temperature: config.temperature ?? 0.2,
    response_format: { type: "json_object" },
  };

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${providerCfg.apiKey}`,
      ...(providerCfg.provider === "openrouter" ? { "HTTP-Referer": "https://github.com/arx-dev15/Aegis", "X-Title": "AEGIS" } : {}),
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`[${providerCfg.provider.toUpperCase()}-STRUCTURED-ERROR] ${errText}`);
  }

  const data = (await res.json()) as any;
  const rawText = data.choices?.[0]?.message?.content || "{}";
  const parsed = JSON.parse(rawText);
  const cleaned = stripNulls(parsed);
  return schema.parse(cleaned) as z.infer<T>;
}

// ── Main callStructured ──────────────────────────────────────────────────────

export async function callStructured<T extends z.ZodTypeAny>(
  prompt: string,
  schema: T,
  config: GeminiConfig = {}
): Promise<z.infer<T>> {
  const providerCfg = getActiveProviderConfig();
  if (providerCfg.isOpenAICompatible) {
    return callStructuredOpenAI(prompt, schema, config);
  }

  const client = getClient();
  const primaryModel = config.model ?? process.env.GEMINI_MODEL ?? "gemini-3.6-flash";
  const FALLBACK_MODELS = Array.from(new Set([primaryModel, "gemini-3.6-flash", "gemini-3.7-flash", "gemini-3.5-flash", "gemini-flash-latest"]));

  async function callOnceWithModel(targetModel: string): Promise<z.infer<T>> {
    const response = await client.models.generateContent({
      model: targetModel,
      contents: prompt,
      config: {
        temperature: config.temperature ?? 0.2,
        responseMimeType: "application/json",
        responseSchema: zodToGoogleSchema(schema),
      },
    });

    const text = response.text ?? "";
    const parsed = JSON.parse(text);
    const cleaned = stripNulls(parsed);
    return schema.parse(cleaned) as z.infer<T>;
  }

  let lastError: unknown;

  for (const targetModel of FALLBACK_MODELS) {
    const MAX_RETRIES = 2;
    for (let i = 0; i <= MAX_RETRIES; i++) {
      try {
        return await callOnceWithModel(targetModel);
      } catch (err) {
        lastError = err;
        const msg = String((err as any)?.message || err);
        const isTransient =
          msg.includes("503") ||
          msg.includes("429") ||
          msg.includes("UNAVAILABLE") ||
          msg.includes("RESOURCE_EXHAUSTED") ||
          msg.includes("high demand") ||
          msg.includes("Quota exceeded");

        if (isTransient && i < MAX_RETRIES) {
          const backoffMs = Math.pow(2, i + 1) * 1000;
          await new Promise((r) => setTimeout(r, backoffMs));
          continue;
        }
        break;
      }
    }
  }

  const rawMsg = (lastError as any)?.message || String(lastError);
  if (rawMsg.includes("429") || rawMsg.includes("RESOURCE_EXHAUSTED")) {
    throw new Error(`[RATE-LIMIT] API Rate Limit / Quota Exceeded (HTTP 429). Free tier request quota reached.`);
  }

  throw lastError;
}
