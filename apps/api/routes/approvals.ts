import { Router } from 'express'
import { validate } from '../middleware/validate'
import { ResolveApprovalSchema } from '../schemas/approval'
import * as approvalsCtrl from '../controllers/approvals'

const router = Router()

router.get('/:id', approvalsCtrl.getApproval)
router.patch('/:id', validate(ResolveApprovalSchema), approvalsCtrl.resolveApproval)

export default router
