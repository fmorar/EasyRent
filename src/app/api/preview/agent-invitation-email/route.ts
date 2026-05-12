// Dev-only preview route for the agent-invitation email. Renders the
// HTML with sample data so designers can iterate without sending mail.
// Disabled in production — the page returns 404.

import { NextResponse } from "next/server"
import { buildAgentInvitationEmail } from "@/lib/email/agent-invitation"

export const runtime = "nodejs"

export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return new NextResponse("Not found", { status: 404 })
  }

  const { html } = buildAgentInvitationEmail({
    recipientEmail: "ana@ejemplo.com",
    inviterName:    "Fabián Morar",
    roleLabel:      "Agente",
    acceptUrl:      "https://www.easyrent.house/invite/0c92d36c2e014769a6d3b1daa62f4ad2feaf90b528ca4672b4ba66d37df1582d",
    expiresAtLabel: "19 de mayo de 2026",
  })

  return new NextResponse(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  })
}
