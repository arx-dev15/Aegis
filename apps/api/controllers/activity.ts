import { Request, Response, NextFunction } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { query } from '../db'
import { config } from '../config'

import { memActivity, ActivityItem } from '../services/memoryStore'

const validTypes = [
  'task_started', 'task_completed', 'agent_ran',
  'file_changed', 'commit', 'approval_required',
] as const

export async function getActivity(req: Request, res: Response, next: NextFunction) {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 200)
    if (config.SKIP_DB) {
      return res.json({ data: memActivity.slice(-limit).reverse() })
    }
    const items = await query(
      `SELECT * FROM activity ORDER BY timestamp DESC LIMIT $1`,
      [limit],
    )
    res.json({ data: items })
  } catch (err) {
    next(err)
  }
}

export async function storeActivity(req: Request, res: Response, next: NextFunction) {
  try {
    const { type, description, agent, metadata, projectId, runId } = req.body
    if (!type || !description) {
      return res.status(400).json({
        error: { message: 'type and description are required', code: 'VALIDATION_ERROR' },
      })
    }
    const id = uuidv4()
    const now = new Date().toISOString()

    const item: ActivityItem = {
      id,
      type,
      description,
      agent: agent ?? undefined,
      metadata: metadata ?? {},
      project_id: projectId ?? null,
      run_id: runId ?? null,
      timestamp: now,
    }

    if (config.SKIP_DB) {
      memActivity.push(item)
      return res.status(201).json({ data: item })
    }

    const [result] = await query(
      `INSERT INTO activity (id, type, description, agent, metadata, project_id, run_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [id, type, description, agent ?? null, JSON.stringify(metadata ?? {}), projectId ?? null, runId ?? null],
    )
    res.status(201).json({ data: result })
  } catch (err) {
    next(err)
  }
}
