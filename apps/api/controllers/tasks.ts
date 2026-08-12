import { Request, Response, NextFunction } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { query, queryOne } from '../db'
import { createError } from '../middleware/errorHandler'
import { CreateTaskInput, UpdateTaskStatusInput } from '../schemas/task'
import { config } from '../config'

import { memTasks, memProjects, Task } from '../services/memoryStore'

export async function listTasksForProject(req: Request, res: Response, next: NextFunction) {
  try {
    const { projectId } = req.params
    if (config.SKIP_DB) {
      const tasks = Object.values(memTasks).filter((t: any) => t.project_id === projectId)
      return res.json({ data: tasks })
    }
    const tasks = await query(
      `SELECT * FROM tasks WHERE project_id = $1 ORDER BY created_at DESC`,
      [projectId],
    )
    res.json({ data: tasks })
  } catch (err) {
    next(err)
  }
}

export async function getTask(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params
    if (config.SKIP_DB) {
      const t = memTasks[id]
      if (!t) return next(createError('Task not found', 404, 'NOT_FOUND'))
      return res.json({ data: t })
    }
    const task = await queryOne(`SELECT * FROM tasks WHERE id = $1`, [id])
    if (!task) return next(createError('Task not found', 404, 'NOT_FOUND'))
    res.json({ data: task })
  } catch (err) {
    next(err)
  }
}

export async function createTask(req: Request, res: Response, next: NextFunction) {
  try {
    const input = req.body as CreateTaskInput
    const id = uuidv4()
    const now = new Date().toISOString()

    if (config.SKIP_DB) {
      const project = memProjects[input.projectId]
      if (!project) return next(createError('Project not found', 404, 'NOT_FOUND'))

      const task: Task = {
        id,
        project_id: input.projectId,
        description: input.description,
        execution_mode: input.executionMode,
        priority: input.priority,
        status: 'pending',
        created_at: now,
        updated_at: now,
      }
      memTasks[id] = task

      // Update project metrics
      const projectTasks = Object.values(memTasks).filter((t) => t.project_id === project.id)
      project.task_count = projectTasks.length
      project.completed_tasks = projectTasks.filter((t) => t.status === 'completed').length
      project.updated_at = now

      return res.status(201).json({ data: task })
    }

    const [task] = await query(
      `INSERT INTO tasks (id, project_id, description, execution_mode, priority, status)
       VALUES ($1, $2, $3, $4, $5, 'pending')
       RETURNING *`,
      [id, input.projectId, input.description, input.executionMode, input.priority],
    )
    res.status(201).json({ data: task })
  } catch (err) {
    next(err)
  }
}

export async function updateTaskStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params
    const input = req.body as UpdateTaskStatusInput
    const now = new Date().toISOString()

    if (config.SKIP_DB) {
      const task = memTasks[id]
      if (!task) return next(createError('Task not found', 404, 'NOT_FOUND'))
      
      task.status = input.status
      task.updated_at = now

      // Update project metrics
      const project = memProjects[task.project_id]
      if (project) {
        const projectTasks = Object.values(memTasks).filter((t) => t.project_id === project.id)
        project.task_count = projectTasks.length
        project.completed_tasks = projectTasks.filter((t) => t.status === 'completed').length
        project.updated_at = now
      }

      return res.json({ data: task })
    }

    const [task] = await query(
      `UPDATE tasks SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [input.status, id],
    )
    if (!task) return next(createError('Task not found', 404, 'NOT_FOUND'))
    res.json({ data: task })
  } catch (err) {
    next(err)
  }
}
