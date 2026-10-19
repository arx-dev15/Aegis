/**
 * src/agent/models/providerConfig.ts
 *
 * Universal LLM Provider Configuration & Endpoint Resolver.
 *
 * Supports switching providers simply by specifying LLM_PROVIDER and standard API keys:
 * - gemini: Google GenAI (default)
 * - groq: Groq Cloud ultra-fast inference (OpenAI-compatible)
 * - openai: OpenAI official
 * - anthropic: Anthropic Claude (via OpenAI compatibility layer or direct)
 * - openrouter: OpenRouter unified gateway
 * - deepseek: DeepSeek API (OpenAI-compatible)
 * - mistral: Mistral AI (OpenAI-compatible)
 * - ollama: Local self-hosted Ollama (OpenAI-compatible)
 * - custom: Any OpenAI-compatible endpoint via LLM_BASE_URL
 */

import dotenv from "dotenv";
dotenv.config();

export type SupportedProvider =
  | "gemini"
  | "groq"
  | "openai"
  | "openrouter"
  | "deepseek"
  | "mistral"
  | "anthropic"
  | "ollama"
  | "custom";

export interface ResolvedProviderConfig {
  provider: SupportedProvider;
  model: string;
  apiKey: string;
  baseUrl?: string;
  isOpenAICompatible: boolean;
}

const DEFAULT_MODELS: Record<SupportedProvider, string> = {
  gemini: "gemini-3.6-flash",
  groq: "llama-3.3-70b-versatile",
  openai: "gpt-4o-mini",
  openrouter: "meta-llama/llama-3.3-70b-instruct:free",
  deepseek: "deepseek-chat",
  mistral: "mistral-small-latest",
  anthropic: "claude-3-5-haiku-20241022",
  ollama: "llama3.2",
  custom: "default",
};

const DEFAULT_BASE_URLS: Partial<Record<SupportedProvider, string>> = {
  groq: "https://api.groq.com/openai/v1",
  openrouter: "https://openrouter.ai/api/v1",
  deepseek: "https://api.deepseek.com/v1",
  mistral: "https://api.mistral.ai/v1",
  ollama: "http://localhost:11434/v1",
};

export function getActiveProviderConfig(envOverride?: Record<string, string | undefined>): ResolvedProviderConfig {
  const env = envOverride || process.env;

  const providerRaw = (
    env.LLM_PROVIDER ||
    env.PROVIDER ||
    (env.GROQ_API_KEY && !env.GOOGLE_API_KEY ? "groq" : "gemini")
  ).toLowerCase().trim() as SupportedProvider;

  const provider: SupportedProvider =
    providerRaw in DEFAULT_MODELS ? providerRaw : "gemini";

  let apiKey = "";
  switch (provider) {
    case "gemini":
      apiKey = env.GOOGLE_API_KEY || env.GEMINI_API_KEY || "";
      break;
    case "groq":
      apiKey = env.GROQ_API_KEY || env.OPENAI_API_KEY || "";
      break;
    case "openai":
      apiKey = env.OPENAI_API_KEY || "";
      break;
    case "openrouter":
      apiKey = env.OPENROUTER_API_KEY || env.OPENAI_API_KEY || "";
      break;
    case "deepseek":
      apiKey = env.DEEPSEEK_API_KEY || env.OPENAI_API_KEY || "";
      break;
    case "mistral":
      apiKey = env.MISTRAL_API_KEY || env.OPENAI_API_KEY || "";
      break;
    case "anthropic":
      apiKey = env.ANTHROPIC_API_KEY || "";
      break;
    case "ollama":
      apiKey = env.OLLAMA_API_KEY || "ollama";
      break;
    case "custom":
      apiKey = env.LLM_API_KEY || env.OPENAI_API_KEY || "custom";
      break;
  }

  // Generic fallback if user just sets LLM_API_KEY
  if (!apiKey && env.LLM_API_KEY) {
    apiKey = env.LLM_API_KEY;
  }

  const model =
    env.LLM_MODEL ||
    env.MODEL ||
    (provider === "gemini" ? env.GEMINI_MODEL : undefined) ||
    DEFAULT_MODELS[provider];

  const baseUrl =
    env.LLM_BASE_URL ||
    env.OPENAI_BASE_URL ||
    DEFAULT_BASE_URLS[provider];

  const isOpenAICompatible = provider !== "gemini";

  return {
    provider,
    model,
    apiKey,
    baseUrl,
    isOpenAICompatible,
  };
}
