/**
 * rag/loaders/fileLoader.ts
 *
 * Feature 19 — RAG Pipeline: Document Loader
 *
 * Loads documents from the filesystem into the RAG pipeline.
 *
 * Supported file types:
 *   .ts, .tsx, .js, .jsx  — TypeScript/JavaScript source
 *   .md                    — Markdown documentation
 *   .txt                   — Plain text
 *   .json                  — JSON files
 *   .yaml, .yml            — YAML configuration
 *   .env.example           — Example environment files
 *
 * Usage:
 *   const docs = await loadFile("src/auth.ts");
 *   const docs = await loadDirectory("agents/", { extensions: [".ts", ".md"] });
 */

import { readFile, readdir } from "node:fs/promises";
import { join, extname, relative } from "node:path";
import type { Document } from "../types.js";

// ── Supported extensions ──────────────────────────────────────────────────────

export const SUPPORTED_EXTENSIONS = new Set([
  ".ts", ".tsx", ".js", ".jsx",
  ".md", ".txt", ".json",
  ".yaml", ".yml",
]);

// ── Options ───────────────────────────────────────────────────────────────────

export interface LoadDirectoryOptions {
  /** File extensions to include. Defaults to SUPPORTED_EXTENSIONS. */
  extensions?: string[];
  /** Directories to skip (e.g. node_modules, dist). */
  exclude?: string[];
  /** Whether to recurse into subdirectories. Default: true. */
  recursive?: boolean;
}

const DEFAULT_EXCLUDE = ["node_modules", "dist", ".git", ".next", "build"];

// ── Single file loader ────────────────────────────────────────────────────────

/**
 * Load a single file from disk into a Document.
 * Returns null if the file extension is not supported.
 */
export async function loadFile(filePath: string): Promise<Document | null> {
  const ext = extname(filePath).toLowerCase();

  if (!SUPPORTED_EXTENSIONS.has(ext)) {
    return null;
  }

  const content = await readFile(filePath, "utf-8");

  return {
    source: filePath,
    content,
    metadata: {
      extension: ext,
      sizeBytes: Buffer.byteLength(content, "utf-8"),
    },
  };
}

// ── Directory loader ──────────────────────────────────────────────────────────

/**
 * Recursively load all supported documents from a directory.
 *
 * @param dirPath  - Path to the directory to scan.
 * @param options  - Optional filtering and recursion config.
 * @returns Array of loaded Documents.
 */
export async function loadDirectory(
  dirPath: string,
  options: LoadDirectoryOptions = {}
): Promise<Document[]> {
  const {
    extensions,
    exclude = DEFAULT_EXCLUDE,
    recursive = true,
  } = options;

  const allowedExtensions = extensions
    ? new Set(extensions)
    : SUPPORTED_EXTENSIONS;

  const documents: Document[] = [];

  async function walk(currentPath: string): Promise<void> {
    const entries = await readdir(currentPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(currentPath, entry.name);

      if (entry.isDirectory()) {
        if (!recursive) continue;
        if (exclude.includes(entry.name)) continue;
        await walk(fullPath);
      } else if (entry.isFile()) {
        const ext = extname(entry.name).toLowerCase();
        if (!allowedExtensions.has(ext)) continue;

        try {
          const content = await readFile(fullPath, "utf-8");
          documents.push({
            source: fullPath,
            content,
            metadata: {
              extension: ext,
              relativePath: relative(dirPath, fullPath),
              sizeBytes: Buffer.byteLength(content, "utf-8"),
            },
          });
        } catch {
          // Skip unreadable files silently
        }
      }
    }
  }

  await walk(dirPath);
  return documents;
}

/**
 * Load documents from a list of file paths.
 * Skips unsupported or unreadable files.
 */
export async function loadFiles(filePaths: string[]): Promise<Document[]> {
  const results = await Promise.allSettled(filePaths.map(loadFile));
  const documents: Document[] = [];

  for (const result of results) {
    if (result.status === "fulfilled" && result.value !== null) {
      documents.push(result.value);
    }
  }

  return documents;
}
