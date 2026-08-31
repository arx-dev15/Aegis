import { Request, Response, NextFunction } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { query, queryOne } from '../db'
import { createError } from '../middleware/errorHandler'
import { CreateApprovalInput, ResolveApprovalInput } from '../schemas/approval'
import { config } from '../config'
import { broadcast } from '../ws'
import * as agentService from '../services/agentService'

import { memApprovals, Approval } from '../services/memoryStore'

export async function createApproval(req: Request, res: Response, next: NextFunction) {
  try {
    const { runId } = req.params
    const input = req.body as CreateApprovalInput
    const id = uuidv4()
    const now = new Date().toISOString()

    const approval: Approval = {
      id,
      run_id: runId,
      type: input.type,
      title: input.title,
      description: input.description,
      requested_by: input.requestedBy,
      status: 'pending',
      requested_at: now,
      resolved_at: null,
      resolution: null,
    }

    if (config.SKIP_DB) {
      memApprovals[id] = approval
    } else {
      await query(
        `INSERT INTO approvals (id, run_id, type, title, description, requested_by, status)
         VALUES ($1, $2, $3, $4, $5, $6, 'pending')`,
        [id, runId, input.type, input.title, input.description, input.requestedBy],
      )
    }

    // Notify frontend via WebSocket
    broadcast({
      type: 'approval:requested',
      runId,
      payload: approval as any,
      timestamp: now,
    })

    // Notify agent service to pause
    await agentService.requestApproval(runId, id, input.title)

    res.status(201).json({ data: approval })
  } catch (err) {
    next(err)
  }
}

export async function getApproval(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params
    if (config.SKIP_DB) {
      const a = memApprovals[id]
      if (!a) return next(createError('Approval not found', 404, 'NOT_FOUND'))
      return res.json({ data: a })
    }
    const approval = await queryOne(`SELECT * FROM approvals WHERE id = $1`, [id])
    if (!approval) return next(createError('Approval not found', 404, 'NOT_FOUND'))
    res.json({ data: approval })
  } catch (err) {
    next(err)
  }
}

export async function resolveApproval(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params
    const input = req.body as ResolveApprovalInput
    const now = new Date().toISOString()
    const newStatus = input.action === 'approve' ? 'approved' : 'rejected'

    if (config.SKIP_DB) {
      if (!memApprovals[id]) return next(createError('Approval not found', 404, 'NOT_FOUND'))
      const approval = memApprovals[id]
      if (approval.status !== 'pending') {
        return next(createError('Approval already resolved', 409, 'CONFLICT'))
      }
      memApprovals[id] = { ...approval, status: newStatus, resolved_at: now, resolution: input.reason ?? null }
      const runId = approval.run_id
      // Tell agent service to resume with human decision (approve or reject)
      await agentService.resumeRun(runId, id, input.action, input.reason ?? undefined)

      broadcast({
        type: 'approval:resolved',
        runId,
        payload: memApprovals[id] as any,
        timestamp: now,
      })
      return res.json({ data: memApprovals[id] })
    }

    const existing = await queryOne<{ status: string; run_id: string }>(
      `SELECT status, run_id FROM approvals WHERE id = $1`,
      [id],
    )
    if (!existing) return next(createError('Approval not found', 404, 'NOT_FOUND'))
    if (existing.status !== 'pending') {
      return next(createError('Approval already resolved', 409, 'CONFLICT'))
    }

    const [approval] = await query(
      `UPDATE approvals SET status = $1, resolved_at = NOW(), resolution = $2
       WHERE id = $3 RETURNING *`,
      [newStatus, input.reason ?? null, id],
    )

    await agentService.resumeRun(existing.run_id, id, input.action, input.reason ?? undefined)

    broadcast({
      type: 'approval:resolved',
      runId: existing.run_id,
      payload: approval,
      timestamp: now,
    })

    res.json({ data: approval })
  } catch (err) {
    next(err)
  }
}
