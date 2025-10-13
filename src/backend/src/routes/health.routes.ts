import { Router } from 'express'
import { query } from '../config/db'
const r = Router()
r.get('/', async (_req, res) => {
  try {
    const now = await query<{ now: string }>('SELECT NOW() as now')
    res.json({ ok:true, service:'visicontrol-api', db_time: now.rows[0].now })
  } catch (e:any) {
    res.status(500).json({ ok:false, error: e.message })
  }
})
export default r
