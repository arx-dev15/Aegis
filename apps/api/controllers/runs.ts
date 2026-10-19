import { Request, Response, NextFunction } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { query, queryOne } from '../db'
import { createError } from '../middleware/errorHandler'
import { CreateRunInput, RunEventInput } from '../schemas/run'
import { config } from '../config'
import { broadcast } from '../ws'
import * as agentService from '../services/agentService'
import {
  approvalRuntime,
  ActiveRun,
} from '../../../src/runtime/approvalWorkflow'
import type { AegisState } from '../../../src/runtime/state'
import { memTasks, memEvents, memFiles, RunEvent, ProjectFile } from '../services/memoryStore'

// Helper: Map canonical ActiveRun to API representation
export function mapCanonicalRunToApiRun(run: ActiveRun, task?: any) {
  const state = run.state || ({} as AegisState)
  const taskId = task?.id || (task?.taskId) || (state as any).taskId || 'task_default'
  const projectId = task?.project_id || (task?.projectId) || (state as any).projectId || 'project_default'

  let apiStatus: 'pending' | 'running' | 'completed' | 'failed' | 'paused' | 'cancelled' = 'running'
  if (state.status === 'idle') apiStatus = 'pending'
  else if (state.status === 'completed') apiStatus = 'completed'
  else if (state.status === 'failed') apiStatus = 'failed'
  else if (state.status === 'paused') apiStatus = 'paused'
  else if (state.status === 'rejected') apiStatus = 'failed'
  else if (state.status === 'cancelled') apiStatus = 'cancelled'
  else apiStatus = 'running'

  const events: RunEvent[] = (run.events || []).map((e, idx) => {
    const lvl: 'info' | 'warn' | 'error' | 'debug' =
      e.type === 'error' ? 'error' : e.type === 'approval_requested' ? 'warn' : 'info'
    return {
      id: `ev_${run.runId}_${idx}`,
      run_id: run.runId,
      level: lvl,
      agent: state.executionKind || 'WorkflowAgent',
      message: e.message,
      metadata: {
        status: e.status,
        timestamp: e.timestamp,
        ...(run.pendingApproval ? { approvalId: run.pendingApproval.id, title: run.pendingApproval.title } : {}),
      },
      timestamp: new Date(e.timestamp || Date.now()).toISOString(),
    }
  })

  const files: ProjectFile[] = (state.codeChanges || []).map((c, idx) => {
    const fileStatus: 'added' | 'modified' | 'deleted' =
      c.action === 'add' ? 'added' : c.action === 'delete' ? 'deleted' : 'modified'
    return {
      id: `fc_${run.runId}_${idx}`,
      run_id: run.runId,
      path: c.path,
      status: fileStatus,
      additions: c.content ? c.content.split('\n').length : 0,
      deletions: 0,
      diff_content: c.content || null,
      created_at: new Date(run.events?.[0]?.timestamp || Date.now()).toISOString(),
    }
  })

  // Merge any manually pushed files/events
  if (memFiles[run.runId]) {
    for (const mf of memFiles[run.runId]) {
      if (!files.some((f) => f.path === mf.path)) {
        files.push(mf)
      }
    }
  }
  if (memEvents[run.runId]) {
    events.push(...memEvents[run.runId])
  }

  const testsRun = state.testResults?.totalTests ?? (Array.isArray(state.testResults) ? (state.testResults as any).length : 0)
  const testsPassed = state.testResults?.passedTests ?? 0

  return {
    id: run.runId,
    task_id: taskId,
    project_id: projectId,
    status: apiStatus,
    canonical_status: state.status,
    current_agent: state.status,
    execution_mode: state.executionMode || 'semi-auto',
    files_changed: files.length,
    tests_run: testsRun,
    tests_passed: testsPassed,
    started_at: new Date(run.events?.[0]?.timestamp || Date.now()).toISOString(),
    completed_at: ['completed', 'failed', 'rejected', 'cancelled'].includes(state.status)
      ? new Date(run.events?.[run.events.length - 1]?.timestamp || Date.now()).toISOString()
      : null,
    created_at: new Date(run.events?.[0]?.timestamp || Date.now()).toISOString(),
    events,
    files,
    pendingApproval: run.pendingApproval || state.pendingApproval || null,
    verificationEvidence: state.testResults?.verificationRecord || null,
    verificationHistory: run.verificationHistory || state.verificationHistory || [],
    codeChanges: state.codeChanges || [],
    errors: state.errors || [],
    executionLog: state.executionLog || [],
    nativeAgent: run.nativeAgent,
  }
}

export async function createRun(req: Request, res: Response, next: NextFunction) {
  try {
    const { taskId } = req.params
    const input = req.body as CreateRunInput
    const runId = `run_${Date.now()}_${uuidv4().slice(0, 8)}`
    const now = new Date().toISOString()

    let task: any
    if (config.SKIP_DB) {
      task = memTasks[taskId]
      if (!task) return next(createError('Task not found', 404, 'NOT_FOUND'))
    } else {
      task = await queryOne(`SELECT * FROM tasks WHERE id = $1`, [taskId])
      if (!task) return next(createError('Task not found', 404, 'NOT_FOUND'))
    }

    if (config.SKIP_DB) {
      task.status = 'running'
      task.updated_at = now
      task.lastRunId = runId
    } else {
      await query(`UPDATE tasks SET status = 'running', updated_at = NOW() WHERE id = $1`, [taskId])
    }

    // Broadcast run started event
    broadcast({
      type: 'run:started',
      runId,
      payload: { taskId, projectId: task.project_id, executionMode: input.executionMode },
      timestamp: now,
    })

    // Start canonical agent workflow
    await agentService.startTask({
      runId,
      taskId,
      projectId: task.project_id,
      description: task.description ?? '',
      executionMode: input.executionMode,
    })

    const run = approvalRuntime.getRun(runId)
    const result = run ? mapCanonicalRunToApiRun(run, task) : {
      id: runId,
      task_id: taskId,
      project_id: task.project_id,
      status: 'running',
      execution_mode: input.executionMode,
      files_changed: 0,
      tests_run: 0,
      tests_passed: 0,
      started_at: now,
      completed_at: null,
      created_at: now,
    }

    res.status(201).json({ data: result })
  } catch (err) {
    next(err)
  }
}

export async function listRunsForTask(req: Request, res: Response, next: NextFunction) {
  try {
    const { taskId } = req.params
    let task: any
    if (config.SKIP_DB) {
      task = memTasks[taskId]
    } else {
      task = await queryOne(`SELECT * FROM tasks WHERE id = $1`, [taskId])
    }

    const allRuns = approvalRuntime.listPersistedRuns(50)
    const matching = task
      ? allRuns.filter(
          (r) =>
            r.state?.task === task.description ||
            r.runId === task.lastRunId ||
            (r as any).taskId === taskId
        )
      : allRuns

    const result = matching.map((r) => mapCanonicalRunToApiRun(r, task))
    res.json({ data: result })
  } catch (err) {
    next(err)
  }
}

export async function listAllRuns(req: Request, res: Response, next: NextFunction) {
  try {
    const allRuns = approvalRuntime.listPersistedRuns(50)
    const result = allRuns.map((r) => mapCanonicalRunToApiRun(r))
    res.json({ data: result })
  } catch (err) {
    next(err)
  }
}

export async function getRun(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params
    const run = approvalRuntime.getPersistedRun(id)
    if (!run) {
      return next(createError('Run not found', 404, 'NOT_FOUND'))
    }
    const result = mapCanonicalRunToApiRun(run)
    res.json({ data: result })
  } catch (err) {
    next(err)
  }
}

export async function getRunStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params
    const run = approvalRuntime.getPersistedRun(id)
    if (!run) {
      return next(createError('Run not found', 404, 'NOT_FOUND'))
    }
    const mapped = mapCanonicalRunToApiRun(run)
    res.json({
      data: {
        id,
        status: mapped.status,
        canonicalStatus: run.state?.status ?? 'idle',
        currentAgent: mapped.current_agent,
        pendingApproval: run.pendingApproval ?? run.state?.pendingApproval ?? null,
      },
    })
  } catch (err) {
    next(err)
  }
}

export async function cancelRun(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params
    const run = approvalRuntime.getPersistedRun(id)
    if (!run) {
      return next(createError('Run not found', 404, 'NOT_FOUND'))
    }

    try {
      const cancelledRun = await agentService.cancelRun(id)
      broadcast({
        type: 'run:event',
        runId: id,
        payload: {
          id: `ev_${id}_${Date.now()}`,
          run_id: id,
          level: 'warn',
          agent: 'system',
          message: 'Run was cancelled by user request',
          metadata: { status: 'cancelled' },
          timestamp: new Date().toISOString(),
        },
        timestamp: new Date().toISOString(),
      })
      res.json({ data: mapCanonicalRunToApiRun(cancelledRun) })
    } catch (cancelErr: any) {
      return next(createError(cancelErr.message, 400, 'BAD_REQUEST'))
    }
  } catch (err) {
    next(err)
  }
}

export async function storeRunEvent(req: Request, res: Response, next: NextFunction) {
  try {
    const { id: runId } = req.params
    const input = req.body as RunEventInput
    const eventId = uuidv4()
    const now = new Date().toISOString()

    const event: RunEvent = {
      id: eventId,
      run_id: runId,
      level: input.level,
      agent: input.agent,
      message: input.message,
      metadata: input.metadata ?? {},
      timestamp: now,
    }

    const run = approvalRuntime.getRun(runId)
    if (run) {
      run.events.push({
        timestamp: Date.now(),
        type: input.level === 'error' ? 'error' : 'state_changed',
        status: run.state?.status ?? 'running',
        message: input.message,
      })
      approvalRuntime.persistRunToDisk(run)
    }

    if (!memEvents[runId]) memEvents[runId] = []
    memEvents[runId].push(event)

    broadcast({
      type: 'run:event',
      runId,
      payload: event as any,
      timestamp: now,
    })

    res.status(201).json({ data: event })
  } catch (err) {
    next(err)
  }
}
