import { executeNativeRepair } from '../../cli/cliHandlers.js';
import {
  executeApprovalWorkflow,
  resolveApprovalAndResume,
  approvalRuntime,
  createApprovalRequest,
  ActiveRun,
  approvalWorkflow,
  testApprovalWorkflow,
} from '../../../src/runtime/approvalWorkflow';
import type { AegisState } from '../../../src/runtime/state';
import type { ApprovalRequest } from '../../../src/runtime/approvalTypes';

export interface StartTaskOptions {
  runId: string;
  taskId: string;
  projectId: string;
  description: string;
  executionMode: 'automatic' | 'semi-auto' | 'manual';
  workspace?: string;
}

export interface AgentServiceResult {
  runId: string;
  status: 'started' | 'queued';
  message: string;
}

/**
 * Start an agent run for a given task using canonical approval-aware workflow engine.
 */
export async function startTask(options: StartTaskOptions): Promise<AgentServiceResult> {
  const workspace = options.workspace || process.cwd();

  const wfInstance = process.env.AEGIS_TEST_ADAPTER === '1' ? testApprovalWorkflow : approvalWorkflow;

  // Invoke workflow asynchronously to run up to completion or pause
  executeApprovalWorkflow(
    options.runId,
    {
      task: options.description,
      runId: options.runId,
      executionMode: options.executionMode,
      workspace,
    },
    wfInstance
  ).catch((err) => {
    console.error(`[AgentService] Error during workflow run ${options.runId}:`, err);
  });

  return {
    runId: options.runId,
    status: 'started',
    message: 'Task execution started with canonical approval runtime',
  };
}

/**
 * Cancel an in-progress agent run canonically.
 */
export async function cancelRun(runId: string): Promise<ActiveRun> {
  return approvalRuntime.cancelRun(runId);
}

/**
 * Request human approval gate.
 */
export async function requestApproval(
  runId: string,
  approvalId: string,
  title: string,
  description?: string,
): Promise<ApprovalRequest> {
  const run = approvalRuntime.getRun(runId);
  if (!run) throw new Error(`Run "${runId}" not found.`);
  if (['completed', 'failed', 'rejected', 'cancelled'].includes(run.state.status)) {
    throw new Error(`Cannot request approval on run with terminal status "${run.state.status}".`);
  }
  const req = createApprovalRequest({
    runId,
    type: 'code-review',
    action: 'write_file',
    title,
    description: description || `Approval requested for run ${runId}`,
    target: run.state.workspace || 'workspace',
    riskLevel: 'high',
    requestedBy: 'api',
  });
  run.state.status = 'paused';
  run.state.pendingApproval = req;
  run.pendingApproval = req;
  run.events.push({
    timestamp: Date.now(),
    type: 'approval_requested',
    status: 'paused',
    message: `Approval requested: ${req.id} - ${title}`,
  });
  approvalRuntime.updateRunState(runId, run.state);
  return req;
}

/**
 * Resume a paused run after human decision (approve or reject).
 */
export async function resumeRun(
  runId: string,
  approvalId?: string,
  action: 'approve' | 'reject' = 'approve',
  reason?: string
): Promise<AegisState> {
  const effectiveApprovalId = approvalId || `appr_${runId}`;
  const wfInstance = process.env.AEGIS_TEST_ADAPTER === '1' ? testApprovalWorkflow : approvalWorkflow;
  return await resolveApprovalAndResume(runId, effectiveApprovalId, action, reason, wfInstance);
}

if (!approvalRuntime.getRepairHandler()) {
  approvalRuntime.setRepairHandler(async (context) => {
    return executeNativeRepair(
      context.runId,
      context.workspace,
      context.goal,
      context.failedChanges,
      context.verification,
      context.retryCount
    );
  });
}
