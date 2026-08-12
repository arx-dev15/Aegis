import { Request, Response, NextFunction } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { query, queryOne } from '../db'
import { createError } from '../middleware/errorHandler'
import { CreateProjectInput, UpdateProjectInput } from '../schemas/project'
import { config } from '../config'

import { memProjects, Project } from '../services/memoryStore'

export async function listProjects(req: Request, res: Response, next: NextFunction) {
  try {
    if (config.SKIP_DB) {
      return res.json({ data: Object.values(memProjects) })
    }
    const projects = await query(
      `SELECT * FROM projects ORDER BY created_at DESC`,
    )
    res.json({ data: projects })
  } catch (err) {
    next(err)
  }
}

export async function getProject(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params
    if (config.SKIP_DB) {
      const p = memProjects[id]
      if (!p) return next(createError('Project not found', 404, 'NOT_FOUND'))
      return res.json({ data: p })
    }
    const project = await queryOne(`SELECT * FROM projects WHERE id = $1`, [id])
    if (!project) return next(createError('Project not found', 404, 'NOT_FOUND'))
    res.json({ data: project })
  } catch (err) {
    next(err)
  }
}

export async function createProject(req: Request, res: Response, next: NextFunction) {
  try {
    const input = req.body as CreateProjectInput
    const id = uuidv4()
    const now = new Date().toISOString()

    if (config.SKIP_DB) {
      const project: Project = {
        id,
        name: input.name,
        description: input.description,
        repo: input.repo,
        branch: input.branch,
        tech_stack: JSON.stringify(input.techStack),
        language: input.language,
        status: 'active',
        task_count: 0,
        completed_tasks: 0,
        created_at: now,
        updated_at: now,
      }
      memProjects[id] = project
      return res.status(201).json({ data: project })
    }

    const [project] = await query(
      `INSERT INTO projects (id, name, description, repo, branch, tech_stack, language, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'active')
       RETURNING *`,
      [id, input.name, input.description, input.repo, input.branch, JSON.stringify(input.techStack), input.language],
    )
    res.status(201).json({ data: project })
  } catch (err) {
    next(err)
  }
}

export async function updateProject(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params
    const input = req.body as UpdateProjectInput

    if (config.SKIP_DB) {
      const existing = memProjects[id]
      if (!existing) return next(createError('Project not found', 404, 'NOT_FOUND'))
      
      const updated: Project = {
        ...existing,
        name: input.name !== undefined ? input.name : existing.name,
        description: input.description !== undefined ? input.description : existing.description,
        repo: input.repo !== undefined ? input.repo : existing.repo,
        branch: input.branch !== undefined ? input.branch : existing.branch,
        tech_stack: input.techStack !== undefined ? JSON.stringify(input.techStack) : existing.tech_stack,
        language: input.language !== undefined ? input.language : existing.language,
        status: input.status !== undefined ? input.status : existing.status,
        updated_at: new Date().toISOString(),
      }
      memProjects[id] = updated
      return res.json({ data: updated })
    }

    const setClauses: string[] = []
    const values: unknown[] = []
    let idx = 1

    if (input.name !== undefined)        { setClauses.push(`name = $${idx++}`);         values.push(input.name) }
    if (input.description !== undefined) { setClauses.push(`description = $${idx++}`);  values.push(input.description) }
    if (input.repo !== undefined)        { setClauses.push(`repo = $${idx++}`);          values.push(input.repo) }
    if (input.branch !== undefined)      { setClauses.push(`branch = $${idx++}`);        values.push(input.branch) }
    if (input.status !== undefined)      { setClauses.push(`status = $${idx++}`);        values.push(input.status) }
    if (input.techStack !== undefined)   { setClauses.push(`tech_stack = $${idx++}`);    values.push(JSON.stringify(input.techStack)) }

    if (setClauses.length === 0) return next(createError('No fields to update', 400, 'BAD_REQUEST'))

    setClauses.push(`updated_at = NOW()`)
    values.push(id)

    const [project] = await query(
      `UPDATE projects SET ${setClauses.join(', ')} WHERE id = $${idx} RETURNING *`,
      values,
    )
    if (!project) return next(createError('Project not found', 404, 'NOT_FOUND'))
    res.json({ data: project })
  } catch (err) {
    next(err)
  }
}

export async function deleteProject(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params

    if (config.SKIP_DB) {
      if (!memProjects[id]) return next(createError('Project not found', 404, 'NOT_FOUND'))
      delete memProjects[id]
      return res.status(204).send()
    }

    const [deleted] = await query(`DELETE FROM projects WHERE id = $1 RETURNING id`, [id])
    if (!deleted) return next(createError('Project not found', 404, 'NOT_FOUND'))
    res.status(204).send()
  } catch (err) {
    next(err)
  }
}
