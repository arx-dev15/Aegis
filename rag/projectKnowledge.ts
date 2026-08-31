/**
 * rag/projectKnowledge.ts
 *
 * Feature 20 — Project Knowledge Retrieval
 *
 * Manages project document/codebase knowledge ingestion, querying, context formatting,
 * and agent context integration for Aegis.
 * Built on top of Feature 19 RAG Pipeline without modifying core RAG components or existing agents.
 *
 * Usage:
 *   const knowledge = createProjectKnowledge();
 *   await knowledge.ingestProject("d:/my-project");
 *   const context = await knowledge.getFormattedContext("how does JWT auth work?");
 *   const research = await researcherAgent.research(task, context);
 */

import { RagPipeline, createRagPipeline } from "./pipeline.js";
import type { RagPipelineConfig } from "./pipeline.js";
import type { RetrievalResult } from "./types.js";
import type { LoadDirectoryOptions } from "./loaders/fileLoader.js";

export interface ProjectKnowledgeOptions {
  /** Optional pre-configured RagPipeline instance */
  pipeline?: RagPipeline;
  /** Optional pipeline config if instantiating default pipeline */
  pipelineConfig?: RagPipelineConfig;
}

export interface QueryKnowledgeOptions {
  /** Top-K results to retrieve. Default: 5. */
  topK?: number;
  /** Minimum similarity score threshold (0.0–1.0). Default: 0.0. */
  minScore?: number;
}

/**
 * ProjectKnowledge — Manages project knowledge ingestion, retrieval,
 * context formatting, and agent prompt integration.
 */
export class ProjectKnowledge {
  private readonly pipeline: RagPipeline;

  constructor(options: ProjectKnowledgeOptions = {}) {
    this.pipeline = options.pipeline ?? createRagPipeline(options.pipelineConfig);
  }

  /**
   * Ingest all supported documents from a project directory into knowledge store.
   * Automatically ignores irrelevant directories (node_modules, dist, .git, etc.).
   *
   * @param projectPath - Root path of the project directory.
   * @param options     - Directory loading options (exclude, extensions, recursive).
   * @returns Number of chunks stored.
   */
  async ingestProject(
    projectPath: string,
    options?: LoadDirectoryOptions
  ): Promise<number> {
    return this.pipeline.ingestDirectory(projectPath, options);
  }

  /**
   * Alias for ingestProject.
   */
  async ingestDirectory(
    projectPath: string,
    options?: LoadDirectoryOptions
  ): Promise<number> {
    return this.ingestProject(projectPath, options);
  }

  /**
   * Ingest specific project files into knowledge store.
   *
   * @param filePaths - List of file paths to load and embed.
   * @returns Number of chunks stored.
   */
  async ingestFiles(filePaths: string[]): Promise<number> {
    return this.pipeline.ingestFiles(filePaths);
  }

  /**
   * Ingest raw text document with a source label into knowledge store.
   *
   * @param content - Document content string.
   * @param source  - Label or source path for metadata tracing.
   * @returns Number of chunks stored.
   */
  async ingestDocument(content: string, source = "inline"): Promise<number> {
    return this.pipeline.ingestText(content, source);
  }

  /**
   * Query project knowledge for relevant chunks with source/path metadata.
   * Returns empty array if query is empty or no knowledge is stored.
   *
   * @param query   - Search query string.
   * @param options - topK and minScore options.
   * @returns Array of RetrievalResult objects.
   */
  async queryKnowledge(
    query: string,
    options: QueryKnowledgeOptions = {}
  ): Promise<RetrievalResult[]> {
    if (!query || query.trim() === "") {
      return [];
    }
    return this.pipeline.retrieve(query.trim(), options.topK ?? 5);
  }

  /**
   * Format retrieved project knowledge into a concise context block for agent prompt injection.
   * Preserves source file paths and similarity scores.
   *
   * @param query - Search query string.
   * @param topK  - Number of top chunks to include. Default: 5.
   * @returns Formatted markdown string, or empty string if no relevant knowledge found.
   */
  async getFormattedContext(query: string, topK = 5): Promise<string> {
    if (!query || query.trim() === "") {
      return "";
    }

    const results = await this.queryKnowledge(query, { topK });
    if (results.length === 0) {
      return "";
    }

    const blocks = results.map((r, i) => {
      const normSource = r.chunk.source.replace(/\\/g, "/");
      return [
        `[PROJECT KNOWLEDGE Chunk ${i + 1}]`,
        `Source: ${normSource}`,
        `Relevance Score: ${r.score.toFixed(3)}`,
        `Content:\n${r.chunk.content}`,
      ].join("\n");
    });

    return [
      "=== PROJECT KNOWLEDGE CONTEXT ===",
      "",
      blocks.join("\n\n"),
      "",
      "=== END PROJECT KNOWLEDGE CONTEXT ===",
    ].join("\n");
  }

  /**
   * Helper to merge existing agent context with retrieved project knowledge context.
   *
   * @param existingContext - Base context string (can be undefined/empty).
   * @param query           - Search query for project knowledge.
   * @param topK            - Number of chunks to retrieve. Default: 5.
   * @returns Merged context string ready for agent prompt injection.
   */
  async enhanceContext(
    existingContext: string | undefined,
    query: string,
    topK = 5
  ): Promise<string> {
    const knowledgeContext = await this.getFormattedContext(query, topK);
    if (!knowledgeContext) {
      return existingContext ?? "";
    }
    if (!existingContext || existingContext.trim() === "") {
      return knowledgeContext;
    }
    return `${existingContext.trim()}\n\n${knowledgeContext}`;
  }

  /** Number of chunks currently stored in project knowledge vector store. */
  get chunkCount(): number {
    return this.pipeline.chunkCount;
  }

  /** Clear stored project knowledge. */
  clear(): void {
    this.pipeline.clear();
  }
}

/**
 * Factory helper for ProjectKnowledge.
 */
export function createProjectKnowledge(
  options: ProjectKnowledgeOptions = {}
): ProjectKnowledge {
  return new ProjectKnowledge(options);
}
