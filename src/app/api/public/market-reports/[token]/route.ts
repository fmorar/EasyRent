// ============================================================
// GET /api/public/market-reports/[token]
//
// Public, no auth. Calls the SECURITY DEFINER `get_public_market_report`
// RPC which enforces:
//   • status = 'completed'
//   • owner_visible = true
//   • not expired
//
// Also logs an anonymized view event.
// ============================================================

import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createHash } from "node:crypto"

interface Params { params: Promise<{ token: string }> }

export async function GET(req: Request, { params }: Params) {
  const { token } = await params
  if (!token || token.length < 16) {
    return NextResponse.json({ error: "Invalid token" }, { status: 400 })
  }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc("get_public_market_report", { p_token: token })

  if (error) {
    return NextResponse.json({ error: "Could not load report" }, { status: 500 })
  }
  if (!data) {
    return NextResponse.json({ error: "Report not found or expired" }, { status: 404 })
  }

  // Anonymize the request and log a view (best-effort)
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? ""
    const ua = req.headers.get("user-agent") ?? ""
    const ipHash = ip ? createHash("sha256").update(ip).digest("hex").slice(0, 32) : null
    const reportId = (data as { id?: string }).id
    if (reportId) {
      await supabase.from("market_report_public_views").insert({
        report_id: reportId,
        ip_hash:   ipHash,
        user_agent: ua.slice(0, 256),
      })
    }
  } catch { /* swallow */ }

  return NextResponse.json(data, {
    headers: {
      "Cache-Control": "public, max-age=60, s-maxage=60",
    },
  })
}
