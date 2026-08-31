/**
 * rag/embeddings/geminiEmbedder.ts
 *
 * Feature 19 — RAG Pipeline: Embedding Layer
 *
 * Wraps the @google/genai embedding API to produce dense vector embeddings
 * for text chunks. Uses the existing shared GoogleGenAI client from the model layer.
 *
 * Model used: "gemini-embedding-001" — stable Gemini embedding model available via API.
 * Output dimension: 3072 floats per embedding (gemini-embedding-001).
 *
 * Interface design:
 *   The EmbedderInterface keeps the rest of the RAG pipeline decoupled from
 *   Google specifics. A different provider could implement the same interface.
 *
 * Usage:
 *   const embedder = new GeminiEmbedder();
 *   const embedding = await embedder.embed("how does JWT authentication work?");
 *   const embeddings = await embedder.embedBatch(["text a", "text b"]);
 */

import { getClient } from "../../models/gemini/model.js";

// ── Interface ─────────────────────────────────────────────────────────────────

/**
 * Clean provider-agnostic embedding interface.
 * The vector store and retriever depend only on this interface.
 */
export interface EmbedderInterface {
  /** Embed a single string. Returns a dense float vector. */
  embed(text: string): Promise<number[]>;
  /** Embed multiple strings. Returns an array of float vectors (same order). */
  embedBatch(texts: string[]): Promise<number[][]>;
}

// ── Gemini Embedder ───────────────────────────────────────────────────────────

export interface GeminiEmbedderConfig {
  /**
   * Embedding model name.
   * Default: "gemini-embedding-001" (available for current Gemini API keys).
   */
  model?: string;
}

/**
 * Gemini-backed embedder using the existing GoogleGenAI client from the model layer.
 * Uses @google/genai's embedContent API directly (no LangChain dependency).
 */
export class GeminiEmbedder implements EmbedderInterface {
  private readonly model: string;

  constructor(config: GeminiEmbedderConfig = {}) {
    this.model = config.model ?? "gemini-embedding-001";
  }

  /**
   * Embed a single text string.
   * Returns a float array (e.g. 3072-dimensional for gemini-embedding-001).
   */
  async embed(text: string): Promise<number[]> {
    if (!text || text.trim().length === 0) {
      throw new Error("Cannot embed empty text.");
    }

    const client = getClient();
    const response = await client.models.embedContent({
      model: this.model,
      contents: text.trim(),
    });

    const values = response.embeddings?.[0]?.values;
    if (!values || values.length === 0) {
      throw new Error("Gemini embedding API returned empty values.");
    }

    return values;
  }

  /**
   * Embed multiple strings sequentially.
   * Sequential rather than concurrent to stay within API rate limits.
   */
  async embedBatch(texts: string[]): Promise<number[][]> {
    const embeddings: number[][] = [];

    for (const text of texts) {
      const embedding = await this.embed(text);
      embeddings.push(embedding);
    }

    return embeddings;
  }
}

// ── Default instance ──────────────────────────────────────────────────────────

/**
 * Shared default embedder instance.
 * Use this unless a custom config is needed.
 */
export const geminiEmbedder = new GeminiEmbedder();
