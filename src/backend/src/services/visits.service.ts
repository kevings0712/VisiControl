import { getPool } from "../config/db";
import { createNotification } from "./notifications.service";
import { sendVisitStatusChangeEmail } from "../lib/mailer";



export type CreateVisitDTO = {
  visitor_name: string;
  inmate_name?: string;
  inmate_id?: string | null;
  visit_date: string;            // YYYY-MM-DD
  visit_hour: string;            // HH:mm[:ss]
  duration_minutes?: number;     // 30, 60, 90, 120
  notes?: string | null;
  created_by?: string | null;    // quién creó la visita
  skip_auth?: boolean;           // ← permite al ADMIN saltar la validación de autorización
};

/* ================== HELPERS FORMATO ================== */

export function formatDateForText(raw: any): string {
  if (!raw) return "";
  const d = raw instanceof Date ? raw : new Date(raw);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

export function formatTimeForText(raw: any): string {
  if (!raw) return "";
  if (typeof raw === "string") {
    const [h, m] = raw.split(":");
    return `${h.padStart(2, "0")}:${(m ?? "00").padStart(2, "0")}`;
  }
  const d = raw as Date;
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

export function formatStatusLabel(status?: string | null): string {
  const s = String(status || "").toUpperCase();
  switch (s) {
    case "PENDING":
      return "Pendiente";
    case "APPROVED":
      return "Aprobada";
    case "REJECTED":
      return "Rechazada";
    case "CANCELLED":
    case "CANCELED":
      return "Cancelada";
    default:
      return s || "Pendiente";
  }
}

/* ================== HELPERS VISITAS ================== */

export function buildVisitMeta(v: {
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
    status_label: formatStatusLabel(v.status),
    inmate_id: v.inmate_id ?? null,
  };
}

async function getInmateDisplayNameById(
  inmateId: string
): Promise<string | null> {
  const db = getPool();
  const q = `
    SELECT COALESCE(
             full_name,
             trim(coalesce(first_name,'') || ' ' || coalesce(last_name,''))
           ) AS name
      FROM inmates
     WHERE id = $1
     LIMIT 1;
  `;
  const { rows } = await db.query(q, [inmateId]);
  return rows[0]?.name ?? null;
}

// ⚠️ Esta validación SOLO se usa cuando skip_auth === false
async function assertUserAuthorizedToInmate(userId: string, inmateId: string) {
  const db = getPool();
  const q = `
    SELECT 1
      FROM user_inmates
     WHERE user_id = $1
       AND inmate_id = $2
     LIMIT 1;
  `;
  const { rows } = await db.query(q, [userId, inmateId]);
  if (!rows.length) {
    const err: any = new Error(
      `El usuario ${userId} no está autorizado para el interno ${inmateId}`
    );
    err.status = 403;
    throw err;
  }
}

/* ================== CREATE ================== */

export async function createVisit(dto: CreateVisitDTO) {
  const db = getPool();

  // 1) Validar duración
  const duration = dto.duration_minutes ?? 60;
  const allowedDurations = [30, 60, 90, 120];

  if (!allowedDurations.includes(duration)) {
    const err: any = new Error(
      "La duración de la visita debe ser de 30, 60, 90 o 120 minutos."
    );
    err.status = 400;
    throw err;
  }

  // 2) Parsear hora de inicio → minutos desde 00:00
  const [hStr, mStr] = dto.visit_hour.split(":");
  const h = Number.parseInt(hStr, 10);
  const m = Number.parseInt(mStr ?? "0", 10);

  if (Number.isNaN(h) || Number.isNaN(m)) {
    const err: any = new Error("Hora de visita inválida.");
    err.status = 400;
    throw err;
  }

  const startMinutes = h * 60 + m;
  const endMinutes = startMinutes + duration;

  const MIN_START = 8 * 60;  // 08:00
  const MAX_END   = 17 * 60; // 17:00

  if (startMinutes < MIN_START || endMinutes > MAX_END) {
    const err: any = new Error(
      "La visita debe estar entre las 08:00 y las 17:00 y durar máximo 2 horas."
    );
    err.status = 400;
    throw err;
  }

  // 3) Validar solapamiento SOLO para el mismo interno (si hay inmate_id)
  let overlapQ = `
    SELECT visit_hour, duration_minutes
      FROM visits
     WHERE visit_date = $1
       AND status IN ('PENDING','APPROVED')
       AND visit_date >= CURRENT_DATE
  `;
  const overlapParams: any[] = [dto.visit_date];

  if (dto.inmate_id) {
    overlapQ += ` AND inmate_id = $2`;
    overlapParams.push(dto.inmate_id);
  }

  const overlapRes = await db.query(overlapQ, overlapParams);
  const existing = overlapRes.rows as {
    visit_hour: string;
    duration_minutes: number | null;
  }[];

  for (const row of existing) {
    const [ehStr, emStr] = String(row.visit_hour).split(":");
    const eh = Number.parseInt(ehStr, 10);
    const em = Number.parseInt(emStr ?? "0", 10);
    const existingStart = eh * 60 + em;
    const existingDuration = row.duration_minutes ?? 60;
    const existingEnd = existingStart + existingDuration;

    // [start, end) vs [existingStart, existingEnd)
    if (startMinutes < existingEnd && endMinutes > existingStart) {
      const err: any = new Error(
        "Ese horario se solapa con otra visita ya registrada para esa fecha. Elige otro horario."
      );
      err.status = 409;
      throw err;
    }
  }

  // 4) Validar autorización usuario–interno
  if (!dto.skip_auth && dto.created_by && dto.inmate_id) {
    await assertUserAuthorizedToInmate(dto.created_by, dto.inmate_id);
  }

  // 5) Resolver nombre del interno
  let inmateName = dto.inmate_name?.trim();
  if (dto.inmate_id && !inmateName) {
    inmateName = (await getInmateDisplayNameById(dto.inmate_id)) ?? "";
  }

  // 6) Insert
  const q = `
    INSERT INTO visits
      (visitor_name, inmate_name, inmate_id,
       visit_date, visit_hour, duration_minutes,
       notes, created_by)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
    RETURNING *;
  `;
  const { rows } = await db.query(q, [
    dto.visitor_name,
    inmateName ?? dto.inmate_name ?? "",
    dto.inmate_id ?? null,
    dto.visit_date,
    dto.visit_hour,
    duration,
    dto.notes ?? null,
    dto.created_by ?? null,
  ]);

  const v = rows[0];

  // 7) Notificación VISIT_CREATED
  try {
    if (v?.created_by) {
      await createNotification({
        user_id: v.created_by,
        visit_id: v.id,
        kind: "VISIT_CREATED",
        title: "Visita registrada",
        body: `Tu visita fue registrada para el ${formatDateForText(
          v.visit_date
        )} a las ${formatTimeForText(
          v.visit_hour
        )}. Estado: ${formatStatusLabel(v.status ?? "PENDING")}.`,
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

/* ================== LIST ================== */

export async function listVisits(params: {
  date?: string;
  status?: string;
  created_by?: string;
  inmate_id?: string;
}) {
  const db = getPool();
  const wh: string[] = [];
  const vals: any[] = [];

  if (params.date) {
    wh.push(`visit_date = $${vals.length + 1}`);
    vals.push(params.date);
  }
  if (params.status) {
    wh.push(`status = $${vals.length + 1}`);
    vals.push(params.status);
  }
  if (params.created_by) {
    wh.push(`created_by = $${vals.length + 1}`);
    vals.push(params.created_by);
  }
  if (params.inmate_id) {
    wh.push(`inmate_id = $${vals.length + 1}`);
    vals.push(params.inmate_id);
  }

  const where = wh.length ? `WHERE ${wh.join(" AND ")}` : "";
  const q = `SELECT * FROM visits ${where}
             ORDER BY visit_date DESC, visit_hour DESC
             LIMIT 200`;
  const { rows } = await db.query(q, vals);
  return rows;
}

/* ================== UPDATE ================== */

export async function updateVisit(
  id: string,
  patch: {
    visitor_name?: string;
    inmate_name?: string;
    inmate_id?: string | null;
    visit_date?: string;
    visit_hour?: string;
    duration_minutes?: number;
    status?: string;
    notes?: string | null;
  }
) {
  const db = getPool();

  // 1) Leer valores previos
  const prevQ = `
    SELECT id, visitor_name, inmate_name, inmate_id,
           visit_date, visit_hour, status,
           created_by, notes, duration_minutes
      FROM visits
     WHERE id = $1
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
        notes?: string | null;
        duration_minutes?: number | null;
      }
    | undefined;

  if (!prev) return null;

  const oldStatus   = prev.status;
  const oldDate     = prev.visit_date;
  const oldHour     = prev.visit_hour;
  const oldInmateId = prev.inmate_id ?? null;
  const owner       = prev.created_by ?? null;

  // Datos del dueño para correos
  let ownerEmail: string | null = null;
  let ownerName: string | null = null;
  let ownerNotifyEmail = false;

  if (owner) {
    const userRes = await db.query(
      `SELECT email, name, notify_email
         FROM users
        WHERE id = $1
        LIMIT 1`,
      [owner]
    );
    if (userRes.rows[0]) {
      ownerEmail = userRes.rows[0].email ?? null;
      ownerName = userRes.rows[0].name ?? null;
      ownerNotifyEmail = !!userRes.rows[0].notify_email;
    }
  }

  // 2) Mezclar nuevos valores
  const newVisitorName = patch.visitor_name ?? prev.visitor_name;
  const newStatus      = (patch.status ?? prev.status) || "PENDING";
  const newDate        = patch.visit_date ?? prev.visit_date;
  const newHour        = patch.visit_hour ?? prev.visit_hour;
  const newDuration    = patch.duration_minutes ?? prev.duration_minutes ?? 60;
  const newNotes =
    patch.notes !== undefined ? patch.notes : prev.notes ?? null;
  const newInmateId =
    patch.inmate_id !== undefined ? patch.inmate_id : prev.inmate_id;

  // 3) Nombre del interno
  let newInmateName =
    (patch.inmate_name && patch.inmate_name.trim()) || prev.inmate_name;

  if (newInmateId && (!patch.inmate_name || !patch.inmate_name.trim())) {
    const autoName = await getInmateDisplayNameById(newInmateId);
    if (autoName) newInmateName = autoName;
  }

  // 4) Validar autorización si cambia el interno
  if (owner && newInmateId && newInmateId !== oldInmateId) {
    await assertUserAuthorizedToInmate(owner, newInmateId);
  }

  // 4.1) Validar duración
  const allowedDurations = [30, 60, 90, 120];
  if (!allowedDurations.includes(newDuration)) {
    const err: any = new Error(
      "La duración de la visita debe ser de 30, 60, 90 o 120 minutos."
    );
    err.status = 400;
    throw err;
  }

  // 4.2) Validar rango horario
  const [hStr, mStr] = newHour.split(":");
  const h = Number.parseInt(hStr, 10);
  const m = Number.parseInt(mStr ?? "0", 10);

  if (Number.isNaN(h) || Number.isNaN(m)) {
    const err: any = new Error("Hora de visita inválida.");
    err.status = 400;
    throw err;
  }

  const startMinutes = h * 60 + m;
  const endMinutes = startMinutes + newDuration;

  const MIN_START = 8 * 60;
  const MAX_END   = 17 * 60;

  if (startMinutes < MIN_START || endMinutes > MAX_END) {
    const err: any = new Error(
      "La visita debe estar entre las 08:00 y las 17:00 y durar máximo 2 horas."
    );
    err.status = 400;
    throw err;
  }

  // 4.3) Validar solapamiento (mismo interno, excluyéndome)
  if (["PENDING", "APPROVED"].includes(newStatus.toUpperCase())) {
    let overlapQ = `
      SELECT id, visit_hour, duration_minutes
        FROM visits
       WHERE visit_date = $1
         AND status IN ('PENDING','APPROVED')
         AND visit_date >= CURRENT_DATE
         AND id <> $2
    `;
    const overlapParams: any[] = [newDate, id];

    if (newInmateId) {
      overlapQ += ` AND inmate_id = $3`;
      overlapParams.push(newInmateId);
    }

    const overlapRes = await db.query(overlapQ, overlapParams);
    const existing = overlapRes.rows as {
      id: string;
      visit_hour: string;
      duration_minutes: number | null;
    }[];

    for (const row of existing) {
      const [ehStr, emStr] = String(row.visit_hour).split(":");
      const eh = Number.parseInt(ehStr, 10);
      const em = Number.parseInt(emStr ?? "0", 10);
      const existingStart = eh * 60 + em;
      const existingDuration = row.duration_minutes ?? 60;
      const existingEnd = existingStart + existingDuration;

      if (startMinutes < existingEnd && endMinutes > existingStart) {
        const err: any = new Error(
          "Ese horario se solapa con otra visita ya registrada para esa fecha. Elige otro horario."
        );
        err.status = 409;
        throw err;
      }
    }
  }

  // 5) Actualizar
  const updQ = `
    UPDATE visits
       SET visitor_name     = $1,
           inmate_name      = $2,
           inmate_id        = $3,
           visit_date       = $4,
           visit_hour       = $5,
           duration_minutes = $6,
           status           = $7,
           notes            = $8
     WHERE id = $9
     RETURNING *;
  `;
  const { rows } = await db.query(updQ, [
    newVisitorName,
    newInmateName,
    newInmateId ?? null,
    newDate,
    newHour,
    newDuration,
    newStatus,
    newNotes,
    id,
  ]);
  const v = rows[0];

  // 6) Notificaciones (internas + correo)
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

      const hasStatusChange =
        patch.status !== undefined && patch.status !== oldStatus;

      const changedDate =
        patch.visit_date !== undefined && patch.visit_date !== oldDate;
      const changedHour =
        patch.visit_hour !== undefined && patch.visit_hour !== oldHour;
      const changedInmate =
        patch.inmate_id !== undefined && patch.inmate_id !== oldInmateId;
      const hasScheduleChange = changedDate || changedHour || changedInmate;

      const canEmail = !!ownerEmail && ownerNotifyEmail;
      const formattedDateNew = formatDateForText(v.visit_date);
      const formattedHourNew = formatTimeForText(v.visit_hour);

      if (hasStatusChange) {
        if (patch.status === "APPROVED") {
          // Notificación interna
          await createNotification({
            user_id: owner,
            visit_id: id,
            kind: "VISIT_APPROVED",
            title: "Visita aprobada",
            body: "Tu solicitud de visita ha sido aprobada.",
            meta: {
              ...metaBase,
              old_status: oldStatus,
              new_status: patch.status,
            },
          });

          // Correo
          if (canEmail) {
            await sendVisitStatusChangeEmail({
              to: ownerEmail!,
              userName: ownerName,
              inmateName: v.inmate_name,
              visitDate: formattedDateNew,
              visitHour: formattedHourNew,
              newStatusLabel: "aprobada",
              extraMessage:
                "Tu solicitud de visita ha sido aprobada por el centro.",
            });
          }
        } else if (patch.status === "REJECTED") {
          // Notificación interna (mantienes VISIT_CANCELED como ya lo usabas)
          await createNotification({
            user_id: owner,
            visit_id: id,
            kind: "VISIT_CANCELED",
            title: "Visita rechazada",
            body: "Lamentamos informarte que tu visita fue rechazada.",
            meta: {
              ...metaBase,
              old_status: oldStatus,
              new_status: patch.status,
            },
          });

          // Correo
          if (canEmail) {
            await sendVisitStatusChangeEmail({
              to: ownerEmail!,
              userName: ownerName,
              inmateName: v.inmate_name,
              visitDate: formattedDateNew,
              visitHour: formattedHourNew,
              newStatusLabel: "rechazada",
              extraMessage:
                "Lamentamos informarte que tu visita no fue aprobada.",
            });
          }
        }
      } else if (hasScheduleChange) {
        // Notificación interna por reprogramación
        await createNotification({
          user_id: owner,
          visit_id: id,
          kind: "VISIT_UPDATED",
          title: "Visita reprogramada",
          body: `Tu visita fue reprogramada para el ${formattedDateNew} a las ${formattedHourNew}.`,
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

        // Correo por reprogramación
        if (canEmail) {
          await sendVisitStatusChangeEmail({
            to: ownerEmail!,
            userName: ownerName,
            inmateName: v.inmate_name,
            visitDate: formattedDateNew,
            visitHour: formattedHourNew,
            newStatusLabel: "reprogramada",
            extraMessage:
              "Se modificó la fecha y/o la hora de tu visita. Verifica el nuevo horario antes de asistir.",
          });
        }
      }
    }
  } catch (e) {
    console.error("[visits.service] update notifications failed", e);
  }

  return v;
}


/* ================== DELETE ================== */

export async function deleteVisit(id: string) {
  const db = getPool();
  await db.query(`DELETE FROM visits WHERE id = $1`, [id]);
  return { ok: true };
}


export async function cancelVisit(userId: string, visitId: string) {
  const db = getPool();

  const q = `
    UPDATE visits
       SET status = 'CANCELLED',
           updated_at = NOW()
     WHERE id = $1
       AND created_by = $2
       AND status IN ('PENDING', 'APPROVED')
       AND visit_date >= CURRENT_DATE
     RETURNING *;
  `;

  const { rows } = await db.query(q, [visitId, userId]);

  if (rows.length === 0) {
    return {
      ok: false,
      message:
        "No se pudo cancelar la visita (no existe, no es tuya, ya pasó o ya estaba cancelada).",
    };
  }

  const v = rows[0];
  try {
    await createNotification({
      user_id: userId,
      visit_id: v.id,
      kind: "VISIT_CANCELED",
      title: "Visita cancelada",
      body: `Cancelaste tu visita a ${v.inmate_name} para el ${formatDateForText(
        v.visit_date
      )}.`,
      meta: buildVisitMeta({
        id: v.id,
        visitor_name: v.visitor_name,
        inmate_name: v.inmate_name,
        visit_date: v.visit_date,
        visit_hour: v.visit_hour,
        status: v.status,
        inmate_id: v.inmate_id ?? null,
      }),
    });
  } catch (e) {
    console.error("[visits.service] cancelVisit notification failed", e);
  }

  return { ok: true, visit: v };
}
