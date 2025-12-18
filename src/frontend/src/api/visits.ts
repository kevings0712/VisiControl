// src/frontend/src/api/visits.ts
import api from "./client";

export type VisitStatus = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED" | string;

export type Visit = {
  id: string;
  visitor_name: string;
  inmate_name: string;
  visit_date: string;   // YYYY-MM-DD
  visit_hour: string;   // HH:mm[:ss]
  status: VisitStatus;
  notes?: string | null;
  created_at?: string;
  inmate_id?: string | null;
};

export type VisitListResp = {
  ok: boolean;
  visits?: Visit[]; // lo que devuelve getVisits
  items?: Visit[];  // lo que devuelve adminList
  pagination?: { total: number; page: number; limit: number };
};

/* ================= USUARIO NORMAL ================= */

export function listMyVisits(params?: { date?: string; status?: string }) {
  const qs = new URLSearchParams();
  if (params?.date) qs.set("date", params.date);
  if (params?.status) qs.set("status", params.status);
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return api.get<VisitListResp>(`/visits${suffix}`);
}

export function listMyVisitHistory(params?: { date?: string; status?: string }) {
  const qs = new URLSearchParams();
  if (params?.date) qs.set("date", params.date);
  if (params?.status) qs.set("status", params.status);
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return api.get<VisitListResp>(`/visits/history${suffix}`);
}

export function createVisit(payload: {
  inmate_id: string;
  visit_date: string;
  visit_hour: string;
  notes?: string | null;
  visitor_name?: string;
}) {
  return api.post<{ ok: boolean; visit: Visit }>("/visits", payload);
}

export function updateMyVisit(
  id: string,
  payload: { visit_date?: string; visit_hour?: string; notes?: string | null }
) {
  return api.put<{ ok: boolean; visit: Visit }>(`/visits/${id}`, payload);
}

export function deleteMyVisit(id: string) {
  return api.del<{ ok: boolean }>(`/visits/${id}`);
}

/* =================== ADMIN =================== */

export function adminListVisits(params?: {
  q?: string;
  status?: string;
  page?: number;
  limit?: number;
}) {
  const qs = new URLSearchParams();
  if (params?.q) qs.set("q", params.q);
  if (params?.status) qs.set("status", params.status);
  if (params?.page) qs.set("page", String(params.page));
  if (params?.limit) qs.set("limit", String(params.limit));

  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return api.get<{
    ok: boolean;
    items: Visit[];
    pagination: { total: number; page: number; limit: number };
  }>(`/visits/admin${suffix}`);
}

export function adminChangeVisitStatus(id: string, status: VisitStatus) {
  return api.patch<{ ok: boolean; item: Visit }>(`/visits/admin/${id}`, {
    status,
  });
}
