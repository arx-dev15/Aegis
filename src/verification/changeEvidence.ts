/**
 * graph/changeEvidence.ts
 *
 * Feature R04 — Workspace Change Evidence & Baseline Tracking
 *
 * Captures pre-apply baseline state, verifies post-apply workspace changes,
 * checks exact content match for approved proposals, and distinguishes
 * pre-existing dirty files from AEGIS run-introduced changes.
 */

import fs from "fs";
import path from "path";
import crypto from "crypto";
import { runCommand } from "../tools/terminal/index.js";
import type { CodeChange } from "../runtime/state.js";

export interface FileBaseline {
  path: string;
  exists: boolean;
  content?: string;
  hash?: string;
}

export interface WorkspaceBaseline {
  timestamp: number;
  workspace: string;
  isGitRepo: boolean;
  preExistingDirtyFiles: string[];
  preExistingHashes: Record<string, string>;
  fileBaselines: Record<string, FileBaseline>;
}

export interface FileEvidence {
  path: string;
  action: "add" | "modify" | "delete";
  beforeExists: boolean;
  afterExists: boolean;
  beforeHash?: string;
  afterHash?: string;
  preExistingDirty: boolean;
  actuallyChanged: boolean;
  contentMatches: boolean;
  verified: boolean;
  classification: "run-introduced" | "pre-existing" | "unexpected";
  error?: string;
}

export interface WorkspaceChangeEvidence {
  timestamp: number;
  workspace: string;
  isGitRepo: boolean;
  preExistingDirtyFiles: string[];
  fileEvidence: FileEvidence[];
  unexpectedChanges: string[];
  allVerified: boolean;
}

/**
 * Compute SHA-256 hash of text content using standard Node crypto.
 */
export function computeSHA256(content: string): string {
  return crypto.createHash("sha256").update(content, "utf-8").digest("hex");
}

/**
 * Safely resolve a path relative to workspace rootDir, verifying path containment and symlink safety.
 * Returns valid: false if relativePath attempts to escape rootDir or traverse a symlink outside rootDir.
 */
export function safeResolveWorkspacePath(
  rootDir: string,
  relativePath: string
): { valid: boolean; resolvedPath?: string; reason?: string } {
  if (!rootDir || !rootDir.trim()) {
    return { valid: false, reason: "Workspace root directory is empty." };
  }
  const normRoot = path.resolve(rootDir.trim());
  const normRel = relativePath.replace(/\\/g, "/");

  // 1. Guardrail / syntax check for path escape (../ or ..\)
  if (
    normRel.startsWith("../") ||
    normRel.includes("/../") ||
    normRel.startsWith("..\\") ||
    normRel.includes("\\..\\")
  ) {
    return {
      valid: false,
      reason: `Path escape attempt blocked: "${relativePath}" contains relative navigation outside workspace.`,
    };
  }

  // 2. Resolve target path and check string prefix containment
  const resolved = path.resolve(normRoot, relativePath);
  const rootPrefix = normRoot.endsWith(path.sep) ? normRoot : normRoot + path.sep;
  const isCwdEqual = resolved.toLowerCase() === normRoot.toLowerCase();
  const isInside = resolved.toLowerCase().startsWith(rootPrefix.toLowerCase());

  if (!isCwdEqual && !isInside) {
    return {
      valid: false,
      reason: `Path escape attempt blocked: "${relativePath}" resolves outside workspace "${rootDir}".`,
    };
  }

  // 3. Symlink / Realpath resolution check (if target or parent exists on disk)
  try {
    if (fs.existsSync(resolved)) {
      const realTarget = fs.realpathSync(resolved);
      const realRoot = fs.realpathSync(normRoot);
      const realRootPrefix = realRoot.endsWith(path.sep) ? realRoot : realRoot + path.sep;
      const isRealCwdEqual = realTarget.toLowerCase() === realRoot.toLowerCase();
      const isRealInside = realTarget.toLowerCase().startsWith(realRootPrefix.toLowerCase());
      if (!isRealCwdEqual && !isRealInside) {
        return {
          valid: false,
          reason: `Symlink escape attempt blocked: "${relativePath}" points to real path "${realTarget}" outside workspace "${rootDir}".`,
        };
      }
    } else {
      let parent = path.dirname(resolved);
      while (
        parent &&
        parent.toLowerCase() !== normRoot.toLowerCase() &&
        parent !== path.dirname(parent)
      ) {
        if (fs.existsSync(parent)) {
          const realParent = fs.realpathSync(parent);
          const realRoot = fs.realpathSync(normRoot);
          const realRootPrefix = realRoot.endsWith(path.sep) ? realRoot : realRoot + path.sep;
          const isRealCwdEqual = realParent.toLowerCase() === realRoot.toLowerCase();
          const isRealInside = realParent.toLowerCase().startsWith(realRootPrefix.toLowerCase());
          if (!isRealCwdEqual && !isRealInside) {
            return {
              valid: false,
              reason: `Symlink parent escape attempt blocked: "${relativePath}" traverses symlink outside workspace "${rootDir}".`,
            };
          }
          break;
        }
        parent = path.dirname(parent);
      }
    }
  } catch {
    // If realpathSync fails due to permissions, return valid: false to fail closed
    return { valid: false, reason: `Failed realpath verification for "${relativePath}".` };
  }

  return { valid: true, resolvedPath: resolved };
}

/**
 * Helper to parse a single line of `git status --porcelain` output into a clean relative path.
 * Handles renames (old -> new), paths with spaces, and quotes.
 */
export function parseGitPorcelainLine(line: string): string | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  if (trimmed.includes(" -> ")) {
    const parts = trimmed.split(" -> ");
    return parts[parts.length - 1].trim().replace(/^"|"$/g, "").replace(/\\/g, "/");
  }
  const rawPath = line.length > 3 ? line.slice(3).trim() : line.trim();
  const unquoted = rawPath.replace(/^"|"$/g, "");
  return unquoted.replace(/\\/g, "/");
}

/**
 * Query Git for dirty files (modified/untracked) using AEGIS's controlled terminal tool (`runCommand`).
 */
export async function getGitStatusDirtyFiles(
  workspace: string
): Promise<{ isGitRepo: boolean; dirtyFiles: string[] }> {
  if (!workspace || workspace.trim() === "") {
    return { isGitRepo: false, dirtyFiles: [] };
  }
  const absPath = path.resolve(workspace.trim());
  try {
    // Verify workspace itself is a Git repository root or contains .git via runCommand
    if (!fs.existsSync(path.join(absPath, ".git"))) {
      const revRes = await runCommand("git rev-parse --show-toplevel", {
        cwd: absPath,
        workspaceRoot: absPath,
        executionMode: "automatic",
        timeoutMs: 10_000,
        trusted: true,
        sandbox: "none",
      });
      if (!revRes.success || !revRes.stdout.trim()) {
        return { isGitRepo: false, dirtyFiles: [] };
      }
      const normTop = path.resolve(revRes.stdout.trim()).toLowerCase();
      const normAbs = absPath.toLowerCase();
      if (normTop !== normAbs) {
        return { isGitRepo: false, dirtyFiles: [] };
      }
    }

    const statusRes = await runCommand("git status --porcelain", {
      cwd: absPath,
      workspaceRoot: absPath,
      executionMode: "automatic",
      timeoutMs: 10_000,
      trusted: true,
      sandbox: "none",
    });
    if (!statusRes.success) {
      return { isGitRepo: false, dirtyFiles: [] };
    }

    const dirtyFiles: string[] = [];
    const lines = statusRes.stdout.split(/\r?\n/);
    for (const line of lines) {
      const parsed = parseGitPorcelainLine(line);
      if (parsed) {
        dirtyFiles.push(parsed);
      }
    }
    return { isGitRepo: true, dirtyFiles };
  } catch {
    return { isGitRepo: false, dirtyFiles: [] };
  }
}

/**
 * Capture pre-apply baseline information for proposed file paths and workspace Git status.
 */
export async function captureWorkspaceBaseline(
  workspace: string,
  proposedChanges: CodeChange[]
): Promise<WorkspaceBaseline> {
  const normWs = workspace.trim();
  const gitInfo = await getGitStatusDirtyFiles(normWs);
  const fileBaselines: Record<string, FileBaseline> = {};
  const preExistingHashes: Record<string, string> = {};

  if (normWs && fs.existsSync(normWs)) {
    // 1. Capture baselines for proposed changes
    for (const change of proposedChanges) {
      const normRel = change.path.replace(/\\/g, "/");
      const pathCheck = safeResolveWorkspacePath(normWs, normRel);

      if (
        pathCheck.valid &&
        pathCheck.resolvedPath &&
        fs.existsSync(pathCheck.resolvedPath) &&
        fs.statSync(pathCheck.resolvedPath).isFile()
      ) {
        try {
          const content = fs.readFileSync(pathCheck.resolvedPath, "utf-8");
          const hash = computeSHA256(content);
          fileBaselines[normRel] = {
            path: normRel,
            exists: true,
            content,
            hash,
          };
        } catch {
          fileBaselines[normRel] = {
            path: normRel,
            exists: false,
          };
        }
      } else {
        fileBaselines[normRel] = {
          path: normRel,
          exists: false,
        };
      }
    }

    // 2. Capture baseline hashes for pre-existing dirty files not in proposedChanges
    const proposedSet = new Set(proposedChanges.map((c) => c.path.replace(/\\/g, "/")));
    for (const dirtyRel of gitInfo.dirtyFiles) {
      const normRel = dirtyRel.replace(/\\/g, "/");
      if (!proposedSet.has(normRel)) {
        const pathCheck = safeResolveWorkspacePath(normWs, normRel);
        if (
          pathCheck.valid &&
          pathCheck.resolvedPath &&
          fs.existsSync(pathCheck.resolvedPath) &&
          fs.statSync(pathCheck.resolvedPath).isFile()
        ) {
          try {
            const content = fs.readFileSync(pathCheck.resolvedPath, "utf-8");
            preExistingHashes[normRel] = computeSHA256(content);
          } catch {}
        }
      }
    }
  }

  return {
    timestamp: Date.now(),
    workspace: normWs,
    isGitRepo: gitInfo.isGitRepo,
    preExistingDirtyFiles: gitInfo.dirtyFiles,
    preExistingHashes,
    fileBaselines,
  };
}

/**
 * Inspect post-apply workspace state and generate structured change evidence.
 */
export async function verifyWorkspaceChanges(
  workspace: string,
  proposedChanges: CodeChange[],
  baseline: WorkspaceBaseline
): Promise<WorkspaceChangeEvidence> {
  const normWs = workspace.trim();
  const fileEvidenceList: FileEvidence[] = [];
  const proposedPathsSet = new Set(proposedChanges.map((c) => c.path.replace(/\\/g, "/")));
  const preExistingSet = new Set(baseline.preExistingDirtyFiles);

  let allVerified = true;

  for (const change of proposedChanges) {
    const normRel = change.path.replace(/\\/g, "/");
    const pathCheck = safeResolveWorkspacePath(normWs, normRel);
    const base = baseline.fileBaselines[normRel] || { path: normRel, exists: false };
    const action: "add" | "modify" | "delete" =
      change.action === "add" ? "add" : change.action === "delete" ? "delete" : "modify";
    const expectedContent = change.content ?? "";
    const preExistingDirty = preExistingSet.has(normRel);

    if (!pathCheck.valid || !pathCheck.resolvedPath) {
      allVerified = false;
      fileEvidenceList.push({
        path: normRel,
        action,
        beforeExists: base.exists,
        afterExists: false,
        preExistingDirty,
        actuallyChanged: false,
        contentMatches: false,
        verified: false,
        classification: preExistingDirty ? "pre-existing" : "run-introduced",
        error: pathCheck.reason || `Path escape attempt blocked for ${normRel}`,
      });
      continue;
    }

    const fullPath = pathCheck.resolvedPath;

    let afterExists = false;
    let afterContent = "";
    let afterHash: string | undefined = undefined;

    if (normWs && fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
      try {
        afterExists = true;
        afterContent = fs.readFileSync(fullPath, "utf-8");
        afterHash = computeSHA256(afterContent);
      } catch {
        afterExists = false;
      }
    }

    let actuallyChanged = false;
    let contentMatches = false;
    let verified = false;
    let errorMsg: string | undefined = undefined;

    if (action === "delete") {
      actuallyChanged = base.exists && !afterExists;
      contentMatches = !afterExists;
      verified = contentMatches;
      if (!verified) {
        errorMsg = `File ${normRel} was expected to be deleted but still exists on disk.`;
      }
    } else if (action === "add") {
      // CASE B: Target file already existed before apply
      if (base.exists) {
        actuallyChanged = false;
        contentMatches = afterContent === expectedContent;
        verified = false;
        errorMsg = `File ${normRel} was expected to be created, but target file already existed on disk before apply.`;
      } else {
        actuallyChanged = !base.exists && afterExists;
        contentMatches = afterContent === expectedContent;
        verified = afterExists && contentMatches;
        if (!afterExists) {
          errorMsg = `File ${normRel} was expected to be created but does not exist on disk.`;
        } else if (!contentMatches) {
          errorMsg = `Content of created file ${normRel} does not match approved proposal.`;
        }
      }
    } else {
      // modify
      actuallyChanged = base.exists && afterHash !== base.hash;
      contentMatches = afterContent === expectedContent;
      verified = afterExists && contentMatches;
      if (!afterExists) {
        errorMsg = `File ${normRel} was expected to be modified but does not exist on disk.`;
      } else if (!contentMatches) {
        errorMsg = `Content of modified file ${normRel} does not match approved proposal.`;
      }
    }

    if (!verified) {
      allVerified = false;
    }

    const classification = preExistingDirty ? "pre-existing" : "run-introduced";

    fileEvidenceList.push({
      path: normRel,
      action,
      beforeExists: base.exists,
      afterExists,
      beforeHash: base.hash,
      afterHash,
      preExistingDirty,
      actuallyChanged,
      contentMatches,
      verified,
      classification,
      error: errorMsg,
    });
  }

  // Check post-apply git status for unexpected modifications outside proposal if in git repo
  const unexpectedChanges: string[] = [];
  if (baseline.isGitRepo && normWs) {
    const postGitInfo = await getGitStatusDirtyFiles(normWs);
    for (const dirtyFile of postGitInfo.dirtyFiles) {
      const normRel = dirtyFile.replace(/\\/g, "/");
      if (!proposedPathsSet.has(normRel)) {
        if (!preExistingSet.has(normRel)) {
          // Newly dirty file created/modified during apply
          unexpectedChanges.push(normRel);
        } else {
          // CASE C: Pre-existing dirty file modified AGAIN during apply window
          const pathCheck = safeResolveWorkspacePath(normWs, normRel);
          if (
            pathCheck.valid &&
            pathCheck.resolvedPath &&
            fs.existsSync(pathCheck.resolvedPath) &&
            fs.statSync(pathCheck.resolvedPath).isFile()
          ) {
            try {
              const currentContent = fs.readFileSync(pathCheck.resolvedPath, "utf-8");
              const currentHash = computeSHA256(currentContent);
              const originalBaselineHash = baseline.preExistingHashes[normRel];
              if (originalBaselineHash && currentHash !== originalBaselineHash) {
                unexpectedChanges.push(`${normRel} (modified during apply window)`);
              }
            } catch {}
          }
        }
      }
    }
  }

  return {
    timestamp: Date.now(),
    workspace: normWs,
    isGitRepo: baseline.isGitRepo,
    preExistingDirtyFiles: baseline.preExistingDirtyFiles,
    fileEvidence: fileEvidenceList,
    unexpectedChanges,
    allVerified,
  };
}

export interface BaselineConflict {
  path: string;
  expectedHash?: string;
  actualHash?: string;
  reason: string;
}

export function checkApprovalBaselineConflicts(
  workspace: string,
  proposedChanges: CodeChange[],
  approvalBaseline: WorkspaceBaseline
): BaselineConflict[] {
  const normWs = workspace.trim();
  const conflicts: BaselineConflict[] = [];

  // Fail-closed if baseline is missing or corrupt
  if (!approvalBaseline || typeof approvalBaseline !== "object" || !approvalBaseline.fileBaselines) {
    return [{
      path: ".",
      reason: "Missing or corrupt approval baseline evidence (fail-closed)",
    }];
  }

  // A protected approval without a workspace identity cannot be safely resumed.
  if (typeof approvalBaseline.workspace !== "string" || !approvalBaseline.workspace.trim()) {
    return [{ path: ".", reason: "Approval baseline is missing workspace identity (fail-closed)" }];
  }
  try {
    const canonicalBaseline = fs.realpathSync(approvalBaseline.workspace);
    const canonicalCurrent = fs.realpathSync(normWs);
    const comparable = (value: string) => process.platform === "win32" ? value.toLowerCase() : value;
    if (comparable(canonicalBaseline) !== comparable(canonicalCurrent)) {
      return [{ path: ".", reason: "Approval baseline workspace does not match active workspace" }];
    }
  } catch {
    return [{ path: ".", reason: "Could not resolve approval workspace identity (fail-closed)" }];
  }

  for (const change of proposedChanges) {
    const normRel = change.path.replace(/\\/g, '/');
    const baseline = approvalBaseline.fileBaselines[normRel];
    if (!baseline || typeof baseline !== "object") {
      conflicts.push({
        path: normRel,
        reason: 'Missing approval baseline entry for proposed change (fail-closed)',
      });
      continue;
    }

    if (baseline.exists && (!baseline.hash || typeof baseline.hash !== "string")) {
      conflicts.push({
        path: normRel,
        reason: 'Corrupt approval baseline: expected hash missing for existing file (fail-closed)',
      });
      continue;
    }

    const pathCheck = safeResolveWorkspacePath(normWs, normRel);
    if (!pathCheck.valid || !pathCheck.resolvedPath) {
      conflicts.push({
        path: normRel,
        reason: pathCheck.reason || 'Invalid workspace path',
      });
      continue;
    }

    // Check for symlink substitution
    try {
      const lstat = fs.lstatSync(pathCheck.resolvedPath);
      if (lstat.isSymbolicLink()) {
        conflicts.push({
          path: normRel,
          reason: `Symlink substitution detected: "${normRel}" is a symbolic link.`,
        });
        continue;
      }
    } catch {
      // file might not exist yet on disk
    }

    const currentExists = fs.existsSync(pathCheck.resolvedPath);
    if (currentExists) {
      try {
        const stat = fs.statSync(pathCheck.resolvedPath);
        if (!stat.isFile()) {
          conflicts.push({
            path: normRel,
            reason: `Target "${normRel}" is not a regular file on disk.`,
          });
          continue;
        }
      } catch (statErr: any) {
        conflicts.push({
          path: normRel,
          reason: `Failed to stat target file: ${statErr.message}`,
        });
        continue;
      }
    }

    if (baseline.exists !== currentExists) {
      conflicts.push({
        path: normRel,
        reason: baseline.exists
          ? 'File was deleted on disk after approval was requested'
          : 'File was created on disk after approval was requested',
      });
      continue;
    }

    if (baseline.exists && currentExists) {
      try {
        const currentContent = fs.readFileSync(pathCheck.resolvedPath, 'utf-8');
        const currentHash = computeSHA256(currentContent);
        if (baseline.hash && currentHash !== baseline.hash) {
          conflicts.push({
            path: normRel,
            expectedHash: baseline.hash,
            actualHash: currentHash,
            reason: 'File content was modified on disk after approval was requested (expected hash ' + baseline.hash.slice(0, 8) + ', found ' + currentHash.slice(0, 8) + ')',
          });
        }
      } catch (err) {
        conflicts.push({
          path: normRel,
          reason: 'Failed to read file for baseline revalidation: ' + (err as Error).message,
        });
      }
    }
  }

  return conflicts;
}
