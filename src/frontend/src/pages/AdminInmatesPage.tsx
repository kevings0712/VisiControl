import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  adminListInmates,
  adminGetInmate,
  adminCreateInmate,
  adminUpdateInmate,
  adminDeleteInmate,
  type Inmate,
  type InmateDetail,
  type InmatePayload,
} from "../api/inmates";

type Mode = "create" | "edit";

export default function AdminInmatesPage() {
  const nav = useNavigate();

  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"" | "ENABLED" | "BLOCKED">("");
  const [page, setPage] = useState(1);
  const [limit] = useState(20);

  const [rows, setRows] = useState<Inmate[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // ---- Modal estado ----
  const [mode, setMode] = useState<Mode | null>(null);
  const [editing, setEditing] = useState<InmateDetail | null>(null);
  const [form, setForm] = useState<InmatePayload | null>(null);
  const [formErr, setFormErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function load(p = page) {
    setLoading(true);
    setErr(null);
    try {
      const r = await adminListInmates({
        q: q.trim() || undefined,
        status: status || undefined,
        page: p,
        limit,
      });
      setRows(r.items || []);
      setTotal(r.pagination.total || 0);
    } catch (e: any) {
      setErr(e?.message ?? "No se pudo cargar la lista");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setPage(1);
    load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, status]);

  useEffect(() => {
    load(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const pages = useMemo(
    () => Math.max(1, Math.ceil(total / limit)),
    [total, limit]
  );

  // ========= Modal helpers =========

  function openCreate() {
    setMode("create");
    setEditing(null);
    setForm({
      first_name: "",
      last_name: "",
      doc_type: "CEDULA",
      national_id: "",
      birth_date: "",
      pavilion: "",
      cell: "",
      status: "ENABLED",
      notes: "",
    });
    setFormErr(null);
  }

  async function openEdit(row: Inmate) {
    try {
      setMode("edit");
      setFormErr(null);
      setSaving(false);
      // Traer detalle completo
      const detail = await adminGetInmate(row.id);
      setEditing(detail);
      setForm({
        first_name: detail.first_name,
        last_name: detail.last_name,
        doc_type: detail.doc_type,
        national_id: detail.national_id,
        birth_date: detail.birth_date?.slice(0, 10) ?? "",
        pavilion: detail.pavilion,
        cell: detail.cell,
        status:
          detail.status === "ACTIVE" ? "ENABLED" : (detail.status as any),
        notes: detail.notes,
      });
    } catch (e: any) {
      setMode(null);
      alert(e?.message ?? "No se pudo cargar el interno");
    }
  }

  function closeModal() {
    setMode(null);
    setEditing(null);
    setForm(null);
    setFormErr(null);
    setSaving(false);
    setDeleting(false);
  }

  function updateForm<K extends keyof InmatePayload>(
    key: K,
    val: InmatePayload[K]
  ) {
    if (!form) return;
    setForm({ ...form, [key]: val });
    setFormErr(null);
  }

  async function handleSave() {
    if (!form || !mode) return;

    if (!form.first_name || !form.last_name) {
      setFormErr("Nombres y apellidos son obligatorios");
      return;
    }

    setSaving(true);
    try {
      // Limpiar strings vacíos -> null
      const payload: InmatePayload = {
        ...form,
        national_id: form.national_id || null,
        birth_date: form.birth_date || null,
        pavilion: form.pavilion || null,
        cell: form.cell || null,
        notes: form.notes || null,
      };

      if (mode === "create") {
        await adminCreateInmate(payload);
      } else if (mode === "edit" && editing) {
        await adminUpdateInmate(editing.id, payload);
      }

      await load(page);
      closeModal();
    } catch (e: any) {
      setFormErr(e?.message ?? "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!editing) return;
    if (!confirm("¿Eliminar este interno? Esta acción no se puede deshacer.")) {
      return;
    }
    setDeleting(true);
    try {
      await adminDeleteInmate(editing.id);
      await load(page);
      closeModal();
    } catch (e: any) {
      setFormErr(e?.message ?? "No se pudo eliminar");
      setDeleting(false);
    }
  }

  // ========= Render =========

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
          <h1 className="h1">Administración · Internos</h1>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn-outline" onClick={openCreate}>
              Nuevo interno
            </button>
            <button
              className="btn-outline"
              onClick={() => nav("/admin")}
            >
              Volver
            </button>
          </div>
        </div>

        {/* Filtros */}
        <div className="card-light" style={{ padding: 12, marginBottom: 12 }}>
          <div className="row">
            <label>
              Buscar
              <input
                className="input-light"
                placeholder="Nombre o cédula"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </label>
            <label>
              Estado
              <select
                className="input-light"
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
              >
                <option value="">Todos</option>
                <option value="ENABLED">ENABLED</option>
                <option value="BLOCKED">BLOCKED</option>
              </select>
            </label>
            <div style={{ display: "flex", alignItems: "flex-end" }}>
              <button className="btn" onClick={() => load(1)}>
                Aplicar
              </button>
            </div>
          </div>
        </div>

        {loading && <p>Cargando…</p>}
        {err && <p style={{ color: "#b91c1c" }}>{err}</p>}
        {!loading && !rows.length && (
          <div className="card-light" style={{ padding: 16 }}>
            Sin resultados
          </div>
        )}

        {/* Lista de internos */}
        {rows.map((i) => (
          <article
            key={i.id}
            className="notif-card"
            onClick={() => openEdit(i)}
            style={{
              background: "#fff",
              border: "1px solid #e5e7eb",
              borderRadius: 16,
              padding: 14,
              marginBottom: 12,
              boxShadow: "0 10px 30px rgba(0,0,0,.06)",
              cursor: "pointer",
            }}
          >
            <h3 style={{ margin: "0 0 6px" }}>
              {i.first_name} {i.last_name}
            </h3>
            <div style={{ color: "#64748b", fontSize: 14 }}>
              {i.national_id ? <>Cédula: {i.national_id} · </> : null}
              Estado: {i.status}
              {i.pavilion ? <> · Pab: {i.pavilion}</> : null}
              {i.cell ? <> · Celda: {i.cell}</> : null}
            </div>
          </article>
        ))}

        {/* Paginación */}
        {pages > 1 && (
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button
              className="btn-outline"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Anterior
            </button>
            <div style={{ padding: "6px 10px" }}>
              Página {page} / {pages}
            </div>
            <button
              className="btn-outline"
              disabled={page >= pages}
              onClick={() => setPage((p) => p + 1)}
            >
              Siguiente
            </button>
          </div>
        )}
      </div>

      {/* Modal crear/editar */}
      {mode && form && (
        <div className="modal" onClick={closeModal}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>
              {mode === "create" ? "Nuevo interno" : "Editar interno"}
            </h3>

            <div className="row">
              <label>
                Nombres
                <input
                  className="input-light"
                  value={form.first_name}
                  onChange={(e) =>
                    updateForm("first_name", e.target.value)
                  }
                />
              </label>
              <label>
                Apellidos
                <input
                  className="input-light"
                  value={form.last_name}
                  onChange={(e) =>
                    updateForm("last_name", e.target.value)
                  }
                />
              </label>
              <label>
                Tipo doc.
                <select
                  className="input-light"
                  value={form.doc_type || "CEDULA"}
                  onChange={(e) =>
                    updateForm("doc_type", e.target.value)
                  }
                >
                  <option value="CEDULA">Cédula</option>
                  <option value="PASAPORTE">Pasaporte</option>
                  <option value="OTRO">Otro</option>
                </select>
              </label>
              <label>
                Número doc.
                <input
                  className="input-light"
                  value={form.national_id || ""}
                  onChange={(e) =>
                    updateForm("national_id", e.target.value)
                  }
                />
              </label>
              <label>
                Fecha de nacimiento
                <input
                  type="date"
                  className="input-light"
                  value={form.birth_date || ""}
                  onChange={(e) =>
                    updateForm("birth_date", e.target.value)
                  }
                />
              </label>
              <label>
                Pabellón
                <input
                  className="input-light"
                  value={form.pavilion || ""}
                  onChange={(e) =>
                    updateForm("pavilion", e.target.value)
                  }
                />
              </label>
              <label>
                Celda
                <input
                  className="input-light"
                  value={form.cell || ""}
                  onChange={(e) =>
                    updateForm("cell", e.target.value)
                  }
                />
              </label>
              <label>
                Estado
                <select
                  className="input-light"
                  value={form.status || "ENABLED"}
                  onChange={(e) =>
                    updateForm("status", e.target.value as any)
                  }
                >
                  <option value="ENABLED">ENABLED</option>
                  <option value="BLOCKED">BLOCKED</option>
                </select>
              </label>
              <label className="vc-col-span-2">
                Notas
                <textarea
                  className="input-light"
                  rows={3}
                  value={form.notes || ""}
                  onChange={(e) =>
                    updateForm("notes", e.target.value)
                  }
                />
              </label>
            </div>

            {formErr && (
              <p style={{ color: "#b91c1c", marginTop: 8 }}>{formErr}</p>
            )}

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginTop: 12,
                gap: 8,
              }}
            >
              {mode === "edit" && (
                <button
                  className="btn-outline danger"
                  onClick={handleDelete}
                  disabled={deleting}
                >
                  {deleting ? "Eliminando…" : "Eliminar"}
                </button>
              )}
              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: 8,
                  flex: 1,
                }}
              >
                <button className="btn-outline" onClick={closeModal}>
                  Cancelar
                </button>
                <button
                  className="btn"
                  onClick={handleSave}
                  disabled={saving}
                >
                  {saving ? "Guardando…" : "Guardar"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
