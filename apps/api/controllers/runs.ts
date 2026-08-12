import { Request, Response, NextFunction } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { query, queryOne } from '../db'
import { createError } from '../middleware/errorHandler'
import { CreateRunInput, RunEventInput, FileChangeInput } from '../schemas/run'
import { config } from '../config'
import { broadcast } from '../ws'
import * as agentService from '../services/agentService'

import { memRuns, memEvents, memFiles, memTasks, AgentRun, RunEvent } from '../services/memoryStore'

export async function createRun(req: Request, res: Response, next: NextFunction) {
  try {
    const { taskId } = req.params
    const input = req.body as CreateRunInput
    const runId = uuidv4()
    const now = new Date().toISOString()

    let task: any
    if (config.SKIP_DB) {
      task = memTasks[taskId]
      if (!task) return next(createError('Task not found', 404, 'NOT_FOUND'))
    } else {
      task = await queryOne(`SELECT * FROM tasks WHERE id = $1`, [taskId])
      if (!task) return next(createError('Task not found', 404, 'NOT_FOUND'))
    }

    const run: AgentRun = {
      id: runId,
      task_id: taskId,
      project_id: task.project_id,
      status: 'pending',
      execution_mode: input.executionMode,
      files_changed: 0,
      tests_run: 0,
      tests_passed: 0,
      started_at: now,
      completed_at: null,
      created_at: now,
    }

    if (config.SKIP_DB) {
      memRuns[runId] = run
      memEvents[runId] = []
      memFiles[runId] = []
      // Update task status in memory
      task.status = 'running'
      task.updated_at = now
    } else {
      await query(
        `INSERT INTO agent_runs (id, task_id, project_id, status, execution_mode)
         VALUES ($1, $2, $3, 'pending', $4)`,
        [runId, taskId, task.project_id, input.executionMode],
      )
    }

    // Update task status in database
    if (!config.SKIP_DB) {
      await query(`UPDATE tasks SET status = 'running', updated_at = NOW() WHERE id = $1`, [taskId])
    }

    // Broadcast run started event
    broadcast({
      type: 'run:started',
      runId,
      payload: { taskId, projectId: task.project_id, executionMode: input.executionMode },
      timestamp: now,
    })

    // Call agent service stub
    await agentService.startTask({
      runId,
      taskId,
      projectId: task.project_id,
      description: task.description ?? '',
      executionMode: input.executionMode,
    })

    res.status(201).json({ data: run })
  } catch (err) {
    next(err)
  }
}

export async function listRunsForTask(req: Request, res: Response, next: NextFunction) {
  try {
    const { taskId } = req.params
    if (config.SKIP_DB) {
      const runs = Object.values(memRuns).filter((r) => r.task_id === taskId)
      // Include events and files on each run
      const result = runs.map((r) => ({
        ...r,
        events: memEvents[r.id] ?? [],
        files: memFiles[r.id] ?? [],
      }))
      return res.json({ data: result })
    }
    const runs = await query(
      `SELECT * FROM agent_runs WHERE task_id = $1 ORDER BY created_at DESC`,
      [taskId],
    )
    res.json({ data: runs })
  } catch (err) {
    next(err)
  }
}

export async function getRun(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params
    if (config.SKIP_DB) {
      const run = memRuns[id]
      if (!run) return next(createError('Run not found', 404, 'NOT_FOUND'))
      return res.json({ data: { ...run, events: memEvents[id] ?? [], files: memFiles[id] ?? [] } })
    }
    const run = await queryOne(`SELECT * FROM agent_runs WHERE id = $1`, [id])
    if (!run) return next(createError('Run not found', 404, 'NOT_FOUND'))
    res.json({ data: run })
  } catch (err) {
    next(err)
  }
}

export async function getRunStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params
    if (config.SKIP_DB) {
      const run = memRuns[id]
      if (!run) return next(createError('Run not found', 404, 'NOT_FOUND'))
      return res.json({ data: { id, status: run.status, currentAgent: run.current_agent } })
    }
    const run = await queryOne<{ id: string; status: string; current_agent: string }>(
      `SELECT id, status, current_agent FROM agent_runs WHERE id = $1`,
      [id],
    )
    if (!run) return next(createError('Run not found', 404, 'NOT_FOUND'))
    res.json({ data: run })
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
      timestamp: now
    }

    if (config.SKIP_DB) {
      if (!memEvents[runId]) memEvents[runId] = []
      memEvents[runId].push(event)
    } else {
      await query(
        `INSERT INTO run_events (id, run_id, level, agent, message, metadata)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [eventId, runId, input.level, input.agent, input.message, JSON.stringify(input.metadata ?? {})],
      )
    }

    // Stream event over WebSocket
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
