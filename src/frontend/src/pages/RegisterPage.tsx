import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import api from "../api/client";
import logo from "../../../../docs/logovisicontrol.png";

const schema = z
  .object({
    name: z.string().min(2, "Ingresa tu nombre"),
    last_name: z.string().min(2, "Ingresa tu apellido"),
    national_id: z
      .string()
      .trim()
      .regex(/^\d{6,15}$/, "Cédula inválida (solo dígitos, 6–15)"),
    birth_date: z
      .string()
      .trim()
      .optional()
      .or(z.literal("").transform(() => undefined)),
    email: z.string().trim().toLowerCase().email("Correo inválido"),
    password: z
      .string()
      .min(6, "La contraseña debe tener al menos 6 caracteres"),
    confirm: z.string().min(6, "Confirma tu contraseña"),
  })
  .refine(
    (v) => v.password.trim() === v.confirm.trim(),
    {
      path: ["confirm"],
      message: "Las contraseñas no coinciden",
    }
  );

export default function RegisterPage() {
  const nav = useNavigate();

  const [showPwd, setShowPwd] = useState(false);
  const [showPwd2, setShowPwd2] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: "",
    last_name: "",
    national_id: "",
    birth_date: "",
    email: "",
    password: "",
    confirm: "",
  });

  function onChange<K extends keyof typeof form>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
    setErr(null); // limpia error cuando el usuario edita
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);

    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      setErr(first?.message ?? "Datos inválidos");
      return;
    }

    try {
      setLoading(true);
      const payload = {
        name: form.name.trim(),
        last_name: form.last_name.trim(),
        email: form.email.trim().toLowerCase(),
        password: form.password,
        national_id: form.national_id.trim(),
        birth_date: form.birth_date || null,
      };

      const res = await api.post<{ ok: boolean; token: string; user: any }>(
        "/auth/register",
        payload
      );

      localStorage.setItem("token", res.token);
      localStorage.setItem(
        "user_name",
        `${res.user.name} ${res.user.last_name}`.trim()
      );
      localStorage.setItem("email", res.user.email);

      nav("/dashboard", { replace: true });
    } catch (e: any) {
      setErr(e?.message ?? "Error registrando");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="app-light">
      <div className="container" style={{ maxWidth: 900 }}>
        {/* Header rojo */}
        <div
          className="card-light"
          style={{ background: "#cf4444", color: "#fff", marginTop: 16 }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <button
              className="btn-outline"
              onClick={() => nav(-1)}
              style={{
                background: "transparent",
                color: "#fff",
                borderColor: "#fff",
              }}
            >
              ← Volver
            </button>
            <div />
          </div>
          <h1 style={{ margin: "12px 0 6px 0" }}>Registro</h1>
          <p style={{ margin: 0, opacity: 0.9 }}>Crea una nueva cuenta</p>
        </div>

        {/* Formulario */}
        <div className="card-light">
          <form onSubmit={onSubmit}>
            <div className="row" style={{ marginBottom: 12 }}>
              <label>
                Nombre
                <input
                  className="input-light"
                  type="text"
                  value={form.name}
                  onChange={(e) => onChange("name", e.target.value)}
                  placeholder="Tu nombre"
                />
              </label>

              <label>
                Apellido
                <input
                  className="input-light"
                  type="text"
                  value={form.last_name}
                  onChange={(e) => onChange("last_name", e.target.value)}
                  placeholder="Tu apellido"
                />
              </label>
            </div>

            <div className="row" style={{ marginBottom: 12 }}>
              <label>
                Cédula de Identidad
                <input
                  className="input-light"
                  type="text"
                  value={form.national_id}
                  onChange={(e) => onChange("national_id", e.target.value)}
                  placeholder="1234567890"
                />
              </label>

              <label>
                Fecha de Nacimiento
                <input
                  className="input-light"
                  type="date"
                  value={form.birth_date}
                  onChange={(e) => onChange("birth_date", e.target.value)}
                  placeholder="YYYY-MM-DD"
                />
              </label>
            </div>

            <div className="row" style={{ marginBottom: 12 }}>
              <label>
                Correo Electrónico
                <input
                  className="input-light"
                  type="email"
                  value={form.email}
                  onChange={(e) => onChange("email", e.target.value)}
                  placeholder="correo@ejemplo.com"
                />
              </label>
              <div />
            </div>

            {/* Contraseña */}
            <div className="row" style={{ marginBottom: 12 }}>
              <div className="field">
                <label className="label">Contraseña</label>
                <div className="input-wrap">
                  <input
                    className="input has-toggle"
                    type={showPwd ? "text" : "password"}
                    value={form.password}
                    onChange={(e) => onChange("password", e.target.value)}
                    placeholder="Contraseña segura"
                    autoComplete="new-password"
                    required
                  />
                  <button
                    type="button"
                    className="eye-btn"
                    aria-label={
                      showPwd ? "Ocultar contraseña" : "Mostrar contraseña"
                    }
                    onClick={() => setShowPwd((s) => !s)}
                  >
                    {showPwd ? (
                      <svg
                        viewBox="0 0 24 24"
                        width="20"
                        height="20"
                        stroke="currentColor"
                        fill="none"
                        strokeWidth="2"
                      >
                        <path d="M3 3l18 18" />
                        <path d="M10.58 10.58A3 3 0 0113.42 13.42" />
                        <path d="M17.94 17.94A10.94 10.94 0 0112 20C5 20 1 12 1 12a21.56 21.56 0 016.06-7.06" />
                        <path d="M9.88 4.12A10.94 10.94 0 0112 4c7 0 11 8 11 8a20.29 20.29 0 01-3.87 5.14" />
                      </svg>
                    ) : (
                      <svg
                        viewBox="0 0 24 24"
                        width="20"
                        height="20"
                        stroke="currentColor"
                        fill="none"
                        strokeWidth="2"
                      >
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <div className="field">
                <label className="label">Confirmar contraseña</label>
                <div className="input-wrap">
                  <input
                    className="input has-toggle"
                    type={showPwd2 ? "text" : "password"}
                    value={form.confirm}
                    onChange={(e) => onChange("confirm", e.target.value)}
                    autoComplete="new-password"
                    placeholder="Repetir contraseña"
                    required
                  />
                  <button
                    type="button"
                    className="eye-btn"
                    aria-label={
                      showPwd2 ? "Ocultar contraseña" : "Mostrar contraseña"
                    }
                    onClick={() => setShowPwd2((s) => !s)}
                  >
                    {showPwd2 ? (
                      <svg
                        viewBox="0 0 24 24"
                        width="20"
                        height="20"
                        stroke="currentColor"
                        fill="none"
                        strokeWidth="2"
                      >
                        <path d="M3 3l18 18" />
                        <path d="M10.58 10.58A3 3 0 0113.42 13.42" />
                        <path d="M17.94 17.94A10.94 10.94 0 0112 20C5 20 1 12 1 12a21.56 21.56 0 016.06-7.06" />
                        <path d="M9.88 4.12A10.94 10.94 0 0112 4c7 0 11 8 11 8a20.29 20.29 0 01-3.87 5.14" />
                      </svg>
                    ) : (
                      <svg
                        viewBox="0 0 24 24"
                        width="20"
                        height="20"
                        stroke="currentColor"
                        fill="none"
                        strokeWidth="2"
                      >
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {err && (
              <p
                style={{
                  color: "#b91c1c",
                  marginTop: 6,
                  marginBottom: 10,
                }}
              >
                {err}
              </p>
            )}

            <button className="btn" type="submit" disabled={loading}>
              {loading ? "Creando cuenta..." : "Registrar"}
            </button>

            <p className="link-muted">
              ¿Ya tienes cuenta? <a href="/login">Iniciar sesión</a>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
