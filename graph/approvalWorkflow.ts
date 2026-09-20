/**
 * graph/approvalWorkflow.ts
 *
 * Feature 23 — Human-in-the-Loop
 *
 * Approval-aware LangGraph workflow engine with MemorySaver checkpointing,
 * graph interruption on approval gates, and decision resolution (approve/reject).
 */

import { StateGraph, START, END, MemorySaver } from "@langchain/langgraph";
import { AegisStateAnnotation, AegisState, AegisStateUpdate } from "./state.js";
import { plannerNode } from "./nodes/plannerNode.js";
import { researcherNode } from "./nodes/researcherNode.js";
import { architectNode } from "./nodes/architectNode.js";
import { createDeveloperNode } from "./nodes/developerNode.js";
import { createTesterNode } from "./nodes/testerNode.js";
import { createReviewerNode } from "./nodes/reviewerNode.js";
import { recoveryNode } from "./nodes/recoveryNode.js";
import { requiresApproval, createApprovalRequest } from "./edges/approvalGate.js";
import { ApprovalRequest, ApprovalDecision } from "./approvalTypes.js";
import { writeFile, deleteFile } from "../tools/filesystem/index.js";

// ── In-memory active runs registry for approval runtime ──────────────────────

import fs from "fs";
import path from "path";

interface ActiveRun {
  runId: string;
  state: AegisState;
  pendingApproval: ApprovalRequest | null;
  history: AegisState[];
}

class ApprovalRuntime {
  private activeRuns: Map<string, ActiveRun> = new Map();

  private getRunsDir(): string {
    const dir = path.resolve(process.cwd(), ".aegis", "runs");
    try {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    } catch {}
    return dir;
  }

  private getRunFilePath(runId: string): string {
    const safeId = runId.replace(/[^a-zA-Z0-9_-]/g, "_");
    return path.join(this.getRunsDir(), `${safeId}.json`);
  }

  public getRun(runId: string): ActiveRun | null {
    if (this.activeRuns.has(runId)) {
      return this.activeRuns.get(runId)!;
    }
    return this.loadRunFromDisk(runId);
  }

  public loadRunFromDisk(runId: string): ActiveRun | null {
    try {
      const filePath = this.getRunFilePath(runId);
      if (fs.existsSync(filePath)) {
        const raw = fs.readFileSync(filePath, "utf-8");
        const parsed = JSON.parse(raw) as ActiveRun;
        if (parsed && parsed.runId) {
          this.activeRuns.set(runId, parsed);
          return parsed;
        }
      }
    } catch {}
    return null;
  }

  public registerRun(runId: string, initialState: AegisState): ActiveRun {
    const run: ActiveRun = {
      runId,
      state: initialState,
      pendingApproval: initialState.pendingApproval || null,
      history: [initialState],
    };
    this.activeRuns.set(runId, run);
    this.persistRunToDisk(run);
    return run;
  }

  public updateRunState(runId: string, newState: AegisState): void {
    let run = this.activeRuns.get(runId) || this.loadRunFromDisk(runId);
    if (!run) {
      run = {
        runId,
        state: newState,
        pendingApproval: newState.pendingApproval || null,
        history: [newState],
      };
    } else {
      run.state = newState;
      run.pendingApproval = newState.pendingApproval || null;
      run.history.push(newState);
    }
    this.activeRuns.set(runId, run);
    this.persistRunToDisk(run);
  }

  public persistRunToDisk(run: ActiveRun): void {
    try {
      const filePath = this.getRunFilePath(run.runId);
      fs.writeFileSync(filePath, JSON.stringify(run, null, 2), "utf-8");
    } catch {}
  }

  public clear(): void {
    this.activeRuns.clear();
  }
}

export const approvalRuntime = new ApprovalRuntime();

// ── Custom Approval Nodes ───────────────────────────────────────────────────

/**
 * Gate node inspecting state after Developer proposal generation.
 * Checks if proposed code changes require human approval.
 * If required and no approval decision exists, sets status: "paused" and creates pendingApproval.
 */
export async function approvalCheckNode(state: AegisState): Promise<AegisStateUpdate> {
  const runId = state.runId || "default_run";
  const hasCodeChanges = state.codeChanges && state.codeChanges.length > 0;
  const isMutating = hasCodeChanges || Boolean(state.workspace && state.workspace.length > 0);

  // If we already have an approval decision, proceed
  if (state.approvalDecision) {
    if (state.approvalDecision.action === "approve") {
      return { status: "developing" };
    } else {
      return { status: "paused" }; // Router will send to rejectionNode
    }
  }

  // Check policy if approval is required
  const needsAppr = requiresApproval("write_file", {
    executionMode: state.executionMode || "semi-auto",
    isMutating: Boolean(isMutating),
  });

  if (needsAppr) {
    const changeCount = state.codeChanges?.length ?? 0;
    const changeSummaries = (state.codeChanges ?? [])
      .map((c) => {
        const actionLabel = c.action === "add" ? "CREATE" : c.action.toUpperCase();
        const summaryPart = c.summary ? `: ${c.summary}` : "";
        return `- ${actionLabel} ${c.path}${summaryPart}`;
      })
      .join("\n");

    const description =
      changeCount > 0
        ? `Developer proposes ${changeCount} file change(s):\n${changeSummaries}`
        : `Developer proposes operations on workspace "${state.workspace}".`;

    const target =
      state.codeChanges && state.codeChanges.length > 0
        ? state.codeChanges.map((c) => c.path).join(", ")
        : state.workspace;

    const req = createApprovalRequest({
      runId,
      type: "code-review",
      action: "write_file",
      title: `Approve code changes for: ${state.task}`,
      description,
      target,
      riskLevel: "high",
      requestedBy: "developerNode",
    });

    return {
      status: "paused",
      pendingApproval: req,
      executionLog: [`[HUMAN-APPROVAL-GATE] Execution paused for run ${runId}. Created ApprovalRequest ${req.id}.`],
    };
  }

  return { status: "developing" };
}

/**
 * Node executed after approval to apply exact proposed file changes to disk.
 * Uses existing safe filesystem tools (writeFile, deleteFile) with zero LLM calls.
 */
export async function applyProposalNode(state: AegisState): Promise<AegisStateUpdate> {
  const executionLog: string[] = [];

  if (!state.codeChanges || state.codeChanges.length === 0) {
    executionLog.push("[DEV-APPLY] No proposed file changes to apply.");
    return { status: "developing", executionLog };
  }

  if (!state.workspace || state.workspace.trim() === "") {
    executionLog.push("[DEV-APPLY] Workspace is empty (simulation mode). Skipping physical disk writes.");
    return { status: "developing", executionLog };
  }

  const workspace = state.workspace.trim();
  const mode = state.executionMode || "semi-auto";
  executionLog.push(`[DEV-APPLY] Applying ${state.codeChanges.length} approved file change(s) to ${workspace} (mode: ${mode})...`);

  for (const change of state.codeChanges) {
    try {
      if (change.action === "delete") {
        const del = await deleteFile(workspace, change.path, { executionMode: mode, isApproved: true });
        executionLog.push(
          `[DEV-APPLY] DELETE ${change.path} → ${del.deleted ? "deleted" : "not found (ok)"}`
        );
      } else {
        const content = change.content ?? "";
        const write = await writeFile(workspace, change.path, content, { executionMode: mode, isApproved: true });
        executionLog.push(
          `[DEV-APPLY] WRITE ${change.path} → ${write.bytesWritten} bytes written`
        );
      }
    } catch (err) {
      const errMsg = (err as Error).message;
      executionLog.push(`[DEV-APPLY] ERROR on ${change.path}: ${errMsg}`);
      return {
        status: "failed",
        errors: [`Failed to apply approved proposal change to ${change.path}: ${errMsg}`],
        executionLog,
      };
    }
  }

  return { status: "developing", executionLog };
}

/**
 * Rejection handling node executed when human decision is "reject".
 * Skips file changes, logs human refusal, and cleanly terminates/routes without side effects.
 */
export async function rejectionNode(state: AegisState): Promise<AegisStateUpdate> {
  const reason = state.approvalDecision?.reason || "Human reviewer rejected proposed action.";

  return {
    status: "failed",
    pendingApproval: null,
    executionLog: [
      `[HUMAN-APPROVAL-REJECTED] Action rejected by human reviewer. Reason: "${reason}". Protected changes skipped safely.`,
    ],
    errors: [`Action rejected by human reviewer: ${reason}`],
  };
}

// ── Routing Edges ─────────────────────────────────────────────────────────────

export function routeAfterApprovalCheck(state: AegisState): string {
  if (state.status === "paused") {
    if (state.approvalDecision && state.approvalDecision.action === "reject") {
      return "rejectionNode";
    }
    return END; // Pauses graph execution cleanly
  }
  return "applyProposalNode";
}

export function routeAfterApplyProposal(state: AegisState): string {
  if (state.status === "failed") {
    return END;
  }
  return "testerNode";
}

/**
 * After tester runs, route based on result:
 *   - Tests passed → reviewerNode
 *   - Tests failed and retries remain → recoveryNode
 *   - Tests failed and retries exhausted → END (with failed status)
 */
function approvalRouteAfterTester(state: AegisState): string {
  if (state.testResults && state.testResults.passed) {
    return "reviewerNode";
  }
  // Tests failed — check retry budget
  if ((state.retryCount ?? 0) < (state.maxRetries ?? 3)) {
    return "recoveryNode";
  }
  return END; // Exhausted retries
}

/**
 * After reviewer runs, route based on result:
 *   - Approved → END (workflow complete)
 *   - Rejected and retries remain → recoveryNode
 *   - Rejected and retries exhausted → END
 */
function approvalRouteAfterReviewer(state: AegisState): string {
  if (state.reviewResults && state.reviewResults.approved) {
    return END;
  }
  if ((state.retryCount ?? 0) < (state.maxRetries ?? 3)) {
    return "recoveryNode";
  }
  return END;
}

// ── Graph Builder ─────────────────────────────────────────────────────────────

export function buildApprovalWorkflow(customNodes?: {
  planner?: any;
  researcher?: any;
  architect?: any;
  approvalCheck?: any;
  developer?: any;
  applyProposal?: any;
  tester?: any;
  reviewer?: any;
  recovery?: any;
  rejection?: any;
}) {
  const planner = customNodes?.planner ?? plannerNode;
  const researcher = customNodes?.researcher ?? researcherNode;
  const architect = customNodes?.architect ?? architectNode;
  const approvalCheck = customNodes?.approvalCheck ?? approvalCheckNode;
  const developer = customNodes?.developer ?? createDeveloperNode();
  const applyProposal = customNodes?.applyProposal ?? applyProposalNode;
  const tester = customNodes?.tester ?? createTesterNode();
  const reviewer = customNodes?.reviewer ?? createReviewerNode();
  const recovery = customNodes?.recovery ?? recoveryNode;
  const rejection = customNodes?.rejection ?? rejectionNode;

  const workflow = new StateGraph(AegisStateAnnotation)
    .addNode("planner", planner)
    .addNode("researcher", researcher)
    .addNode("architect", architect)
    .addNode("developerNode", developer)
    .addNode("approvalCheck", approvalCheck)
    .addNode("applyProposalNode", applyProposal)
    .addNode("testerNode", tester)
    .addNode("reviewerNode", reviewer)
    .addNode("recoveryNode", recovery)
    .addNode("rejection", rejection)
    .addEdge(START, "planner")
    .addEdge("planner", "researcher")
    .addEdge("researcher", "architect")
    .addEdge("architect", "developerNode")
    .addEdge("developerNode", "approvalCheck")
    .addConditionalEdges("approvalCheck", routeAfterApprovalCheck, {
      applyProposalNode: "applyProposalNode",
      rejectionNode: "rejection",
      [END]: END,
    })
    .addConditionalEdges("applyProposalNode", routeAfterApplyProposal, {
      testerNode: "testerNode",
      [END]: END,
    })
    .addConditionalEdges("testerNode", approvalRouteAfterTester, {
      reviewerNode: "reviewerNode",
      recoveryNode: "recoveryNode",
      [END]: END,
    })
    .addConditionalEdges("reviewerNode", approvalRouteAfterReviewer, {
      recoveryNode: "recoveryNode",
      [END]: END,
    })
    .addEdge("recoveryNode", "developerNode") // retry loop: recovery → developer → approvalCheck → applyProposal → tester → reviewer
    .addEdge("rejection", END);

  return workflow.compile({ checkpointer: new MemorySaver() });
}

export const approvalWorkflow = buildApprovalWorkflow();

// ── Execution Helpers ─────────────────────────────────────────────────────────

/**
 * Execute an approval-aware graph run up to completion or pause.
 */
export async function executeApprovalWorkflow(
  runId: string,
  initialState: Partial<AegisState>,
  workflowInstance = approvalWorkflow
): Promise<AegisState> {
  const threadConfig = { configurable: { thread_id: runId } };

  const fullState: AegisState = {
    task: initialState.task || "",
    plan: initialState.plan || [],
    research: initialState.research || "",
    architecture: initialState.architecture || "",
    codeChanges: initialState.codeChanges || [],
    testResults: initialState.testResults || null,
    reviewResults: initialState.reviewResults || null,
    errors: initialState.errors || [],
    status: initialState.status || "idle",
    retryCount: initialState.retryCount || 0,
    maxRetries: initialState.maxRetries || 3,
    workspace: initialState.workspace || "",
    executionLog: initialState.executionLog || [],
    recoveryContext: initialState.recoveryContext || [],
    runId: runId,
    memoryContext: initialState.memoryContext || "",
    pendingApproval: initialState.pendingApproval || null,
    approvalDecision: initialState.approvalDecision || null,
    executionMode: initialState.executionMode || "semi-auto",
  };

  approvalRuntime.registerRun(runId, fullState);

  const resultState = await workflowInstance.invoke(fullState, threadConfig);
  approvalRuntime.updateRunState(runId, resultState as AegisState);

  return resultState as AegisState;
}

/**
 * Resolve a pending approval decision (approve or reject) and resume execution from checkpoint.
 */
export async function resolveApprovalAndResume(
  runId: string,
  approvalId: string,
  action: "approve" | "reject",
  reason?: string,
  workflowInstance = approvalWorkflow
): Promise<AegisState> {
  const threadConfig = { configurable: { thread_id: runId } };
  const currentRun = approvalRuntime.getRun(runId);

  if (!currentRun || !currentRun.state || !currentRun.state.task) {
    throw new Error(`Run state for runId "${runId}" not found or empty on disk. Cannot resume approval workflow.`);
  }

  const decision: ApprovalDecision = {
    approvalId,
    action,
    reason,
    decidedAt: Date.now(),
  };

  const updatedState: AegisState = {
    ...currentRun.state,
    runId,
    approvalDecision: decision,
    pendingApproval: null,
  };

  // Resume workflow from checkpoint with decision attached
  const resultState = await workflowInstance.invoke(updatedState, threadConfig);
  approvalRuntime.updateRunState(runId, resultState as AegisState);

  return resultState as AegisState;
}
