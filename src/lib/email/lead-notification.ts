import "server-only"

/**
 * HTML + plain-text body for the "new lead captured" email sent to the
 * agent who owns the surface where the lead came in (their public
 * profile, a property they created, a project they manage, etc.).
 *
 * Same visual vocabulary as the share-notification and auth templates:
 * brand yellow accent bar, inline-styled card, easyrent wordmark, big
 * headline, lead data block, CTA → dashboard /leads.
 *
 * Inline styles only — Gmail / Outlook strip <style> blocks.
 */

interface Vars {
  /** Agent's display name — used in the salutation. */
  agentName:        string
  /** Lead's display name. */
  leadName:         string
  /** Lead's email (optional). When present we render a mailto link. */
  leadEmail:        string | null
  /** Lead's phone (optional). When present we render a tel link. */
  leadPhone:        string | null
  /** Free-form message the lead wrote (optional). */
  message:          string | null
  /** Pre-translated source label, e.g. "Perfil de agente". */
  sourceLabel:      string
  /** Short context blurb, e.g. "Asesor: Fabs Test" or "Propiedad: Estudio …". */
  sourceContext:    string | null
  /** Absolute URL where the agent can open their leads inbox. */
  inboxUrl:         string
}

const PRIMARY    = "#FACC15"  // brand yellow
const FOREGROUND = "#0A0A0A"
const MUTED      = "#6B7280"
const BORDER     = "#E5E7EB"
const CARD_BG    = "#FFFFFF"
const PAGE_BG    = "#F5F5F5"
const LINK       = "#0A0A0A"

const APP_URL = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "https://www.easyrent.house"

export function buildLeadNotificationEmail(v: Vars): { subject: string; html: string; text: string } {
  const leadFirstName  = v.leadName.trim().split(/\s+/)[0] || v.leadName
  const agentFirstName = v.agentName.trim().split(/\s+/)[0] || v.agentName
  const subject        = `Nueva consulta de ${leadFirstName} · ${v.sourceLabel}`

  // ── Plain text ───────────────────────────────────────────────
  const text = [
    `Hola ${agentFirstName},`,
    ``,
    `Recibiste una nueva consulta en easyrent.`,
    ``,
    `Origen: ${v.sourceLabel}`,
    v.sourceContext ? `Contexto: ${v.sourceContext}` : null,
    ``,
    `Nombre: ${v.leadName}`,
    v.leadEmail ? `Correo: ${v.leadEmail}` : null,
    v.leadPhone ? `Teléfono: ${v.leadPhone}` : null,
    v.message   ? `\nMensaje:\n${v.message}` : null,
    ``,
    `Respondé desde tu inbox: ${v.inboxUrl}`,
    ``,
    `— easyrent`,
  ].filter((l) => l !== null).join("\n")

  // Inlined wordmark — same SVG used in other transactional emails.
  const wordmark = `<svg xmlns="http://www.w3.org/2000/svg" width="124" height="32" viewBox="8 130 590 148" fill="${FOREGROUND}" role="img" aria-label="easyrent">
    <title>easyrent</title>
    <path d="M291.47,235.59c-10.78-5.53-16.94-14.16-17.25-26.17-.43-16.86-.32-33.73-.4-50.6-.02-4.05,3.14-6.9,7.49-6.85,4.42.05,7.23,2.67,7.25,6.77.09,15.38.35,30.76.24,46.14-.1,13.58,11.27,21.65,24.14,18.67,8.16-1.89,13.59-6.86,15.36-15.29.3-1.44.27-2.96.29-4.44.14-14.99.33-29.98.34-44.98,0-3.95,1.84-5.81,5.35-6.71,3.66-.94,7.69.8,9.04,3.87.32.73.38,1.63.38,2.45-.02,25.27.02,50.54-.11,75.81-.08,16.05-10.21,30.86-26.31,36.46-22.91,7.97-43.98,4.19-62.23-12.42-2.46-2.23-3.41-5.03-2.45-8.24.84-2.82,2.85-4.58,5.73-5.19,2.75-.58,5.11.37,7.04,2.33,6.69,6.81,14.95,10.45,24.24,11.8,8.06,1.17,16.02.56,23.44-3.09,9.26-4.56,14.72-11.9,15.52-22.4.02-.25-.02-.5-.05-.96-11.88,6.98-24.13,8.54-37.04,3.02Z"/>
    <path d="M107.96,218.19c-9.13-17.92-8.23-35.18,3.61-51.28,7.34-9.98,17.94-14.68,30.25-15.25,10.84-.5,20.86,2.01,29.57,9.17.3-1.51.43-2.84.83-4.09,1.28-4.03,4.94-5.9,9.82-5.12,3.59.58,6.07,3.67,6.07,7.61,0,23.9,0,47.8-.02,71.71,0,4.91-2.71,7.47-8.14,7.74-4.51.23-7.71-2.51-8.15-6.95-.06-.63-.15-1.26-.25-2.13-12.73,9.2-26.55,11.29-41.22,6.85-9.78-2.96-17.13-9.3-22.38-18.25M126.8,217.02c12.03,10.67,29.2,9.36,38.85-3.1,6.23-8.04,7.78-17.2,5.31-26.93-2.66-10.47-9.15-17.67-19.82-20.1-10.44-2.38-19.65.31-26.56,8.86-9.7,12-8.75,29.96,2.22,41.26Z"/>
    <path d="M31.59,212.33c6.91,9.87,16.52,13.33,28.03,12.34,6.19-.54,11.81-2.67,16.54-6.77,1.45-1.26,2.69-2.78,3.9-4.28,2.61-3.25,6-4.65,9.31-3.72,5.19,1.45,7.02,7.67,3.59,12.26-6.48,8.65-15.17,13.83-25.63,16.14-11.56,2.55-22.94,2.18-33.55-3.5-16.05-8.59-23.65-22.4-23.36-40.42.35-22.32,16.36-40.21,38.55-42.97,10.75-1.34,21.32-.21,30.8,5.77,6.34,3.99,10.76,9.47,11.77,17.12,1.33,10.01-3.5,19.22-12.31,24.14-6.55,3.65-13.69,4.87-21.03,5.12-3.14.11-6.31,0-9.44-.31-3.42-.34-5.77-3.39-5.69-6.93.07-3.58,2.3-6.26,5.82-6.6,3.21-.31,6.44-.32,9.67-.43,4.19-.13,8.19-.96,11.86-3.06,7.17-4.09,7.56-12.2.71-16.78-5.89-3.94-12.56-4.72-19.34-3.62-13.33,2.17-22.26,10.95-24.81,24.21-1.53,7.95.21,15.37,4.61,22.31Z"/>
    <path d="M400.24,200.05c-.68-10.9,1.58-20.92,7.77-29.75,8.69-12.39,20.83-18.24,35.91-17.39,8.11.46,15.51,3.29,21.6,8.9,11.7,10.8,9.1,28.96-5.25,37.14-5.4,3.08-11.3,4.34-17.41,4.59-3.21.13-6.47.07-9.66-.31-3.59-.43-5.61-3.32-5.41-7.04.2-3.7,2.74-6.34,6.38-6.53,3.55-.18,7.11-.17,10.65-.43,3.9-.29,7.42-1.67,10.23-4.49,4.67-4.68,3.68-11.47-2.1-14.65-10.35-5.69-23.05-3.29-30.69,5.78-9.93,11.8-9.81,29.4.28,40.68,10.34,11.56,30,10.06,38.45-2.95,1.73-2.66,4.04-4.2,7.25-3.92,6.06.52,8.68,6.72,5.04,11.81-5.79,8.11-13.55,13.39-23.19,15.79-23.24,5.77-44.86-8.32-49.08-31.89-.31-1.71-.5-3.44-.75-5.35Z"/>
    <path d="M205.22,184.91c-6.06-11.05-2.6-23.75,8.6-29.18,13.52-6.55,27.3-6.23,40.75.7,1.64.84,3.15,2.05,4.49,3.33,3.25,3.11,3.37,7.99.43,11.14-2.83,3.03-7.92,3.4-10.96.22-3.12-3.26-6.93-4.57-11.08-5.29-4.97-.87-9.91-.77-14.53,1.65-5.87,3.06-6.43,9.85-.84,13.35,3.29,2.06,7.03,3.45,10.67,4.87,5.57,2.18,11.39,3.78,16.82,6.24,9.32,4.22,14.7,11.46,14.49,22-.18,8.78-4.32,15.68-12.07,19.61-13.59,6.87-27.42,6.96-40.93-.55-4.6-2.56-8.14-6.32-10.8-10.88-2.37-4.08-1.31-8.72,2.49-10.97,3.88-2.29,8.67-.96,10.92,3.23,3.48,6.48,9.3,9.04,16.16,9.73,4.75.47,9.42.02,13.65-2.52,4.25-2.56,5.83-6.72,4.31-11.28-.87-2.61-2.57-4.43-5.14-5.43-7.73-3-15.48-5.98-23.2-9.01-5.75-2.26-10.88-5.36-14.25-10.96Z"/>
    <path d="M486.67,171.01c4.91-11.33,13.59-17.44,25.51-18.99,10.76-1.39,20.24,1.55,27.89,9.39,5.15,5.28,7.88,11.75,7.94,19.19.15,16.99.24,33.98.34,50.97.03,4.77-4.04,7.9-8.71,6.74-4.17-1.04-5.2-2.35-5.21-6.58-.02-15.76.01-31.53-.12-47.29-.02-2.54-.32-5.23-1.22-7.58-2.55-6.72-7.67-10.3-14.84-10.92-4.09-.35-7.98.3-11.55,2.42-5.18,3.08-7.92,7.59-7.97,13.69-.12,16.8-.25,33.59-.39,50.39-.03,3.53-2.93,6.08-6.86,6.1-4.16.03-7.03-2.39-7.03-6.07-.02-16.93-.13-33.86.09-50.78.05-3.52,1.34-7.02,2.11-10.68Z"/>
    <path d="M574.36,151.14c.49.46.95.97,1.43.99,3.87.15,7.76.41,11.62.23,3.82-.18,6.36,2.39,6.61,6.51.24,3.81-2.9,7.06-6.66,7.11-3.94.05-7.88.05-11.83.07-.31,0-.62.05-1.11.1-.03.75-.09,1.44-.09,2.12.01,15.19.03,30.37.05,45.56,0,6.16,4.36,10.59,10.55,10.78,1.92.06,3.84.23,5.76.24,2.97.02,5.19,2.68,5.41,5.57.3,3.91-1.21,6.71-4.47,7.67-3.64,1.08-7.37.99-11.12.44-9.73-1.43-17.69-8.62-19.85-18.22-.45-1.99-.61-4.09-.61-6.14-.05-25.33-.04-50.66-.05-75.99,0-3.7,2.77-6.27,6.79-6.31,4.2-.05,7.16,2.41,7.27,6.11.13,4.33.18,8.65.29,13.16Z"/>
    <path d="M356.03,221.45c.03-13.76.04-27.33.08-40.89.05-15.07,11.33-27.16,26.36-28.59,5.47-.52,10.82-.3,16.14.92,4.33,1,6.8,4.47,6.02,8.29-.88,4.31-4.53,6.55-9.11,5.37-4.06-1.04-8.12-1.51-12.24-.58-7.47,1.67-12.44,7.3-12.87,14.99-.34,6.18-.36,12.39-.4,18.58-.08,10.79-.06,21.58-.09,32.37,0,3.42-1.57,5.34-4.97,6.15-3.28.78-7.18-.53-8.4-2.94-.36-.71-.49-1.6-.5-2.42-.05-3.68-.02-7.36-.02-11.24Z"/>
  </svg>`

  // ── Rows that only render when their data is present ─────────
  const contextRow = v.sourceContext
    ? `
            <tr>
              <td style="padding:0 36px 8px 36px;">
                <p style="margin:0;font-size:13px;line-height:1.5;color:${MUTED};">
                  ${escapeHtml(v.sourceContext)}
                </p>
              </td>
            </tr>`
    : ""

  const emailRow = v.leadEmail
    ? `
              <tr>
                <td style="padding:6px 0;font-size:13px;line-height:1.5;color:${MUTED};width:80px;vertical-align:top;">Correo</td>
                <td style="padding:6px 0;font-size:14px;line-height:1.5;color:${FOREGROUND};">
                  <a href="mailto:${escapeAttr(v.leadEmail)}" style="color:${LINK};text-decoration:underline;font-weight:500;">${escapeHtml(v.leadEmail)}</a>
                </td>
              </tr>`
    : ""

  const phoneRow = v.leadPhone
    ? `
              <tr>
                <td style="padding:6px 0;font-size:13px;line-height:1.5;color:${MUTED};width:80px;vertical-align:top;">Teléfono</td>
                <td style="padding:6px 0;font-size:14px;line-height:1.5;color:${FOREGROUND};">
                  <a href="tel:${escapeAttr(v.leadPhone.replace(/\s+/g, ""))}" style="color:${LINK};text-decoration:underline;font-weight:500;">${escapeHtml(v.leadPhone)}</a>
                </td>
              </tr>`
    : ""

  const messageBlock = v.message
    ? `
            <tr>
              <td style="padding:8px 36px 0 36px;">
                <div style="border-top:1px dashed ${BORDER};padding-top:16px;">
                  <p style="margin:0 0 8px 0;font-size:11px;line-height:1;color:${MUTED};text-transform:uppercase;letter-spacing:0.08em;font-weight:600;">
                    Mensaje
                  </p>
                  <p style="margin:0;font-size:14px;line-height:1.6;color:${FOREGROUND};white-space:pre-line;">${escapeHtml(v.message)}</p>
                </div>
              </td>
            </tr>`
    : ""

  const html = `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>${escapeHtml(subject)}</title>
  </head>
  <body style="margin:0;padding:0;background:${PAGE_BG};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:${FOREGROUND};-webkit-font-smoothing:antialiased;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(`${v.leadName} te dejó una consulta. ${v.sourceContext ?? v.sourceLabel}.`)}</div>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${PAGE_BG};padding:40px 16px;">
      <tr>
        <td align="center">

          <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;background:${CARD_BG};border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.04);">

            <tr>
              <td style="background:${PRIMARY};height:6px;font-size:0;line-height:0;">&nbsp;</td>
            </tr>

            <tr>
              <td style="padding:36px 36px 8px 36px;">
                ${wordmark}
              </td>
            </tr>

            <tr>
              <td style="padding:24px 36px 8px 36px;">
                <p style="margin:0 0 6px 0;font-size:11px;line-height:1;color:${MUTED};text-transform:uppercase;letter-spacing:0.08em;font-weight:600;">
                  Nuevo lead · ${escapeHtml(v.sourceLabel)}
                </p>
                <h1 style="margin:0;font-size:24px;line-height:1.25;font-weight:700;letter-spacing:-0.01em;color:${FOREGROUND};">
                  ${escapeHtml(v.leadName)} quiere hablar con vos
                </h1>
              </td>
            </tr>

            ${contextRow}

            <tr>
              <td style="padding:16px 36px 0 36px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="padding:6px 0;font-size:13px;line-height:1.5;color:${MUTED};width:80px;vertical-align:top;">Nombre</td>
                    <td style="padding:6px 0;font-size:14px;line-height:1.5;color:${FOREGROUND};font-weight:500;">${escapeHtml(v.leadName)}</td>
                  </tr>
                  ${emailRow}
                  ${phoneRow}
                </table>
              </td>
            </tr>

            ${messageBlock}

            <tr>
              <td style="padding:28px 36px 12px 36px;">
                <a href="${escapeAttr(v.inboxUrl)}"
                   style="display:inline-block;background:${PRIMARY};color:${FOREGROUND};font-weight:600;font-size:15px;text-decoration:none;padding:14px 24px;border-radius:10px;line-height:1;">
                  Abrir bandeja de leads
                </a>
              </td>
            </tr>

            <tr>
              <td style="padding:12px 36px 32px 36px;">
                <p style="margin:0 0 6px 0;font-size:12px;line-height:1.5;color:${MUTED};">
                  ¿No funciona el botón? Copiá este link en tu navegador:
                </p>
                <p style="margin:0;font-size:12px;line-height:1.5;word-break:break-all;">
                  <a href="${escapeAttr(v.inboxUrl)}" style="color:${LINK};text-decoration:underline;">
                    ${escapeHtml(v.inboxUrl)}
                  </a>
                </p>
              </td>
            </tr>

            <tr>
              <td style="padding:0 36px;">
                <div style="border-top:1px solid ${BORDER};"></div>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 36px 36px 36px;">
                <p style="margin:0;font-size:12px;line-height:1.55;color:${MUTED};">
                  Estás recibiendo este correo porque el lead llegó desde una de tus superficies en easyrent.
                  Respondele pronto — los leads se enfrían en cuestión de horas.
                </p>
              </td>
            </tr>
          </table>

          <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;margin-top:20px;">
            <tr>
              <td align="center" style="padding:0 16px;">
                <p style="margin:0 0 8px 0;font-size:11px;color:${MUTED};">
                  <a href="${escapeAttr(APP_URL)}/contacto" style="color:${MUTED};text-decoration:underline;">Ayuda</a>
                  &nbsp;·&nbsp;
                  <a href="${escapeAttr(APP_URL)}/terminos" style="color:${MUTED};text-decoration:underline;">Términos</a>
                  &nbsp;·&nbsp;
                  <a href="${escapeAttr(APP_URL)}/privacidad" style="color:${MUTED};text-decoration:underline;">Privacidad</a>
                </p>
                <p style="margin:0;font-size:11px;color:${MUTED};">
                  ©${new Date().getFullYear()} easyrent · operaciones inmobiliarias en Costa Rica
                </p>
              </td>
            </tr>
          </table>

        </td>
      </tr>
    </table>
  </body>
</html>`

  return { subject, html, text }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}
function escapeAttr(s: string): string {
  return escapeHtml(s)
}
