// src/backend/src/routes/visits.routes.ts
import { Router } from "express";
import { requireAuth, requireAdmin } from "../middlewares/auth";
import { getPool } from "../config/db";
import {
  // Usuario normal
  getMyVisitsCtrl,
  getMyVisitHistoryCtrl,
  createVisitCtrl,
  updateMyVisitCtrl,
  deleteMyVisitCtrl,

  // Admin
  adminListVisitsCtrl,
  adminChangeVisitStatusCtrl, // o adminApprove/Reject si los separas
} from "../controllers/visits.controller";

const r = Router();

/**
 * Todas las rutas de visitas requieren estar autenticado
 */
r.use(requireAuth);

/* ================== SLOTS OCUPADOS POR INTERNO ================== */
/**
 * GET /api/visits/slots?date=YYYY-MM-DD&inmate_id=<uuid>
 *
 * Devuelve todas las visitas PENDING/APPROVED de UN interno en una fecha,
 * para poder bloquear horarios en el frontend.
 */
r.get("/slots", async (req: any, res) => {
  try {
    const date =
      typeof req.query.date === "string" ? req.query.date : undefined;
    const inmateId =
      typeof req.query.inmate_id === "string"
        ? req.query.inmate_id
        : undefined;

    if (!date || !inmateId) {
      return res
        .status(400)
        .json({ ok: false, error: "date e inmate_id son requeridos" });
    }

    const db = getPool();
    const q = `
      SELECT id,
             visit_date,
             visit_hour,
             status,
             duration_minutes
        FROM visits
       WHERE visit_date = $1
         AND inmate_id = $2
         AND status IN ('PENDING','APPROVED')
         AND visit_date >= CURRENT_DATE
       ORDER BY visit_hour ASC;
    `;
    const { rows } = await db.query(q, [date, inmateId]);

    return res.json({ ok: true, visits: rows });
  } catch (e: any) {
    console.error("[GET /visits/slots] error", e);
    return res
      .status(500)
      .json({ ok: false, error: e?.message ?? "Error obteniendo horarios" });
  }
});

/* ================== USUARIO NORMAL ================== */
// /api/visits          → lista de MIS visitas (activas / futuras)
r.get("/", getMyVisitsCtrl);

// /api/visits/history  → historial de MIS visitas (pasadas, canceladas, etc.)
r.get("/history", getMyVisitHistoryCtrl);

// /api/visits          → crear nueva visita
r.post("/", createVisitCtrl);

// /api/visits/:id      → actualizar una visita propia (si quieres permitirlo)
r.put("/:id", updateMyVisitCtrl);

// /api/visits/:id      → cancelar/eliminar una visita propia
r.delete("/:id", deleteMyVisitCtrl);

/* ================== ADMIN: CONTROL DE VISITAS ================== */
/**
 * Todas las rutas que empiezan con /admin dentro de este router
 * exigen además rol ADMIN.
 *
 * Frontend podría llamar a:
 *   GET    /api/visits/admin        → listar visitas pendientes/aprobadas
 *   PATCH  /api/visits/admin/:id    → cambiar estado (APPROVED / REJECTED)
 */

r.get("/admin", requireAdmin, adminListVisitsCtrl);

// Cambiar estado (APPROVED / REJECTED) desde el panel admin
r.patch("/admin/:id", requireAdmin, adminChangeVisitStatusCtrl);

// Si prefieres dos endpoints separados, en vez del PATCH de arriba:
// r.post("/admin/:id/approve", requireAdmin, adminApproveVisitCtrl);
// r.post("/admin/:id/reject",  requireAdmin, adminRejectVisitCtrl);

export default r;
