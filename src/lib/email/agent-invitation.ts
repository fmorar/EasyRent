import "server-only"

/**
 * HTML + plain-text bodies for the agent invitation email.
 *
 * Kept as a plain template literal (no React Email) on purpose — single
 * transactional template, no need for the runtime/build cost of a
 * full rendering pipeline. Inline styles only, since Gmail / Outlook
 * strip <style> blocks. Tested layout: max-width 560, centered, single
 * primary CTA, plain-text URL fallback for security-conscious readers.
 */

interface Vars {
  /** Invited agent's email — shown so they recognise the message is for them. */
  recipientEmail: string
  /** Inviter's display name. Falls back to "el equipo" when unknown. */
  inviterName:    string | null
  /** "Agente" | "Administradora/Administrador" — pre-translated. */
  roleLabel:      string
  /** Absolute URL the recipient clicks to set their password. */
  acceptUrl:      string
  /** Pre-formatted date string ("12 de mayo de 2026"). */
  expiresAtLabel: string
}

const BRAND_PRIMARY = "#FACC15"  // matches --primary (amber)
const FOREGROUND    = "#0A0A0A"
const MUTED         = "#6B7280"
const BORDER        = "#E5E7EB"
const CARD_BG       = "#FFFFFF"
const PAGE_BG       = "#F9FAFB"

export function buildAgentInvitationEmail(v: Vars): { subject: string; html: string; text: string } {
  const inviter = v.inviterName?.trim() || "el equipo de easyrent"
  const subject = `Te invitaron a easyrent`

  // ── Plain text ───────────────────────────────────────────────
  const text = [
    `Hola,`,
    ``,
    `${inviter} te invitó a unirte a easyrent como ${v.roleLabel}.`,
    ``,
    `Hacé clic en el siguiente link para crear tu contraseña y entrar a la plataforma:`,
    v.acceptUrl,
    ``,
    `Este link es personal (${v.recipientEmail}) y vence el ${v.expiresAtLabel}.`,
    `Si no esperabas esta invitación, podés ignorar este correo.`,
    ``,
    `— easyrent`,
  ].join("\n")

  // ── HTML ─────────────────────────────────────────────────────
  const html = `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>${escapeHtml(subject)}</title>
  </head>
  <body style="margin:0;padding:0;background:${PAGE_BG};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:${FOREGROUND};">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(`${inviter} te invitó a easyrent. Creá tu contraseña y entrá a la plataforma.`)}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${PAGE_BG};padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;background:${CARD_BG};border:1px solid ${BORDER};border-radius:16px;overflow:hidden;">
            <tr>
              <td style="padding:32px 32px 0 32px;">
                <div style="font-weight:700;font-size:20px;letter-spacing:-0.01em;color:${FOREGROUND};">easyrent</div>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 32px 8px 32px;">
                <h1 style="margin:0;font-size:22px;line-height:1.3;font-weight:700;color:${FOREGROUND};">
                  ${escapeHtml(inviter)} te invitó a unirte a easyrent
                </h1>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 32px 24px 32px;">
                <p style="margin:0;font-size:15px;line-height:1.6;color:${MUTED};">
                  Te creamos un acceso como <strong style="color:${FOREGROUND};">${escapeHtml(v.roleLabel)}</strong>.
                  Hacé clic en el botón para crear tu contraseña y entrar a la plataforma.
                </p>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:8px 32px 24px 32px;">
                <a href="${escapeAttr(v.acceptUrl)}"
                   style="display:inline-block;background:${BRAND_PRIMARY};color:${FOREGROUND};font-weight:600;font-size:15px;text-decoration:none;padding:14px 28px;border-radius:10px;">
                  Crear mi contraseña
                </a>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 32px 24px 32px;">
                <p style="margin:0 0 8px 0;font-size:12px;line-height:1.5;color:${MUTED};">
                  ¿No funciona el botón? Copiá este link en tu navegador:
                </p>
                <p style="margin:0;font-size:12px;line-height:1.5;word-break:break-all;">
                  <a href="${escapeAttr(v.acceptUrl)}" style="color:${FOREGROUND};text-decoration:underline;">
                    ${escapeHtml(v.acceptUrl)}
                  </a>
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 32px 32px 32px;border-top:1px solid ${BORDER};">
                <p style="margin:0 0 4px 0;font-size:12px;color:${MUTED};">
                  Este link es personal para <strong style="color:${FOREGROUND};">${escapeHtml(v.recipientEmail)}</strong> y vence el <strong style="color:${FOREGROUND};">${escapeHtml(v.expiresAtLabel)}</strong>.
                </p>
                <p style="margin:0;font-size:12px;color:${MUTED};">
                  Si no esperabas esta invitación, podés ignorar este correo.
                </p>
              </td>
            </tr>
          </table>
          <p style="margin:16px 0 0 0;font-size:11px;color:${MUTED};text-align:center;">
            easyrent · operaciones inmobiliarias en Costa Rica
          </p>
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
  // Attribute values still need quote + angle bracket escaping
  return escapeHtml(s)
}
