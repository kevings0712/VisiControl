// src/frontend/src/api/client.ts

// Host de la API basado en el hostname actual (para que funcione con cualquier IP)
const API_HOST =
  typeof window !== "undefined" && window.location.hostname
    ? window.location.hostname
    : "localhost";

// Puerto fijo donde corre el backend de VisiControl
const API_PORT = 4000;

// Base del API sin barra final, ej: http://192.168.100.178:4000
export const API_BASE_URL = `http://${API_HOST}:${API_PORT}`.replace(/\/+$/, "");

const API_PREFIX = "/api";

// Normaliza base y path para evitar dobles barras y dobles /api
function buildUrl(path: string) {
  const prefix = API_PREFIX.replace(/\/+$/, ""); // deja /api sin barra extra
  const p = (path || "").startsWith("/") ? path : `/${path}`;
  return `${API_BASE_URL}${prefix}${p}`; // ej: http://ip:4000 + /api + /auth/login
}

async function request<T>(path: string, init: RequestInit = {}) {
  const token = typeof window !== "undefined"
    ? localStorage.getItem("token")
    : null;

  const res = await fetch(buildUrl(path), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers || {}),
    },
  });

  if (!res.ok) {
    let msg = "";
    try {
      const data = await res.json();
      msg = (data as any)?.message || "";
    } catch {
      // si no vino JSON, seguimos con fallbacks
    }

    if (!msg) {
      if (res.status === 401) msg = "Credenciales inválidas";
      else if (res.status === 404) msg = "Servicio no encontrado";
      else if (res.status === 409) msg = "Ya existe un registro con esos datos";
      else msg = res.statusText || `HTTP ${res.status}`;
    }

    throw new Error(msg);
  }

  if (res.status === 204) {
    return {} as T;
  }

  return (await res.json()) as T;
}

export const api = {
  get: <T>(path: string) =>
    request<T>(path),

  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body: JSON.stringify(body ?? {}) }),

  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PUT", body: JSON.stringify(body ?? {}) }),

  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PATCH", body: JSON.stringify(body ?? {}) }),

  del: <T>(path: string) =>
    request<T>(path, { method: "DELETE" }),
};

export default api;
