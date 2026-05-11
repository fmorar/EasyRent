// ============================================================
// GET /api/public/performance-reports/[token]
//
// Public, no auth. Calls the SECURITY DEFINER RPC which:
//   - gates by status='active' + owner_visible + not expired
//   - strips PII (lead names → initials, no phone/email/notes)
//   - respects visibility_settings.show_lead_list
// ============================================================

import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createHash } from "node:crypto"

interface Params { params: Promise<{ token: string }> }

export async function GET(req: Request, { params }: Params) {
  const { token } = await params
  if (!token || token.length < 16) {
    return NextResponse.json({ error: "invalid_token" }, { status: 400 })
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .rpc("get_public_property_performance_report", { p_token: token })

  if (error) {
    return NextResponse.json({ error: "lookup_failed" }, { status: 500 })
  }
  if (!data) {
    return NextResponse.json({ error: "not_found" }, { status: 404 })
  }

  // Anonymized analytic ping — best-effort, never blocks the response
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? ""
    const ua = req.headers.get("user-agent") ?? ""
    const ipHash = ip ? createHash("sha256").update(ip).digest("hex").slice(0, 32) : null
    const reportId = (data as { id?: string }).id
    if (reportId) {
      await supabase.from("owner_report_public_views").insert({
        report_id:  reportId,
        ip_hash:    ipHash,
        user_agent: ua.slice(0, 256),
      })
    }
  } catch { /* swallow */ }

  return NextResponse.json(data, {
    headers: { "Cache-Control": "public, max-age=60, s-maxage=60" },
  })
}
