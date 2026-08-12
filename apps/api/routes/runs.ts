import { Router } from 'express'
import { validate } from '../middleware/validate'
import { RunEventSchema, FileChangeSchema } from '../schemas/run'
import { CreateApprovalSchema } from '../schemas/approval'
import * as runsCtrl from '../controllers/runs'
import * as filesCtrl from '../controllers/files'
import * as approvalsCtrl from '../controllers/approvals'

const router = Router()

router.get('/:id', runsCtrl.getRun)
router.get('/:id/status', runsCtrl.getRunStatus)
router.post('/:id/events', validate(RunEventSchema), runsCtrl.storeRunEvent)

// Files per run
router.get('/:runId/files', filesCtrl.getRunFiles)
router.post('/:runId/files', validate(FileChangeSchema), filesCtrl.storeFileChange)

// Approvals per run
router.post('/:runId/approvals', validate(CreateApprovalSchema), approvalsCtrl.createApproval)

export default router
