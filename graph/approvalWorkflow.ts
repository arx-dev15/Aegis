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
import { requiresApproval, createApprovalRequest } from "./edges/approvalGate.js";
import { ApprovalRequest, ApprovalDecision } from "./approvalTypes.js";

// ── In-memory active runs registry for approval runtime ──────────────────────

interface ActiveRun {
  runId: string;
  state: AegisState;
  pendingApproval: ApprovalRequest | null;
  history: AegisState[];
}

class ApprovalRuntime {
  private activeRuns: Map<string, ActiveRun> = new Map();
  private checkpointer = new MemorySaver();

  public getRun(runId: string): ActiveRun | null {
    return this.activeRuns.get(runId) || null;
  }

  public registerRun(runId: string, initialState: AegisState): ActiveRun {
    const run: ActiveRun = {
      runId,
      state: initialState,
      pendingApproval: null,
      history: [initialState],
    };
    this.activeRuns.set(runId, run);
    return run;
  }

  public updateRunState(runId: string, newState: AegisState): void {
    const run = this.activeRuns.get(runId);
    if (run) {
      run.state = newState;
      run.pendingApproval = newState.pendingApproval;
      run.history.push(newState);
    }
  }

  public clear(): void {
    this.activeRuns.clear();
  }
}

export const approvalRuntime = new ApprovalRuntime();

// ── Custom Approval Nodes ───────────────────────────────────────────────────

/**
 * Gate node inspecting state before Developer execution.
 * Checks if code changes require human approval.
 * If required and no approval decision exists, sets status: "paused" and creates pendingApproval.
 */
export async function approvalCheckNode(state: AegisState): Promise<AegisStateUpdate> {
  const runId = state.runId || "default_run";
  const hasCodeChanges = state.codeChanges && state.codeChanges.length > 0;
  const isMutating = hasCodeChanges || (state.workspace && state.workspace.length > 0);

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
    executionMode: "semi-auto",
    isMutating: Boolean(isMutating),
  });

  if (needsAppr) {
    const req = createApprovalRequest({
      runId,
      type: "code-review",
      action: "write_file",
      title: `Approve code changes for: ${state.task}`,
      description: `Developer proposes ${state.codeChanges.length} file change(s).`,
      target: state.codeChanges.map((c) => c.path).join(", "),
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
 * Rejection handling node executed when human decision is "reject".
 * Skips file changes, logs human refusal, and cleanly terminates/routes without side effects.
 */
export async function rejectionNode(state: AegisState): Promise<AegisStateUpdate> {
  const reason = state.approvalDecision?.reason || "Human reviewer rejected proposed action.";

  return {
    status: "completed",
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
  return "developerNode";
}

// ── Graph Builder ─────────────────────────────────────────────────────────────

export function buildApprovalWorkflow(customNodes?: {
  planner?: any;
  researcher?: any;
  architect?: any;
  approvalCheck?: any;
  developer?: any;
  rejection?: any;
}) {
  const planner = customNodes?.planner ?? plannerNode;
  const researcher = customNodes?.researcher ?? researcherNode;
  const architect = customNodes?.architect ?? architectNode;
  const approvalCheck = customNodes?.approvalCheck ?? approvalCheckNode;
  const developer = customNodes?.developer ?? createDeveloperNode();
  const rejection = customNodes?.rejection ?? rejectionNode;

  const workflow = new StateGraph(AegisStateAnnotation)
    .addNode("planner", planner)
    .addNode("researcher", researcher)
    .addNode("architect", architect)
    .addNode("approvalCheck", approvalCheck)
    .addNode("developer", developer)
    .addNode("rejection", rejection)
    .addEdge(START, "planner")
    .addEdge("planner", "researcher")
    .addEdge("researcher", "architect")
    .addEdge("architect", "approvalCheck")
    .addConditionalEdges("approvalCheck", routeAfterApprovalCheck, {
      developerNode: "developer",
      rejectionNode: "rejection",
      [END]: END,
    })
    .addEdge("developer", END)
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

  const decision: ApprovalDecision = {
    approvalId,
    action,
    reason,
    decidedAt: Date.now(),
  };

  const updatedState: Partial<AegisState> = {
    ...(currentRun?.state || {}),
    runId,
    approvalDecision: decision,
    pendingApproval: null,
  };

  // Resume workflow from checkpoint with decision attached
  const resultState = await workflowInstance.invoke(updatedState as AegisState, threadConfig);
  approvalRuntime.updateRunState(runId, resultState as AegisState);

  return resultState as AegisState;
}
