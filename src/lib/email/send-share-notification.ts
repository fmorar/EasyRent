import "server-only"
import { getResend, getEmailFrom } from "./client"
import { buildShareNotificationEmail } from "./share-notification"

interface Input {
  to:                string
  senderName:        string | null
  property: {
    title:           string
    listingTypeLabel: string
    priceLabel:      string
    address:         string | null
    bedrooms:        number | null
    bathrooms:       number | null
    areaSqm:         number | null
    coverUrl:        string | null
  }
  commissionLabel:   string
  reviewUrl:         string
}

interface SendResult {
  sent:  boolean
  id?:   string
  error?: string
}

/**
 * Send the "shared with you" email via Resend. Never throws — returns
 * a structured result so callers can keep the share row even if the
 * send fails. The agent still sees the request in /shares; the email
 * is a courtesy nudge, not the system of record.
 */
export async function sendShareNotificationEmail(input: Input): Promise<SendResult> {
  const { subject, html, text } = buildShareNotificationEmail({
    recipientEmail:  input.to,
    senderName:      input.senderName,
    property:        input.property,
    commissionLabel: input.commissionLabel,
    reviewUrl:       input.reviewUrl,
  })

  try {
    const resend = getResend()
    const from   = getEmailFrom()
    const { data, error } = await resend.emails.send({
      from, to: input.to, subject, html, text,
    })
    if (error) {
      console.error("[email] Resend rejected share notification:", error)
      return { sent: false, error: error.message }
    }
    return { sent: true, id: data?.id }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error("[email] Failed to send share notification:", msg)
    return { sent: false, error: msg }
  }
}
