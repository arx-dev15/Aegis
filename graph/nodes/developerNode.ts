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
  writeFile,
  deleteFile,
} from "../../tools/filesystem/index.js";

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
      // ── Phase 1: LLM generates the implementation plan ───────────────────
      // Feature 18: extract recovery context so Developer knows what to fix on retry
      const recoveryCtx = formatRecoveryContext(state.recoveryContext ?? []);
      const memoryContext = state.memoryContext || (state.runId ? memoryManager.getFormattedMemoryContext({ runId: state.runId }) : "");
      const baseArch = memoryContext ? `${state.architecture}\n\n${memoryContext}`.trim() : state.architecture;

      const result = await developer.develop(state.task, baseArch, recoveryCtx);

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

      const executionLog: string[] = [];

      // ── Phase 2: Real file execution (only when workspace is configured) ──
      if (state.workspace && state.workspace.trim() !== "") {
        const workspace = state.workspace.trim();

        for (const change of result.fileChanges) {
          try {
            if (change.action === "delete") {
              const del = await deleteFile(workspace, change.path);
              executionLog.push(
                `[DEV-TOOL] DELETE ${change.path} → ${del.deleted ? "deleted" : "not found (ok)"}`
              );
            } else {
              // "add" or "modify" — write the file
              const content = change.content ?? "";
              const write = await writeFile(workspace, change.path, content);
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
