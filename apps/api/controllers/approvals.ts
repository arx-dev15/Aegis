import { Request, Response, NextFunction } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { createError } from '../middleware/errorHandler'
import { CreateApprovalInput, ResolveApprovalInput } from '../schemas/approval'
import { broadcast } from '../ws'
import * as agentService from '../services/agentService'
import { approvalRuntime } from '../../../src/runtime/approvalWorkflow'
import { memApprovals, Approval } from '../services/memoryStore'

export async function createApproval(req: Request, res: Response, next: NextFunction) {
  try {
    const { runId } = req.params
    const input = req.body as CreateApprovalInput
    const id = uuidv4()
    const now = new Date().toISOString()

    const run = approvalRuntime.getPersistedRun(runId)
    if (!run) {
      return next(createError('Run not found', 404, 'NOT_FOUND'))
    }

    try {
      const canonicalAppr = await agentService.requestApproval(
        runId,
        id,
        input.title,
        input.description
      )

      const approval: Approval = {
        id: canonicalAppr.id,
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
      memApprovals[canonicalAppr.id] = approval

      // Notify frontend via WebSocket
      broadcast({
        type: 'approval:requested',
        runId,
        payload: approval as any,
        timestamp: now,
      })

      res.status(201).json({ data: approval })
    } catch (err: any) {
      return next(createError(err.message, 400, 'BAD_REQUEST'))
    }
  } catch (err) {
    next(err)
  }
}

export async function getApproval(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params
    const approvalInfo = approvalRuntime.findApproval(id)

    if (approvalInfo) {
      const { run, approval, isPending } = approvalInfo
      const decision = run.state.approvalDecision
      const status = isPending
        ? 'pending'
        : decision?.action === 'approve'
        ? 'approved'
        : 'rejected'

      const data: Approval = {
        id: approval.id,
        run_id: run.runId,
        type: (approval.type as any) || 'code-review',
        title: approval.title,
        description: approval.description,
        requested_by: approval.requestedBy,
        status,
        resolution: decision?.reason || null,
        requested_at: new Date(approval.requestedAt || Date.now()).toISOString(),
        resolved_at: decision?.decidedAt ? new Date(decision.decidedAt).toISOString() : null,
      }
      return res.json({ data })
    }

    // Fallback to memApprovals if registered separately
    const mem = memApprovals[id]
    if (mem) {
      return res.json({ data: mem })
    }

    return next(createError('Approval not found', 404, 'NOT_FOUND'))
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

    const approvalInfo = approvalRuntime.findApproval(id)
    if (!approvalInfo) {
      const mem = memApprovals[id]
      if (mem) {
        return next(
          createError(
            'Cannot resolve synthetic demo approval without canonical run. Start a real task run first.',
            400,
            'BAD_REQUEST'
          )
        )
      }
      return next(createError('Approval not found', 404, 'NOT_FOUND'))
    }

    if (!approvalInfo.isPending) {
      return next(createError('Approval already resolved', 409, 'CONFLICT'))
    }

    const runId = approvalInfo.run.runId

    try {
      await agentService.resumeRun(runId, id, input.action, input.reason ?? undefined)
    } catch (resumeErr: any) {
      const msg = resumeErr.message || ''
      if (msg.includes('already being resolved') || msg.includes('not pending')) {
        return next(createError(msg, 409, 'CONFLICT'))
      }
      return next(createError(msg, 400, 'BAD_REQUEST'))
    }

    const resolvedData: Approval = {
      id,
      run_id: runId,
      type: (approvalInfo.approval.type as any) || 'code-review',
      title: approvalInfo.approval.title,
      description: approvalInfo.approval.description,
      requested_by: approvalInfo.approval.requestedBy,
      status: newStatus,
      resolution: input.reason ?? null,
      requested_at: new Date(approvalInfo.approval.requestedAt || Date.now()).toISOString(),
      resolved_at: now,
    }
    memApprovals[id] = resolvedData

    broadcast({
      type: 'approval:resolved',
      runId,
      payload: resolvedData as any,
      timestamp: now,
    })

    res.json({ data: resolvedData })
  } catch (err) {
    next(err)
  }
}
