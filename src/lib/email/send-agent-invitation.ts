import "server-only"
import { getResend, getEmailFrom } from "./client"
import { buildAgentInvitationEmail } from "./agent-invitation"

interface Input {
  /** Recipient — the invited agent's email. */
  to:             string
  /** Inviter's display name (e.g. profile.full_name). */
  inviterName:    string | null
  /** Pre-translated role label ("Agente" | "Administrador/a"). */
  roleLabel:      string
  /** Absolute invite URL: `${appUrl}/invite/${token}`. */
  acceptUrl:      string
  /** ISO timestamp the invitation expires at. */
  expiresAt:      string
}

interface SendResult {
  sent:   boolean
  /** Resend message id when sent successfully. */
  id?:    string
  /** Human-readable error when send failed (logged + returned for UI). */
  error?: string
}

/**
 * Send the agent-invitation email via Resend. Never throws — returns a
 * structured result so callers can keep the invitation row even if the
 * send fails (admin can copy the link manually + resend later).
 */
export async function sendAgentInvitationEmail(input: Input): Promise<SendResult> {
  const expiresAtLabel = new Date(input.expiresAt).toLocaleDateString("es-CR", {
    day: "numeric", month: "long", year: "numeric",
  })

  const { subject, html, text } = buildAgentInvitationEmail({
    recipientEmail: input.to,
    inviterName:    input.inviterName,
    roleLabel:      input.roleLabel,
    acceptUrl:      input.acceptUrl,
    expiresAtLabel,
  })

  try {
    const resend = getResend()
    const from   = getEmailFrom()
    const { data, error } = await resend.emails.send({
      from, to: input.to, subject, html, text,
    })
    if (error) {
      console.error("[email] Resend rejected invitation email:", error)
      return { sent: false, error: error.message }
    }
    return { sent: true, id: data?.id }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error("[email] Failed to send invitation email:", msg)
    return { sent: false, error: msg }
  }
}
