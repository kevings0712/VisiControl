import { useNavigate } from "react-router-dom";

export default function AdminPanelPage() {
  const nav = useNavigate();

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
          <h1 className="h1">Panel de Administración</h1>
          <button className="btn-outline" onClick={() => nav("/dashboard")}>
            Volver al inicio
          </button>
        </div>

        <p style={{ color: "#64748b", marginBottom: 16 }}>
          Desde aquí puedes gestionar la información del sistema penitenciario.
        </p>

        {/* Opciones del panel */}
        <div className="action-list">
          {/* Internos */}
          <button
            className="action-card"
            onClick={() => nav("/admin/inmates")}
          >
            <span className="icon-square">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="white">
                <circle cx="12" cy="9" r="3.2" />
                <path d="M6 18.5c0-3 2.7-5.5 6-5.5s6 2.5 6 5.5v.5H6z" />
              </svg>
            </span>
            <div className="action-text">
              <h3>Gestión de internos</h3>
              <p>Crear, editar, bloquear o eliminar internos</p>
            </div>
          </button>

          {/* Aprobación de visitas (placeholder, lo armamos luego) */}
          <button
            className="action-card"
            onClick={() => nav("/admin/visits")}
          >
            <span className="icon-square">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="white">
                <path d="M5 4h14v2H5z" />
                <path d="M5 8h14v12H5z" />
                <path d="M9 12h3v3H9z" />
              </svg>
            </span>
            <div className="action-text">
              <h3>Control de aprobación de visitas</h3>
              <p>Revisar y aprobar / rechazar solicitudes</p>
            </div>
          </button>

          {/* Relaciones interno–usuario (placeholder) */}
          <button
            className="action-card"
            onClick={() => nav("/admin/relations")}
          >
            <span className="icon-square">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="white">
                <circle cx="8" cy="8" r="3" />
                <circle cx="16" cy="8" r="3" />
                <path d="M4 18c0-2.2 1.8-4 4-4" />
                <path d="M20 18c0-2.2-1.8-4-4-4" />
                <path d="M10 13h4" />
              </svg>
            </span>
            <div className="action-text">
              <h3>Relación internos – usuarios</h3>
              <p>Asignar qué usuario puede visitar a qué interno</p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
