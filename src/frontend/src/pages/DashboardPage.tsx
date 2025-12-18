// src/frontend/src/pages/DashboardPage.tsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api, { API_BASE_URL } from "../api/client";

type Visit = {
  id: string;
  visitor_name: string;
  inmate_name: string;
  visit_date: string; // YYYY-MM-DD
  visit_hour: string; // HH:mm[:ss]
  status: "PENDING" | "APPROVED" | "REJECTED" | string;
  notes?: string;
  created_at?: string;
  inmate_id?: string | null;
};

type MeResp = {
  ok: boolean;
  user?: { id: string; name: string; email: string; role: string };
};

export default function DashboardPage() {
  const nav = useNavigate();

  const [visits, setVisits] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(false);
  const [unread, setUnread] = useState(0);
  const [toasts, setToasts] = useState<
    Array<{ id: string; title: string; body: string }>
  >([]);
  const [displayName, setDisplayName] = useState<string>(
    localStorage.getItem("user_name") ||
      localStorage.getItem("email") ||
      "Usuario"
  );
  const [userRole, setUserRole] = useState<string | null>(null); // 👈 nuevo

  const greet = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return "¡Buenos días!";
    if (h < 19) return "¡Buenas tardes!";
    return "¡Buenas noches!";
  }, []);

  function parseDateTime(v: Visit) {
    const hh = v.visit_hour.length === 5 ? `${v.visit_hour}:00` : v.visit_hour;
    return new Date(`${v.visit_date}T${hh}`);
  }

  // ----- Nombre usuario (me) + rol -----
  useEffect(() => {
    (async () => {
      try {
        const me = await api.get<MeResp>("/auth/me");
        if (me?.user) {
          const name = me.user.name || me.user.email || "Usuario";
          setDisplayName(name);
          localStorage.setItem("user_name", me.user.name || "");
          localStorage.setItem("email", me.user.email || "");
          setUserRole(me.user.role || null); // 👈 guardamos rol en estado
          localStorage.setItem("user_role", me.user.role || "");
        }
      } catch {
        /* ignore */
      }
    })();
  }, []);

  // ----- CARGAR VISITAS PARA KPIs + PRÓXIMA VISITA -----
  useEffect(() => {
    async function loadVisits() {
      setLoading(true);
      try {
        const res = await api.get<{ ok: boolean; visits: Visit[] }>("/visits");
        setVisits(res.visits ?? []);
      } catch (e) {
        console.error("Error cargando visitas:", e);
        setVisits([]);
      } finally {
        setLoading(false);
      }
    }

    loadVisits();
  }, []);

  // ----- Unread inicial -----
  async function refreshUnread() {
    try {
      const r = await api.get<{ ok: boolean; count: number }>(
        "/notifications/unread-count"
      );
      setUnread(r.count || 0);
    } catch {
      setUnread(0);
    }
  }

  useEffect(() => {
    refreshUnread();
  }, []);

  useEffect(() => {
    const onChanged = () => {
      refreshUnread();
    };
    window.addEventListener("notif:changed", onChanged as any);
    return () => window.removeEventListener("notif:changed", onChanged as any);
  }, []);

  // ----- SSE notificaciones -----
  useEffect(() => {
    const base = API_BASE_URL;
    const token = localStorage.getItem("token") || "";
    if (!token) return;

    const url = `${base}/api/notifications/stream?token=${encodeURIComponent(
      token
    )}`;
    const es = new EventSource(url);

    const onNotif = (ev: MessageEvent) => {
      try {
        const data = JSON.parse(ev.data);
        const n = (data as any)?.item;
        if (!n) return;

        setUnread((u) => u + (n.is_read ? 0 : 1));

        const id = n.id || Math.random().toString(36).slice(2);
        setToasts((t) => [{ id, title: n.title, body: n.body }, ...t]);

        setTimeout(() => {
          setToasts((t) => t.filter((x) => x.id !== id));
        }, 5000);
      } catch {
        /* ignore */
      }
    };

    es.addEventListener("notif", onNotif);
    es.addEventListener("error", () => {});

    return () => {
      es.removeEventListener("notif", onNotif);
      es.close();
    };
  }, []);

  // ----- KPIs -----
  const { pending, approved, rejected } = useMemo(() => {
    const p = visits.filter((v) => v.status === "PENDING").length;
    const a = visits.filter((v) => v.status === "APPROVED").length;
    const r = visits.filter((v) => v.status === "REJECTED").length;
    return { pending: p, approved: a, rejected: r };
  }, [visits]);

    const nextVisit = useMemo(() => {
    // Candidatas: visitas pendientes o aprobadas
    const candidates = visits.filter(
      (v) => v.status === "PENDING" || v.status === "APPROVED"
    );

    if (!candidates.length) return undefined;

    candidates.sort((a, b) => {
      const ta = parseDateTime(a).getTime();
      const tb = parseDateTime(b).getTime();
      if (isNaN(ta) && isNaN(tb)) return 0;
      if (isNaN(ta)) return 1; // ponemos las inválidas al final
      if (isNaN(tb)) return -1;
      return ta - tb;
    });

    return candidates[0];
  }, [visits]);


  const notifCount = unread;
  const isAdmin = userRole === "ADMIN"; // 👈 flag

  const logout = () => {
    localStorage.removeItem("token");
    nav("/login", { replace: true });
  };

  return (
    <div className="app-light">
      {/* TOASTS overlay */}
      <div className="toast-wrap">
        {toasts.map((t) => (
          <div key={t.id} className="toast">
            <strong>{t.title}</strong>
            <div>{t.body}</div>
          </div>
        ))}
      </div>

      <div className="dash">
        {/* HERO */}
        <header className="hero">
          <div className="hero-row">
            <div className="brand-avatar">VC</div>

            <div className="hero-titles">
              <div className="hero-greet">{greet}</div>
              <div className="hero-name">{displayName}</div>
            </div>

            <button className="btn-outline" onClick={() => nav("/profile")}>
              Mi perfil
            </button>

            <button
              className="hero-bell"
              onClick={() => nav("/notifications")}
              aria-label="Notificaciones"
              title="Notificaciones"
            >
              <svg viewBox="0 0 24 24" width="22" height="22" fill="#fff">
                <path d="M12 2a7 7 0 0 0-7 7v3.09l-1.38 2.3A1 1 0 0 0 4.5 16h15a1 1 0 0 0 .88-1.5L19 12.09V9a7 7 0 0 0-7-7Zm0 20a3 3 0 0 0 3-3H9a3 3 0 0 0 3 3Z" />
              </svg>
              {notifCount > 0 && <span className="badge">{notifCount}</span>}
            </button>
          </div>

          <div className="hero-pill">
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
              <path
                fill="#fff"
                opacity=".85"
                d="M12 2L3 5v6c0 5 3.8 9.7 9 11 5.2-1.3 9-6 9-11V5l-9-3Zm0 2.2l7 2.3v4.5c0 4-2.8 7.9-7 9.1-4.2-1.2-7-5-7-9.1V6.5l7-2.3Z"
              />
            </svg>
            <span>Sistema de gestión de visitas penitenciarias</span>
          </div>
        </header>

        {/* ACCIONES */}
        <h2 className="section-title">Acciones Principales</h2>

        <div className="action-list">
          {/* Agendar visita */}
          <button className="action-card" onClick={() => nav("/visits")}>
            <span className="icon-square primary">
              <svg
                viewBox="0 0 24 24"
                width="22"
                height="22"
                fill="none"
                stroke="white"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="4" width="18" height="17" rx="2" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
                <line x1="12" y1="13" x2="12" y2="17" />
                <line x1="10" y1="15" x2="14" y2="15" />
              </svg>
            </span>
            <div className="action-text">
              <h3>Agendar Visita</h3>
              <p>Programa una nueva visita</p>
            </div>
          </button>

          {/* Historial */}
          <button className="action-card" onClick={() => nav("/history")}>
            <span className="icon-square">
              <svg
                viewBox="0 0 24 24"
                width="22"
                height="22"
                fill="none"
                stroke="white"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="7" />
                <polyline points="12,8 12,12 15,13.5" />
              </svg>
            </span>
            <div className="action-text">
              <h3>Mis Visitas / Historial</h3>
              <p>Ver tus visitas programadas y pasadas</p>
            </div>
          </button>

          {/* Internos */}
          <button className="action-card" onClick={() => nav("/inmates")}>
            <span className="icon-square">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="white">
                <circle cx="12" cy="9" r="3.2" />
                <path d="M6 18.5c0-3 2.7-5.5 6-5.5s6 2.5 6 5.5v.5H6z" />
              </svg>
            </span>
            <div className="action-text">
              <h3>Mis Internos</h3>
              <p>Ver internos autorizados</p>
            </div>
          </button>

          {/* Notificaciones */}
          <button className="action-card" onClick={() => nav("/notifications")}>
            <span className="icon-square">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="white">
                <path d="M12 2a6 6 0 0 0-6 6v3.2L4 14.5V16h16v-1.5l-2-3.3V8a6 6 0 0 0-6-6z" />
                <path d="M9.5 18.5A2.5 2.5 0 0 0 12 21a2.5 2.5 0 0 0 2.5-2.5h-5z" />
              </svg>
              {notifCount > 0 && (
                <span className="badge small">{notifCount}</span>
              )}
            </span>
            <div className="action-text">
              <h3>Notificaciones</h3>
              <p>{notifCount} mensajes nuevos</p>
            </div>
          </button>

          {/* Panel Admin – solo si es ADMIN */}
          {isAdmin && (
            <button className="action-card" onClick={() => nav("/admin")}>
              <span className="icon-square">
                <svg viewBox="0 0 24 24" width="22" height="22" fill="white">
                  <path d="M7 3l2 2-3 3-2-2z" />
                  <path d="M14 10l2 2-6 6H8v-2z" />
                  <path d="M15.5 3.5a3 3 0 0 1 4.24 4.24l-2.12 2.12-4.24-4.24z" />
                </svg>
              </span>
              <div className="action-text">
                <h3>Panel Admin</h3>
                <p>Gestionar internos y visitas</p>
              </div>
            </button>
          )}
        </div>

        {/* Próxima visita */}
        <div className="card-light" style={{ marginTop: 16 }}>
          <h3 className="subtitle">Próxima visita</h3>
          {loading ? (
            <p style={{ color: "#64748b", margin: 8 }}>Cargando…</p>
          ) : nextVisit ? (
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div className="icon-square" aria-hidden>
                <svg
                  viewBox="0 0 24 24"
                  width="22"
                  height="22"
                  fill="none"
                  stroke="white"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="3" y="4" width="18" height="17" rx="2" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
              </div>
              <div>
                <div style={{ fontWeight: 600 }}>
                  {nextVisit.inmate_name} · {nextVisit.visit_date}{" "}
                  {nextVisit.visit_hour.length === 5
                    ? nextVisit.visit_hour
                    : nextVisit.visit_hour.slice(0, 5)}
                </div>
                <div style={{ color: "#64748b", fontSize: 14 }}>
                  Estado:{" "}
                  {nextVisit.status === "PENDING"
                    ? "Pendiente"
                    : nextVisit.status === "APPROVED"
                    ? "Aprobada"
                    : nextVisit.status === "REJECTED"
                    ? "Rechazada"
                    : nextVisit.status}
                </div>
              </div>
            </div>
          ) : (
            <p style={{ color: "#64748b", margin: 8 }}>
              No tienes visitas próximas.
            </p>
          )}
        </div>

        {/* Logout + sesión */}
        <button 
          className="logout-ghost" 
          onClick={logout}
        >
          Cerrar sesión
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
            <path d="M10 17l5-5-5-5v10z" />
            <path d="M4 4h6v2H6v12h4v2H4z" />
          </svg>
        </button>
        <p className="session-note">Sesión iniciada como {displayName}</p>

        {/* RESUMEN KPIs */}
        <div className="card-light">
          <h3 className="subtitle">Resumen de Visitas</h3>
          {loading ? (
            <p style={{ color: "#64748b", margin: 8 }}>Cargando…</p>
          ) : (
            <div className="summary">
              <div className="summary-chip pending">
                <span className="chip-ico">🕑</span>
                <div>
                  <div className="chip-title">Pendientes</div>
                  <div className="chip-val">{pending}</div>
                </div>
              </div>
              <div className="summary-chip approved">
                <span className="chip-ico">✅</span>
                <div>
                  <div className="chip-title">Aprobadas</div>
                  <div className="chip-val">{approved}</div>
                </div>
              </div>
              <div className="summary-chip rejected">
                <span className="chip-ico">✖️</span>
                <div>
                  <div className="chip-title">Rechazadas</div>
                  <div className="chip-val">{rejected}</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}