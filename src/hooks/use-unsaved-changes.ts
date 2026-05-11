"use client"

import { useEffect, useRef, useState, useCallback } from "react"

/**
 * Blocks navigation (browser close, back/forward, Link clicks) when there are
 * unsaved changes, and returns state needed to render a confirmation dialog.
 *
 * Usage:
 *   const { blocking, confirm, cancel } = useUnsavedChanges(isDirty)
 */
export function useUnsavedChanges(isDirty: boolean) {
  const [blocking, setBlocking] = useState(false)
  const isDirtyRef  = useRef(isDirty)
  const proceedRef  = useRef<(() => void) | null>(null)

  isDirtyRef.current = isDirty

  // ── beforeunload — covers refresh / tab close / external links ──
  useEffect(() => {
    function handler(e: BeforeUnloadEvent) {
      if (!isDirtyRef.current) return
      e.preventDefault()
      e.returnValue = ""
    }
    window.addEventListener("beforeunload", handler)
    return () => window.removeEventListener("beforeunload", handler)
  }, [])

  // ── Intercept history.pushState (Next.js Link / router.push)
  // ── AND popstate (browser back/forward) in ONE effect so they
  // ── share the same original pushState reference.
  useEffect(() => {
    const origPush = history.pushState.bind(history)

    // Patch pushState — Next.js uses this for all client-side navigation
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    history.pushState = function (...args: Parameters<typeof history.pushState>) {
      if (isDirtyRef.current) {
        proceedRef.current = () => origPush(...args)
        // Must escape React's commit/insertion-effect phase before setting state.
        // setTimeout (not queueMicrotask / Promise.resolve) gives us a real
        // macro-task tick, safely outside React's synchronous rendering cycle.
        setTimeout(() => setBlocking(true), 0)
      } else {
        origPush(...args)
      }
    }

    // popstate fires for back / forward button
    function popHandler(e: PopStateEvent) {
      if (!isDirtyRef.current) return
      // Push the current state back using the ORIGINAL pushState so we don't
      // recurse into our patched version and don't trigger another block.
      origPush(history.state, "", window.location.href)
      proceedRef.current = () => history.back()
      setTimeout(() => setBlocking(true), 0)
    }

    window.addEventListener("popstate", popHandler)

    return () => {
      history.pushState = origPush
      window.removeEventListener("popstate", popHandler)
    }
  }, [])

  const confirm = useCallback(() => {
    isDirtyRef.current = false   // allow the pending navigation through
    setBlocking(false)
    proceedRef.current?.()
    proceedRef.current = null
  }, [])

  const cancel = useCallback(() => {
    setBlocking(false)
    proceedRef.current = null
  }, [])

  return { blocking, confirm, cancel }
}
