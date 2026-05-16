"use client"

import dynamic from "next/dynamic"
import type { ComponentProps } from "react"

// Skip SSR — Leaflet touches `window` during module init and would crash
// the server render. The placeholder shown while loading matches the
// final map height so the page doesn't shift on hydration. We DON'T
// reserve space for the address line below — it's text content that
// flows naturally once it loads, and matching its variable height in
// a static placeholder would shift more than it saved.
export const PropertyLocationMap = dynamic(
  () =>
    import("./property-location-map").then((m) => m.PropertyLocationMap),
  {
    ssr: false,
    loading: () => (
      <div
        className="w-full rounded-xl border bg-muted/30 animate-pulse"
        style={{ height: 360 }}
      />
    ),
  },
) as React.ComponentType<
  ComponentProps<typeof import("./property-location-map").PropertyLocationMap>
>
