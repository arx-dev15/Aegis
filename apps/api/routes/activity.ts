import { Router } from 'express'
import * as activityCtrl from '../controllers/activity'

const router = Router()

router.get('/', activityCtrl.getActivity)
router.post('/', activityCtrl.storeActivity)

export default router
