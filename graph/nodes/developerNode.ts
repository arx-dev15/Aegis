/**
 * graph/nodes/developerNode.ts
 *
 * Feature 12 (upgraded in Feature 16, Feature 18) — Developer Agent LangGraph Node
 *
 * Two-phase execution:
 *
 *   Phase 1 — LLM Planning:
 *     DeveloperAgent uses Gemini to generate a structured implementation plan
 *     (fileChanges: path, action, content, summary).
 *
 *     Feature 18: When state.recoveryContext is non-empty, the latest failure
 *     context is formatted and passed to the Developer so it knows precisely
 *     what to repair on this retry.
 *
 *   Phase 2 — Real Tool Execution:
 *     If state.workspace is set, actually write/delete the files using the
 *     filesystem tool. Records each operation in state.executionLog.
 *
 * When workspace is empty (test / simulation mode), Phase 2 is skipped —
 * all existing tests continue to pass without modification.
 */

import type { AegisState, AegisStateUpdate, CodeChange, RecoveryContext } from "../state.js";
import { DeveloperAgent } from "../../agents/developer/developer.js";
import { memoryManager } from "../../memory/memoryManager.js";
import {
  readFile,
  writeFile,
  deleteFile,
} from "../../tools/filesystem/index.js";
import {
  findMatchingRepoSnapshot,
  queryRepositoryIntelligence,
} from "../../repo-intelligence/retrieval/hybridRetriever.js";

/**
 * Format the latest RecoveryContext into a human-readable string for the Developer.
 * Returns undefined when there is no recovery history (first attempt).
 */
function formatRecoveryContext(recoveryContext: RecoveryContext[]): string | undefined {
  if (!recoveryContext || recoveryContext.length === 0) return undefined;

  const latest = recoveryContext[recoveryContext.length - 1]!;

  const lines = [
    `Failing agent: ${latest.failingAgent}`,
    `Reason: ${latest.reason}`,
    `Attempt: ${latest.attemptNumber}`,
  ];

  if (latest.details.length > 0) {
    lines.push("Details:");
    latest.details.forEach((d) => lines.push(`  - ${d}`));
  }

  return lines.join("\n");
}

/**
 * Discover relevant target file paths using Repository Intelligence or task path hints,
 * read their current source contents from workspace using safe readFile(),
 * and format a bounded context block (max 5 files, 30KB total budget).
 */
export async function discoverAndReadExistingCode(
  workspace: string,
  task: string,
  architecture: string,
  executionLog: string[]
): Promise<string | undefined> {
  if (!workspace || workspace.trim() === "") {
    return undefined;
  }

  const normalizedWs = workspace.trim();
  const candidates: string[] = [];

  try {
    const snapshot = await findMatchingRepoSnapshot(normalizedWs);
    if (snapshot) {
      executionLog.push(`[DEV-INSPECT] Resolved Repository Snapshot: "${snapshot.repository.name}" (${snapshot.repository.id})`);
      const searchRes = await queryRepositoryIntelligence({
        snapshot,
        query: `${task} ${architecture}`,
        mode: "structural",
      });

      if (searchRes.symbols.length > 0) {
        searchRes.symbols.forEach((s) => candidates.push(s.filePath));
      }
      if (searchRes.apis.length > 0) {
        searchRes.apis.forEach((a) => candidates.push(a.filePath));
      }
      if (searchRes.evidence.length > 0) {
        searchRes.evidence.forEach((e) => candidates.push(e.filePath));
      }
      if (searchRes.impactReport?.resolvedSymbol?.file) {
        candidates.push(searchRes.impactReport.resolvedSymbol.file);
      }
      if (searchRes.impactReport?.directDependents) {
        searchRes.impactReport.directDependents.forEach((d) => candidates.push(d.file));
      }
    } else {
      executionLog.push(`[DEV-INSPECT] No pre-indexed Repository Snapshot found for workspace.`);
    }
  } catch (err) {
    executionLog.push(`[DEV-INSPECT] Repository Intelligence query warning: ${(err as Error).message}`);
  }

  // Fallback path discovery via regex over task and architecture text if no snapshot candidates
  if (candidates.length === 0) {
    const textToScan = `${task}\n${architecture}`;
    const pathMatches = textToScan.match(/\b([a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)*\.(?:ts|tsx|js|jsx|json|py|md|sql|txt))\b/gi);
    if (pathMatches) {
      pathMatches.forEach((p) => candidates.push(p));
    }
  }

  // Deduplicate and filter out lockfiles, node_modules, and git internals
  const uniqueCandidates = Array.from(new Set(candidates)).filter((p) => {
    const lower = p.toLowerCase();
    return (
      !lower.includes("node_modules") &&
      !lower.includes(".git") &&
      !lower.includes("package-lock.json") &&
      !lower.includes("pnpm-lock") &&
      !lower.includes("yarn.lock") &&
      !lower.endsWith(".snapshot.json")
    );
  }).slice(0, 5); // Bounded limit: max 5 files

  if (uniqueCandidates.length === 0) {
    executionLog.push(`[DEV-INSPECT] No candidate relevant existing files identified.`);
    return undefined;
  }

  executionLog.push(`[DEV-INSPECT] Discovered ${uniqueCandidates.length} candidate relevant file(s): ${uniqueCandidates.join(", ")}`);

  const fileBlocks: string[] = [];
  let totalBytes = 0;
  const MAX_TOTAL_BYTES = 30_720; // Bounded budget: 30 KB max

  for (const relPath of uniqueCandidates) {
    if (totalBytes >= MAX_TOTAL_BYTES) {
      executionLog.push(`[DEV-INSPECT] Source context budget limit (30KB) reached. Skipping remaining candidate files.`);
      break;
    }

    try {
      const readRes = await readFile(normalizedWs, relPath);
      if (readRes.exists && readRes.content.trim().length > 0) {
        let content = readRes.content;
        const fileByteLen = Buffer.byteLength(content, "utf-8");

        if (totalBytes + fileByteLen > MAX_TOTAL_BYTES) {
          const allowedBytes = MAX_TOTAL_BYTES - totalBytes;
          content = content.slice(0, allowedBytes) + "\n\n[... TRUNCATED TO FIT 30KB BUDGET ...]";
          totalBytes = MAX_TOTAL_BYTES;
          executionLog.push(`[DEV-INSPECT] Read ${relPath} (partially truncated to fit 30KB budget)`);
        } else {
          totalBytes += fileByteLen;
          executionLog.push(`[DEV-INSPECT] Read ${relPath} (${fileByteLen} bytes)`);
        }

        fileBlocks.push(`--- File: ${relPath} ---\n${content}`);
      } else if (!readRes.exists) {
        executionLog.push(`[DEV-INSPECT] Skipped missing/stale candidate file: ${relPath}`);
      }
    } catch (readErr) {
      executionLog.push(`[DEV-INSPECT] Error reading candidate ${relPath}: ${(readErr as Error).message}`);
    }
  }

  if (fileBlocks.length === 0) {
    return undefined;
  }

  return fileBlocks.join("\n\n");
}

/**
 * Creates a developer node using a provided DeveloperAgent instance or defaults to standard DeveloperAgent.
 */
export function createDeveloperNode(agent?: DeveloperAgent) {
  const developer = agent ?? new DeveloperAgent();

  return async function developerNode(state: AegisState): Promise<AegisStateUpdate> {
    if (!state.task || state.task.trim() === "") {
      return {
        status: "failed",
        errors: ["Task input is empty in developer node"],
      };
    }

    try {
      const executionLog: string[] = [];

      // ── Phase 1: Grounding & LLM implementation plan generation ──────────
      const recoveryCtx = formatRecoveryContext(state.recoveryContext ?? []);
      const memoryContext = state.memoryContext || (state.runId ? memoryManager.getFormattedMemoryContext({ runId: state.runId }) : "");
      const baseArch = memoryContext ? `${state.architecture}\n\n${memoryContext}`.trim() : state.architecture;

      // Inspect & read existing workspace source files before LLM generation
      const existingCodeContext = await discoverAndReadExistingCode(
        state.workspace ?? "",
        state.task,
        baseArch,
        executionLog
      );

      const result = await developer.develop(state.task, baseArch, recoveryCtx, existingCodeContext);

      if (state.runId) {
        memoryManager.shortTerm.set(
          state.runId,
          "developer_summary",
          `Generated ${result.fileChanges.length} file changes`,
          "step_note"
        );
      }

      const newCodeChanges: CodeChange[] = result.fileChanges.map((fc) => ({
        path: fc.path,
        action: fc.action,
        summary: fc.summary,
        content: fc.content,
      }));

      // ── Phase 2: Real file execution (only when workspace is configured) ──
      if (state.workspace && state.workspace.trim() !== "") {
        const workspace = state.workspace.trim();
        const toolOptions = state.approvalDecision?.action === "approve" ? { executionMode: "automatic" as const } : undefined;

        for (const change of result.fileChanges) {
          try {
            if (change.action === "delete") {
              const del = await deleteFile(workspace, change.path, toolOptions);
              executionLog.push(
                `[DEV-TOOL] DELETE ${change.path} → ${del.deleted ? "deleted" : "not found (ok)"}`
              );
            } else {
              // "add" or "modify" — write the file
              const content = change.content ?? "";
              const write = await writeFile(workspace, change.path, content, toolOptions);
              executionLog.push(
                `[DEV-TOOL] WRITE ${change.path} → ${write.bytesWritten} bytes written`
              );
            }
          } catch (toolErr) {
            // A tool error does not abort the whole workflow — log it
            executionLog.push(
              `[DEV-TOOL] ERROR on ${change.path}: ${(toolErr as Error).message}`
            );
          }
        }
      }

      return {
        status: "developing",
        codeChanges: newCodeChanges,
        executionLog,
      };
    } catch (err) {
      return {
        status: "failed",
        errors: [(err as Error).message],
      };
    }
  };
}

/**
 * Default Developer Agent node function for standard graph workflows.
 */
export const developerNode = createDeveloperNode();
