import { Router } from 'express'
import { validate } from '../middleware/validate'
import { CreateTaskSchema, UpdateTaskStatusSchema } from '../schemas/task'
import { CreateRunSchema } from '../schemas/run'
import * as tasksCtrl from '../controllers/tasks'
import * as runsCtrl from '../controllers/runs'

const router = Router()

router.post('/', validate(CreateTaskSchema), tasksCtrl.createTask)
router.get('/:id', tasksCtrl.getTask)
router.patch('/:id/status', validate(UpdateTaskStatusSchema), tasksCtrl.updateTaskStatus)

// Runs nested under task
router.get('/:taskId/runs', runsCtrl.listRunsForTask)
router.post('/:taskId/runs', validate(CreateRunSchema), runsCtrl.createRun)

export default router
