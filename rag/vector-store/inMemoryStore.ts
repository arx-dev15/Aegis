/**
 * rag/vector-store/inMemoryStore.ts
 *
 * Feature 19 — RAG Pipeline: In-Memory Vector Store
 *
 * Stores EmbeddedChunks in memory and retrieves the most similar ones
 * given a query embedding using cosine similarity.
 *
 * Design decisions:
 *  - In-memory: simplest appropriate implementation for the current project.
 *    No external database dependency (chromadb, pinecone, etc.) needed yet.
 *    Feature 20+ can introduce a persistent store when genuinely required.
 *  - Cosine similarity: standard metric for dense embedding retrieval.
 *  - Interface-based: the retriever depends on VectorStoreInterface, not this class.
 *    Swapping backends later requires no changes to the retriever.
 *
 * Usage:
 *   const store = new InMemoryVectorStore();
 *   await store.add(embeddedChunks);
 *   const results = await store.search(queryEmbedding, { topK: 5 });
 */

import type { EmbeddedChunk, RetrievalResult } from "../types.js";

// ── Interface ─────────────────────────────────────────────────────────────────

export interface SearchOptions {
  /** Number of results to return. Default: 5. */
  topK?: number;
  /** Minimum similarity score threshold (0.0–1.0). Default: 0.0. */
  minScore?: number;
}

/**
 * Clean provider-agnostic vector store interface.
 * The retriever depends only on this — not on InMemoryVectorStore directly.
 */
export interface VectorStoreInterface {
  /** Add embedded chunks to the store. */
  add(chunks: EmbeddedChunk[]): Promise<void>;
  /** Search for the most similar chunks to a query embedding. */
  search(queryEmbedding: number[], options?: SearchOptions): Promise<RetrievalResult[]>;
  /** Return the number of chunks currently stored. */
  size(): number;
  /** Remove all stored chunks. */
  clear(): void;
}

// ── Cosine similarity ─────────────────────────────────────────────────────────

/**
 * Compute cosine similarity between two equal-length vectors.
 * Returns a value in [-1, 1] where 1 = identical direction.
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!;
    normA += a[i]! * a[i]!;
    normB += b[i]! * b[i]!;
  }

  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

// ── In-Memory Vector Store ─────────────────────────────────────────────────────

/**
 * In-memory vector store backed by a plain array of EmbeddedChunks.
 * Search performs a linear scan and returns the top-K results by cosine similarity.
 *
 * Suitable for: small-to-medium document sets (< ~10k chunks).
 * For large corpora, replace this with a proper ANN/vector database later.
 */
export class InMemoryVectorStore implements VectorStoreInterface {
  private store: EmbeddedChunk[] = [];

  /**
   * Add one or more EmbeddedChunks to the store.
   */
  async add(chunks: EmbeddedChunk[]): Promise<void> {
    this.store.push(...chunks);
  }

  /**
   * Find the top-K most similar chunks to the query embedding.
   * Uses linear cosine similarity scan.
   *
   * @param queryEmbedding  - The query vector to search against.
   * @param options         - topK and optional minScore filter.
   * @returns               Sorted list of RetrievalResults (highest score first).
   */
  async search(
    queryEmbedding: number[],
    options: SearchOptions = {}
  ): Promise<RetrievalResult[]> {
    const topK = options.topK ?? 5;
    const minScore = options.minScore ?? 0.0;

    if (this.store.length === 0) return [];

    const scored = this.store.map((entry) => ({
      chunk: entry.chunk,
      score: cosineSimilarity(queryEmbedding, entry.embedding),
    }));

    return scored
      .filter((r) => r.score >= minScore)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }

  /** Number of chunks currently stored. */
  size(): number {
    return this.store.length;
  }

  /** Clear all stored chunks. */
  clear(): void {
    this.store = [];
  }
}
