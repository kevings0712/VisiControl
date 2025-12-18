import express from "express";
import cors from "cors";

import authRoutes from "./routes/auth.routes";
import visitsRoutes from "./routes/visits.routes";
import notifRoutes from "./routes/notifications.routes";
import inmateRoutes from "./routes/inmates.routes";
import userInmatesRoutes from "./routes/user-inmates.routes";

const app = express();

/**
 * 1) CORS primero
 *    Para desarrollo, deja todo abierto. Así no te rompe
 *    cuando cambie la IP de la red (192.168.x.x).
 */
app.use(cors());

// 2) Body parsers con límite elevado (por la foto de perfil en base64)
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true, limit: "5mb" }));

// 3) Rutas
app.use("/api/notifications", notifRoutes);

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    service: "visicontrol-api",
    db_time: new Date().toISOString(),
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/visits", visitsRoutes);
app.use("/api/inmates", inmateRoutes);
app.use("/api/user-inmates", userInmatesRoutes);

export default app;
