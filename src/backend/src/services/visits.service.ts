// src/backend/src/services/visits.service.ts
import { getPool } from "../config/db";
import { createNotification } from "./notifications.service";

export type CreateVisitDTO = {
  visitor_name: string;
  inmate_name?: string;
  inmate_id?: string | null;
  visit_date: string;            // YYYY-MM-DD
  visit_hour: string;            // HH:mm[:ss]
  notes?: string | null;
  created_by?: string | null;    // quién creó la visita
  skip_auth?: boolean;           // ← permite al ADMIN saltar la validación de autorización
};

// ---- Helpers ----
function buildVisitMeta(v: {
  id: string;
  visitor_name: string;
  inmate_name: string;
  visit_date: string;
  visit_hour: string;
  status: string;
  inmate_id?: string | null;
}) {
  return {
    visit_id: v.id,
    visitor_name: v.visitor_name,
    inmate_name: v.inmate_name,
    visit_date: v.visit_date,
    visit_hour: v.visit_hour,
    status: v.status,
    inmate_id: v.inmate_id ?? null,
  };
}

async function getInmateDisplayNameById(inmateId: string): Promise<string | null> {
  const db = getPool();
  const q = `
    SELECT COALESCE(full_name, trim(coalesce(first_name,'') || ' ' || coalesce(last_name,''))) AS name
      FROM inmates
     WHERE id = $1
     LIMIT 1;
  `;
  const { rows } = await db.query(q, [inmateId]);
  return rows[0]?.name ?? null;
}

async function assertUserAuthorizedToInmate(userId: string, inmateId: string) {
  const db = getPool();
  const q = `SELECT 1 FROM user_inmates WHERE user_id = $1 AND inmate_id = $2 LIMIT 1`;
  const { rows } = await db.query(q, [userId, inmateId]);
  if (!rows.length) {
    const err: any = new Error("USER_NOT_AUTHORIZED_FOR_INMATE");
    err.status = 403;
    throw err;
  }
}

export async function createVisit(dto: CreateVisitDTO) {
  const db = getPool();

  // 1) Si llegó inmate_id y no hay inmate_name, lo obtenemos
  let inmateName = dto.inmate_name?.trim();
  if (dto.inmate_id && !inmateName) {
    inmateName = (await getInmateDisplayNameById(dto.inmate_id)) ?? "";
  }

  // 2) Validar autorización SOLO si no es ADMIN (skip_auth=false)
  if (!dto.skip_auth && dto.created_by && dto.inmate_id) {
    await assertUserAuthorizedToInmate(dto.created_by, dto.inmate_id);
  }

  // 3) Insert con inmate_id
  const q = `
    INSERT INTO visits (visitor_name, inmate_name, inmate_id, visit_date, visit_hour, notes, created_by)
    VALUES ($1,$2,$3,$4,$5,$6,$7)
    RETURNING *`;
  const { rows } = await db.query(q, [
    dto.visitor_name,
    inmateName ?? dto.inmate_name ?? "",     // por compatibilidad
    dto.inmate_id ?? null,
    dto.visit_date,
    dto.visit_hour,
    dto.notes ?? null,
    dto.created_by ?? null,
  ]);

  const v = rows[0];

  // 🔔 Notificación: VISIT_CREATED
  try {
    if (v?.created_by) {
      await createNotification({
        user_id: v.created_by,
        visit_id: v.id,
        kind: "VISIT_CREATED",
        title: "Visita registrada",
        body: `Tu visita fue registrada para el ${String(v.visit_date)} a las ${String(v.visit_hour)}. Estado: ${v.status ?? "PENDING"}.`,
        meta: buildVisitMeta({
          id: v.id,
          visitor_name: v.visitor_name,
          inmate_name: v.inmate_name,
          visit_date: v.visit_date,
          visit_hour: v.visit_hour,
          status: v.status ?? "PENDING",
          inmate_id: v.inmate_id ?? null,
        }),
      });
    }
  } catch (e) {
    console.error("[visits.service] VISIT_CREATED notif failed", e);
  }

  return v;
}

export async function listVisits(params: {
  date?: string;
  status?: string;
  created_by?: string;  // ← NUEVO: permite filtrar por dueño
}) {
  const db = getPool();
  const wh: string[] = [];
  const vals: any[] = [];

  if (params.date)      { wh.push(`visit_date = $${vals.length + 1}`); vals.push(params.date); }
  if (params.status)    { wh.push(`status = $${vals.length + 1}`);     vals.push(params.status); }
  if (params.created_by){ wh.push(`created_by = $${vals.length + 1}`); vals.push(params.created_by); }

  const where = wh.length ? `WHERE ${wh.join(" AND ")}` : "";
  const q = `SELECT * FROM visits ${where} ORDER BY visit_date DESC, visit_hour DESC LIMIT 200`;
  const { rows } = await db.query(q, vals);
  return rows;
}

export async function updateVisit(
  id: string,
  data: {
    visitor_name: string;
    inmate_name?: string;          // opcional si llega inmate_id
    inmate_id?: string | null;     // opcional
    visit_date: string;            // YYYY-MM-DD
    visit_hour: string;            // HH:mm[:ss]
    status: string;                // PENDING | APPROVED | REJECTED
    notes?: string | null;
  }
) {
  const db = getPool();

  // Leer valores previos (incluye dueño)
  const prevQ = `
    SELECT id, visitor_name, inmate_name, inmate_id, visit_date, visit_hour, status, created_by
      FROM visits
     WHERE id=$1
  `;
  const prevRes = await db.query(prevQ, [id]);
  const prev = prevRes.rows[0] as
    | {
        id: string;
        visitor_name: string;
        inmate_name: string;
        inmate_id: string | null;
        visit_date: string;
        visit_hour: string;
        status: string;
        created_by: string | null;
      }
    | undefined;

  const oldStatus   = prev?.status;
  const oldDate     = prev?.visit_date;
  const oldHour     = prev?.visit_hour;
  const oldInmateId = prev?.inmate_id ?? null;
  const owner       = prev?.created_by ?? null;

  // Si viene inmate_id sin nombre, intenta autocompletar
  let newInmateName = data.inmate_name?.trim();
  if (data.inmate_id && !newInmateName) {
    newInmateName = (await getInmateDisplayNameById(data.inmate_id)) ?? prev?.inmate_name ?? "";
  }

  // (Opcional) Validar autorización si cambia/fija inmate_id
  if (owner && data.inmate_id && data.inmate_id !== oldInmateId) {
    await assertUserAuthorizedToInmate(owner, data.inmate_id);
  }

  // Actualizar (incluye inmate_id)
  const updQ = `
    UPDATE visits
       SET visitor_name=$1,
           inmate_name=$2,
           inmate_id=$3,
           visit_date=$4,
           visit_hour=$5,
           status=$6,
           notes=$7
     WHERE id=$8
     RETURNING *`;
  const { rows } = await db.query(updQ, [
    data.visitor_name,
    newInmateName ?? data.inmate_name ?? prev?.inmate_name ?? "",
    data.inmate_id ?? oldInmateId ?? null,
    data.visit_date,
    data.visit_hour,
    data.status,
    data.notes ?? null,
    id,
  ]);
  const v = rows[0];

  // 🔔 Notificaciones por cambios
  try {
    if (owner) {
      const metaBase = buildVisitMeta({
        id: v.id,
        visitor_name: v.visitor_name,
        inmate_name: v.inmate_name,
        visit_date: v.visit_date,
        visit_hour: v.visit_hour,
        status: v.status,
        inmate_id: v.inmate_id ?? null,
      });

      // Cambio de estado
      if (oldStatus && oldStatus !== data.status) {
        if (data.status === "APPROVED") {
          await createNotification({
            user_id: owner,
            visit_id: id,
            kind: "VISIT_APPROVED",
            title: "Visita Aprobada",
            body: "Tu solicitud de visita ha sido aprobada.",
            meta: { ...metaBase, old_status: oldStatus, new_status: data.status },
          });
        } else if (data.status === "REJECTED") {
          await createNotification({
            user_id: owner,
            visit_id: id,
            kind: "VISIT_CANCELED",
            title: "Visita Rechazada",
            body: "Lamentamos informarte que tu visita fue rechazada.",
            meta: { ...metaBase, old_status: oldStatus, new_status: data.status },
          });
        }
      }

      // Cambio de fecha/hora o del interno
      const changedDate   = !!(oldDate && oldDate !== data.visit_date);
      const changedHour   = !!(oldHour && oldHour !== data.visit_hour);
      const changedInmate = (data.inmate_id ?? oldInmateId) !== oldInmateId;

      if (changedDate || changedHour || changedInmate) {
        await createNotification({
          user_id: owner,
          visit_id: id,
          kind: "VISIT_UPDATED",
          title: "Visita reprogramada",
          body: `Tu visita fue actualizada para el ${v.visit_date} a las ${v.visit_hour}.`,
          meta: {
            ...metaBase,
            old_date: oldDate,
            old_hour: oldHour,
            new_date: v.visit_date,
            new_hour: v.visit_hour,
            old_inmate_id: oldInmateId,
            new_inmate_id: v.inmate_id ?? null,
          },
        });
      }
    }
  } catch (e) {
    console.error("[visits.service] update notifications failed", e);
  }

  return v;
}

export async function deleteVisit(id: string) {
  const db = getPool();
  await db.query(`DELETE FROM visits WHERE id=$1`, [id]);
  return { ok: true };
}
