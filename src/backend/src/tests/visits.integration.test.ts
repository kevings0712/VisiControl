// src/tests/visits.integration.test.ts
import request from "supertest";
import app from "../app";
import { getPool } from "../config/db";

describe("Pruebas de integración - Visitas (creación y lectura)", () => {
  const userCreds = {
    // Puede ser el admin o un usuario normal que SÍ pueda crear visitas
    email: "admin@visicontrol.dev",
    password: "Admin123!", // ajusta según tu seed
  };

  let token: string;
  let inmateId: string;

  beforeAll(async () => {
    const db = getPool();
    await db.query("SELECT 1");

    // 1) Login para obtener token
    const loginRes = await request(app)
      .post("/api/auth/login")
      .send(userCreds);

    if (loginRes.status !== 200 || !loginRes.body.token) {
      throw new Error("No se pudo hacer login en beforeAll de visitas");
    }

    token = loginRes.body.token as string;

    // 2) Buscar un interno existente en la BD
    const { rows } = await db.query(
      "SELECT id FROM inmates ORDER BY created_at LIMIT 1;"
    );

    if (!rows[0]) {
      throw new Error("No hay internos en la tabla inmates para las pruebas");
    }

    inmateId = rows[0].id as string;
  });

  it("crea una visita y luego aparece en el listado de /api/visits", async () => {
    const fecha = "2025-12-10";
    const hora = "10:00";

    // 1) Crear visita
    const createRes = await request(app)
      .post("/api/visits")
      .set("Authorization", `Bearer ${token}`)
      .send({
        inmate_id: inmateId,
        visit_date: fecha,
        visit_hour: hora,
        duration_minutes: 60,
        notes: "Visita de integración de pruebas",
      });

    // Aceptamos 200 o 201 según cómo respondan tus controladores
    expect([200, 201]).toContain(createRes.status);
    expect(createRes.body.ok).toBe(true);

    const createdId =
      createRes.body.visit?.id ??
      createRes.body.data?.id ??
      null;

    // 2) Listar mis visitas
    const listRes = await request(app)
      .get("/api/visits")
      .set("Authorization", `Bearer ${token}`);

    expect(listRes.status).toBe(200);
    expect(listRes.body.ok).toBe(true);

    const visits = listRes.body.visits ?? listRes.body.data ?? [];
    expect(Array.isArray(visits)).toBe(true);

    // 3) Buscar la visita recién creada
    const encontrada = visits.find((v: any) => {
      if (createdId && v.id === createdId) return true;
      return v.visit_date === fecha && v.visit_hour === hora;
    });

    expect(encontrada).toBeDefined();
  });
});
