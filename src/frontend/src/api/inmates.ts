import api from "./client";

/* ---------- Usuario (mis internos) ---------- */
export type MyInmate = {
  inmate_id: string;
  first_name: string;
  last_name: string;
  relation: "AUTHORIZED" | "FAMILY" | "LAWYER" | "OTHER" | string;
};

export async function getMyInmates(): Promise<MyInmate[]> {
  const r = await api.get<{ ok: boolean; items: MyInmate[] }>("/inmates/my");
  return r.items ?? [];
}

export const listMyInmates = getMyInmates;

/* ---------- Admin (listar) ---------- */
export type Inmate = {
  id: string;
  first_name: string;
  last_name: string;
  national_id: string | null;
  pavilion: string | null;
  cell: string | null;
  status: "ENABLED" | "BLOCKED" | "ACTIVE";
};

export type AdminListParams = {
  q?: string;
  status?: "ENABLED" | "BLOCKED";
  page?: number;
  limit?: number;
};

export type AdminListResp = {
  ok: boolean;
  items: Inmate[];
  pagination: { page: number; limit: number; total: number };
};

export async function adminListInmates(
  params: AdminListParams = {}
): Promise<AdminListResp> {
  const qs = new URLSearchParams();
  if (params.q) qs.set("q", params.q);
  if (params.status) qs.set("status", params.status);
  if (params.page) qs.set("page", String(params.page));
  if (params.limit) qs.set("limit", String(params.limit));

  const url = `/inmates${qs.toString() ? `?${qs.toString()}` : ""}`;
  return api.get<AdminListResp>(url);
}

/* ---------- Admin (detalle + CRUD) ---------- */

// Lo que devuelve el backend para un interno concreto
export type InmateDetail = Inmate & {
  doc_type: string | null;
  birth_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

// Payload para crear/editar
export type InmatePayload = {
  first_name: string;
  last_name: string;
  doc_type?: string | null;
  national_id?: string | null;
  birth_date?: string | null; // YYYY-MM-DD
  pavilion?: string | null;
  cell?: string | null;
  status?: "ENABLED" | "BLOCKED";
  notes?: string | null;
};

export async function adminGetInmate(id: string): Promise<InmateDetail> {
  const r = await api.get<{ ok: boolean; item: InmateDetail }>(`/inmates/${id}`);
  return r.item;
}

export async function adminCreateInmate(
  data: InmatePayload
): Promise<InmateDetail> {
  const r = await api.post<{ ok: boolean; item: InmateDetail }>(
    "/inmates",
    data
  );
  return r.item;
}

export async function adminUpdateInmate(
  id: string,
  data: InmatePayload
): Promise<InmateDetail> {
  const r = await api.put<{ ok: boolean; item: InmateDetail }>(
    `/inmates/${id}`,
    data
  );
  return r.item;
}

export async function adminDeleteInmate(id: string): Promise<void> {
  await api.del<{ ok: boolean }>(`/inmates/${id}`);
}

// --- Relación interno-usuario (ADMIN) ---

export type InmateUserRelation = {
  user_id: string;
  inmate_id: string;
  name: string;
  email: string;
  rel: "AUTHORIZED" | "FAMILY" | "LAWYER" | "OTHER";
};

export type SimpleUser = {
  id: string;
  name: string;
  email: string;
};

/**
 * Lista los usuarios autorizados para un interno
 * GET /api/inmates/admin/:inmateId/users
 */
export function adminListInmateUsers(inmateId: string) {
  return api.get<{
    ok: boolean;
    items: InmateUserRelation[];
  }>(`/inmates/admin/${inmateId}/users`);
}

/**
 * Busca usuarios por nombre o correo
 * GET /api/inmates/admin/users/search?q=...
 */
export function adminSearchUsers(q: string) {
  const qs = new URLSearchParams();
  if (q) qs.set("q", q);
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return api.get<{
    ok: boolean;
    items: SimpleUser[];
  }>(`/inmates/admin/users/search${suffix}`);
}

/**
 * Autoriza a un usuario para un interno
 * POST /api/inmates/admin/:inmateId/users
 */
export function adminAuthorizeUserToInmate(
  inmateId: string,
  userId: string,
  rel: "AUTHORIZED" | "FAMILY" | "LAWYER" | "OTHER" = "AUTHORIZED"
) {
  return api.post<{ ok: boolean }>(`/inmates/admin/${inmateId}/users`, {
    user_id: userId,
    rel,
  });
}

/**
 * Quita la autorización de un usuario para un interno
 * DELETE /api/inmates/admin/:inmateId/users/:userId
 */
export function adminUnauthorizeUserFromInmate(
  inmateId: string,
  userId: string
) {
  return api.del<{ ok: boolean }>(
    `/inmates/admin/${inmateId}/users/${userId}`
  );
}
