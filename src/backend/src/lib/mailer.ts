// src/backend/src/lib/mailer.ts
import nodemailer from "nodemailer";

const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM } = process.env;

if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
  throw new Error(
    "SMTP config incompleta: define SMTP_HOST, SMTP_USER y SMTP_PASS en el .env del backend"
  );
}

export const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: Number(SMTP_PORT || 587),
  secure: Number(SMTP_PORT) === 465, // sólo true si usas 465
  auth: {
    user: SMTP_USER,
    pass: SMTP_PASS,
  },
});

const FROM = SMTP_FROM || SMTP_USER!;

/* ========= Recuperar contraseña ========= */

export async function sendResetEmail(to: string, resetUrl: string) {
  await transporter.sendMail({
    from: FROM,
    to,
    subject: "Recuperar contraseña – VisiControl",
    html: `
      <p>Hola,</p>
      <p>Solicitaste recuperar tu contraseña. Haz clic en el enlace para continuar:</p>
      <p><a href="${resetUrl}" target="_blank" rel="noopener noreferrer">${resetUrl}</a></p>
      <p><small>Este enlace expira en 1 hora.</small></p>
      <p>Si no fuiste tú, ignora este correo.</p>
    `,
  });
}

/* ========= Recordatorios de visita (mañana) ========= */

export async function sendVisitReminderEmail(opts: {
  to: string;
  userName?: string | null;
  inmateName: string;
  visitDate: string; // YYYY-MM-DD
  visitHour: string; // HH:mm
}) {
  const { to, userName, inmateName, visitDate, visitHour } = opts;
  if (!to) return;

  const subject = "Recordatorio de visita para mañana – VisiControl";

  const text = `Hola ${userName || ""},

Te recordamos que mañana tienes una visita programada con ${inmateName} a las ${visitHour} (fecha: ${visitDate}).

Si ya no puedes asistir, puedes cancelar o reprogramar la visita desde la aplicación.

Saludos,
Equipo VisiControl`;

  const html = `
    <p>Hola <strong>${userName || ""}</strong>,</p>
    <p>Te recordamos que <strong>mañana</strong> tienes una visita programada:</p>
    <ul>
      <li>Interno: <strong>${inmateName}</strong></li>
      <li>Fecha: <strong>${visitDate}</strong></li>
      <li>Hora: <strong>${visitHour}</strong></li>
    </ul>
    <p>Si ya no puedes asistir, puedes cancelar o reprogramar la visita desde la aplicación.</p>
    <p>Saludos,<br/>Equipo VisiControl</p>
  `;

  await transporter.sendMail({
    from: FROM,
    to,
    subject,
    text,
    html,
  });
}

/* ========= Cambio de estado de visita (aprobada, rechazada, cancelada, reprogramada) ========= */

type VisitStatusEmail = {
  to: string;
  userName?: string | null;
  inmateName: string;
  visitDate: string; // texto ya formateado (por ej. 16/12/2025 o 2025-12-16)
  visitHour: string; // texto ya formateado (por ej. 09:30)
  newStatusLabel: string; // "aprobada", "rechazada", "cancelada", "reprogramada"
  extraMessage?: string;
};

export async function sendVisitStatusChangeEmail(
  opts: VisitStatusEmail
) {
  const {
    to,
    userName,
    inmateName,
    visitDate,
    visitHour,
    newStatusLabel,
    extraMessage,
  } = opts;

  if (!to) return;

  const subject = `Actualización de tu visita – ${newStatusLabel}`;
  const humanName = userName ? ` ${userName}` : "";

  const html = `
    <p>Hola${humanName},</p>
    <p>Te informamos que el estado de tu visita ha cambiado a <strong>${newStatusLabel}</strong>.</p>
    <ul>
      <li>Interno: <strong>${inmateName}</strong></li>
      <li>Fecha: <strong>${visitDate}</strong></li>
      <li>Hora: <strong>${visitHour}</strong></li>
    </ul>
    ${extraMessage ? `<p>${extraMessage}</p>` : ""}
    <p>Puedes revisar el detalle en la aplicación VisiControl.</p>
    <p>Saludos,<br/>Equipo VisiControl</p>
  `;

  const textLines = [
    `Hola${humanName},`,
    `El estado de tu visita ha cambiado a ${newStatusLabel}.`,
    `Interno: ${inmateName}`,
    `Fecha: ${visitDate}`,
    `Hora: ${visitHour}`,
    extraMessage || "",
    "Revisa el detalle en la aplicación VisiControl.",
  ].filter(Boolean);

  await transporter.sendMail({
    from: FROM,
    to,
    subject,
    text: textLines.join("\n"),
    html,
  });
}
