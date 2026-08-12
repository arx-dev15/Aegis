import { v4 as uuidv4 } from 'uuid'

/**
 * AGENT SERVICE — STUB BOUNDARY
 *
 * This module defines the interface between the API layer and the agentic core.
 * The actual implementation lives in:
 *   agents/
 *   graph/
 *
 * DO NOT implement agent logic here or in controllers.
 * When the agentic core is ready, replace the stub bodies
 * with real calls to the agent orchestrator.
 */

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
 * Start an agent run for a given task.
 * STUB: logs intent and returns immediately.
 * Future: invokes LangGraph orchestrator.
 */
export async function startTask(options: StartTaskOptions): Promise<AgentServiceResult> {
  console.log('[AgentService] startTask called — STUB', {
    runId: options.runId,
    taskId: options.taskId,
    executionMode: options.executionMode,
  })

  // TODO: Replace with actual agent invocation:
  // await graph.invoke({ task: options.description, mode: options.executionMode })

  return {
    runId: options.runId,
    status: 'queued',
    message: 'Task queued for agent execution (stub — no agent connected yet)',
  }
}

/**
 * Cancel an in-progress agent run.
 * STUB: no-op for now.
 */
export async function cancelRun(runId: string): Promise<void> {
  console.log('[AgentService] cancelRun called — STUB', { runId })
  // TODO: Send cancellation signal to running LangGraph graph instance
}

/**
 * Request human approval gate (used in semi-auto mode).
 * STUB: returns immediately as if approval was requested.
 */
export async function requestApproval(
  runId: string,
  approvalId: string,
  title: string,
): Promise<void> {
  console.log('[AgentService] requestApproval — STUB', { runId, approvalId, title })
  // TODO: Pause graph execution and wait for approval signal
}

/**
 * Resume a paused run after approval.
 * STUB: no-op.
 */
export async function resumeRun(runId: string): Promise<void> {
  console.log('[AgentService] resumeRun — STUB', { runId })
  // TODO: Resume paused LangGraph graph execution
}
