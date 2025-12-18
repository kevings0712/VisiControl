// src/frontend/src/pages/VisitHistoryPage.tsx
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { useNavigate } from "react-router-dom";
import api from "../api/client";

type Visit = {
  id: string;
  visitor_name: string;
  inmate_name: string;
  visit_date: string; // YYYY-MM-DD o ISO
  visit_hour: string; // HH:mm:ss
  status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED" | string;
  notes?: string;
  created_at?: string;
  inmate_id?: string | null;
  duration_minutes?: number | null;
};

type VisitForm = {
  visitor_name: string;
  inmate_name: string;
  visit_date: string; // YYYY-MM-DD
  visit_hour: string; // HH:mm
  status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
  notes: string;
  duration_minutes: number;
};

type MeResp = {
  ok: boolean;
  user?: { id: string; name: string; email: string; role: string };
};

// ---- helpers para duración / slots ----

type DayVisit = {
  id: string;
  visit_date: string;
  visit_hour: string;
  status: string;
  duration_minutes?: number | null;
};

type BusyInterval = { start: number; end: number };

const SLOT_MINUTES: number[] = [];
// Slots de 30 minutos desde 08:00 hasta 16:30 (último inicio posible)
for (let t = 8 * 60; t <= 16 * 60 + 30; t += 30) {
  SLOT_MINUTES.push(t);
}

function minutesToLabel(total: number): string {
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function isSlotDisabled(
  totalMinutes: number,
  duration: number,
  busy: BusyInterval[]
): boolean {
  if (!duration) return true;

  const start = totalMinutes;
  const end = start + duration;

  const MIN_START = 8 * 60; // 08:00
  const MAX_END = 17 * 60; // 17:00

  if (start < MIN_START || end > MAX_END) return true;

  return busy.some((b) => start < b.end && end > b.start);
}

// helper para saber si la visita es de hoy o futuro
function isTodayOrFuture(dateStr: string): boolean {
  const onlyDate = dateStr.includes("T") ? dateStr.slice(0, 10) : dateStr;
  const todayStr = new Date().toISOString().slice(0, 10);
  return onlyDate >= todayStr;
}

// Schema “completo” para ADMIN
const formSchema = z.object({
  visitor_name: z.string().min(2, "El nombre del visitante es requerido"),
  inmate_name: z.string().min(2, "El nombre del interno es requerido"),
  visit_date: z.string().min(10, "Fecha inválida"),
  visit_hour: z.string().min(4, "Hora inválida"),
  status: z.enum(["PENDING", "APPROVED", "REJECTED", "CANCELLED"]),
  notes: z.string().optional().default(""),
  duration_minutes: z
    .number()
    .int()
    .refine((v) => [30, 60, 90, 120].includes(v), {
      message: "La duración debe ser 30, 60, 90 o 120 minutos",
    }),
});

// Schema reducido para usuario normal
const userEditSchema = z.object({
  visit_date: z.string().min(10, "Fecha inválida"),
  visit_hour: z.string().min(4, "Hora inválida"),
  notes: z.string().optional().default(""),
  duration_minutes: z
    .number()
    .int()
    .refine((v) => [30, 60, 90, 120].includes(v), {
      message: "La duración debe ser 30, 60, 90 o 120 minutos",
    }),
});

export default function VisitHistoryPage() {
  const nav = useNavigate();

  // datos
  const [visits, setVisits] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  // filtros
  const [qVisitor, setQVisitor] = useState("");
  const [qInmate, setQInmate] = useState("");
  const [qStatus, setQStatus] = useState<
    "" | "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED"
  >("");
  const [qDate, setQDate] = useState("");

  // edición
  const [editing, setEditing] = useState<Visit | null>(null);
  const [editForm, setEditForm] = useState<VisitForm | null>(null);
  const [editErr, setEditErr] = useState<string | null>(null);

  // role
  const [isAdmin, setIsAdmin] = useState(false);

  // horarios ocupados (cuando editamos)
  const [busyIntervals, setBusyIntervals] = useState<BusyInterval[]>([]);

  // Cargar rol
  useEffect(() => {
    (async () => {
      try {
        const me = await api.get<MeResp>("/auth/me");
        if (me?.user?.role === "ADMIN") {
          setIsAdmin(true);
        }
      } catch {
        // ignoramos, se queda como false
      }
    })();
  }, []);

  // Cargar visitas
  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoading(true);
      setApiError(null);
      try {
        const res = await api.get<{ ok: boolean; visits?: Visit[] }>("/visits");
        if (!cancel) setVisits(res.visits ?? []);
      } catch (err: any) {
        if (!cancel) setApiError(err?.message ?? "Error cargando visitas");
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, []);

  const filtered = useMemo(() => {
    return (visits ?? []).filter((v) => {
      const byVisitor = qVisitor
        ? v.visitor_name.toLowerCase().includes(qVisitor.toLowerCase())
        : true;
      const byInmate = qInmate
        ? v.inmate_name.toLowerCase().includes(qInmate.toLowerCase())
        : true;
      const byStatus = qStatus ? v.status === qStatus : true;
      const byDate = qDate
        ? (v.visit_date.includes("T")
            ? v.visit_date.slice(0, 10)
            : v.visit_date) === qDate
        : true;
      return byVisitor && byInmate && byStatus && byDate;
    });
  }, [visits, qVisitor, qInmate, qStatus, qDate]);

  function openEdit(v: Visit) {
    setEditing(v);
    setEditForm({
      visitor_name: v.visitor_name,
      inmate_name: v.inmate_name,
      visit_date: v.visit_date.includes("T")
        ? v.visit_date.slice(0, 10)
        : v.visit_date,
      visit_hour: v.visit_hour?.slice(0, 5) ?? "",
      status: (v.status as any) ?? "PENDING",
      notes: v.notes ?? "",
      duration_minutes: v.duration_minutes ?? 60,
    });
    setEditErr(null);
    setBusyIntervals([]);
  }

  function onChangeEdit<K extends keyof VisitForm>(key: K, value: VisitForm[K]) {
    if (!editForm) return;
    setEditForm({ ...editForm, [key]: value });
    setEditErr(null);
  }

  // Cargar horarios ocupados al editar
  useEffect(() => {
    if (!editing || !editForm) {
      setBusyIntervals([]);
      return;
    }

    const inmateId = editing.inmate_id;
    const date = editForm.visit_date;

    if (!inmateId || !date) {
      setBusyIntervals([]);
      return;
    }

    let cancel = false;

    (async () => {
      try {
        const res = await api.get<{ ok: boolean; visits: DayVisit[] }>(
          `/visits/slots?date=${date}&inmate_id=${inmateId}`
        );

        const rows = (res?.visits || [])
          .filter((v) =>
            ["PENDING", "APPROVED"].includes((v.status || "").toUpperCase())
          )
          .filter((v) => v.id !== editing.id);

        const intervals: BusyInterval[] = rows.map((v) => {
          const [hs, ms] = String(v.visit_hour).split(":");
          const h = Number.parseInt(hs, 10);
          const m = Number.parseInt(ms || "0", 10);
          const start = h * 60 + m;
          const dur = v.duration_minutes ?? 60;
          const end = start + dur;
          return { start, end };
        });

        if (!cancel) setBusyIntervals(intervals);
      } catch (e) {
        console.error("Error cargando horarios ocupados (edición)", e);
        if (!cancel) setBusyIntervals([]);
      }
    })();

    return () => {
      cancel = true;
    };
  }, [editing, editForm?.visit_date, editForm?.duration_minutes]);

  async function saveEdit() {
    if (!editing || !editForm) return;

    try {
      let payload: any;

      if (isAdmin) {
        const parsed = formSchema.safeParse(editForm);
        if (!parsed.success) {
          const first = parsed.error.issues[0];
          setEditErr(first?.message ?? "Datos inválidos");
          return;
        }
        payload = {
          ...parsed.data,
          visit_hour:
            parsed.data.visit_hour.length === 5
              ? `${parsed.data.visit_hour}:00`
              : parsed.data.visit_hour,
        };
      } else {
        const parsed = userEditSchema.safeParse({
          visit_date: editForm.visit_date,
          visit_hour: editForm.visit_hour,
          notes: editForm.notes,
          duration_minutes: editForm.duration_minutes,
        });
        if (!parsed.success) {
          const first = parsed.error.issues[0];
          setEditErr(first?.message ?? "Datos inválidos");
          return;
        }
        payload = {
          visit_date: parsed.data.visit_date,
          visit_hour:
            parsed.data.visit_hour.length === 5
              ? `${parsed.data.visit_hour}:00`
              : parsed.data.visit_hour,
          notes: parsed.data.notes,
          duration_minutes: parsed.data.duration_minutes,
        };
      }

      const res = await api.put<{ ok: boolean; visit: Visit }>(
        `/visits/${editing.id}`,
        payload
      );
      setVisits((list) => list.map((v) => (v.id === editing.id ? res.visit : v)));
      setEditing(null);
      setEditForm(null);
      setBusyIntervals([]);
    } catch (err: any) {
      setEditErr(err?.message ?? "Error guardando");
    }
  }

  // cancelar (usuario normal)
  async function cancelVisit(v: Visit) {
    if (
      !window.confirm(
        "¿Seguro que quieres cancelar esta visita? No se eliminará, pero quedará marcada como cancelada."
      )
    ) {
      return;
    }

    try {
      const res = await api.put<{ ok: boolean; visit: Visit }>(
        `/visits/${v.id}`,
        { status: "CANCELLED" }
      );

      setVisits((list) => list.map((item) => (item.id === v.id ? res.visit : item)));
    } catch (err: any) {
      alert(err?.message ?? "Error cancelando la visita");
    }
  }

  // eliminar (solo admin)
  async function removeVisit(id: string) {
    if (!confirm("¿Eliminar esta visita de forma permanente?")) return;
    try {
      await api.del<{ ok: boolean }>(`/visits/${id}`);
      setVisits((list) => list.filter((v) => v.id !== id));
    } catch (err: any) {
      alert(err?.message ?? "Error eliminando");
    }
  }

  return (
    <div className="app-light">
      <div className="container">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            margin: "14px 0 6px 0",
          }}
        >
          <h1 className="h1">Historial de visitas</h1>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn-outline" onClick={() => nav("/dashboard")}>
              Volver
            </button>
          </div>
        </div>

        {/* Filtros */}
        <div className="card-light" style={{ marginBottom: 12 }}>
          <div
            className="filters"
            style={{ gridTemplateColumns: "1.2fr 1.2fr 1fr 1fr auto" }}
          >
            <input
              className="input-light"
              placeholder="Filtrar por visitante"
              value={qVisitor}
              onChange={(e) => setQVisitor(e.target.value)}
              aria-label="Filtrar por visitante" // ⬅️ D2: Corregido
            />
            <input
              className="input-light"
              placeholder="Filtrar por interno"
              value={qInmate}
              onChange={(e) => setQInmate(e.target.value)}
              aria-label="Filtrar por interno" // ⬅️ D2: Corregido
            />
            <select
              className="input-light"
              value={qStatus}
              onChange={(e) => setQStatus(e.target.value as any)}
              aria-label="Estado de visita" // ⬅️ D2: Corregido
            >
              <option value="">Estado de visita</option>
              <option value="PENDING">Pendientes</option>
              <option value="APPROVED">Aprobadas</option>
              <option value="REJECTED">Rechazadas</option>
              <option value="CANCELLED">Canceladas</option>
            </select>
            <input
              className="input-light"
              placeholder="fecha"
              type="date"
              value={qDate}
              onChange={(e) => setQDate(e.target.value)}
              aria-label="Filtrar por fecha" // ⬅️ D2: Corregido
            />
            <button
              className="btn-outline"
              onClick={() => {
                setQVisitor("");
                setQInmate("");
                setQStatus("");
                setQDate("");
              }}
            >
              Limpiar filtros
            </button>
          </div>
        </div>

        {/* Tabla */}
        <section className="card-light">
          {loading ? (
            <p style={{ color: "#64748b" }}>Cargando…</p>
          ) : apiError ? (
            <p style={{ color: "#b91c1c" }}>{apiError}</p>
          ) : (
            <div className="vc-table-wrapper">
              <table className="table table-primary">
                <thead>
                  <tr>
                    <th>Visitante</th>
                    <th>Interno</th>
                    <th>Fecha</th>
                    <th>Hora</th>
                    <th>Duración</th>
                    <th>Estado</th>
                    <th>Notas</th>
                    <th style={{ width: 160 }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((v) => {
                    const isPending = v.status === "PENDING";
                    const futureOrToday = isTodayOrFuture(v.visit_date);
                    const canEdit = isAdmin || isPending;
                    const canCancel =
                      !isAdmin && isPending && futureOrToday;
                    const dur = v.duration_minutes ?? 60;

                    return (
                      <tr key={v.id}>
                        <td>{v.visitor_name}</td>
                        <td>{v.inmate_name}</td>
                        <td>
                          {v.visit_date.includes("T")
                            ? v.visit_date.slice(0, 10)
                            : v.visit_date}
                        </td>
                        <td>{v.visit_hour?.slice(0, 5)}</td>
                        <td>{dur} min</td>
                        <td>{v.status}</td>
                        <td>{v.notes ?? ""}</td>
                        <td>
                          <div className="actions" style={{ gap: 6 }}>
                            {canEdit && (
                              <button
                                className="btn-icon"
                                title="Editar"
                                onClick={() => openEdit(v)}
                              >
                                {/* ícono lápiz */}
                                <svg
                                  viewBox="0 0 24 24"
                                  width="16"
                                  height="16"
                                  aria-hidden
                                >
                                  <path
                                    d="M4 17.25V20h2.75L17.81 8.94l-2.75-2.75L4 17.25z"
                                    fill="none"
                                    stroke="#cf4444"
                                    strokeWidth="1.5"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  />
                                  <path
                                    d="M14.5 6.5l2.75 2.75L19 7.5 16.5 5z"
                                    fill="#cf4444"
                                  />
                                </svg>
                              </button>
                            )}

                            {canCancel && (
                              <button
                                className="btn-icon danger"
                                title="Cancelar visita"
                                onClick={() => cancelVisit(v)}
                              >
                                {/* ícono X / cancelar */}
                                <svg
                                  viewBox="0 0 24 24"
                                  width="16"
                                  height="16"
                                  aria-hidden
                                >
                                  <path
                                    d="M6 6l12 12M18 6L6 18"
                                    fill="none"
                                    stroke="#b91c1c"
                                    strokeWidth="1.8"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  />
                                </svg>
                              </button>
                            )}

                            {isAdmin && (
                              <button
                                className="btn-icon danger"
                                title="Eliminar"
                                onClick={() => removeVisit(v.id)}
                              >
                                {/* ícono basurero */}
                                <svg
                                  viewBox="0 0 24 24"
                                  width="16"
                                  height="16"
                                  aria-hidden
                                >
                                  <path
                                    d="M6 7h12l-1 12H7L6 7z"
                                    fill="none"
                                    stroke="#cf4444"
                                    strokeWidth="1.5"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  />
                                  <path
                                    d="M9 7V5h6v2M5 7h14"
                                    fill="none"
                                    stroke="#cf4444"
                                    strokeWidth="1.5"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  />
                                </svg>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={8} style={{ color: "#64748b" }}>
                        Sin resultados
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <p className="link-muted" style={{ margin: "8px 0 0" }}>
          ¿Quieres agendar una visita?{" "}
          <a href="/visits" style={{ color: "#b91c1c", fontWeight: 600 }}>
            Agendar
          </a>
        </p>

        {!isAdmin && (
          <p
            style={{
              marginTop: 6,
              fontSize: 12,
              color: "#64748b",
            }}
          >
            Solo puedes reprogramar o cancelar visitas en estado pendiente y con
            fecha futura.
          </p>
        )}
      </div>

      {/* Modal edición */}
      {editing && editForm && (
        <div
          className="modal"
          onClick={() => {
            setEditing(null);
            setEditForm(null);
            setBusyIntervals([]);
          }}
        >
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>Editar visita</h3>

            <div className="row">
              <label>
                Visitante
                <input
                  className="input-light"
                  value={editForm.visitor_name}
                  disabled={!isAdmin}
                  onChange={(e) =>
                    onChangeEdit("visitor_name", e.target.value)
                  }
                />
              </label>
              <label>
                Interno
                <input
                  className="input-light"
                  value={editForm.inmate_name}
                  disabled={!isAdmin}
                  onChange={(e) =>
                    onChangeEdit("inmate_name", e.target.value)
                  }
                />
              </label>
              <label>
                Fecha
                <input
                  className="input-light"
                  type="date"
                  value={editForm.visit_date}
                  onChange={(e) =>
                    onChangeEdit("visit_date", e.target.value)
                  }
                />
              </label>
              <label>
                Duración
                <select
                  className="input-light"
                  value={editForm.duration_minutes}
                  onChange={(e) =>
                    onChangeEdit("duration_minutes", Number(e.target.value))
                  }
                >
                  <option value={30}>30 minutos</option>
                  <option value={60}>1 hora</option>
                  <option value={90}>1 hora 30</option>
                  <option value={120}>2 horas</option>
                </select>
              </label>

              <div className="vc-col-span-2" style={{ marginTop: 8 }}>
                <label>Horario de inicio</label>
                {!editForm.visit_date && (
                  <p style={{ fontSize: 12, color: "#64748b" }}>
                    Primero selecciona la fecha.
                  </p>
                )}

                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 6,
                    marginTop: 6,
                  }}
                >
                  {SLOT_MINUTES.map((total) => {
                    const label = minutesToLabel(total);
                    const disabled =
                      !editForm.visit_date ||
                      isSlotDisabled(
                        total,
                        editForm.duration_minutes,
                        busyIntervals
                      );
                    const isSelected = editForm.visit_hour === label;

                    return (
                      <button
                        key={label}
                        type="button"
                        disabled={disabled}
                        onClick={() =>
                          !disabled && onChangeEdit("visit_hour", label)
                        }
                        style={{
                          padding: "4px 8px",
                          borderRadius: 6,
                          border: "1px solid #cbd5f5",
                          fontSize: 12,
                          cursor: disabled ? "not-allowed" : "pointer",
                          backgroundColor: isSelected
                            ? "#0f766e"
                            : disabled
                            ? "#e5e7eb"
                            : "#ffffff",
                          color: disabled
                            ? "#9ca3af"
                            : isSelected
                            ? "#ffffff"
                            : "#0f172a",
                        }}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <label>
                Estado
                <select
                  className="input-light"
                  value={editForm.status}
                  disabled={!isAdmin}
                  onChange={(e) =>
                    onChangeEdit("status", e.target.value as any)
                  }
                >
                  <option value="PENDING">PENDING</option>
                  <option value="APPROVED">APPROVED</option>
                  <option value="REJECTED">REJECTED</option>
                  <option value="CANCELLED">CANCELLED</option>
                </select>
              </label>
              <label className="vc-col-span-2">
                Notas
                <input
                  className="input-light"
                  value={editForm.notes}
                  onChange={(e) => onChangeEdit("notes", e.target.value)}
                />
              </label>
            </div>

            {editErr && <p style={{ color: "#b91c1c" }}>{editErr}</p>}

            <div
              style={{
                display: "flex",
                gap: 8,
                justifyContent: "flex-end",
                marginTop: 12,
              }}
            >
              <button
                className="btn-outline"
                onClick={() => {
                  setEditing(null);
                  setEditForm(null);
                  setBusyIntervals([]);
                }}
              >
                Cancelar
              </button>
              <button className="btn" onClick={saveEdit}>
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}