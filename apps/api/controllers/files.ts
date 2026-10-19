import { Request, Response, NextFunction } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { query } from '../db'
import { FileChangeInput } from '../schemas/run'
import { config } from '../config'
import { approvalRuntime } from '../../../src/runtime/approvalWorkflow'
import { memFiles, ProjectFile } from '../services/memoryStore'

export async function getRunFiles(req: Request, res: Response, next: NextFunction) {
  try {
    const { runId } = req.params

    const files: ProjectFile[] = []
    const run = approvalRuntime.getPersistedRun(runId)
    if (run?.state?.codeChanges) {
      for (const [idx, c] of run.state.codeChanges.entries()) {
        const fileStatus: 'added' | 'modified' | 'deleted' =
          c.action === 'add' ? 'added' : c.action === 'delete' ? 'deleted' : 'modified'
        files.push({
          id: `fc_${run.runId}_${idx}`,
          run_id: run.runId,
          path: c.path,
          status: fileStatus,
          additions: c.content ? c.content.split('\n').length : 0,
          deletions: 0,
          diff_content: c.content || null,
          created_at: new Date(run.events?.[0]?.timestamp || Date.now()).toISOString(),
        })
      }
    }

    if (config.SKIP_DB) {
      const manual = memFiles[runId] ?? []
      for (const mf of manual) {
        if (!files.some((f) => f.path === mf.path)) {
          files.push(mf)
        }
      }
      return res.json({ data: files })
    }

    const dbFiles = await query(
      `SELECT * FROM project_files WHERE run_id = $1 ORDER BY created_at DESC`,
      [runId],
    )
    for (const df of (dbFiles as unknown as ProjectFile[])) {
      if (!files.some((f) => f.path === df.path)) {
        files.push(df)
      }
    }
    res.json({ data: files })
  } catch (err) {
    next(err)
  }
}

export async function storeFileChange(req: Request, res: Response, next: NextFunction) {
  try {
    const { runId } = req.params
    const input = req.body as FileChangeInput
    const id = uuidv4()
    const now = new Date().toISOString()

    const file: ProjectFile = {
      id,
      run_id: runId,
      path: input.path,
      status: input.status,
      additions: input.additions,
      deletions: input.deletions,
      diff_content: input.diffContent ?? null,
      created_at: now,
    }

    if (config.SKIP_DB) {
      if (!memFiles[runId]) memFiles[runId] = []
      memFiles[runId].push(file)
      return res.status(201).json({ data: file })
    }

    const [result] = await query(
      `INSERT INTO project_files (id, run_id, path, status, additions, deletions, diff_content)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [id, runId, input.path, input.status, input.additions, input.deletions, input.diffContent ?? null],
    )
    res.status(201).json({ data: result })
  } catch (err) {
    next(err)
  }
}
