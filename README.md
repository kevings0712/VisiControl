# VisiControl – Sistema de gestión de visitas penitenciarias

Este repositorio contiene una aplicación web tipo PWA para gestionar visitas a un centro penitenciario.  
Permite que los familiares se registren, soliciten visitas, lleven un historial y reciban notificaciones cuando su visita es aprobada, modificada o recordatorios por correo.

La aplicación está pensada como proyecto académico, pero se diseñó con una arquitectura realista y buenas prácticas de seguridad.

---

## 1. Tecnologías utilizadas

**Backend**

- Node.js + TypeScript  
- Express
- PostgreSQL (`pg`)
- JWT para autenticación
- Nodemailer para envío de correos (recuperación de contraseña y recordatorios)
- Jobs simples con `setInterval` para recordatorios diarios
- Jest + Supertest para pruebas automatizadas

**Frontend**

- React + TypeScript
- Vite
- PWA (manifiesto + service worker simple)
- CSS modularizado (estilos propios, sin framework pesado)
- Server-Sent Events (SSE) para notificaciones en tiempo real

---

## 2. Arquitectura general

La solución está separada en dos carpetas principales:

- `backend/`  
  API REST en Express + PostgreSQL. Expone endpoints para:
  - autenticación y gestión de usuarios;
  - internos asociados a un usuario;
  - creación, listado, actualización y cancelación de visitas;
  - notificaciones internas y recordatorios por correo.

- `frontend/`  
  SPA en React que consume la API:
  - login y registro;
  - dashboard con KPIs y próxima visita;
  - flujo para agendar visitas;
  - historial y cancelación;
  - panel de administración;
  - centro de notificaciones.

El backend se comunica con la base de datos mediante un pool de `pg`.  
Las notificaciones internas se guardan en la tabla `notifications` y, además de quedar en la web, se transmiten por SSE a la PWA. Para recordatorios de visitas también se envía un correo al usuario si tiene activadas las notificaciones por email.

---

## 3. Requisitos previos

Para ejecutar el proyecto de forma local necesitas:

- Node.js 18+  
- npm o pnpm
- PostgreSQL 14+ instalado y accesible
- Una cuenta de correo válida para SMTP (por ejemplo Gmail)  
  o un sandbox tipo Mailtrap para desarrollo.

---

## 4. Configuración de la base de datos

1. Crear una base de datos, por ejemplo:

   ```sql
   CREATE DATABASE visicontrol;
psql -U TU_USUARIO -d visicontrol -f backend/schema_actual.sql

El script crea todas las tablas necesarias (users, inmates, visits, notifications, etc.) y algunos datos base.

## 5. Variables de entorno
# backend/.env
NODE_ENV=development
PORT=4000

# Postgres local
PGHOST=127.0.0.1
PGPORT=5433
PGDATABASE=visicontrol
PGUSER=visictrl_admin
PGPASSWORD=tu_password

# CORS y URLs
CORS_ORIGIN=http://localhost:5173
APP_BASE_URL=http://localhost:5173
FRONTEND_BASE_URL=http://localhost:5173

# JWT
JWT_SECRET=supersecret
JWT_EXPIRES_IN=7d

# SMTP (ejemplo Mailtrap o Gmail)
SMTP_HOST=sandbox.smtp.mailtrap.io
SMTP_PORT=587
SMTP_USER=XXXXXXXXXXXX
SMTP_PASS=YYYYYYYYYYYY
SMTP_FROM="VisiControl <no-reply@visicontrol.dev>"


# Frontend – frontend/.env
VITE_API_BASE_URL=http://localhost:4000

## 6. Instalación y ejecución local
## 6.1 Backend
cd backend
npm install
npm run dev

## 6.2 Frontend
cd frontend
npm install
npm run dev


## 7. Flujo principal de uso

Registro y login
El usuario se registra o inicia sesión. El backend responde con un JWT, que se guarda en localStorage.

Dashboard
Al entrar se muestra:

saludo y nombre de usuario;

contador de visitas pendientes, aprobadas y rechazadas;

“Próxima visita” según fecha/hora;

acceso directo a agendar visita, historial, internos, notificaciones y (si es admin) panel de administración.

Gestión de visitas
El usuario puede:

crear una nueva visita eligiendo interno, fecha, hora y duración (30/60/90/120 minutos entre las 08:00 y 17:00);

ver su historial y cancelar visitas futuras en estado pendiente/aprobado.

Panel de administración
El administrador:

ve todas las visitas;

aprueba o rechaza solicitudes;

puede reasignar internos y reprogramar visitas respetando las reglas de negocio.

Notificaciones

El sistema genera notificaciones internas para:

creación de visita (VISIT_CREATED),

aprobación (VISIT_APPROVED),

rechazo (VISIT_CANCELED),

reprogramación de fecha/hora (VISIT_UPDATED),

recordatorios (VISIT_REMINDER).

La PWA abre un canal SSE (/api/notifications/stream) y las muestra en tiempo real como “toasts”.

Recordatorios por correo
Un job del backend ejecuta upsertTomorrowReminders, que:

busca visitas de mañana en estado PENDING/APPROVED;

crea una notificación interna si no existe;

envía un correo de recordatorio al email del usuario usando sendVisitReminderEmail.


## 8. Endpoints principales
POST /auth/register – registrar usuario

POST /auth/login – login, devuelve token

GET /auth/me – datos del usuario autenticado

POST /auth/forgot-password – enviar correo con enlace de reseteo

POST /auth/reset-password – cambiar contraseña usando token

GET /visits – listar visitas del usuario o admin

POST /visits – crear visita

PUT /visits/:id – actualizar / reprogramar / aprobar / rechazar

DELETE /visits/:id – eliminar visita (admin)

POST /visits/:id/cancel – cancelar visita propia

GET /notifications – listar notificaciones

GET /notifications/unread-count – cantidad sin leer

POST /notifications/mark-read – marcar como leídas

GET /notifications/stream – SSE de notificaciones

