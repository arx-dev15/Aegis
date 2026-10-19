/**
 * rag/types.ts
 *
 * Feature 19 — RAG Pipeline
 *
 * Core shared types for the Aegis RAG pipeline.
 * These are used across loaders, chunkers, embeddings, vector-store and retriever.
 */

// ── Document ─────────────────────────────────────────────────────────────────

/**
 * A raw document loaded from disk or any other source.
 * This is the input to the chunking stage.
 */
export interface Document {
  /** Absolute or relative path to the source file */
  source: string;
  /** Raw text content of the document */
  content: string;
  /** Optional free-form metadata (type, extension, size, etc.) */
  metadata?: Record<string, string | number | boolean>;
}

// ── Chunk ─────────────────────────────────────────────────────────────────────

/**
 * A single text chunk produced by splitting a Document.
 * Carries enough metadata to trace back to its source document and position.
 */
export interface Chunk {
  /** Unique identifier for this chunk (source + index) */
  id: string;
  /** The chunked text content */
  content: string;
  /** Source document path */
  source: string;
  /** Zero-based index of this chunk within its source document */
  chunkIndex: number;
  /** Total number of chunks in the source document */
  totalChunks: number;
  /** Optional inherited/additional metadata from the source document */
  metadata?: Record<string, string | number | boolean>;
}

// ── Embedded Chunk ───────────────────────────────────────────────────────────

/**
 * A Chunk that has been embedded into a numeric vector.
 * This is stored in the vector store.
 */
export interface EmbeddedChunk {
  /** The original chunk */
  chunk: Chunk;
  /** Dense embedding vector from the embedding model */
  embedding: number[];
}

// ── Retrieval Result ─────────────────────────────────────────────────────────

/**
 * A single result returned by the retriever after similarity search.
 */
export interface RetrievalResult {
  /** The matching chunk */
  chunk: Chunk;
  /** Cosine similarity score between query and chunk (0.0 – 1.0) */
  score: number;
}
