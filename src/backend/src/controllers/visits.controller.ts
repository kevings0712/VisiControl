// src/backend/src/controllers/visits.controller.ts
import { Request, Response } from "express";
import { getPool } from "../config/db";
import {
  createVisit,
  listVisits,
  updateVisit,
  deleteVisit,
  cancelVisit, // 👈 servicio de cancelación lógico
} from "../services/visits.service";

// GET /api/visits?date=YYYY-MM-DD&status=&scope=all
export async function getVisits(req: Request, res: Response) {
  try {
    const { date, status } = req.query as {
      date?: string;
      status?: string;
      scope?: string;
    };

    const user = (req as any).user || {};
    const userId = user?.id as string | undefined;
    const rawRole = user?.role ?? "";
    const isAdmin = String(rawRole).toUpperCase() === "ADMIN";

    const visits = await listVisits({
      date,
      status,
      // Admin ve todas; usuario ve solo sus visitas
      created_by: isAdmin ? undefined : userId,
    });

    return res.json({ ok: true, visits });
  } catch (err) {
    console.error("[getVisits] error:", err);
    return res.status(500).json({ ok: false, message: "Error interno" });
  }
}

// POST /api/visits
// Acepta: { inmate_id, visit_date, visit_hour, duration_minutes?, notes?, visitor_name? }
export async function postVisit(req: Request, res: Response) {
  try {
    const {
      inmate_id,
      visit_date,
      visit_hour,
      notes,
      visitor_name,
      duration_minutes,
    } = req.body || {};

    const user = (req as any).user || {};
    const userId = user?.id as string | undefined;
    const rawRole = user?.role ?? "";
    const isAdmin = String(rawRole).toUpperCase() === "ADMIN";

    console.log(
      "[postVisit] userId=",
      userId,
      "role=",
      rawRole,
      "isAdmin=",
      isAdmin
    );

    if (!userId) {
      return res
        .status(401)
        .json({ ok: false, message: "No autenticado" });
    }
    if (!inmate_id || !visit_date || !visit_hour) {
      return res.status(400).json({
        ok: false,
        message:
          "Faltan campos requeridos (inmate_id, visit_date, visit_hour)",
      });
    }

    const db = getPool();

    // 1) Validar que el interno exista
    const { rows: inmateRows } = await db.query(
      `SELECT id, first_name, last_name FROM inmates WHERE id=$1 LIMIT 1`,
      [inmate_id]
    );
    if (!inmateRows.length) {
      return res
        .status(404)
        .json({ ok: false, message: "Interno no encontrado" });
    }
    const inmate = inmateRows[0];
    const inmate_name = `${inmate.first_name} ${inmate.last_name}`.trim();

    const vName =
      (visitor_name && String(visitor_name).trim()) ||
      user?.name ||
      "Visitante";

    // Aseguramos número o undefined
    const dur =
      duration_minutes !== undefined && duration_minutes !== null
        ? Number(duration_minutes)
        : undefined;

    // 👇 Aquí el ADMIN se salta la validación de user_inmates
    const visit = await createVisit({
      visitor_name: vName,
      inmate_name,
      inmate_id,
      visit_date,
      visit_hour,
      notes,
      created_by: userId,
      skip_auth: isAdmin,
      duration_minutes: dur,
    });

    return res.status(201).json({ ok: true, visit });
  } catch (err: any) {
    console.error("[postVisit] error:", err);
    const status = typeof err?.status === "number" ? err.status : 500;
    const message = err?.message || "Error interno";
    return res.status(status).json({ ok: false, message });
  }
}

/**
 * PUT /api/visits/:id
 */
export async function putVisit(req: Request, res: Response) {
  const { id } = req.params;
  if (!id) {
    return res.status(400).json({ ok: false, message: "Falta id" });
  }

  const user = (req as any).user || {};
  const userId = user?.id as string | undefined;
  const rawRole = user?.role ?? "";
  const isAdmin = String(rawRole).toUpperCase() === "ADMIN";

  try {
    const db = getPool();

    const { rows } = await db.query(
      `SELECT id, status, created_by FROM visits WHERE id = $1 LIMIT 1`,
      [id]
    );
    if (!rows.length) {
      return res
        .status(404)
        .json({ ok: false, message: "Visita no encontrada" });
    }
    const current = rows[0] as {
      id: string;
      status: string;
      created_by: string;
    };

    const isOwner = userId && current.created_by === userId;

    // ================== USUARIO NORMAL ==================
    if (!isAdmin) {
      if (!isOwner) {
        return res.status(403).json({
          ok: false,
          message: "No tienes permiso para modificar esta visita",
        });
      }

      if (current.status !== "PENDING") {
        return res.status(400).json({
          ok: false,
          message:
            "Solo las visitas pendientes pueden ser reprogramadas por el usuario",
        });
      }

      const { visit_date, visit_hour, notes, duration_minutes, status} =
        req.body || {};
      const patch: any = {};

      if (visit_date !== undefined) patch.visit_date = visit_date;
      if (visit_hour !== undefined) patch.visit_hour = visit_hour;
      if (notes !== undefined) patch.notes = notes;
      if (duration_minutes !== undefined)
        patch.duration_minutes = Number(duration_minutes);

      if (status === "CANCELLED") {
        patch.status = "CANCELLED";
      }

      if (Object.keys(patch).length === 0) {
        return res.status(400).json({
          ok: false,
          message: "No hay campos válidos para actualizar",
        });
      }

      const updated = await updateVisit(id, patch);
      if (!updated) {
        return res
          .status(404)
          .json({ ok: false, message: "Visita no encontrada" });
      }
      return res.json({ ok: true, visit: updated });
    }

    // ================== ADMIN ==================
    const {
      visitor_name,
      inmate_name,
      visit_date,
      visit_hour,
      status,
      notes,
      inmate_id,
      duration_minutes,
    } = req.body || {};

    const patch: any = {
      visitor_name,
      inmate_name,
      visit_date,
      visit_hour,
      status,
      notes,
      inmate_id,
    };

    if (duration_minutes !== undefined) {
      patch.duration_minutes = Number(duration_minutes);
    }

    Object.keys(patch).forEach((k) => {
      if (patch[k] === undefined) delete patch[k];
    });

    if (Object.keys(patch).length === 0) {
      return res.status(400).json({
        ok: false,
        message: "No hay campos válidos para actualizar",
      });
    }

    const updated = await updateVisit(id, patch);
    if (!updated) {
      return res
        .status(404)
        .json({ ok: false, message: "Visita no encontrada" });
    }
    return res.json({ ok: true, visit: updated });
  } catch (err) {
    console.error("[putVisit] error:", err);
    return res.status(500).json({ ok: false, message: "Error interno" });
  }
}

/**
 * DELETE /api/visits/:id
 * Usuario normal: cancela su propia visita (status = CANCELLED)
 */
export async function deleteMyVisitCtrl(req: Request, res: Response) {
  const { id } = req.params;

  const user = (req as any).user || {};
  const userId = user?.id as string | undefined;

  if (!userId) {
    return res.status(401).json({ ok: false, message: "No autenticado" });
  }

  if (!id) {
    return res
      .status(400)
      .json({ ok: false, message: "Falta el id de la visita" });
  }

  try {
    const out = await cancelVisit(userId, id);

    if (!out.ok) {
      return res.status(400).json(out);
    }

    return res.json({
      ok: true,
      message: "Visita cancelada correctamente",
      visit: out.visit,
    });
  } catch (err) {
    console.error("[deleteMyVisitCtrl] error:", err);
    return res.status(500).json({ ok: false, message: "Error interno" });
  }
}

/**
 * DELETE /api/visits/:id (ADMIN)
 * Eliminación física de la visita (si algún día la necesitas)
 */
export async function deleteVisitCtrl(req: Request, res: Response) {
  const { id } = req.params;
  if (!id) {
    return res.status(400).json({ ok: false, message: "Falta id" });
  }

  const user = (req as any).user || {};
  const rawRole = user?.role ?? "";
  const isAdmin = String(rawRole).toUpperCase() === "ADMIN";

  if (!isAdmin) {
    return res.status(403).json({
      ok: false,
      message: "Solo el administrador puede eliminar visitas",
    });
  }

  try {
    await deleteVisit(id);
    return res.json({ ok: true });
  } catch (err) {
    console.error("[deleteVisitCtrl] error:", err);
    return res.status(500).json({ ok: false, message: "Error interno" });
  }
}

// Wrappers para reutilizar en routes
export const getMyVisitsCtrl = getVisits;
export const getMyVisitHistoryCtrl = getVisits;
export const createVisitCtrl = postVisit;
export const updateMyVisitCtrl = putVisit;
// 👇 deleteMyVisitCtrl ya está declarado arriba (no alias aquí)

// ADMIN: listar visitas (panel)
export async function adminListVisitsCtrl(req: Request, res: Response) {
  try {
    const { date, status } = req.query as {
      date?: string;
      status?: string;
    };

    const visits = await listVisits({
      date,
      status,
      created_by: undefined, // ADMIN ve todas
    });

    return res.json({
      ok: true,
      items: visits,
      pagination: {
        total: visits.length,
        page: 1,
        limit: visits.length,
      },
    });
  } catch (err) {
    console.error("[adminListVisitsCtrl] error:", err);
    return res.status(500).json({ ok: false, message: "Error interno" });
  }
}

// PATCH /api/visits/admin/:id
// Cambia el estado de una visita (APPROVED / REJECTED)
export async function adminChangeVisitStatusCtrl(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { status } = req.body as { status?: string };

    if (!id || !status) {
      return res
        .status(400)
        .json({ ok: false, message: "Faltan id o status" });
    }

    const db = getPool();
    const { rows } = await db.query(
      `SELECT id, visitor_name, inmate_name, inmate_id,
              visit_date, visit_hour, status, notes
         FROM visits
        WHERE id = $1
        LIMIT 1`,
      [id]
    );

    if (!rows.length) {
      return res
        .status(404)
        .json({ ok: false, message: "Visita no encontrada" });
    }

    const v = rows[0];

    const updated = await updateVisit(id, {
      visitor_name: v.visitor_name,
      inmate_name: v.inmate_name,
      inmate_id: v.inmate_id,
      visit_date: v.visit_date,
      visit_hour: v.visit_hour,
      status,
      notes: v.notes,
      // duration_minutes se queda igual al anterior (no lo cambiamos aquí)
    });

    return res.json({ ok: true, item: updated });
  } catch (err) {
    console.error("[adminChangeVisitStatusCtrl] error:", err);
    return res.status(500).json({ ok: false, message: "Error interno" });
  }
}
