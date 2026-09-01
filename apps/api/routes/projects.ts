import { Router } from 'express'
import { validate } from '../middleware/validate'
import { CreateProjectSchema, UpdateProjectSchema } from '../schemas/project'
import { CreateTaskSchema } from '../schemas/task'
import * as projectsCtrl from '../controllers/projects'
import * as tasksCtrl from '../controllers/tasks'

const router = Router()

// Projects
router.get('/', projectsCtrl.listProjects)
router.post('/', validate(CreateProjectSchema), projectsCtrl.createProject)
router.get('/:id', projectsCtrl.getProject)
router.get('/:id/github', projectsCtrl.getProjectGithubData)
router.patch('/:id', validate(UpdateProjectSchema), projectsCtrl.updateProject)
router.delete('/:id', projectsCtrl.deleteProject)

// Tasks nested under project
router.get('/:projectId/tasks', tasksCtrl.listTasksForProject)

export default router
