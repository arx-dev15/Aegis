/**
 * rag/retriever/retriever.ts
 *
 * Feature 19 — RAG Pipeline: Retriever
 *
 * Given a natural-language query, the retriever:
 *   1. Embeds the query using the configured EmbedderInterface.
 *   2. Searches the VectorStoreInterface for the most similar chunks.
 *   3. Returns RetrievalResult[] with chunks and similarity scores.
 *
 * The Retriever is intentionally thin — it combines the embedder and
 * vector store without adding extra logic. It is the read-path of the RAG pipeline.
 *
 * Usage:
 *   const retriever = new Retriever(embedder, vectorStore);
 *   const results = await retriever.retrieve("how does JWT auth work?", { topK: 5 });
 */

import type { EmbedderInterface } from "../embeddings/geminiEmbedder.js";
import type { VectorStoreInterface, SearchOptions } from "../vector-store/inMemoryStore.js";
import type { RetrievalResult } from "../types.js";

// ── Retriever ─────────────────────────────────────────────────────────────────

export interface RetrieveOptions extends SearchOptions {
  /** Optional label for logging/debugging (e.g. the requesting agent). */
  label?: string;
}

/**
 * RAG Retriever — combines an embedder and a vector store into a single
 * query interface for the pipeline.
 *
 * Agents and workflows that need project context call `retrieve()`.
 */
export class Retriever {
  constructor(
    private readonly embedder: EmbedderInterface,
    private readonly vectorStore: VectorStoreInterface
  ) {}

  /**
   * Retrieve the most relevant chunks for a given query.
   *
   * @param query    - Natural language question or keyword query.
   * @param options  - topK, minScore, and optional debug label.
   * @returns        Ranked list of RetrievalResult (highest similarity first).
   */
  async retrieve(
    query: string,
    options: RetrieveOptions = {}
  ): Promise<RetrievalResult[]> {
    if (!query || query.trim().length === 0) {
      return [];
    }

    const queryEmbedding = await this.embedder.embed(query.trim());
    return this.vectorStore.search(queryEmbedding, {
      topK: options.topK,
      minScore: options.minScore,
    });
  }

  /**
   * Convenience: retrieve and return only the text content of the top-K chunks,
   * ready to be injected into an agent prompt.
   *
   * @param query    - Natural language query.
   * @param topK     - Number of chunks to return. Default: 5.
   * @returns        Array of content strings, ordered by relevance.
   */
  async retrieveContent(query: string, topK = 5): Promise<string[]> {
    const results = await this.retrieve(query, { topK });
    return results.map((r) => r.chunk.content);
  }

  /**
   * Format retrieval results into a single context block suitable for
   * injection into an agent's system or user prompt.
   *
   * @param query    - Natural language query.
   * @param topK     - Number of chunks to retrieve. Default: 5.
   * @returns        Formatted context string, or empty string if no results.
   */
  async retrieveContext(query: string, topK = 5): Promise<string> {
    const results = await this.retrieve(query, { topK });
    if (results.length === 0) return "";

    const blocks = results.map((r, i) => {
      const source = r.chunk.source.replace(/\\/g, "/").split("/").slice(-2).join("/");
      return [
        `--- Context ${i + 1} [${source}] (score: ${r.score.toFixed(3)}) ---`,
        r.chunk.content,
      ].join("\n");
    });

    return blocks.join("\n\n");
  }
}
