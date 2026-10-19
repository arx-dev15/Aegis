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

import fsSync from "fs";
import { promises as fs } from "fs";
import path from "path";
import { enforceToolGuardrail, GuardrailOptions } from "../guardrails/index.js";

// ── Path Safety ───────────────────────────────────────────────────────────────

/**
 * Resolve a relative path inside rootDir and confirm it stays within rootDir.
 * Throws if the path would escape the sandbox.
 */
function safePath(
  rootDir: string,
  relativePath: string,
  action: "read_file" | "write_file" | "create_directory" | "delete_file" = "read_file",
  options?: GuardrailOptions
): string {
  const workspaceIdentity = fsSync.realpathSync(path.resolve(rootDir)).toLowerCase();
  const guard = enforceToolGuardrail({
    toolName: "filesystem",
    action,
    target: relativePath,
    runId: options?.approvalContext?.runId,
    isApproved: options?.isApproved,
    approvalContext: options?.approvalContext,
    context: { workspaceIdentity },
  }, options);

  if (!guard.allowed) {
    throw new Error(`[GUARDRAIL-BLOCKED] ${guard.reason}`);
  }

  const resolved = path.resolve(rootDir, relativePath);
  const root = path.resolve(rootDir);

  const relative = path.relative(root, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(
      `Path escape attempt blocked: "${relativePath}" resolves outside workspace "${rootDir}"`
    );
  }

  try {
    const realRoot = fsSync.realpathSync(root);
    const existingTarget = fsSync.existsSync(resolved)
      ? resolved
      : (() => {
          let parent = path.dirname(resolved);
          while (parent !== path.dirname(parent) && !fsSync.existsSync(parent)) {
            parent = path.dirname(parent);
          }
          return parent;
        })();
    const realTarget = fsSync.realpathSync(existingTarget);
    const realRelative = path.relative(realRoot, realTarget);
    if (realRelative.startsWith("..") || path.isAbsolute(realRelative)) {
      throw new Error(
        `Symlink escape attempt blocked: "${relativePath}" resolves outside workspace "${rootDir}".`
      );
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes("Symlink escape")) throw error;
    throw new Error(`Failed realpath verification for "${relativePath}".`);
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
  content: string,
  options?: GuardrailOptions
): Promise<WriteResult> {
  const guard = enforceToolGuardrail(
    {
      toolName: "filesystem",
      action: "write_file",
      target: relativePath,
      runId: options?.approvalContext?.runId,
      isApproved: options?.isApproved,
      approvalContext: options?.approvalContext,
      context: { workspaceIdentity: fsSync.realpathSync(path.resolve(rootDir)).toLowerCase() },
    },
    options
  );

  if (!guard.allowed) {
    throw new Error(`[GUARDRAIL-BLOCKED] ${guard.reason}`);
  }

  const fullPath = safePath(rootDir, relativePath, "write_file", options);
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
  const fullPath = safePath(rootDir, relativePath, "read_file");
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
  relativePath: string,
  options?: GuardrailOptions
): Promise<DirResult> {
  const fullPath = safePath(rootDir, relativePath, "create_directory", options);
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
  relativePath: string,
  options?: GuardrailOptions
): Promise<DeleteResult> {
  const guard = enforceToolGuardrail(
    {
      toolName: "filesystem",
      action: "delete_file",
      target: relativePath,
      runId: options?.approvalContext?.runId,
      isApproved: options?.isApproved,
      approvalContext: options?.approvalContext,
      context: { workspaceIdentity: fsSync.realpathSync(path.resolve(rootDir)).toLowerCase() },
    },
    options
  );

  if (!guard.allowed) {
    throw new Error(`[GUARDRAIL-BLOCKED] ${guard.reason}`);
  }

  const fullPath = safePath(rootDir, relativePath, "delete_file", options);
  try {
    await fs.unlink(fullPath);
    return { path: relativePath, deleted: true };
  } catch (err: unknown) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") return { path: relativePath, deleted: false };
    throw err;
  }
}
