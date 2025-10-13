import { Router } from 'express'
import * as controller from '../controllers/visits.controller'
import auth from '../middlewares/auth'
const r = Router()
r.get('/', auth.optional, controller.list)
r.post('/', auth.required, controller.create)
export default r
