/**
 * rag/index.ts
 *
 * Feature 19 — RAG Pipeline: Barrel Export
 *
 * Public API surface for the entire rag/ module.
 * Import from here rather than from individual files.
 *
 * Usage:
 *   import { createRagPipeline, RagPipeline } from "../rag/index.js";
 *   import type { Document, Chunk, RetrievalResult } from "../rag/index.js";
 */

// ── Public API ────────────────────────────────────────────────────────────────

export { createRagPipeline, RagPipeline } from "./pipeline.js";
export type { RagPipelineConfig } from "./pipeline.js";

// ── Types ─────────────────────────────────────────────────────────────────────

export type { Document, Chunk, EmbeddedChunk, RetrievalResult } from "./types.js";

// ── Loaders ───────────────────────────────────────────────────────────────────

export { loadFile, loadFiles, loadDirectory, SUPPORTED_EXTENSIONS } from "./loaders/fileLoader.js";
export type { LoadDirectoryOptions } from "./loaders/fileLoader.js";

// ── Chunkers ──────────────────────────────────────────────────────────────────

export { chunkDocument, chunkDocuments } from "./chunkers/textChunker.js";
export type { ChunkOptions } from "./chunkers/textChunker.js";

// ── Embeddings ────────────────────────────────────────────────────────────────

export { GeminiEmbedder, geminiEmbedder } from "./embeddings/geminiEmbedder.js";
export type { EmbedderInterface, GeminiEmbedderConfig } from "./embeddings/geminiEmbedder.js";

// ── Vector Store ──────────────────────────────────────────────────────────────

export { InMemoryVectorStore } from "./vector-store/inMemoryStore.js";
export type { VectorStoreInterface, SearchOptions } from "./vector-store/inMemoryStore.js";

// ── Retriever ─────────────────────────────────────────────────────────────────

export { Retriever } from "./retriever/retriever.js";
export type { RetrieveOptions } from "./retriever/retriever.js";

// ── Project Knowledge (Feature 20) ───────────────────────────────────────────

export { ProjectKnowledge, createProjectKnowledge } from "./projectKnowledge.js";
export type { ProjectKnowledgeOptions, QueryKnowledgeOptions } from "./projectKnowledge.js";


