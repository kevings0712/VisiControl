// src/backend/src/routes/inmates.routes.ts
import { Router } from "express";
import { requireAuth, requireAdmin } from "../middlewares/auth";
import {
  getMyInmatesCtrl,
  adminListInmatesCtrl,
  adminGetInmateCtrl,
  adminCreateInmateCtrl,
  adminUpdateInmateCtrl,
  adminDeleteInmateCtrl,
  adminAuthorizeUserCtrl,
  adminUnauthorizeUserCtrl,
  adminListInmateUsersCtrl,
  adminSearchUsersCtrl,
} from "../controllers/inmates.controller";

const r = Router();

/* ===== Usuario autenticado: ver sus internos ===== */
r.get("/my", requireAuth, getMyInmatesCtrl);

/* ===== Admin: búsqueda de usuarios para relación internos–usuarios ===== */
r.get(
  "/admin/users/search",
  requireAuth,
  requireAdmin,
  adminSearchUsersCtrl
);

/* ===== Admin: relación internos–usuarios ===== */
r.get(
  "/admin/:inmateId/users",
  requireAuth,
  requireAdmin,
  adminListInmateUsersCtrl
);

r.post(
  "/admin/:inmateId/users",
  requireAuth,
  requireAdmin,
  adminAuthorizeUserCtrl
);

r.delete(
  "/admin/:inmateId/users/:userId",
  requireAuth,
  requireAdmin,
  adminUnauthorizeUserCtrl
);

/* ===== Admin: CRUD de internos ===== */
r.get("/", requireAuth, requireAdmin, adminListInmatesCtrl);
r.get("/:id", requireAuth, requireAdmin, adminGetInmateCtrl);
r.post("/", requireAuth, requireAdmin, adminCreateInmateCtrl);
r.put("/:id", requireAuth, requireAdmin, adminUpdateInmateCtrl);
r.delete("/:id", requireAuth, requireAdmin, adminDeleteInmateCtrl);

export default r;
