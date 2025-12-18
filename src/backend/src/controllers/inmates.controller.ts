// src/backend/src/controllers/inmates.controller.ts
import { Request, Response } from "express";
import * as repo from "../repositories/inmates.repository";
import {
  listMyInmates,
  adminListInmates,
  adminGetInmate,
  adminCreateInmate,
  adminUpdateInmate,
  adminAuthorizeUser,
  adminUnauthorizeUser,
  adminDeleteInmate,
  adminListInmateUsers,
  adminSearchUsers,
  InmateCreateDTO,
  InmateUpdateDTO,
  Relation,
} from "../services/inmates.service";

// ---- helper para asegurar ADMIN ----
function ensureAdmin(req: Request, res: Response): boolean {
  const user = (req as any).user;
  const role = String(user?.role || "").toUpperCase();

  if (!user || role !== "ADMIN") {
    res.status(403).json({ ok: false, message: "Solo administradores" });
    return false;
  }
  return true;
}

// =================== PUBLIC / USUARIO NORMAL ===================

export async function getMyInmatesCtrl(req: Request, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res
        .status(401)
        .json({ ok: false, message: "No autenticado" });
    }
    const q = (req.query.q as string) || "";
    const items = await listMyInmates(userId, q);
    return res.json({ ok: true, items });
  } catch (e) {
    console.error("[inmates] getMyInmates", e);
    return res
      .status(500)
      .json({ ok: false, message: "Error interno" });
  }
}

// =================== ADMIN: INMATES CRUD ===================

export async function adminListInmatesCtrl(req: Request, res: Response) {
  if (!ensureAdmin(req, res)) return;

  try {
    const { q, status, page, limit } = req.query as any;
    const data = await adminListInmates({
      q,
      status,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
    return res.json({ ok: true, ...data });
  } catch (e) {
    console.error("[inmates] adminList", e);
    return res
      .status(500)
      .json({ ok: false, message: "Error interno" });
  }
}

export async function adminGetInmateCtrl(req: Request, res: Response) {
  if (!ensureAdmin(req, res)) return;

  try {
    const row = await adminGetInmate(req.params.id);
    if (!row) {
      return res
        .status(404)
        .json({ ok: false, message: "No encontrado" });
    }
    return res.json({ ok: true, item: row });
  } catch (e) {
    console.error("[inmates] adminGet", e);
    return res
      .status(500)
      .json({ ok: false, message: "Error interno" });
  }
}

export async function adminCreateInmateCtrl(req: Request, res: Response) {
  if (!ensureAdmin(req, res)) return;

  try {
    const payload: InmateCreateDTO = req.body || {};
    if (!payload.first_name || !payload.last_name) {
      return res.status(400).json({
        ok: false,
        message: "Faltan nombres/apellidos",
      });
    }
    const row = await adminCreateInmate(payload);
    return res.status(201).json({ ok: true, item: row });
  } catch (e: any) {
    console.error("[inmates] adminCreate", e);
    return res
      .status(500)
      .json({ ok: false, message: e?.detail || "Error interno" });
  }
}

export async function adminUpdateInmateCtrl(req: Request, res: Response) {
  if (!ensureAdmin(req, res)) return;

  try {
    const payload: InmateUpdateDTO = req.body || {};
    const row = await adminUpdateInmate(req.params.id, payload);
    if (!row) {
      return res
        .status(404)
        .json({ ok: false, message: "No encontrado" });
    }
    return res.json({ ok: true, item: row });
  } catch (e: any) {
    console.error("[inmates] adminUpdate", e);
    return res
      .status(500)
      .json({ ok: false, message: e?.detail || "Error interno" });
  }
}

export async function adminDeleteInmateCtrl(req: Request, res: Response) {
  if (!ensureAdmin(req, res)) return;

  try {
    const { id } = req.params;
    if (!id) {
      return res
        .status(400)
        .json({ ok: false, message: "Falta id" });
    }
    await adminDeleteInmate(id);
    return res.json({ ok: true });
  } catch (e) {
    console.error("[inmates] adminDelete", e);
    return res
      .status(500)
      .json({ ok: false, message: "Error interno" });
  }
}

// =================== ADMIN: AUTORIZACIONES USER–INMATE ===================

export async function adminAuthorizeUserCtrl(req: Request, res: Response) {
  if (!ensureAdmin(req, res)) return;

  try {
    const inmateId = req.params.inmateId;
    const { user_id, rel } = req.body as { user_id: string; rel?: Relation };

    if (!inmateId || !user_id) {
      return res
        .status(400)
        .json({ ok: false, message: "Faltan inmateId o user_id" });
    }

    const row = await adminAuthorizeUser(inmateId, user_id, rel ?? "AUTHORIZED");
    return res.json({ ok: true, item: row });
  } catch (e) {
    console.error("[inmates] adminAuthorize", e);
    return res
      .status(500)
      .json({ ok: false, message: "Error interno" });
  }
}

export async function adminUnauthorizeUserCtrl(req: Request, res: Response) {
  if (!ensureAdmin(req, res)) return;

  try {
    const inmateId = req.params.inmateId;
    const userId = req.params.userId;

    if (!inmateId || !userId) {
      return res
        .status(400)
        .json({ ok: false, message: "Faltan inmateId o userId" });
    }

    await adminUnauthorizeUser(inmateId, userId);
    return res.json({ ok: true });
  } catch (e) {
    console.error("[inmates] adminUnauthorize", e);
    return res
      .status(500)
      .json({ ok: false, message: "Error interno" });
  }
}

// =================== ADMIN: LISTA DE USUARIOS POR INTERNO ===================

export async function adminListInmateUsersCtrl(req: Request, res: Response) {
  if (!ensureAdmin(req, res)) return;

  try {
    const { inmateId } = req.params;
    if (!inmateId) {
      return res
        .status(400)
        .json({ ok: false, message: "Falta inmateId" });
    }

    const items = await adminListInmateUsers(inmateId);
    return res.json({ ok: true, items });
  } catch (e) {
    console.error("[inmates] adminListInmateUsersCtrl", e);
    return res
      .status(500)
      .json({ ok: false, message: "Error interno" });
  }
}

// =================== ADMIN: BUSCAR USUARIOS POR NOMBRE/CORREO ===================

export async function adminSearchUsersCtrl(req: Request, res: Response) {
  if (!ensureAdmin(req, res)) return;

  try {
    const q = String(req.query.q || "").trim();
    const items = q ? await adminSearchUsers(q) : [];
    return res.json({ ok: true, items });
  } catch (e) {
    console.error("[inmates] adminSearchUsersCtrl", e);
    return res
      .status(500)
      .json({ ok: false, message: "Error interno" });
  }
}

// =================== ENDPOINTS “LEGACY” BASADOS EN REPO ===================

export async function listMine(req: Request, res: Response) {
  const userId = req.user?.id;
  if (!userId) {
    return res
      .status(401)
      .json({ ok: false, message: "Unauthorized" });
  }
  const items = await repo.listForUser(userId);
  res.json({ ok: true, items });
}

export async function listAll(req: Request, res: Response) {
  const { q, status } = req.query as any;
  const items = await repo.listAll({ q, status });
  res.json({ ok: true, items });
}

export async function getOne(req: Request, res: Response) {
  const row = await repo.getById(req.params.id);
  if (!row) {
    return res
      .status(404)
      .json({ ok: false, message: "Not found" });
  }
  res.json({ ok: true, item: row });
}

export async function create(req: Request, res: Response) {
  const item = await repo.create(req.body);
  res.status(201).json({ ok: true, item });
}

export async function update(req: Request, res: Response) {
  const item = await repo.update(req.params.id, req.body);
  res.json({ ok: true, item });
}

export async function remove(req: Request, res: Response) {
  await repo.remove(req.params.id);
  res.json({ ok: true });
}
