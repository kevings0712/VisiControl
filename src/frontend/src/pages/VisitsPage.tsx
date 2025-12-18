// src/frontend/src/pages/VisitsPage.tsx
import { useEffect, useState } from "react";
import { z } from "zod";
import { useNavigate, useSearchParams } from "react-router-dom";
import api from "../api/client";
import { getMyInmates, type MyInmate, adminListInmates } from "../api/inmates";

type VisitForm = {
  inmate_id: string;
  visit_date: string; // YYYY-MM-DD
  visit_hour: string; // HH:mm
  notes: string;
};

const formSchema = z.object({
  inmate_id: z.string().uuid("Selecciona un interno válido"),
  visit_date: z.string().min(10, "Fecha inválida"),
  visit_hour: z.string().min(4, "Hora inválida"),
  notes: z.string().optional().default(""),
});

type MeResp = { ok: boolean; user?: { id: string; role: string } };

// ---- NUEVOS TIPOS Y HELPERS PARA HORARIOS ----

type DayVisit = {
  id: string;
  visit_date: string;
  visit_hour: string;
  status: string;
  duration_minutes?: number | null;
};

type BusyInterval = { start: number; end: number };

// Slots cada 30 minutos desde 08:00 hasta 16:30 (último inicio posible)
const SLOT_MINUTES: number[] = [];
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

  // fuera de rango
  if (start < MIN_START || end > MAX_END) return true;

  // se solapa con algún intervalo ocupado
  return busy.some((b) => start < b.end && end > b.start);
}

export default function VisitsPage() {
  const nav = useNavigate();
  const [searchParams] = useSearchParams();

  const [role, setRole] = useState<"ADMIN" | "USER">("USER");
  const [inmates, setInmates] = useState<MyInmate[]>([]);
  const [loadingInmates, setLoadingInmates] = useState(true);

  const [form, setForm] = useState<VisitForm>({
    inmate_id: "",
    visit_date: "",
    visit_hour: "",
    notes: "",
  });

  const [formError, setFormError] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  // NUEVO: duración seleccionada y horarios ocupados
  const [duration, setDuration] = useState<number>(60); // 1 hora por defecto
  const [busyIntervals, setBusyIntervals] = useState<BusyInterval[]>([]);

  // Cargar rol + opciones de internos (todos si es ADMIN, propios si es USER)
  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        setLoadingInmates(true);
        // 1) rol
        const me = await api.get<MeResp>("/auth/me");
        const r = (me?.user?.role === "ADMIN" ? "ADMIN" : "USER") as
          | "ADMIN"
          | "USER";
        if (!cancel) setRole(r);

        // 2) cargar internos según rol
        if (r === "ADMIN") {
          const resp = await adminListInmates({ page: 1, limit: 500 });
          const mapped: MyInmate[] = (resp.items || []).map((i) => ({
            inmate_id: i.id,
            first_name: i.first_name,
            last_name: i.last_name,
            relation: "ADMIN",
          }));
          if (!cancel) setInmates(mapped);
        } else {
          const mine = await getMyInmates();
          if (!cancel) setInmates(mine);
        }
      } catch (e: any) {
        if (!cancel) setApiError(e?.message ?? "Error cargando internos");
      } finally {
        if (!cancel) setLoadingInmates(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, []);

  // Preselección por query ?inmate=<uuid> si existe; si no, primero de la lista
  useEffect(() => {
    if (loadingInmates) return;
    const fromQuery = searchParams.get("inmate");
    if (fromQuery && inmates.some((x) => x.inmate_id === fromQuery)) {
      setForm((f) => ({ ...f, inmate_id: fromQuery }));
    } else if (!form.inmate_id && inmates.length) {
      setForm((f) => ({ ...f, inmate_id: inmates[0].inmate_id }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadingInmates, inmates]);

// Cargar horarios ocupados cuando cambia la fecha o el interno
useEffect(() => {
  if (!form.visit_date || !form.inmate_id) {
    setBusyIntervals([]);
    return;
  }

  let cancel = false;

  (async () => {
    try {
      const res = await api.get<{ ok: boolean; visits: DayVisit[] }>(
        `/visits/slots?date=${form.visit_date}&inmate_id=${form.inmate_id}`
      );

      const rows = (res?.visits || []).filter((v) =>
        ["PENDING", "APPROVED"].includes((v.status || "").toUpperCase())
      );

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
      console.error("Error cargando horarios ocupados", e);
      if (!cancel) setBusyIntervals([]);
    }
  })();

  return () => {
    cancel = true;
  };
}, [form.visit_date, form.inmate_id]);


  function onChange<K extends keyof VisitForm>(key: K, value: VisitForm[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setFormError(null);
    setApiError(null);
    setOkMsg(null);
  }

  async function onSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    setFormError(null);
    setApiError(null);
    setOkMsg(null);

    const parsed = formSchema.safeParse(form);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      setFormError(first?.message ?? "Datos inválidos");
      return;
    }

    try {
      const hhmm = parsed.data.visit_hour;
      const visit_hour = hhmm.length === 5 ? `${hhmm}:00` : hhmm;

      await api.post<{ ok: boolean; visit: any }>("/visits", {
        inmate_id: parsed.data.inmate_id,
        visit_date: parsed.data.visit_date,
        visit_hour,
        duration_minutes: duration, // NUEVO: enviamos duración al backend
        notes: parsed.data.notes ?? null,
      });

      setOkMsg("Visita creada correctamente.");
      setForm({
        inmate_id: inmates[0]?.inmate_id ?? "",
        visit_date: "",
        visit_hour: "",
        notes: "",
      });
      setDuration(60);
      setBusyIntervals([]);
    } catch (err: any) {
      setApiError(err?.message ?? "Error creando visita");
    }
  }

  const isAdmin = role === "ADMIN";

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
          <h1 className="h1">Visitas</h1>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn-outline" onClick={() => nav("/dashboard")}>
              Volver
            </button>
            <button
              className="btn-outline"
              onClick={() => {
                localStorage.removeItem("token");
                window.location.href = "/login";
              }}
            >
              Salir
            </button>
          </div>
        </div>

        <section className="card-light">
          <h2 style={{ marginTop: 0 }}>Nueva visita</h2>

          <form className="row" onSubmit={onSubmit}>
            <label className="vc-col-span-2">
              Interno{" "}
              {isAdmin && <span style={{ color: "#64748b" }}>(Admin)</span>}
              <select
                className="input-light"
                disabled={loadingInmates}
                value={form.inmate_id}
                onChange={(e) => onChange("inmate_id", e.target.value)}
              >
                {loadingInmates && <option>Cargando…</option>}
                {!loadingInmates && !inmates.length && (
                  <option value="">
                    {isAdmin
                      ? "No hay internos"
                      : "No tienes internos autorizados"}
                  </option>
                )}
                {!loadingInmates &&
                  inmates.map((i) => (
                    <option key={i.inmate_id} value={i.inmate_id}>
                      {i.first_name} {i.last_name}
                      {isAdmin ? "" : ` · ${i.relation}`}
                    </option>
                  ))}
              </select>
            </label>

            <label>
              Fecha
              <input
                className="input-light"
                type="date"
                value={form.visit_date}
                onChange={(e) => onChange("visit_date", e.target.value)}
              />
            </label>

            {/* NUEVO: duración + selector de horario en bloques de 30 min */}
            <label>
              Duración
              <select
                className="input-light"
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
              >
                <option value={30}>30 minutos</option>
                <option value={60}>1 hora</option>
                <option value={90}>1 hora 30</option>
                <option value={120}>2 horas (máximo)</option>
              </select>
            </label>

            <div className="vc-col-span-2" style={{ marginTop: 8 }}>
              <label>Horario de inicio</label>
              {!form.visit_date && (
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
                  const label = minutesToLabel(total); // "08:00", "08:30", etc.
                  const disabled =
                    !form.visit_date ||
                    isSlotDisabled(total, duration, busyIntervals);
                  const isSelected = form.visit_hour === label;

                  return (
                    <button
                      key={label}
                      type="button"
                      disabled={disabled}
                      onClick={() =>
                        !disabled && onChange("visit_hour", label)
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

            <label className="vc-col-span-2">
              Notes (opcional)
              <input
                className="input-light"
                type="text"
                value={form.notes}
                onChange={(e) => onChange("notes", e.target.value)}
                placeholder="Observaciones, motivo, etc."
              />
            </label>
          </form>

          {formError && (
            <p className="vc-error" style={{ color: "#b91c1c", marginTop: 8 }}>
              {formError}
            </p>
          )}
          {apiError && (
            <p className="vc-error" style={{ color: "#b91c1c" }}>
              {apiError}
            </p>
          )}
          {okMsg && (
            <p className="vc-error" style={{ color: "#16a34a" }}>
              {okMsg}
            </p>
          )}

          <div style={{ marginTop: 10 }}>
            <button
              onClick={onSubmit as any}
              className="btn"
              style={{ width: 96 }}
              disabled={!form.inmate_id}
              title={!form.inmate_id ? "Debes seleccionar un interno" : ""}
            >
              Crear
            </button>
          </div>

          <p style={{ marginTop: 12 }}>
            ¿Quieres ver tus visitas?{" "}
            <a href="/history" style={{ color: "#b91c1c", fontWeight: 600 }}>
              Ir al historial
            </a>
          </p>
        </section>
      </div>
    </div>
  );
}
