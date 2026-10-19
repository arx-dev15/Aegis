/**
 * rag/pipeline.ts
 *
 * Feature 19 — RAG Pipeline: Public API
 *
 * Single entry point for the Aegis RAG system.
 * Composes Loader → Chunker → Embedder → VectorStore into two clean operations:
 *
 *   ingest(...)   — load documents, chunk, embed, and store
 *   retrieve(...) — embed a query, search the store, return ranked results
 *
 * Usage:
 *   import { createRagPipeline } from "./rag/pipeline.js";
 *
 *   const rag = createRagPipeline();
 *   await rag.ingestFiles(["src/auth.ts", "docs/api.md"]);
 *   const context = await rag.retrieveContext("how does JWT authentication work?");
 *
 * Design:
 *   - createRagPipeline() uses sensible defaults (GeminiEmbedder + InMemoryVectorStore).
 *   - All dependencies are injectable for testing without live API calls.
 *   - The pipeline does NOT connect to any agent. Feature 20 handles that.
 */

import { loadFile, loadFiles, loadDirectory } from "./loaders/fileLoader.js";
import type { LoadDirectoryOptions } from "./loaders/fileLoader.js";
import { chunkDocuments } from "./chunkers/textChunker.js";
import type { ChunkOptions } from "./chunkers/textChunker.js";
import { GeminiEmbedder } from "./embeddings/geminiEmbedder.js";
import type { EmbedderInterface } from "./embeddings/geminiEmbedder.js";
import { InMemoryVectorStore } from "./vector-store/inMemoryStore.js";
import type { VectorStoreInterface } from "./vector-store/inMemoryStore.js";
import { Retriever } from "./retriever/retriever.js";
import type { RetrievalResult, EmbeddedChunk, Chunk } from "./types.js";

// ── Pipeline options ──────────────────────────────────────────────────────────

export interface RagPipelineConfig {
  /** Custom embedder. Defaults to GeminiEmbedder. */
  embedder?: EmbedderInterface;
  /** Custom vector store. Defaults to InMemoryVectorStore. */
  vectorStore?: VectorStoreInterface;
  /** Chunking configuration. */
  chunkOptions?: ChunkOptions;
}

// ── Pipeline ──────────────────────────────────────────────────────────────────

export class RagPipeline {
  private readonly embedder: EmbedderInterface;
  private readonly vectorStore: VectorStoreInterface;
  private readonly retriever: Retriever;
  private readonly chunkOptions: ChunkOptions;

  constructor(config: RagPipelineConfig = {}) {
    this.embedder = config.embedder ?? new GeminiEmbedder();
    this.vectorStore = config.vectorStore ?? new InMemoryVectorStore();
    this.retriever = new Retriever(this.embedder, this.vectorStore);
    this.chunkOptions = config.chunkOptions ?? {};
  }

  // ── Ingest ────────────────────────────────────────────────────────────────

  /**
   * Ingest a list of file paths.
   * Each file is loaded, chunked, embedded, and stored.
   *
   * @returns Number of chunks stored.
   */
  async ingestFiles(filePaths: string[]): Promise<number> {
    const documents = await loadFiles(filePaths);
    return this._embedAndStore(chunkDocuments(documents, this.chunkOptions));
  }

  /**
   * Ingest a single file.
   * @returns Number of chunks stored.
   */
  async ingestFile(filePath: string): Promise<number> {
    const doc = await loadFile(filePath);
    if (!doc) return 0;
    return this._embedAndStore(chunkDocuments([doc], this.chunkOptions));
  }

  /**
   * Ingest all supported files from a directory.
   * @returns Number of chunks stored.
   */
  async ingestDirectory(
    dirPath: string,
    options?: LoadDirectoryOptions
  ): Promise<number> {
    const documents = await loadDirectory(dirPath, options);
    return this._embedAndStore(chunkDocuments(documents, this.chunkOptions));
  }

  /**
   * Ingest raw text directly (without a source file).
   * Useful for ingesting in-memory content (API responses, etc.).
   *
   * @param content  - The text to ingest.
   * @param source   - A label for the source (e.g. "api-response:tasks").
   * @returns        Number of chunks stored.
   */
  async ingestText(content: string, source = "inline"): Promise<number> {
    return this._embedAndStore(
      chunkDocuments([{ source, content }], this.chunkOptions)
    );
  }

  // ── Retrieve ──────────────────────────────────────────────────────────────

  /**
   * Retrieve the most relevant chunks for a query.
   * Returns ranked RetrievalResult[] with chunks and scores.
   */
  async retrieve(query: string, topK = 5): Promise<RetrievalResult[]> {
    return this.retriever.retrieve(query, { topK });
  }

  /**
   * Retrieve and return a formatted context string for agent prompt injection.
   * Returns empty string if the store is empty or no relevant results found.
   */
  async retrieveContext(query: string, topK = 5): Promise<string> {
    return this.retriever.retrieveContext(query, topK);
  }

  /**
   * Retrieve and return only the text contents of the top-K chunks.
   */
  async retrieveContent(query: string, topK = 5): Promise<string[]> {
    return this.retriever.retrieveContent(query, topK);
  }

  // ── Stats ─────────────────────────────────────────────────────────────────

  /** Number of chunks currently in the vector store. */
  get chunkCount(): number {
    return this.vectorStore.size();
  }

  /** Clear all stored chunks (useful between sessions or in tests). */
  clear(): void {
    this.vectorStore.clear();
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private async _embedAndStore(chunks: Chunk[]): Promise<number> {
    if (chunks.length === 0) return 0;

    const texts = chunks.map((c) => c.content);
    const embeddings = await this.embedder.embedBatch(texts);

    const embedded: EmbeddedChunk[] = chunks.map((chunk, i) => ({
      chunk,
      embedding: embeddings[i]!,
    }));

    await this.vectorStore.add(embedded);
    return embedded.length;
  }
}

// ── Factory ────────────────────────────────────────────────────────────────────

/**
 * Create a new RagPipeline instance with the default configuration.
 * Use this unless you need custom embedder or vector store injection.
 */
export function createRagPipeline(config: RagPipelineConfig = {}): RagPipeline {
  return new RagPipeline(config);
}
