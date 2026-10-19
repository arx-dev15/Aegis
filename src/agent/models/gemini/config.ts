/**
 * models/gemini/config.ts
 *
 * Universal Provider Key Resolution
 *
 * Resolves API key using the active provider configuration (Google, Groq, OpenAI, etc.)
 * with zero-breaking-change fallback for existing GoogleGenAI client callers.
 */

import dotenv from "dotenv";
dotenv.config();
import { getActiveProviderConfig } from "../providerConfig.js";

export const GEMINI_API_KEY =
  process.env["GOOGLE_API_KEY"] ||
  process.env["GEMINI_API_KEY"] ||
  process.env["LLM_API_KEY"];

export function requireGeminiApiKey(): string {
  const cfg = getActiveProviderConfig();
  if (cfg.apiKey) {
    return cfg.apiKey;
  }
  if (cfg.provider === "ollama") {
    return "ollama";
  }
  throw new Error(
    `Missing API key for provider "${cfg.provider}". ` +
      `Add ${cfg.provider.toUpperCase()}_API_KEY or LLM_API_KEY to your .env file.`
  );
}
