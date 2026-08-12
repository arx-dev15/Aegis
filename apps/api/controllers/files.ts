import { Request, Response, NextFunction } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { query, queryOne } from '../db'
import { createError } from '../middleware/errorHandler'
import { FileChangeInput } from '../schemas/run'
import { config } from '../config'

import { memFiles, ProjectFile } from '../services/memoryStore'

export async function getRunFiles(req: Request, res: Response, next: NextFunction) {
  try {
    const { runId } = req.params
    if (config.SKIP_DB) {
      return res.json({ data: memFiles[runId] ?? [] })
    }
    const files = await query(
      `SELECT * FROM project_files WHERE run_id = $1 ORDER BY created_at DESC`,
      [runId],
    )
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
