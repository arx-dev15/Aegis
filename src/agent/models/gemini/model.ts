/**
 * models/gemini/model.ts
 *
 * Universal Model Layer — Feature 01
 *
 * Provides:
 *  - `getClient()`    : returns GoogleGenAI client when using Gemini
 *  - `gemini`         : default pre-configured model handle (call .invoke())
 *  - `createModel()`  : universal factory for model configurations across any provider
 *  - `GeminiConfig`   : options interface
 */

import { GoogleGenAI } from "@google/genai";
import { requireGeminiApiKey } from "./config.js";
import { getActiveProviderConfig } from "../providerConfig.js";

export interface GeminiConfig {
  model?: string;
  temperature?: number;
  maxOutputTokens?: number;
}

export interface GeminiResponse {
  text: string;
}

let _client: GoogleGenAI | null = null;

export function getClient(): GoogleGenAI {
  if (!_client) {
    _client = new GoogleGenAI({ apiKey: requireGeminiApiKey() });
  }
  return _client;
}

export interface GeminiModel {
  model: string;
  temperature: number;
  invoke: (prompt: string) => Promise<GeminiResponse>;
}

async function invokeOpenAICompatible(
  prompt: string,
  config: GeminiConfig = {}
): Promise<GeminiResponse> {
  const providerCfg = getActiveProviderConfig();
  const endpoint = `${(providerCfg.baseUrl || "https://api.openai.com/v1").replace(/\/$/, "")}/chat/completions`;
  const model = config.model || providerCfg.model;
  const temperature = config.temperature ?? 0.2;

  const payload: Record<string, unknown> = {
    model,
    messages: [{ role: "user", content: prompt }],
    temperature,
    ...(config.maxOutputTokens ? { max_tokens: config.maxOutputTokens } : {}),
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
    throw new Error(`[${providerCfg.provider.toUpperCase()}-ERROR] ${errText}`);
  }

  const data = (await res.json()) as any;
  const text = data.choices?.[0]?.message?.content || "";
  return { text };
}

export function createModel(config: GeminiConfig = {}): GeminiModel {
  const activeCfg = getActiveProviderConfig();
  const primaryModel = config.model ?? activeCfg.model;
  const temperature = config.temperature ?? 0.2;

  async function invoke(prompt: string): Promise<GeminiResponse> {
    const currentCfg = getActiveProviderConfig();
    if (currentCfg.isOpenAICompatible) {
      return invokeOpenAICompatible(prompt, { ...config, model: primaryModel, temperature });
    }

    const client = getClient();
    const FALLBACK_MODELS = Array.from(new Set([primaryModel, "gemini-3.6-flash", "gemini-3.7-flash", "gemini-3.5-flash", "gemini-flash-latest"]));
    let lastErr: any;

    for (const targetModel of FALLBACK_MODELS) {
      try {
        const response = await client.models.generateContent({
          model: targetModel,
          contents: prompt,
          config: {
            temperature,
            ...(config.maxOutputTokens ? { maxOutputTokens: config.maxOutputTokens } : {}),
          },
        });
        const candidate = response.candidates?.[0];
        const textParts = (candidate?.content?.parts ?? [])
          .filter((p: any) => typeof p?.text === "string")
          .map((p: any) => p.text);
        const text = textParts.join("") || (response.text ?? "");
        return { text };
      } catch (err: any) {
        lastErr = err;
        const msg = String(err?.message || err);
        if (msg.includes("429") || msg.includes("RESOURCE_EXHAUSTED") || msg.includes("Quota exceeded")) {
          continue;
        }
        throw err;
      }
    }

    const rawMsg = lastErr?.message || String(lastErr);
    if (rawMsg.includes("429") || rawMsg.includes("RESOURCE_EXHAUSTED")) {
      throw new Error(`[RATE-LIMIT] API Rate Limit / Quota Exceeded (HTTP 429). Free tier request quota reached.`);
    }
    throw lastErr;
  }

  return { model: primaryModel, temperature, invoke };
}

export const gemini = createModel();
