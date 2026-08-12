import { Router } from 'express'
import projectsRouter from './projects'
import tasksRouter from './tasks'
import runsRouter from './runs'
import approvalsRouter from './approvals'
import activityRouter from './activity'

const router = Router()

router.use('/projects', projectsRouter)
router.use('/tasks', tasksRouter)
router.use('/runs', runsRouter)
router.use('/approvals', approvalsRouter)
router.use('/activity', activityRouter)

export default router
