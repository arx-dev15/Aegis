/**
 * rag/chunkers/textChunker.ts
 *
 * Feature 19 — RAG Pipeline: Text Chunker
 *
 * Splits Document content into Chunks using a fixed-size sliding window
 * with configurable overlap.
 *
 * Strategy: character-based chunking with optional sentence-boundary respect.
 *
 * This is deterministic: same input + same config = same output, always.
 * No LLM calls are made here.
 *
 * Usage:
 *   const chunks = chunkDocument(doc, { chunkSize: 1000, overlap: 150 });
 */

import type { Document, Chunk } from "../types.js";

// ── Options ───────────────────────────────────────────────────────────────────

export interface ChunkOptions {
  /**
   * Target size of each chunk in characters.
   * Default: 1000
   */
  chunkSize?: number;

  /**
   * Number of characters to overlap between consecutive chunks.
   * Ensures context is not lost at boundaries.
   * Default: 150
   */
  overlap?: number;

  /**
   * If true, tries to split at a sentence boundary (". ") near the chunk end.
   * Improves semantic coherence of chunks.
   * Default: true
   */
  splitOnSentences?: boolean;
}

const DEFAULT_CHUNK_SIZE = 1000;
const DEFAULT_OVERLAP = 150;

// ── ID generation ─────────────────────────────────────────────────────────────

/**
 * Generates a stable, human-readable chunk ID.
 * Format: "<source>::chunk:<index>/<total>"
 */
function makeChunkId(source: string, index: number, total: number): string {
  // Use just the last 2 path segments for readability
  const parts = source.replace(/\\/g, "/").split("/");
  const shortSource = parts.slice(-2).join("/");
  return `${shortSource}::chunk:${index}/${total}`;
}

// ── Core splitter ─────────────────────────────────────────────────────────────

/**
 * Split a string into overlapping character windows.
 * Returns array of { start, text } objects.
 */
function splitIntoWindows(
  text: string,
  chunkSize: number,
  overlap: number,
  splitOnSentences: boolean
): string[] {
  const windows: string[] = [];

  if (text.length <= chunkSize) {
    // Document fits in a single chunk
    const trimmed = text.trim();
    if (trimmed.length > 0) windows.push(trimmed);
    return windows;
  }

  let start = 0;

  while (start < text.length) {
    let end = Math.min(start + chunkSize, text.length);

    if (splitOnSentences && end < text.length) {
      // Look back up to 100 chars for a good split point (". " or "\n")
      const lookback = text.slice(Math.max(start, end - 100), end);
      const sentenceEnd = Math.max(lookback.lastIndexOf(". "), lookback.lastIndexOf("\n"));

      if (sentenceEnd > 0) {
        end = end - 100 + sentenceEnd + 1; // include the period
      }
    }

    const chunk = text.slice(start, end).trim();
    if (chunk.length > 0) {
      windows.push(chunk);
    }

    if (end >= text.length) break;

    // Move forward, but step back by overlap amount
    start = Math.max(end - overlap, start + 1);
  }

  return windows;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Split a single Document into an array of Chunks.
 *
 * @param document     - The document to chunk.
 * @param options      - Chunking configuration (size, overlap, sentence splitting).
 * @returns            Array of Chunks with source tracing metadata.
 */
export function chunkDocument(
  document: Document,
  options: ChunkOptions = {}
): Chunk[] {
  const chunkSize = options.chunkSize ?? DEFAULT_CHUNK_SIZE;
  const overlap = options.overlap ?? DEFAULT_OVERLAP;
  const splitOnSentences = options.splitOnSentences ?? true;

  const windows = splitIntoWindows(
    document.content,
    chunkSize,
    overlap,
    splitOnSentences
  );

  const total = windows.length;

  return windows.map((text, index) => ({
    id: makeChunkId(document.source, index, total),
    content: text,
    source: document.source,
    chunkIndex: index,
    totalChunks: total,
    metadata: document.metadata,
  }));
}

/**
 * Chunk an array of Documents.
 *
 * @param documents    - Array of documents to chunk.
 * @param options      - Chunking configuration.
 * @returns            Flat array of all Chunks across all documents.
 */
export function chunkDocuments(
  documents: Document[],
  options: ChunkOptions = {}
): Chunk[] {
  return documents.flatMap((doc) => chunkDocument(doc, options));
}
