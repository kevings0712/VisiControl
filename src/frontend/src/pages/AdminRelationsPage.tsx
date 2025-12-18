// src/frontend/src/pages/AdminRelationsPage.tsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  adminListInmates,
  adminListInmateUsers,
  adminSearchUsers,
  adminAuthorizeUserToInmate,
  adminUnauthorizeUserFromInmate,
  type Inmate,
  type InmateUserRelation,
  type SimpleUser,
} from "../api/inmates";

export default function AdminRelationsPage() {
  const nav = useNavigate();

  // Internos
  const [inmates, setInmates] = useState<Inmate[]>([]);
  const [inmateSearch, setInmateSearch] = useState("");
  const [selectedInmateId, setSelectedInmateId] = useState<string>("");

  // Relaciones (usuarios autorizados)
  const [relations, setRelations] = useState<InmateUserRelation[]>([]);
  const [relLoading, setRelLoading] = useState(false);

  // Buscar usuarios para agregar
  const [userSearch, setUserSearch] = useState("");
  const [userResults, setUserResults] = useState<SimpleUser[]>([]);
  const [userSearchLoading, setUserSearchLoading] = useState(false);

  const [loadingInmates, setLoadingInmates] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);

  const selectedInmate = useMemo(
    () => inmates.find((i) => i.id === selectedInmateId) || null,
    [inmates, selectedInmateId]
  );

  // ---------- Cargar internos (lista para el combo) ----------
async function loadInmates() {
  setLoadingInmates(true);
  setErr(null);
  try {
    const resp = await adminListInmates({
      q: inmateSearch.trim() || undefined,
      // status: "ENABLED",   // ← QUITA ESTA LÍNEA
      page: 1,
      limit: 200,
    });
    setInmates(resp.items || []);
    if (!selectedInmateId && resp.items && resp.items.length > 0) {
      setSelectedInmateId(resp.items[0].id);
    }
  } catch (e: any) {
    setErr(e?.message ?? "No se pudo cargar la lista de internos");
  } finally {
    setLoadingInmates(false);
  }
}


  useEffect(() => {
    loadInmates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cuando cambia el search de internos y haces "Buscar"
  async function handleSearchInmates() {
    await loadInmates();
  }

  // ---------- Cargar relaciones de un interno ----------
  async function loadRelations(inmateId: string) {
    if (!inmateId) {
      setRelations([]);
      return;
    }
    setRelLoading(true);
    setErr(null);
    try {
      const resp = await adminListInmateUsers(inmateId);
      setRelations(resp.items || []);
    } catch (e: any) {
      setErr(e?.message ?? "No se pudo cargar las relaciones");
    } finally {
      setRelLoading(false);
    }
  }

  useEffect(() => {
    if (selectedInmateId) {
      loadRelations(selectedInmateId);
    } else {
      setRelations([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedInmateId]);

  // ---------- Buscar usuarios para agregar ----------
  async function handleSearchUsers() {
    const q = userSearch.trim();
    if (!q) {
      setUserResults([]);
      return;
    }
    setUserSearchLoading(true);
    setErr(null);
    try {
      const resp = await adminSearchUsers(q);
      setUserResults(resp.items || []);
    } catch (e: any) {
      setErr(e?.message ?? "No se pudo buscar usuarios");
    } finally {
      setUserSearchLoading(false);
    }
  }

  // ---------- Agregar relación ----------
  async function handleAddUser(u: SimpleUser) {
    if (!selectedInmateId) return;
    if (
      !confirm(
        `¿Autorizar al usuario ${u.name} (${u.email}) para el interno ${
          selectedInmate?.first_name || ""
        } ${selectedInmate?.last_name || ""}?`
      )
    ) {
      return;
    }
    setBusyUserId(u.id);
    try {
      await adminAuthorizeUserToInmate(selectedInmateId, u.id, "AUTHORIZED");
      await loadRelations(selectedInmateId);
    } catch (e: any) {
      alert(e?.message ?? "No se pudo autorizar al usuario");
    } finally {
      setBusyUserId(null);
    }
  }

  // ---------- Quitar relación ----------
  async function handleRemoveUser(rel: InmateUserRelation) {
    if (!selectedInmateId) return;
    if (
      !confirm(
        `¿Quitar al usuario ${rel.name} (${rel.email}) del interno seleccionado?`
      )
    ) {
      return;
    }
    setBusyUserId(rel.user_id);
    try {
      await adminUnauthorizeUserFromInmate(selectedInmateId, rel.user_id);
      await loadRelations(selectedInmateId);
    } catch (e: any) {
      alert(e?.message ?? "No se pudo quitar la relación");
    } finally {
      setBusyUserId(null);
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
          <h1 className="h1">Relación internos – usuarios</h1>
          <button className="btn-outline" onClick={() => nav("/admin")}>
            Volver
          </button>
        </div>

        {/* Selección de interno */}
        <div className="card-light" style={{ padding: 12, marginBottom: 12 }}>
          <div className="row">
            <label className="vc-col-span-2">
              Interno
              <select
                className="input-light"
                value={selectedInmateId}
                onChange={(e) => setSelectedInmateId(e.target.value)}
              >
                {!selectedInmateId && <option value="">Selecciona…</option>}
                {inmates.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.first_name} {i.last_name}{" "}
                    {i.national_id ? `· ${i.national_id}` : ""}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Buscar interno
              <input
                className="input-light"
                placeholder="Nombre o cédula"
                value={inmateSearch}
                onChange={(e) => setInmateSearch(e.target.value)}
              />
            </label>
            <div style={{ display: "flex", alignItems: "flex-end" }}>
              <button className="btn" onClick={handleSearchInmates}>
                Buscar
              </button>
            </div>
          </div>
          {loadingInmates && <p>Cargando internos…</p>}
        </div>

        {err && (
          <p style={{ color: "#b91c1c", marginBottom: 12 }}>{err}</p>
        )}

        {!selectedInmate && !loadingInmates && (
          <div className="card-light" style={{ padding: 16 }}>
            Selecciona un interno para ver y gestionar sus usuarios
            autorizados.
          </div>
        )}

        {selectedInmate && (
          <>
            {/* Lista de usuarios autorizados */}
            <div
              className="card-light"
              style={{ padding: 12, marginBottom: 12 }}
            >
              <h3 style={{ marginTop: 0, marginBottom: 8 }}>
                Usuarios autorizados para{" "}
                <strong>
                  {selectedInmate.first_name} {selectedInmate.last_name}
                </strong>
              </h3>

              {relLoading && <p>Cargando relaciones…</p>}

              {!relLoading && !relations.length && (
                <p style={{ margin: 0 }}>
                  No hay usuarios autorizados para este interno.
                </p>
              )}

              {!relLoading &&
                relations.map((rel) => (
                  <article
                    key={rel.user_id}
                    className="notif-card"
                    style={{
                      background: "#fff",
                      border: "1px solid #e5e7eb",
                      borderRadius: 14,
                      padding: 10,
                      marginTop: 8,
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600 }}>{rel.name}</div>
                      <div
                        style={{
                          fontSize: 13,
                          color: "#64748b",
                          wordBreak: "break-all",
                        }}
                      >
                        {rel.email} · Relación: {rel.rel}
                      </div>
                    </div>
                    <button
                      className="btn-outline danger"
                      disabled={busyUserId === rel.user_id}
                      onClick={() => handleRemoveUser(rel)}
                    >
                      {busyUserId === rel.user_id
                        ? "Eliminando…"
                        : "Quitar"}
                    </button>
                  </article>
                ))}
            </div>

            {/* Buscar y agregar usuario */}
            <div className="card-light" style={{ padding: 12 }}>
              <h3 style={{ marginTop: 0, marginBottom: 8 }}>
                Agregar usuario autorizado
              </h3>
              <div className="row">
                <label className="vc-col-span-2">
                  Buscar usuario
                  <input
                    className="input-light"
                    placeholder="Nombre o correo"
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                  />
                </label>
                <div style={{ display: "flex", alignItems: "flex-end" }}>
                  <button className="btn" onClick={handleSearchUsers}>
                    Buscar
                  </button>
                </div>
              </div>

              {userSearchLoading && <p>Buscando usuarios…</p>}

              {!userSearchLoading && userResults.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  {userResults.map((u) => {
                    const already = relations.some(
                      (r) => r.user_id === u.id
                    );
                    return (
                      <article
                        key={u.id}
                        className="notif-card"
                        style={{
                          background: "#fff",
                          border: "1px solid #e5e7eb",
                          borderRadius: 14,
                          padding: 10,
                          marginTop: 6,
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 600 }}>{u.name}</div>
                          <div
                            style={{
                              fontSize: 13,
                              color: "#64748b",
                              wordBreak: "break-all",
                            }}
                          >
                            {u.email}
                          </div>
                        </div>
                        <button
                          className="btn-outline"
                          disabled={busyUserId === u.id || already}
                          onClick={() => handleAddUser(u)}
                        >
                          {already
                            ? "Ya autorizado"
                            : busyUserId === u.id
                            ? "Agregando…"
                            : "Autorizar"}
                        </button>
                      </article>
                    );
                  })}
                </div>
              )}

              {!userSearchLoading &&
                userResults.length === 0 &&
                userSearch.trim() && (
                  <p style={{ marginTop: 8 }}>
                    No se encontraron usuarios con ese criterio.
                  </p>
                )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
