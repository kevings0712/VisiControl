// src/backend/src/services/inmates.service.ts
import { getPool } from "../config/db";

export type InmateStatus = "ACTIVE" | "ENABLED" | "BLOCKED";
export type DocType = "CEDULA" | "PASAPORTE" | "OTRO";
export type Relation = "AUTHORIZED" | "FAMILY" | "LAWYER" | "OTHER";

export type InmateCreateDTO = {
  first_name: string;
  last_name: string;
  doc_type?: DocType;
  national_id?: string | null;
  birth_date?: string | null; // YYYY-MM-DD
  pavilion?: string | null;
  cell?: string | null;
  status?: InmateStatus;
  notes?: string | null;
};

export type InmateUpdateDTO = Partial<InmateCreateDTO>;

// --- helper para mapear el status del form a la BD ---
function normalizeStatusForDb(status?: InmateStatus | string | null): string {
  if (!status) return "ACTIVE";
  if (status === "ENABLED") return "ACTIVE"; // el select del front usa ENABLED
  return status;
}

// =================== LISTA MIS INTERNOS (usuario normal) ===================
export async function listMyInmates(userId: string, search?: string) {
  const db = getPool();

  const vals: any[] = [userId];
  let searchSql = "";

  if (search && search.trim()) {
    vals.push(`%${search.trim().toLowerCase()}%`);
    searchSql = `
      AND (
        lower(i.first_name || ' ' || i.last_name) LIKE $${vals.length}
        OR i.national_id ILIKE $${vals.length}
      )
    `;
  }

  // Acepta ACTIVE o ENABLED por compatibilidad
  const statusSql = `AND (i.status = 'ENABLED' OR i.status = 'ACTIVE')`;

  const q = `
    SELECT
      i.id         AS inmate_id,
      i.first_name,
      i.last_name,
      ui.rel       AS relation
    FROM user_inmates ui
    JOIN inmates i ON i.id = ui.inmate_id
    WHERE ui.user_id = $1
      ${statusSql}
      ${searchSql}
    ORDER BY i.first_name ASC, i.last_name ASC
    LIMIT 200;
  `;

  const { rows } = await db.query(q, vals);
  return rows;
}

// =================== ADMIN: LIST / GET ===================
export async function adminListInmates(params: {
  q?: string;
  status?: InmateStatus;
  page?: number;
  limit?: number;
}) {
  const db = getPool();
  const page = Math.max(1, Number(params.page || 1));
  const limit = Math.min(200, Math.max(1, Number(params.limit || 50)));
  const offset = (page - 1) * limit;

  const vals: any[] = [];
  const wh: string[] = [];

  if (params.status) {
    vals.push(params.status);
    wh.push(`i.status = $${vals.length}`);
  }
  if (params.q && params.q.trim()) {
    vals.push(`%${params.q.trim().toLowerCase()}%`);
    wh.push(
      `(lower(i.full_name) LIKE $${vals.length} OR i.national_id ILIKE $${vals.length})`
    );
  }

  const where = wh.length ? `WHERE ${wh.join(" AND ")}` : "";

  const sql = `
    SELECT i.*
      FROM inmates i
      ${where}
     ORDER BY i.created_at DESC
     LIMIT ${limit} OFFSET ${offset};
  `;

  const countSql = `SELECT count(*)::int AS total FROM inmates i ${where};`;

  const [listRes, countRes] = await Promise.all([
    db.query(sql, vals),
    db.query(countSql, vals),
  ]);

  return {
    items: listRes.rows,
    pagination: { page, limit, total: countRes.rows[0].total },
  };
}

export async function adminGetInmate(id: string) {
  const db = getPool();
  const { rows } = await db.query(`SELECT * FROM inmates WHERE id=$1 LIMIT 1`, [
    id,
  ]);
  return rows[0] || null;
}

// =================== ADMIN: CREATE ===================
export async function adminCreateInmate(data: InmateCreateDTO) {
  const db = getPool();

  const q = `
    INSERT INTO inmates (
      first_name,
      last_name,
      doc_type,
      national_id,
      birth_date,
      pavilion,
      cell,
      status,
      notes
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
    RETURNING *;
  `;

  const vals = [
    data.first_name,
    data.last_name,
    data.doc_type ?? "CEDULA",
    data.national_id ?? null,
    data.birth_date ?? null,
    data.pavilion ?? null,
    data.cell ?? null,
    normalizeStatusForDb(data.status),
    data.notes ?? null,
  ];

  const { rows } = await db.query(q, vals);
  return rows[0];
}

// =================== ADMIN: UPDATE ===================
export async function adminUpdateInmate(id: string, data: InmateUpdateDTO) {
  const db = getPool();

  const current = await adminGetInmate(id);
  if (!current) return null;

  const first_name = data.first_name ?? current.first_name;
  const last_name = data.last_name ?? current.last_name;
  const doc_type = data.doc_type ?? current.doc_type;
  const national_id =
    data.national_id !== undefined ? data.national_id : current.national_id;
  const birth_date =
    data.birth_date !== undefined ? data.birth_date : current.birth_date;
  const pavilion = data.pavilion ?? current.pavilion;
  const cell = data.cell ?? current.cell;
  const status = normalizeStatusForDb(
    (data.status as InmateStatus | undefined) ?? current.status
  );
  const notes = data.notes !== undefined ? data.notes : current.notes;

  const q = `
    UPDATE inmates
       SET first_name = $1,
           last_name  = $2,
           doc_type   = $3,
           national_id = $4,
           birth_date  = $5,
           pavilion    = $6,
           cell        = $7,
           status      = $8,
           notes       = $9,
           updated_at  = now()
     WHERE id = $10
     RETURNING *;
  `;

  const vals = [
    first_name,
    last_name,
    doc_type,
    national_id,
    birth_date,
    pavilion,
    cell,
    status,
    notes,
    id,
  ];

  const { rows } = await db.query(q, vals);
  return rows[0] || null;
}

// =================== ADMIN: DELETE ===================
export async function adminDeleteInmate(id: string) {
  const db = getPool();
  await db.query(`DELETE FROM inmates WHERE id=$1`, [id]);
  return { ok: true };
}

// =================== ADMIN: autorizar / desautorizar usuarios ===================
export async function adminAuthorizeUser(
  inmateId: string,
  userId: string,
  rel: Relation = "AUTHORIZED"
) {
  const db = getPool();
  const q = `
    INSERT INTO user_inmates (user_id, inmate_id, rel)
    VALUES ($1,$2,$3)
    ON CONFLICT (user_id, inmate_id) DO UPDATE SET rel = EXCLUDED.rel
    RETURNING *;
  `;
  const { rows } = await db.query(q, [userId, inmateId, rel]);
  return rows[0];
}

export async function adminUnauthorizeUser(inmateId: string, userId: string) {
  const db = getPool();
  await db.query(
    `DELETE FROM user_inmates WHERE user_id=$1 AND inmate_id=$2`,
    [userId, inmateId]
  );
  return { ok: true };
}

// ---------- ADMIN: listar usuarios autorizados de un interno ----------
export async function adminListInmateUsers(inmateId: string) {
  const db = getPool();
  const q = `
    SELECT 
      ui.user_id,
      ui.inmate_id,
      ui.rel,
      u.name,
      u.email
    FROM user_inmates ui
    JOIN users u ON u.id = ui.user_id
    WHERE ui.inmate_id = $1
    ORDER BY u.name ASC;
  `;
  const { rows } = await db.query(q, [inmateId]);
  return rows;
}

// ---------- ADMIN: buscar usuarios por nombre/correo ----------
export async function adminSearchUsers(q: string) {
  const db = getPool();
  const text = q.trim();

  if (!text) {
    return [];
  }

  const like = `%${text.toLowerCase()}%`;
  const sql = `
    SELECT id, name, email
    FROM users
    WHERE lower(name) LIKE $1
       OR lower(email) LIKE $1
    ORDER BY name ASC
    LIMIT 50;
  `;
  const { rows } = await db.query(sql, [like]);
  return rows;
}
