// src/frontend/src/pages/AdminVisitsPage.tsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  adminListVisits,
  adminChangeVisitStatus,
  type Visit,
  type VisitStatus,
} from "../api/visits";

// Helper para mostrar el estado en español
function formatStatusLabel(status: VisitStatus) {
  const s = String(status || "").toUpperCase();
  if (s === "PENDING") return "Pendiente";
  if (s === "APPROVED") return "Aprobada";
  if (s === "REJECTED") return "Rechazada";
  if (s === "CANCELLED" || s === "CANCELED") return "Cancelada";
  return status;
}

export default function AdminVisitsPage() {
  const nav = useNavigate();

  const [statusFilter, setStatusFilter] = useState<"" | VisitStatus>("PENDING");
  const [rows, setRows] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const r = await adminListVisits({
        status: statusFilter || undefined,
      });
      setRows(r.items || []);
    } catch (e: any) {
      setErr(e?.message ?? "No se pudo cargar las visitas");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  async function handleChangeStatus(v: Visit, newStatus: VisitStatus) {
    if (v.status === newStatus) return;

    const accion = newStatus === "APPROVED" ? "Aprobar" : "Rechazar";
    if (
      !confirm(
        `¿${accion} la visita de ${v.visitor_name} a ${v.inmate_name}?`
      )
    ) {
      return;
    }

    setBusyId(v.id);
    try {
      await adminChangeVisitStatus(v.id, newStatus);
      await load(); // recargo la lista para que si estás en "Pendientes" desaparezca
    } catch (e: any) {
      alert(e?.message ?? `No se pudo ${accion.toLowerCase()}`);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="app-light">
      <div className="container">
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            margin: "14px 0",
            gap: 8,
          }}
        >
          <h1 className="h1">Administración · Visitas</h1>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn-outline" onClick={() => nav("/admin")}>
              Volver
            </button>
          </div>
        </div>

        {/* Filtros */}
        <div className="card-light" style={{ padding: 12, marginBottom: 12 }}>
          <div className="row">
            <label>
              Estado
              <select
                className="input-light"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
              >
                <option value="">Todos</option>
                <option value="PENDING">Pendientes</option>
                <option value="APPROVED">Aprobadas</option>
                <option value="REJECTED">Rechazadas</option>
              </select>
            </label>
            <div style={{ display: "flex", alignItems: "flex-end" }}>
              <button className="btn" onClick={load}>
                Actualizar
              </button>
            </div>
          </div>
        </div>

        {loading && <p>Cargando…</p>}
        {err && <p style={{ color: "#b91c1c" }}>{err}</p>}
        {!loading && !rows.length && !err && (
          <div className="card-light" style={{ padding: 16 }}>
            No hay visitas para este filtro.
          </div>
        )}

        {/* Lista */}
        {rows.map((v) => {
          const isPending = v.status === "PENDING";
          const isBusy = busyId === v.id;

          return (
            <article
              key={v.id}
              className="notif-card"
              style={{
                background: "#fff",
                border: "1px solid #e5e7eb",
                borderRadius: 16,
                padding: 14,
                marginBottom: 12,
                boxShadow: "0 10px 30px rgba(0,0,0,.06)",
              }}
            >
              <h3 style={{ margin: "0 0 6px" }}>
                {v.visitor_name} → {v.inmate_name}
              </h3>

              <div
                style={{
                  color: "#64748b",
                  fontSize: 14,
                  marginBottom: 6,
                }}
              >
                Fecha: {v.visit_date} · Hora:{" "}
                {v.visit_hour.length === 5
                  ? v.visit_hour
                  : v.visit_hour.slice(0, 5)}
                {" · "}
                Estado: {formatStatusLabel(v.status)}
              </div>

              {v.notes && (
                <div
                  style={{
                    color: "#64748b",
                    fontSize: 13,
                    marginBottom: 6,
                  }}
                >
                  Nota: {v.notes}
                </div>
              )}

              {/* Acciones: SOLO si está pendiente */}
              {isPending && (
                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  <button
                    className="btn-outline"
                    disabled={isBusy}
                    onClick={() => handleChangeStatus(v, "APPROVED")}
                  >
                    {isBusy ? "Procesando…" : "Aprobar"}
                  </button>
                  <button
                    className="btn-outline danger"
                    disabled={isBusy}
                    onClick={() => handleChangeStatus(v, "REJECTED")}
                  >
                    {isBusy ? "Procesando…" : "Rechazar"}
                  </button>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}
