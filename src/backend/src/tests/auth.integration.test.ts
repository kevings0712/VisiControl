// src/tests/auth.integration.test.ts
import request from "supertest";
import app from "../app";
import { getPool } from "../config/db";

describe("Pruebas de integración - Auth", () => {
  const adminCreds = {
    email: "admin@visicontrol.dev",
    password: "Admin123!", // ajusta si tu seed usa otra contraseña
  };

  beforeAll(async () => {
    const db = getPool();
    // Sólo validamos que la BD está arriba
    await db.query("SELECT 1");
  });

  // OJO: aquí ya no cerramos el pool con db.end()
  // para no pelearnos con otros tests que usen la misma conexión.

  it("login válido devuelve 200, ok=true y un token JWT", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send(adminCreds);

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(typeof res.body.token).toBe("string");
    expect(res.body.token.length).toBeGreaterThan(10);

    expect(res.body.user).toBeDefined();
    expect(typeof res.body.user.email).toBe("string");
  });

  it("login con credenciales inválidas devuelve 401 y ok=false", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({
        email: adminCreds.email,
        password: "ClaveTotalmenteIncorrecta!",
      });

    expect(res.status).toBe(401);
    expect(res.body.ok).toBe(false);
  });

  it("GET /api/auth/me devuelve los datos del usuario autenticado", async () => {
    // 1) Hacemos login para obtener token
    const loginRes = await request(app)
      .post("/api/auth/login")
      .send(adminCreds);

    expect(loginRes.status).toBe(200);
    const token = loginRes.body.token as string;

    // 2) Llamamos a /api/auth/me con ese token
    const meRes = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${token}`);

    expect(meRes.status).toBe(200);
    expect(meRes.body.ok).toBe(true);
    expect(meRes.body.user).toBeDefined();
    expect(meRes.body.user.email).toBe(adminCreds.email);
  });
});
