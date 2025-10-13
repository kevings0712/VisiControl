import { Router } from 'express'
import health from './health.routes'
import visits from './visits.routes'
const router = Router()
router.use('/health', health)
router.use('/visits', visits)
export default router
