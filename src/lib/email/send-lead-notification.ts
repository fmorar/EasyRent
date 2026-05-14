import "server-only"
import { getResend, getEmailFrom } from "./client"
import { buildLeadNotificationEmail } from "./lead-notification"

interface Input {
  /** Agent inbox to deliver to (must be a verified-able address). */
  to:            string
  agentName:     string
  leadName:      string
  leadEmail:     string | null
  leadPhone:     string | null
  message:       string | null
  sourceLabel:   string
  sourceContext: string | null
  inboxUrl:      string
}

interface SendResult {
  sent:   boolean
  id?:    string
  error?: string
}

/**
 * Fire the "new lead captured" email via Resend. Never throws — returns
 * a structured result so callers can keep the lead row even if the send
 * fails. The lead still appears in the agent's kanban; the email is a
 * latency-sensitive nudge, not the system of record.
 */
export async function sendLeadNotificationEmail(input: Input): Promise<SendResult> {
  const { subject, html, text } = buildLeadNotificationEmail({
    agentName:     input.agentName,
    leadName:      input.leadName,
    leadEmail:     input.leadEmail,
    leadPhone:     input.leadPhone,
    message:       input.message,
    sourceLabel:   input.sourceLabel,
    sourceContext: input.sourceContext,
    inboxUrl:      input.inboxUrl,
  })

  // If the lead left an email, set Reply-To so the agent can hit "Reply"
  // in their inbox and the message goes straight back to the visitor.
  const replyTo = input.leadEmail ?? undefined

  try {
    const resend = getResend()
    const from   = getEmailFrom()
    const { data, error } = await resend.emails.send({
      from,
      to:        input.to,
      replyTo,
      subject,
      html,
      text,
    })
    if (error) {
      console.error("[email] Resend rejected lead notification:", error)
      return { sent: false, error: error.message }
    }
    return { sent: true, id: data?.id }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error("[email] Failed to send lead notification:", msg)
    return { sent: false, error: msg }
  }
}
