// src/backend/src/services/notifications.service.ts
import { getPool } from "../config/db";
import { ssePush } from "../utils/sse";
import { sendVisitReminderEmail } from "../lib/mailer";

export type NotificationKind =
  | "VISIT_CREATED"
  | "VISIT_APPROVED"
  | "VISIT_UPDATED"
  | "VISIT_REMINDER"
  | "VISIT_CANCELED"
  | "SYSTEM";

export type CreateNotificationDTO = {
  user_id: string;
  visit_id?: string | null;
  kind: NotificationKind;
  title: string;
  body: string;
  meta?: any;
};

export type Notification = {
  id: string;
  user_id: string;
  visit_id: string | null;
  kind: NotificationKind;
  title: string;
  body: string;
  is_read: boolean;
  created_at: string;
  read_at: string | null;
  meta: any | null;
};

export async function createNotification(dto: CreateNotificationDTO) {
  const db = getPool();
  const q = `
    INSERT INTO notifications (user_id, visit_id, kind, title, body, meta)
    VALUES ($1,$2,$3,$4,$5,$6)
    RETURNING *`;
  const { rows } = await db.query(q, [
    dto.user_id,
    dto.visit_id ?? null,
    dto.kind,
    dto.title,
    dto.body,
    dto.meta ?? null,
  ]);
  const notif = rows[0] as Notification;

  // Empujar por SSE al frontend
  if (notif?.user_id) {
    ssePush(notif.user_id, { type: "notification", item: notif });
  }

  return notif;
}

export async function listNotifications(params: {
  userId: string;
  onlyUnread?: boolean;
  limit?: number;
}) {
  const db = getPool();
  const wh: string[] = ["user_id = $1"];

  if (params.onlyUnread) wh.push("is_read = false");

  const where = "WHERE " + wh.join(" AND ");
  const limit = Math.min(params.limit ?? 50, 200);

  const q = `
    SELECT *
    FROM notifications
    ${where}
    ORDER BY created_at DESC
    LIMIT $2`;

  const { rows } = await db.query(q, [params.userId, limit]);
  return rows as Notification[];
}

export async function markAsRead(userId: string, ids: string[]) {
  if (!ids.length) return { updated: 0 };
  const db = getPool();
  const q = `
    UPDATE notifications
    SET is_read = true, read_at = now()
    WHERE user_id = $1 AND id = ANY($2::uuid[])
  `;
  const { rowCount } = await db.query(q, [userId, ids]);
  return { updated: rowCount ?? 0 };
}

export async function countUnread(userId: string) {
  const db = getPool();
  const { rows } = await db.query(
    `SELECT COUNT(*)::int AS n
     FROM notifications
     WHERE user_id=$1 AND is_read=false`,
    [userId]
  );
  return rows[0]?.n ?? 0;
}

/**
 * upsertTomorrowReminders
 * - Busca visitas para mañana (PENDING / APPROVED) de usuarios que tienen notify_email = true.
 * - Solo toma las visitas que todavía NO tienen una notificación de tipo VISIT_REMINDER.
 * - Crea la notificación y envía un correo de recordatorio.
 */
export async function upsertTomorrowReminders() {
  const db = getPool();

  const q = `
    SELECT
      v.id           AS visit_id,
      v.visit_date   AS visit_date,
      v.visit_hour   AS visit_hour,
      v.inmate_name  AS inmate_name,
      v.created_by   AS user_id,
      u.email        AS user_email,
      u.name         AS user_name
    FROM visits v
    JOIN users u ON u.id = v.created_by
    WHERE v.created_by IS NOT NULL
      AND u.notify_email = true
      AND v.status IN ('PENDING','APPROVED')
      AND v.visit_date = (CURRENT_DATE + INTERVAL '1 day')::date
      AND NOT EXISTS (
        SELECT 1
        FROM notifications n
        WHERE n.user_id = v.created_by
          AND n.visit_id = v.id
          AND n.kind = 'VISIT_REMINDER'
      )
  `;

  const { rows } = await db.query(q);

  for (const row of rows) {
    // 1) Crear notificación interna
    await createNotification({
      user_id: row.user_id,
      visit_id: row.visit_id,
      kind: "VISIT_REMINDER",
      title: "Recordatorio de visita",
      body: "Recuerda que mañana tienes una visita programada.",
      meta: {
        visit_date: row.visit_date,
        visit_hour: row.visit_hour,
        inmate_name: row.inmate_name,
      },
    });

    // 2) Enviar correo (si el usuario tiene email)
    if (row.user_email) {
      const visitDate =
        row.visit_date instanceof Date
          ? row.visit_date.toISOString().slice(0, 10)
          : String(row.visit_date);

      const visitHour =
        typeof row.visit_hour === "string"
          ? row.visit_hour.slice(0, 5)
          : String(row.visit_hour);

      await sendVisitReminderEmail({
        to: row.user_email,
        userName: row.user_name,
        inmateName: row.inmate_name,
        visitDate,
        visitHour,
      });
    }
  }

  return { ok: true, count: rows.length };
}
