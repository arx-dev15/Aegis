/**
 * graph/approvalWorkflow.ts
 *
 * Feature 23 — Human-in-the-Loop
 *
 * Approval-aware LangGraph workflow engine with MemorySaver checkpointing,
 * graph interruption on approval gates, and decision resolution (approve/reject).
 */

import { StateGraph, START, END, MemorySaver } from "@langchain/langgraph";
import { AegisStateAnnotation, AegisState, AegisStateUpdate, CodeChange, VerificationRecord, RepairAttemptRecord } from "./state.js";
import { plannerNode } from "../workflows/nodes/plannerNode.js";
import { researcherNode } from "../workflows/nodes/researcherNode.js";
import { architectNode } from "../workflows/nodes/architectNode.js";
import { createDeveloperNode } from "../workflows/nodes/developerNode.js";
import { createTesterNode } from "../workflows/nodes/testerNode.js";
import { createReviewerNode } from "../workflows/nodes/reviewerNode.js";
import { recoveryNode } from "../workflows/nodes/recoveryNode.js";
import { requiresApproval, createApprovalRequest } from "../workflows/edges/approvalGate.js";
export { requiresApproval, createApprovalRequest };
import { ApprovalRequest, ApprovalDecision } from "./approvalTypes.js";
import { writeFile, deleteFile } from "../tools/filesystem/index.js";
import { captureWorkspaceBaseline, verifyWorkspaceChanges, WorkspaceBaseline, checkApprovalBaselineConflicts, safeResolveWorkspacePath } from "../verification/changeEvidence.js";

// ── In-memory active runs registry for approval runtime ──────────────────────

import fs from "fs";
import crypto from "crypto";
import path from "path";
import { abortRunningCommand } from "../tools/terminal/index.js";

export interface ActiveRun {
  version: 1;
  runId: string;
  state: AegisState;
  pendingApproval: ApprovalRequest | null;
  history: AegisState[];
  events: RunEvent[];
  nativeAgent?: NativeAgentRunRecord;
  executionKind?: "WORKFLOW" | "INVESTIGATE" | "FIX";
  approvalBaseline?: WorkspaceBaseline;
  verificationHistory?: VerificationRecord[];
  attempts?: RepairAttemptRecord[];
}

export interface RunEvent {
  timestamp: number;
  type: "created" | "state_changed" | "approval_requested" | "approval_resolved" | "error";
  status: AegisState["status"];
  message: string;
}

export interface PersistedRunRecord extends ActiveRun {}

export interface NativeAgentRunRecord {
  mode: "INVESTIGATE" | "FIX";
  model: string;
  goal: string;
  finalOutput: string;
  termination: string;
  toolCalls: Array<{
    id: string;
    name: string;
    args: unknown;
    output: string;
    durationMs: number;
    policyDecision: string;
    error?: string;
  }>;
  evidence: Array<{ path: string; line?: number; reason: string }>;
  verification: "supported" | "partially_supported" | "insufficient_evidence" | "unverified";
  evidenceValidation?: {
    valid: number;
    invalid: number;
    stale: number;
  };
  skillsOffered?: string[];
  skillsLoaded?: string[];
  contextMetrics?: {
    promptChars?: number;
    relevantFilesCount?: number;
    relevantSymbolsCount?: number;
    freshnessStatus?: string;
  };
}

class ApprovalRuntime {
  private activeRuns: Map<string, ActiveRun> = new Map();

  private getRunsDir(): string {
    const dir = path.resolve(process.cwd(), ".aegis", "runs");
    try {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    } catch (error) {
      throw new Error(
        `Failed to create run persistence directory "${dir}": ${(error as Error).message}`
      );
    }
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
    const filePath = this.getRunFilePath(runId);
    if (!fs.existsSync(filePath)) return null;

    try {
      const parsed = JSON.parse(fs.readFileSync(filePath, "utf-8")) as Partial<ActiveRun>;
      if (!parsed || parsed.version !== 1 || parsed.runId !== runId || !parsed.state) {
        throw new Error(`Run record "${runId}" is invalid or belongs to another run.`);
      }
      if (parsed.pendingApproval?.id !== parsed.state.pendingApproval?.id) {
        throw new Error(`Run record "${runId}" has inconsistent approval state.`);
      }
      if (parsed.pendingApproval && parsed.state.status !== "paused") {
        throw new Error(`Run record "${runId}" has a pending approval but is not paused.`);
      }

      const executionKind = parsed.executionKind ?? parsed.state?.executionKind;
      const normalizedState = {
        ...parsed.state,
        executionKind,
        attempts: parsed.attempts ?? parsed.state?.attempts ?? [],
        verificationHistory: parsed.verificationHistory ?? parsed.state?.verificationHistory ?? [],
      };
      const normalized: ActiveRun = {
        version: parsed.version,
        runId: parsed.runId,
        state: normalizedState,
        pendingApproval: parsed.pendingApproval ?? parsed.state.pendingApproval ?? null,
        history: parsed.history ?? [normalizedState],
        events: parsed.events ?? [],
        nativeAgent: parsed.nativeAgent,
        executionKind,
        approvalBaseline: parsed.approvalBaseline,
        verificationHistory: parsed.verificationHistory ?? parsed.state?.verificationHistory ?? [],
        attempts: parsed.attempts ?? parsed.state?.attempts ?? [],
      };
      this.activeRuns.set(runId, normalized);
      return normalized;
    } catch (error) {
      throw new Error(
        `Failed to load persisted run "${runId}": ${(error as Error).message}`
      );
    }
  }

  public acquireRunLock(runId: string, timeoutMs = 5000): string {
    const lockPath = `${this.getRunFilePath(runId)}.mutate.lock`;
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      try {
        const fd = fs.openSync(lockPath, "wx");
        fs.closeSync(fd);
        return lockPath;
      } catch (err: any) {
        if (err.code === "EEXIST") {
          try {
            const stat = fs.statSync(lockPath);
            if (Date.now() - stat.mtimeMs > 10000) {
              fs.unlinkSync(lockPath);
              continue;
            }
          } catch {}
          const sleepUntil = Date.now() + 10;
          while (Date.now() < sleepUntil) {}
        } else {
          throw err;
        }
      }
    }
    throw new Error(`Timeout acquiring run lock for "${runId}".`);
  }

  public releaseRunLock(lockPath: string): void {
    try {
      if (fs.existsSync(lockPath)) {
        fs.unlinkSync(lockPath);
      }
    } catch {}
  }

  public isRunCancelled(runId: string): boolean {
    const mem = this.activeRuns.get(runId);
    if (mem && mem.state.status === "cancelled") return true;
    const filePath = this.getRunFilePath(runId);
    if (fs.existsSync(filePath)) {
      try {
        const diskRun = this.loadRunFromDisk(runId);
        return Boolean(diskRun && diskRun.state && diskRun.state.status === "cancelled");
      } catch {}
    }
    return false;
  }

  public registerRun(runId: string, initialState: AegisState): ActiveRun {
    const filePath = this.getRunFilePath(runId);
    const existingRun = this.activeRuns.get(runId) || (fs.existsSync(filePath) ? this.loadRunFromDisk(runId) : null);
    const executionKind = initialState.executionKind || existingRun?.executionKind || existingRun?.state?.executionKind || "WORKFLOW";
    initialState.executionKind = executionKind;
    const run: ActiveRun = {
      version: 1,
      runId,
      state: initialState,
      pendingApproval: initialState.pendingApproval || null,
      history: [initialState],
      events: [{
        timestamp: Date.now(),
        type: "created",
        status: initialState.status,
        message: "Run created.",
      }],
      nativeAgent: existingRun?.nativeAgent,
      executionKind,
      verificationHistory: existingRun?.verificationHistory ?? [],
      attempts: existingRun?.attempts ?? [],
      approvalBaseline: existingRun?.approvalBaseline,
    };
    this.activeRuns.set(runId, run);
    this.persistRunToDisk(run);
    return run;
  }

  public updateRunState(runId: string, newState: AegisState): void {
    const lockPath = this.acquireRunLock(runId);
    try {
      const filePath = this.getRunFilePath(runId);
      const diskRun = fs.existsSync(filePath) ? this.loadRunFromDisk(runId) : null;
      let run: ActiveRun | null = diskRun || this.activeRuns.get(runId) || null;

      const terminalStatuses: Array<AegisState["status"]> = ["completed", "failed", "rejected", "cancelled"];

      // Terminal state protection: If run on disk is in a terminal status,
      // delayed callbacks or intermediate states must never overwrite it!
      if (run && terminalStatuses.includes(run.state.status) && !terminalStatuses.includes(newState.status)) {
        return;
      }
      if (run && run.state.status === "cancelled" && newState.status !== "cancelled") {
        return;
      }

      const executionKind = newState.executionKind || run?.executionKind || run?.state?.executionKind;
      if (executionKind) {
        newState.executionKind = executionKind;
      }
      if (run?.attempts && !newState.attempts) {
        newState.attempts = run.attempts;
      }
      if (run?.verificationHistory && !newState.verificationHistory) {
        newState.verificationHistory = run.verificationHistory;
      }
      let currentRun: ActiveRun;
      if (!run) {
        currentRun = {
          version: 1,
          runId,
          state: newState,
          pendingApproval: newState.pendingApproval || null,
          history: [newState],
          events: [],
          executionKind,
          attempts: newState.attempts ?? [],
          verificationHistory: newState.verificationHistory ?? [],
        };
      } else {
        run.version = 1;
        run.state = newState;
        run.pendingApproval = newState.pendingApproval || null;
        run.history.push(newState);
        if (executionKind) run.executionKind = executionKind;
        currentRun = run;
      }
      currentRun.events.push({
        timestamp: Date.now(),
        type: newState.pendingApproval ? "approval_requested" : "state_changed",
        status: newState.status,
        message: newState.pendingApproval
          ? `Approval requested: ${newState.pendingApproval.id}`
          : `Run state updated to ${newState.status}.`,
      });
      this.activeRuns.set(runId, currentRun);
      this.persistRunToDisk(currentRun);
    } finally {
      this.releaseRunLock(lockPath);
    }
  }

  public persistRunToDisk(run: ActiveRun): void {
    const filePath = this.getRunFilePath(run.runId);
    const tempPath = `${filePath}.${process.pid}.${Date.now()}.${crypto.randomBytes(4).toString("hex")}.tmp`;
    try {
      fs.writeFileSync(tempPath, JSON.stringify(run, null, 2), "utf-8");
      let renamed = false;
      for (let attempt = 0; attempt < 5; attempt++) {
        try {
          fs.renameSync(tempPath, filePath);
          renamed = true;
          break;
        } catch (e: any) {
          if (attempt === 4) throw e;
          const end = Date.now() + 10;
          while (Date.now() < end) {}
        }
      }
    } catch (error) {
      try {
        if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
      } catch {}
      throw new Error(
        `Failed to persist run "${run.runId}": ${(error as Error).message}`
      );
    }
  }

  public setApprovalBaseline(runId: string, baseline: WorkspaceBaseline): void {
      const run = this.getRun(runId);
      if (!run) throw new Error(`Cannot record approval baseline for missing run "${runId}".`);
      run.approvalBaseline = baseline;
      this.persistRunToDisk(run);
    }

  public claimApproval(runId: string, approvalId: string): string {
    const lockPath = `${this.getRunFilePath(runId)}.${approvalId}.approval.lock`;
    try {
      const descriptor = fs.openSync(lockPath, "wx");
      fs.writeFileSync(descriptor, JSON.stringify({ runId, approvalId, claimedAt: Date.now(), pid: process.pid }));
      fs.closeSync(descriptor);
      return lockPath;
    } catch (error) {
      throw new Error(`Approval "${approvalId}" is already being resolved or requires recovery.`);
    }
  }

  public releaseApprovalClaim(lockPath: string): void {
    if (fs.existsSync(lockPath)) fs.unlinkSync(lockPath);
  }

  public getPersistedRun(runId: string): PersistedRunRecord | null {
    return this.getRun(runId);
  }

  public attachNativeAgentRun(runId: string, record: NativeAgentRunRecord): void {
    const run = this.getRun(runId);
    if (!run) throw new Error(`Cannot attach native agent result to missing run "${runId}".`);
    (run as ActiveRun & { nativeAgent?: NativeAgentRunRecord }).nativeAgent = record;
    this.persistRunToDisk(run);
  }

  public appendNativeAgentToolCall(
    runId: string,
    toolCall: NativeAgentRunRecord["toolCalls"][number]
  ): void {
    const run = this.getRun(runId);
    if (!run) throw new Error(`Cannot append native agent observation to missing run "${runId}".`);
    if (!run.nativeAgent) {
      throw new Error(`Cannot append native agent observation before native run "${runId}" is initialized.`);
    }
    run.nativeAgent.toolCalls.push(toolCall);
    run.events = run.events || [];
    run.events.push({
      timestamp: Date.now(),
      type: toolCall.error ? "error" : "state_changed",
      status: run.state.status,
      message: `Tool ${toolCall.name} [${toolCall.policyDecision}] (${toolCall.durationMs}ms)${toolCall.error ? `: ${toolCall.error}` : ''}`,
    });
    this.persistRunToDisk(run);
  }

  private repairHandler?: (context: {
    runId: string;
    workspace: string;
    goal: string;
    failedChanges: any[];
    verification: VerificationRecord;
    retryCount: number;
  }) => Promise<any[]>;

  public setRepairHandler(handler: NonNullable<typeof this.repairHandler>): void {
    this.repairHandler = handler;
  }

  public getRepairHandler(): typeof this.repairHandler {
    return this.repairHandler;
  }

  public listPersistedRuns(limit = 50): ActiveRun[] {
    const dir = this.getRunsDir();
    const runs: ActiveRun[] = [];
    const seen = new Set<string>();

    if (fs.existsSync(dir)) {
      try {
        const files = fs.readdirSync(dir)
          .filter((f) => f.endsWith(".json"))
          .sort((a, b) => {
            const statA = fs.statSync(path.join(dir, a));
            const statB = fs.statSync(path.join(dir, b));
            return statB.mtimeMs - statA.mtimeMs;
          })
          .slice(0, limit);

        for (const file of files) {
          const runId = file.replace(/\.json$/, "");
          try {
            const run = this.getRun(runId);
            if (run && !seen.has(run.runId)) {
              runs.push(run);
              seen.add(run.runId);
            }
          } catch {}
        }
      } catch {}
    }

    for (const run of this.activeRuns.values()) {
      if (!seen.has(run.runId)) {
        runs.unshift(run);
        seen.add(run.runId);
      }
    }

    return runs.slice(0, limit);
  }

  public cancelRun(runId: string): ActiveRun {
    const lockPath = this.acquireRunLock(runId);
    try {
      const filePath = this.getRunFilePath(runId);
      const diskRun = fs.existsSync(filePath) ? this.loadRunFromDisk(runId) : null;
      const run = diskRun || this.getRun(runId);
      if (!run) {
        throw new Error(`Run "${runId}" not found.`);
      }
      const terminalStatuses: Array<AegisState["status"]> = ["completed", "failed", "rejected", "cancelled"];
      if (terminalStatuses.includes(run.state.status)) {
        throw new Error(`Cannot cancel run "${runId}" with terminal status "${run.state.status}".`);
      }
      // Abort running container or subprocess immediately
      abortRunningCommand(runId).catch(() => {});

      const newState: AegisState = {
        ...run.state,
        status: "cancelled",
        pendingApproval: null,
      };
      run.pendingApproval = null;
      run.state = newState;
      run.version = 1;
      run.history.push(newState);
      run.events.push({
        timestamp: Date.now(),
        type: "state_changed",
        status: "cancelled",
        message: "Run cancelled by user request.",
      });
      this.activeRuns.set(runId, run);
      this.persistRunToDisk(run);
      return run;
    } finally {
      this.releaseRunLock(lockPath);
    }
  }

  public findApproval(approvalId: string): { run: ActiveRun; approval: ApprovalRequest; isPending: boolean } | null {
    for (const run of this.activeRuns.values()) {
      if (run.pendingApproval?.id === approvalId) {
        return { run, approval: run.pendingApproval, isPending: true };
      }
      if (run.state.pendingApproval?.id === approvalId) {
        return { run, approval: run.state.pendingApproval, isPending: true };
      }
      if (run.state.approvalDecision && (run.pendingApproval?.id === approvalId || run.state.pendingApproval?.id === approvalId)) {
        return { run, approval: (run.pendingApproval || run.state.pendingApproval)!, isPending: false };
      }
    }
    const all = this.listPersistedRuns(100);
    for (const run of all) {
      if (run.pendingApproval?.id === approvalId || run.state.pendingApproval?.id === approvalId) {
        const appr = run.pendingApproval || run.state.pendingApproval!;
        const isPending = run.state.status === "paused" && !run.state.approvalDecision;
        return { run, approval: appr, isPending };
      }
      for (const st of run.history) {
        if (st.pendingApproval?.id === approvalId) {
          return { run, approval: st.pendingApproval, isPending: false };
        }
      }
    }
    return null;
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
  const executionLog: string[] = [];

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
    // Validate proposed changes against workspace before creating approval request
    if (state.workspace && fs.existsSync(state.workspace) && state.codeChanges?.length) {
      const normWs = state.workspace.trim();
      const seenPaths = new Set<string>();

      for (const change of state.codeChanges) {
        const normRel = change.path.replace(/\\/g, "/");
        if (seenPaths.has(normRel.toLowerCase())) {
          const errMsg = `Proposal contains duplicate target path: "${change.path}".`;
          executionLog.push(`[HUMAN-APPROVAL-GATE] FAIL-CLOSED: ${errMsg}`);
          return {
            status: "failed",
            errors: [errMsg],
            executionLog,
          };
        }
        seenPaths.add(normRel.toLowerCase());

        const pathCheck = safeResolveWorkspacePath(normWs, change.path);
        if (!pathCheck.valid) {
          const errMsg = `Proposal contains path containment violation for "${change.path}": ${pathCheck.reason}`;
          executionLog.push(`[HUMAN-APPROVAL-GATE] FAIL-CLOSED: ${errMsg}`);
          return {
            status: "failed",
            errors: [errMsg],
            executionLog,
          };
        }

        const fullPath = path.resolve(normWs, change.path);
        const exists = fs.existsSync(fullPath);

        if (change.action === "add" && exists) {
          executionLog.push(
            `[HUMAN-APPROVAL-GATE] Validated operation against workspace for "${change.path}": CREATE -> MODIFY (target exists on disk)`
          );
          change.action = "modify";
        } else if (change.action === "modify" && !exists) {
          executionLog.push(
            `[HUMAN-APPROVAL-GATE] Validated operation against workspace for "${change.path}": MODIFY -> CREATE (target does not exist on disk)`
          );
          change.action = "add";
        } else if (change.action === "delete" && !exists) {
          const errMsg = `File "${change.path}" was expected to be deleted (DELETE), but target file does not exist on disk.`;
          executionLog.push(`[HUMAN-APPROVAL-GATE] FAIL-CLOSED: ${errMsg}`);
          return {
            status: "failed",
            errors: [errMsg],
            executionLog,
          };
        }
      }

      if (approvalRuntime.getRun(runId)) {
        approvalRuntime.setApprovalBaseline(
          runId,
          await captureWorkspaceBaseline(state.workspace, state.codeChanges)
        );
      }
    }

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
      runId: state.runId,
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
 * Performs rigorous multi-file preflight validation BEFORE any mutation.
 * Applies changes with atomic rollback recovery upon error or verification failure.
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

  // 0. Preflight validation of workspace directory
  if (!fs.existsSync(workspace)) {
    const errMsg = `Workspace directory "${workspace}" does not exist.`;
    executionLog.push(`[CHANGE-EVIDENCE] FAIL-CLOSED: ${errMsg}`);
    return { status: "failed", errors: [errMsg], executionLog };
  }

  const runId = state.runId || "";
  const activeRun = approvalRuntime.getRun(runId);

  // Validate workspace identity
  if (activeRun?.state?.workspace) {
    try {
      const currentReal = fs.realpathSync(workspace).toLowerCase();
      const runReal = fs.realpathSync(activeRun.state.workspace).toLowerCase();
      if (currentReal !== runReal) {
        const errMsg = `Workspace identity mismatch: current "${workspace}" does not match run workspace "${activeRun.state.workspace}".`;
        executionLog.push(`[CHANGE-EVIDENCE] FAIL-CLOSED: ${errMsg}`);
        return { status: "failed", errors: [errMsg], executionLog };
      }
    } catch {}
  }

  // 1. Preflight validation of ALL proposed changes BEFORE writing ANY target
  const seenPaths = new Set<string>();
  for (const change of state.codeChanges) {
    const normRel = change.path.replace(/\\/g, "/");
    if (seenPaths.has(normRel.toLowerCase())) {
      const errMsg = `Preflight validation failed: duplicate target path "${change.path}" across proposed changes.`;
      executionLog.push(`[CHANGE-EVIDENCE] FAIL-CLOSED: ${errMsg}`);
      return { status: "failed", errors: [errMsg], executionLog };
    }
    seenPaths.add(normRel.toLowerCase());

    const pathCheck = safeResolveWorkspacePath(workspace, change.path);
    if (!pathCheck.valid) {
      const errMsg = `Preflight validation failed: path containment violation for "${change.path}": ${pathCheck.reason}`;
      executionLog.push(`[CHANGE-EVIDENCE] FAIL-CLOSED: ${errMsg}`);
      return { status: "failed", errors: [errMsg], executionLog };
    }

    const fullPath = path.resolve(workspace, change.path);
    const exists = fs.existsSync(fullPath);

    if (change.action === "add" && exists) {
      const errMsg = `Preflight validation failed: File ${change.path} was expected to be created, but target file already existed on disk before apply.`;
      executionLog.push(`[CHANGE-EVIDENCE] FAIL-CLOSED for ADD ${change.path}: ${errMsg}`);
      return {
        status: "failed",
        errors: [errMsg],
        executionLog,
      };
    }

    if (change.action === "modify") {
      if (!exists) {
        const errMsg = `Preflight validation failed: File ${change.path} was expected to be modified, but target file does not exist on disk before apply.`;
        executionLog.push(`[CHANGE-EVIDENCE] FAIL-CLOSED for MODIFY ${change.path}: ${errMsg}`);
        return {
          status: "failed",
          errors: [errMsg],
          executionLog,
        };
      }
      try {
        const stat = fs.statSync(fullPath);
        if (!stat.isFile()) {
          const errMsg = `Preflight validation failed: Target ${change.path} is not a regular file.`;
          executionLog.push(`[CHANGE-EVIDENCE] FAIL-CLOSED for MODIFY ${change.path}: ${errMsg}`);
          return { status: "failed", errors: [errMsg], executionLog };
        }
      } catch (err) {
        const errMsg = `Preflight validation failed: Unable to stat ${change.path}: ${(err as Error).message}`;
        executionLog.push(`[CHANGE-EVIDENCE] FAIL-CLOSED for MODIFY ${change.path}: ${errMsg}`);
        return { status: "failed", errors: [errMsg], executionLog };
      }
    }

    if (change.action === "delete" && !exists) {
      const errMsg = `Preflight validation failed: File ${change.path} was expected to be deleted, but target file does not exist on disk before apply.`;
      executionLog.push(`[CHANGE-EVIDENCE] FAIL-CLOSED for DELETE ${change.path}: ${errMsg}`);
      return {
        status: "failed",
        errors: [errMsg],
        executionLog,
      };
    }
  }

  // 2. Revalidate prior Approval Baseline (detect concurrent external modifications)
  const needsAppr = requiresApproval("write_file", {
    executionMode: mode,
    isMutating: Boolean(state.codeChanges && state.codeChanges.length > 0),
  });

  if (needsAppr || activeRun?.pendingApproval || activeRun?.approvalBaseline) {
    if (!activeRun?.approvalBaseline) {
      executionLog.push("[CHANGE-EVIDENCE] FAIL-CLOSED: Missing approval baseline for protected code changes.");
      return {
        status: "failed",
        errors: ["Approval baseline missing for protected code changes. Refusing to apply un-baselined mutations."],
        executionLog,
      };
    }
  }

  if (activeRun?.approvalBaseline) {
    const conflicts = checkApprovalBaselineConflicts(workspace, state.codeChanges, activeRun.approvalBaseline);
    if (conflicts.length > 0) {
      const conflictDetails = conflicts.map((c) => `${c.path}: ${c.reason}`).join("; ");
      executionLog.push(`[CHANGE-EVIDENCE] BASELINE CONFLICT DETECTED: ${conflictDetails}`);
      return {
        status: "failed",
        errors: [`Workspace baseline conflict detected before apply: ${conflictDetails}. Revalidation required.`],
        executionLog,
      };
    }
    executionLog.push(
      `[CHANGE-EVIDENCE] Verified approval baseline consistency for ${state.codeChanges.length} proposed path(s). Zero concurrent conflicts.`
    );
  }

  // 3. Capture Workspace Baseline BEFORE Apply (for change evidence verification)
  const baseline = await captureWorkspaceBaseline(workspace, state.codeChanges);
  executionLog.push(
    `[CHANGE-EVIDENCE] Captured pre-apply baseline for ${state.codeChanges.length} proposed path(s) (git: ${baseline.isGitRepo}).`
  );
  if (baseline.preExistingDirtyFiles.length > 0) {
    executionLog.push(
      `[CHANGE-EVIDENCE] Pre-existing dirty paths detected: ${baseline.preExistingDirtyFiles.join(", ")}`
    );
  }

  // 4. Staging Rollback Plan
  interface RollbackRecord {
    change: CodeChange;
    fullPath: string;
    existedBefore: boolean;
    contentBefore: string | null;
    applied: boolean;
  }

  const snapshots: RollbackRecord[] = state.codeChanges.map((change) => {
    const fullPath = path.resolve(workspace, change.path);
    const existedBefore = fs.existsSync(fullPath);
    let contentBefore: string | null = null;
    if (existedBefore) {
      try {
        contentBefore = fs.readFileSync(fullPath, "utf-8");
      } catch {}
    }
    return {
      change,
      fullPath,
      existedBefore,
      contentBefore,
      applied: false,
    };
  });

  const performRollback = () => {
    executionLog.push("[DEV-APPLY] Initiating rollback of applied file changes...");
    for (const snap of [...snapshots].reverse()) {
      if (!snap.applied) continue;
      try {
        if (snap.existedBefore && snap.contentBefore !== null) {
          fs.writeFileSync(snap.fullPath, snap.contentBefore, "utf-8");
          executionLog.push(`[DEV-APPLY] ROLLBACK restored original content for ${snap.change.path}`);
        } else if (!snap.existedBefore && fs.existsSync(snap.fullPath)) {
          fs.unlinkSync(snap.fullPath);
          executionLog.push(`[DEV-APPLY] ROLLBACK removed created file ${snap.change.path}`);
        }
      } catch (rbErr) {
        executionLog.push(`[DEV-APPLY] ROLLBACK ERROR for ${snap.change.path}: ${(rbErr as Error).message}`);
      }
    }
  };

  executionLog.push(
    `[DEV-APPLY] Applying ${state.codeChanges.length} approved file change(s) to ${workspace} (mode: ${mode})...`
  );

  // 5. Apply mutations with rollback guard
  for (const snap of snapshots) {
    const change = snap.change;
    // Coordinate validation against concurrent modifications during application
    if (activeRun?.approvalBaseline) {
      const liveConflicts = checkApprovalBaselineConflicts(workspace, [change], activeRun.approvalBaseline);
      if (liveConflicts.length > 0) {
        const conflictDetails = liveConflicts.map((c) => `${c.path}: ${c.reason}`).join("; ");
        executionLog.push(`[CHANGE-EVIDENCE] CONCURRENT MUTATION DETECTED DURING APPLY: ${conflictDetails}`);
        performRollback();
        return {
          status: "failed",
          errors: [`Concurrent conflict detected immediately prior to applying ${change.path}: ${conflictDetails}`],
          executionLog,
        };
      }
    }

    try {
      if (change.action === "delete") {
        const del = await deleteFile(workspace, change.path, {
          executionMode: mode,
          isApproved: true,
          approvalContext: {
            runId: state.runId,
            approvalId: state.approvalDecision?.approvalId ?? "",
            workspace: fs.realpathSync(workspace).toLowerCase(),
            allowedActions: ["delete_file"],
            allowedTargets: [change.path],
          },
        });
        snap.applied = true;
        executionLog.push(
          `[DEV-APPLY] DELETE ${change.path} → ${del.deleted ? "deleted" : "not found (ok)"}`
        );
      } else {
        const content = change.content ?? "";
        const write = await writeFile(workspace, change.path, content, {
          executionMode: mode,
          isApproved: true,
          approvalContext: {
            runId: state.runId,
            approvalId: state.approvalDecision?.approvalId ?? "",
            workspace: fs.realpathSync(workspace).toLowerCase(),
            allowedActions: ["write_file"],
            allowedTargets: [change.path],
          },
        });
        snap.applied = true;
        executionLog.push(
          `[DEV-APPLY] WRITE ${change.path} → ${write.bytesWritten} bytes written`
        );
      }
    } catch (err) {
      const errMsg = (err as Error).message;
      executionLog.push(`[DEV-APPLY] ERROR on ${change.path}: ${errMsg}`);
      performRollback();
      return {
        status: "failed",
        errors: [`Failed to apply approved proposal change to ${change.path}: ${errMsg}`],
        executionLog,
      };
    }
  }

  // 6. Verify Post-Apply Workspace Change Evidence
  const changeEvidence = await verifyWorkspaceChanges(workspace, state.codeChanges, baseline);

  for (const fe of changeEvidence.fileEvidence) {
    if (fe.verified) {
      executionLog.push(
        `[CHANGE-EVIDENCE] Verified ${fe.action.toUpperCase()} ${fe.path} (content matches proposal, classification: ${fe.classification})`
      );
    } else {
      executionLog.push(
        `[CHANGE-EVIDENCE] FAILED verification for ${fe.action.toUpperCase()} ${fe.path}: ${fe.error}`
      );
    }
  }

  if (changeEvidence.unexpectedChanges.length > 0) {
    executionLog.push(
      `[CHANGE-EVIDENCE] WARNING: Unexpected changes detected outside proposal: ${changeEvidence.unexpectedChanges.join(", ")}`
    );
  }

  if (!changeEvidence.allVerified) {
    const failedFiles = changeEvidence.fileEvidence
      .filter((fe) => !fe.verified)
      .map((fe) => `${fe.path}: ${fe.error || "mismatch"}`)
      .join("; ");

    performRollback();

    return {
      status: "failed",
      changeEvidence,
      errors: [`Proposal application verification failed for: ${failedFiles}`],
      executionLog,
    };
  }

  return { status: "developing", changeEvidence, executionLog };
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
    // Native FIX has already obtained human authorization and run its actual
    // verification command. An additional LLM review is not the authority for
    // an observed exit code, and model quota must not invalidate that evidence.
    const activeRun = state.runId ? approvalRuntime.getRun(state.runId) : null;
    const kind = state.executionKind || activeRun?.executionKind || activeRun?.state?.executionKind;
    return kind === "FIX" ? END : "reviewerNode";
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

export const testApprovalWorkflow = buildApprovalWorkflow({
  planner: async () => ({
    status: "planning",
    plan: [{ id: "step-1", description: "Design module", status: "completed" }],
  }),
  researcher: async () => ({
    status: "researching",
    research: "Mock research analysis complete.",
  }),
  architect: async (state: AegisState) => ({
    status: "architecting",
    architecture: "Mock architecture design spec.",
    codeChanges: state.codeChanges && state.codeChanges.length > 0 ? state.codeChanges : [
      { path: "src/calc.ts", action: "modify", summary: "Mock code modification" },
    ],
  }),
  developer: async () => ({
    status: "developing",
    executionLog: ["[DEV-TOOL] Executed file changes safely"],
  }),
  tester: async () => ({
    status: "testing",
    testResults: { passed: true, totalTests: 1, passedTests: 1, failedTests: 0 },
  }),
  reviewer: async () => ({
    status: "reviewing",
    reviewResults: { approved: true, comments: ["Approved"] },
  }),
});

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
    executionKind: initialState.executionKind || "WORKFLOW",
    memoryContext: initialState.memoryContext || "",
    pendingApproval: initialState.pendingApproval || null,
    approvalDecision: initialState.approvalDecision || null,
    executionMode: initialState.executionMode || "semi-auto",
    changeEvidence: initialState.changeEvidence || null,
  };

  approvalRuntime.registerRun(runId, fullState);

  try {
    const resultState = await workflowInstance.invoke(fullState, threadConfig);
    if (approvalRuntime.isRunCancelled(runId)) {
      return approvalRuntime.getRun(runId)!.state;
    }
    approvalRuntime.updateRunState(runId, resultState as AegisState);
    return resultState as AegisState;
  } catch (error) {
    if (approvalRuntime.isRunCancelled(runId)) {
      return approvalRuntime.getRun(runId)!.state;
    }
    const message = (error as Error).message;
    const failedState: AegisState = {
      ...fullState,
      status: "failed",
      errors: [...fullState.errors, `Execution failed: ${message}`],
    };
    approvalRuntime.updateRunState(runId, failedState);
    throw error;
  }
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
  const threadConfig = { configurable: { thread_id: `${runId}:resume:${approvalId}` } };
  const currentRun = approvalRuntime.getRun(runId);

  if (!currentRun || !currentRun.state || !currentRun.state.task) {
    throw new Error(`Run state for runId "${runId}" not found or empty on disk. Cannot resume approval workflow.`);
  }
  if (currentRun.state.status === "cancelled") {
    throw new Error(`Cannot resume cancelled run "${runId}".`);
  }

  const pendingApproval = currentRun.pendingApproval || currentRun.state.pendingApproval;
  if (!pendingApproval || pendingApproval.id !== approvalId) {
    throw new Error(`Approval "${approvalId}" is not pending for run "${runId}". Cannot resume approval workflow.`);
  }
  const claimPath = approvalRuntime.claimApproval(runId, approvalId);
  let updatedState: AegisState = currentRun.state;

  try {
    if (action === "approve" && currentRun.approvalBaseline && currentRun.state.workspace) {
      const currentBaseline = await captureWorkspaceBaseline(
        currentRun.state.workspace,
        currentRun.state.codeChanges
      );
      for (const change of currentRun.state.codeChanges) {
        const relativePath = change.path.replace(/\\/g, "/");
        const before = currentRun.approvalBaseline.fileBaselines[relativePath];
        const now = currentBaseline.fileBaselines[relativePath];
        if (before?.exists !== now?.exists || before?.hash !== now?.hash) {
          throw new Error(`Workspace changed after approval request for "${relativePath}". Approval rejected; recovery required.`);
        }
      }
    }

    const decision: ApprovalDecision = {
      approvalId,
      action,
      reason,
      decidedAt: Date.now(),
    };

    updatedState = {
      ...currentRun.state,
      runId,
      approvalDecision: decision,
      pendingApproval: null,
    };

    // Resume workflow from checkpoint with decision attached
    const resultState = await workflowInstance.invoke(updatedState, threadConfig);
    if (approvalRuntime.isRunCancelled(runId)) {
      return approvalRuntime.getRun(runId)!.state;
    }
    const run = approvalRuntime.getRun(runId);
    if (run) {
      run.events.push({
        timestamp: Date.now(),
        type: "approval_resolved",
        status: resultState.status as AegisState["status"],
        message: `Approval ${approvalId} resolved with action "${action}".`,
      });

      run.attempts = run.attempts || [];
      run.verificationHistory = run.verificationHistory || [];

      if (resultState.testResults?.verificationRecord) {
        run.verificationHistory.push(resultState.testResults.verificationRecord);
      }

      const currentAttemptNumber = currentRun.state.retryCount ?? 0;
      const isEnvFailure = resultState.testResults?.verificationRecord?.status === "environment_failure";
      const attemptStatus: RepairAttemptRecord["status"] =
        action === "reject"
          ? "rejected"
          : resultState.status === "failed" && !resultState.testResults
          ? "blocked"
          : isEnvFailure
          ? "environment_failure"
          : resultState.testResults?.passed
          ? "verified_passed"
          : "verified_failed";

      const existingAttempt = run.attempts.find((a) => a.attemptNumber === currentAttemptNumber);
      if (existingAttempt) {
        existingAttempt.approvalId = approvalId;
        existingAttempt.codeChanges = currentRun.state.codeChanges;
        existingAttempt.approvalDecision = decision;
        existingAttempt.changeEvidence = resultState.changeEvidence ?? undefined;
        existingAttempt.verification = resultState.testResults?.verificationRecord;
        existingAttempt.status = attemptStatus;
      } else {
        run.attempts.push({
          attemptNumber: currentAttemptNumber,
          approvalId,
          codeChanges: currentRun.state.codeChanges,
          approvalDecision: decision,
          changeEvidence: resultState.changeEvidence ?? undefined,
          verification: resultState.testResults?.verificationRecord,
          status: attemptStatus,
          timestamp: Date.now(),
        });
      }

      const currentExecutionKind = currentRun.executionKind || currentRun.state.executionKind;
      const repairHandler = approvalRuntime.getRepairHandler();
      const currentRetries = currentRun.state.retryCount ?? 0;
      const maxRetries = currentRun.state.maxRetries ?? 2;

      if (
        action === "approve" &&
        currentExecutionKind === "FIX" &&
        resultState.testResults &&
        !resultState.testResults.passed &&
        !isEnvFailure &&
        repairHandler &&
        currentRetries < maxRetries
      ) {
        const nextRetry = currentRetries + 1;
        const newProposals = await repairHandler({
          runId,
          workspace: currentRun.state.workspace,
          goal: currentRun.state.task,
          failedChanges: currentRun.state.codeChanges,
          verification: resultState.testResults.verificationRecord || {
            command: process.env.AEGIS_TEST_COMMAND || "npm test",
            workspace: currentRun.state.workspace,
            exitCode: 1,
            stdout: resultState.testResults.output || "",
            stderr: "",
            durationMs: 0,
            timeoutMs: 120_000,
            status: "failed",
            executedAt: Date.now(),
          },
          retryCount: nextRetry,
        });

        if (newProposals && newProposals.length > 0) {
          const changeSummaries = newProposals
            .map((c: any) => `- ${c.action.toUpperCase()} ${c.path}${c.summary ? `: ${c.summary}` : ""}`)
            .join("\n");

          const newReq = createApprovalRequest({
            runId,
            type: "code-review",
            action: "write_file",
            title: `Approve repair revision ${nextRetry} of ${maxRetries} for: ${currentRun.state.task}`,
            description: `Verification failed (${resultState.testResults.verificationRecord?.command ?? "test"} exit ${resultState.testResults.verificationRecord?.exitCode ?? 1}). Developer proposes repair revision ${nextRetry}:\n${changeSummaries}`,
            target: newProposals.map((c: any) => c.path).join(", "),
            riskLevel: "high",
            requestedBy: "nativeRepairAgent",
          });

          // Capture fresh baseline for new proposal paths
          const newBaseline = await captureWorkspaceBaseline(currentRun.state.workspace, newProposals);
          run.approvalBaseline = newBaseline;
          run.pendingApproval = newReq;

          run.attempts.push({
            attemptNumber: nextRetry,
            approvalId: newReq.id,
            codeChanges: newProposals,
            status: "proposed",
            timestamp: Date.now(),
          });

          const pausedState: AegisState = {
            ...resultState,
            status: "paused",
            pendingApproval: newReq,
            approvalDecision: null,
            codeChanges: newProposals,
            retryCount: nextRetry,
            executionKind: currentExecutionKind,
            attempts: run.attempts,
            verificationHistory: run.verificationHistory,
            executionLog: [
              ...(resultState.executionLog || []),
              `[NATIVE-REPAIR] Verification failed. Proposed repair revision ${nextRetry} (${newReq.id}). Pausing for approval.`,
            ],
          };

          run.state = pausedState;
          run.events.push({
            timestamp: Date.now(),
            type: "approval_requested",
            status: "paused",
            message: `Repair revision ${nextRetry} requested: ${newReq.id}`,
          });

          if (run.nativeAgent) {
            run.nativeAgent.verification = "unverified";
          }
          approvalRuntime.persistRunToDisk(run);
          return pausedState;
        }
      }

      if (
        action === "approve" &&
        currentExecutionKind === "FIX" &&
        resultState.testResults &&
        !resultState.testResults.passed &&
        currentRetries >= maxRetries
      ) {
        resultState.status = "failed";
        resultState.errors = [
          ...(resultState.errors || []),
          `Repair budget exhausted (${maxRetries} revisions attempted). Verification failed.`,
        ];
        if (run.nativeAgent) {
          run.nativeAgent.verification = "unverified";
        }
      } else if (currentExecutionKind === "FIX" && resultState.testResults && resultState.testResults.passed) {
        resultState.status = "completed";
        if (run.nativeAgent) {
          run.nativeAgent.verification = "supported";
        }
      } else if (run.nativeAgent && resultState.testResults) {
        run.nativeAgent.verification = resultState.testResults.passed ? "supported" : "unverified";
      }

      approvalRuntime.persistRunToDisk(run);
      approvalRuntime.updateRunState(runId, resultState as AegisState);
    }
    return resultState as AegisState;
  } catch (error) {
    const message = (error as Error).message;
    const failedState: AegisState = {
      ...updatedState,
      status: "failed",
      pendingApproval: null,
      errors: [...(updatedState.errors || []), `Approval resume failed: ${message}`],
    };
    const run = approvalRuntime.getRun(runId);
    if (run) run.pendingApproval = null;
    approvalRuntime.updateRunState(runId, failedState);
    throw error;
  } finally {
    approvalRuntime.releaseApprovalClaim(claimPath);
  }
}
