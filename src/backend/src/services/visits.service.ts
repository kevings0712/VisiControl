import * as repo from '../repositories/visits.repository'

export async function listVisits () {
  return repo.findAll()
}

export async function createVisit (payload:any) {
  if (!payload?.visitor_id || !payload?.inmate_id || !payload?.date) {
    throw new Error('visitor_id, inmate_id y date son requeridos')
  }
  return repo.insert(payload)
}
