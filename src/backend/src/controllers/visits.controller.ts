import * as service from '../services/visits.service'
import { ok, fail } from '../utils/response'

export async function list (_req:any, res:any) {
  try {
    const data = await service.listVisits()
    res.json(ok(data))
  } catch (e:any) {
    res.status(500).json(fail(e.message))
  }
}

export async function create (req:any, res:any) {
  try {
    const created = await service.createVisit(req.body)
    res.status(201).json(ok(created))
  } catch (e:any) {
    res.status(400).json(fail(e.message))
  }
}
