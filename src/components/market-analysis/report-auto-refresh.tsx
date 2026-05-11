"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

/**
 * Polls every 4s by triggering a router refresh — good enough
 * for a 30s–3min processing window and avoids websockets.
 */
export function ReportAutoRefresh({ intervalMs = 4000 }: { intervalMs?: number }) {
  const router = useRouter()
  useEffect(() => {
    const id = setInterval(() => router.refresh(), intervalMs)
    return () => clearInterval(id)
  }, [router, intervalMs])
  return null
}
