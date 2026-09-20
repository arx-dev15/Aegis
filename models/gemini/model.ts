/**
 * models/gemini/model.ts
 *
 * Gemini Model Layer — Feature 01
 *
 * Provides:
 *  - `getClient()`    : returns the shared GoogleGenAI client
 *  - `gemini`         : default pre-configured model handle (call .invoke())
 *  - `createModel()`  : factory for custom model configurations
 *  - `GeminiConfig`   : type for model options
 *
 * NOTE: Uses @google/genai (the new Interactions API SDK).
 * The older @langchain/google-genai uses the deprecated generateContent
 * endpoint which is blocked for new API keys.
 * When @langchain/google-genai updates to support @google/genai internally,
 * this layer can be adapted to re-expose LangChain's BaseChatModel interface.
 */

import { GoogleGenAI } from "@google/genai";
import "./config.js"; // validates GOOGLE_API_KEY on import

// ── Types ────────────────────────────────────────────────────────────────────

export interface GeminiConfig {
  /**
   * Gemini model name.
   * Defaults to "gemini-3.5-flash" (stable, fast, good for agentic tasks).
   * Available: gemini-3.5-flash, gemini-3.6-flash, gemini-3.7-flash, etc.
   * Note: gemini-2.5-flash is blocked for new API keys; use 3.x models.
   */
  model?: string;
  /**
   * Sampling temperature (0.0 – 2.0).
   * 0 = deterministic, higher = more creative.
   * Default: 0.2 for agentic tasks.
   */
  temperature?: number;
  /** Max tokens in the response. Optional. */
  maxOutputTokens?: number;
}

export interface GeminiResponse {
  text: string;
}

// ── Shared client ─────────────────────────────────────────────────────────────

let _client: GoogleGenAI | null = null;

/**
 * Returns the shared GoogleGenAI client.
 * Initialised once, reused across all calls.
 */
export function getClient(): GoogleGenAI {
  if (!_client) {
    _client = new GoogleGenAI({ apiKey: process.env["GOOGLE_API_KEY"]! });
  }
  return _client;
}

// ── Model handle ─────────────────────────────────────────────────────────────

export interface GeminiModel {
  /** The model name this handle is configured for. */
  model: string;
  /** Temperature used for this handle. */
  temperature: number;
  /**
   * Send a prompt and receive a text response.
   * This is the primary method used by agents.
   */
  invoke: (prompt: string) => Promise<GeminiResponse>;
}

// ── Factory ───────────────────────────────────────────────────────────────────

/**
 * Create a Gemini model handle with the given config.
 *
 * Usage:
 *   const model = createModel({ temperature: 0 });
 *   const { text } = await model.invoke("Summarise this codebase.");
 */
export function createModel(config: GeminiConfig = {}): GeminiModel {
  const primaryModel = config.model ?? process.env.GEMINI_MODEL ?? "gemini-3.6-flash";
  const temperature = config.temperature ?? 0.2;
  const FALLBACK_MODELS = Array.from(new Set([primaryModel, "gemini-3.6-flash", "gemini-3.7-flash", "gemini-3.5-flash", "gemini-flash-latest"]));

  async function invoke(prompt: string): Promise<GeminiResponse> {
    const client = getClient();
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
        return { text: response.text ?? "" };
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
      throw new Error(`[GEMINI-RATE-LIMIT] Gemini API Rate Limit / Quota Exceeded (HTTP 429). Free tier request quota reached. Please wait ~30-60 seconds for quota reset or update GOOGLE_API_KEY in .env.`);
    }
    throw lastErr;
  }

  return { model: primaryModel, temperature, invoke };
}

// ── Default instance ──────────────────────────────────────────────────────────

/**
 * Default Gemini model handle.
 * Used across all agents unless a custom config is needed.
 */
export const gemini = createModel();