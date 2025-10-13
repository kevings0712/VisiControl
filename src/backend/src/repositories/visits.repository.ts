import { query } from '../config/db'

export async function findAll () {
  const sql = `SELECT id, visitor_id, inmate_id, date, status
               FROM visits
               ORDER BY date DESC
               LIMIT 100`
  const { rows } = await query(sql)
  return rows
}

export async function insert ({ visitor_id, inmate_id, date, status = 'PENDING' }:any) {
  const sql = `INSERT INTO visits (visitor_id, inmate_id, date, status)
               VALUES ($1, $2, $3, $4)
               RETURNING id, visitor_id, inmate_id, date, status`
  const { rows } = await query(sql, [visitor_id, inmate_id, date, status])
  return rows[0]
}
