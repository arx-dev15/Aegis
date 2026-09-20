import {
  executeApprovalWorkflow,
  resolveApprovalAndResume,
  approvalRuntime,
} from '../../../graph/approvalWorkflow';

export interface StartTaskOptions {
  runId: string
  taskId: string
  projectId: string
  description: string
  executionMode: 'automatic' | 'semi-auto' | 'manual'
}

export interface AgentServiceResult {
  runId: string
  status: 'started' | 'queued'
  message: string
}

/**
 * Start an agent run for a given task using approval-aware workflow engine.
 */
export async function startTask(options: StartTaskOptions): Promise<AgentServiceResult> {
  console.log('[AgentService] startTask called with Aegis workflow runtime', {
    runId: options.runId,
    taskId: options.taskId,
    executionMode: options.executionMode,
  })

  // Invoke workflow asynchronously to run up to completion or pause
  executeApprovalWorkflow(options.runId, {
    task: options.description,
    runId: options.runId,
    executionMode: options.executionMode,
  }).catch((err) => {
    console.error(`[AgentService] Error during workflow run ${options.runId}:`, err)
  })

  return {
    runId: options.runId,
    status: 'started',
    message: 'Task execution started with approval runtime',
  }
}

/**
 * Cancel an in-progress agent run.
 */
export async function cancelRun(runId: string): Promise<void> {
  console.log('[AgentService] cancelRun called', { runId })
}

/**
 * Request human approval gate.
 */
export async function requestApproval(
  runId: string,
  approvalId: string,
  title: string,
): Promise<void> {
  console.log('[AgentService] requestApproval called', { runId, approvalId, title })
}

/**
 * Resume a paused run after human decision (approve or reject).
 */
export async function resumeRun(
  runId: string,
  approvalId?: string,
  action: 'approve' | 'reject' = 'approve',
  reason?: string
): Promise<void> {
  console.log('[AgentService] resumeRun called', { runId, approvalId, action, reason })
  const effectiveApprovalId = approvalId || `appr_${runId}`
  await resolveApprovalAndResume(runId, effectiveApprovalId, action, reason)
}
