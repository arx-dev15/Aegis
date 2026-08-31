/**
 * tools/filesystem/index.ts
 *
 * Filesystem Tool — Real file I/O for Aegis agents.
 *
 * Provides four safe operations: writeFile, readFile, createDir, deleteFile.
 *
 * Safety rule: every path MUST resolve inside the configured rootDir.
 * Any attempt to escape (via "../" or absolute paths outside root) throws.
 *
 * Used by DeveloperAgent to write generated code to the workspace.
 */

import { promises as fs } from "fs";
import path from "path";
import { enforceToolGuardrail } from "../guardrails/index.js";

// ── Path Safety ───────────────────────────────────────────────────────────────

/**
 * Resolve a relative path inside rootDir and confirm it stays within rootDir.
 * Throws if the path would escape the sandbox.
 */
function safePath(rootDir: string, relativePath: string): string {
  const guard = enforceToolGuardrail({
    toolName: "filesystem",
    action: "read_file",
    target: relativePath,
  });

  if (!guard.allowed) {
    throw new Error(`[GUARDRAIL-BLOCKED] ${guard.reason}`);
  }

  const resolved = path.resolve(rootDir, relativePath);
  const root = path.resolve(rootDir);

  if (!resolved.startsWith(root + path.sep) && resolved !== root) {
    throw new Error(
      `Path escape attempt blocked: "${relativePath}" resolves outside workspace "${rootDir}"`
    );
  }

  return resolved;
}

// ── Operations ────────────────────────────────────────────────────────────────

export interface WriteResult {
  path: string;
  written: boolean;
  bytesWritten: number;
}

/**
 * Write content to a file inside rootDir.
 * Creates parent directories automatically.
 */
export async function writeFile(
  rootDir: string,
  relativePath: string,
  content: string
): Promise<WriteResult> {
  const guard = enforceToolGuardrail({
    toolName: "filesystem",
    action: "write_file",
    target: relativePath,
  });

  if (!guard.allowed) {
    throw new Error(`[GUARDRAIL-BLOCKED] ${guard.reason}`);
  }

  const fullPath = safePath(rootDir, relativePath);
  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.writeFile(fullPath, content, "utf-8");
  return {
    path: relativePath,
    written: true,
    bytesWritten: Buffer.byteLength(content, "utf-8"),
  };
}

export interface ReadResult {
  path: string;
  content: string;
  exists: boolean;
}

/**
 * Read a file from rootDir. Returns { exists: false } if the file is missing.
 */
export async function readFile(
  rootDir: string,
  relativePath: string
): Promise<ReadResult> {
  const fullPath = safePath(rootDir, relativePath);
  try {
    const content = await fs.readFile(fullPath, "utf-8");
    return { path: relativePath, content, exists: true };
  } catch (err: unknown) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") return { path: relativePath, content: "", exists: false };
    throw err;
  }
}

export interface DirResult {
  path: string;
  created: boolean;
}

/**
 * Create a directory (and any parents) inside rootDir.
 */
export async function createDir(
  rootDir: string,
  relativePath: string
): Promise<DirResult> {
  const fullPath = safePath(rootDir, relativePath);
  await fs.mkdir(fullPath, { recursive: true });
  return { path: relativePath, created: true };
}

export interface DeleteResult {
  path: string;
  deleted: boolean;
}

/**
 * Delete a file inside rootDir. Safe no-op if the file doesn't exist.
 */
export async function deleteFile(
  rootDir: string,
  relativePath: string
): Promise<DeleteResult> {
  const guard = enforceToolGuardrail({
    toolName: "filesystem",
    action: "delete_file",
    target: relativePath,
  });

  if (!guard.allowed) {
    throw new Error(`[GUARDRAIL-BLOCKED] ${guard.reason}`);
  }

  const fullPath = safePath(rootDir, relativePath);
  try {
    await fs.unlink(fullPath);
    return { path: relativePath, deleted: true };
  } catch (err: unknown) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") return { path: relativePath, deleted: false };
    throw err;
  }
}
