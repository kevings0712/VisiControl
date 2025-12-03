// src/tests/visits-helpers.test.ts

import {
  formatDateForText,
  formatTimeForText,
  formatStatusLabel,
  buildVisitMeta,
} from "../services/visits.service";

describe("Helpers de formato de visitas", () => {
  describe("formatDateForText", () => {
    it("formatea una Date a dd/MM/yyyy", () => {
      const d = new Date(2025, 11, 4, 10, 30); // 04 diciembre 2025
      const txt = formatDateForText(d);
      expect(txt).toBe("04/12/2025");
    });

    it("devuelve cadena vacía cuando el valor es null/undefined", () => {
      expect(formatDateForText(null as any)).toBe("");
      expect(formatDateForText(undefined as any)).toBe("");
    });
  });

  describe("formatTimeForText", () => {
    it("formatea una hora en string HH:mm", () => {
      const txt = formatTimeForText("9:5");
      expect(txt).toBe("09:05");
    });

    it("formatea una Date a HH:mm", () => {
      const d = new Date(2025, 11, 4, 8, 3); // 08:03
      const txt = formatTimeForText(d);
      expect(txt).toBe("08:03");
    });

    it("devuelve cadena vacía cuando el valor es null/undefined", () => {
      expect(formatTimeForText(null as any)).toBe("");
      expect(formatTimeForText(undefined as any)).toBe("");
    });
  });

  describe("formatStatusLabel", () => {
    it("mapea estados conocidos a etiquetas en español", () => {
      expect(formatStatusLabel("PENDING")).toBe("Pendiente");
      expect(formatStatusLabel("approved")).toBe("Aprobada");
      expect(formatStatusLabel("REJECTED")).toBe("Rechazada");
      expect(formatStatusLabel("CANCELLED")).toBe("Cancelada");
    });

    it("devuelve el texto original (o 'Pendiente') para estados desconocidos", () => {
      expect(formatStatusLabel("RANDOM")).toBe("RANDOM");
      expect(formatStatusLabel(undefined as any)).toBe("Pendiente");
      expect(formatStatusLabel(null as any)).toBe("Pendiente");
    });
  });

  describe("buildVisitMeta", () => {
    it("construye el objeto meta con los campos correctos", () => {
      const meta = buildVisitMeta({
        id: "visit-123",
        visitor_name: "Kevin",
        inmate_name: "Juan Pérez",
        visit_date: "2025-12-04",
        visit_hour: "09:00",
        status: "APPROVED",
        inmate_id: "inmate-999",
      });

      expect(meta).toEqual({
        visit_id: "visit-123",
        visitor_name: "Kevin",
        inmate_name: "Juan Pérez",
        visit_date: "2025-12-04",
        visit_hour: "09:00",
        status: "APPROVED",
        status_label: "Aprobada", // viene de formatStatusLabel
        inmate_id: "inmate-999",
      });
    });

    it("rellena inmate_id con null si no viene definido", () => {
      const meta = buildVisitMeta({
        id: "visit-456",
        visitor_name: "Maholy",
        inmate_name: "María Gómez",
        visit_date: "2025-12-10",
        visit_hour: "10:30",
        status: "PENDING",
      });

      expect(meta.inmate_id).toBeNull();
      expect(meta.status_label).toBe("Pendiente");
    });
  });
});
