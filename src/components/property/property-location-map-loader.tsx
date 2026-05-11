"use client"

import dynamic from "next/dynamic"
import type { ComponentProps } from "react"

// Skip SSR — Leaflet touches `window` during module init and would crash
// the server render. The placeholder shown while loading matches the
// final map height so the page doesn't shift on hydration.
export const PropertyLocationMap = dynamic(
  () =>
    import("./property-location-map").then((m) => m.PropertyLocationMap),
  {
    ssr: false,
    loading: () => (
      <div
        className="h-full w-full rounded-xl border bg-muted/30 animate-pulse"
        style={{ height: 320 }}
      />
    ),
  },
) as React.ComponentType<
  ComponentProps<typeof import("./property-location-map").PropertyLocationMap>
>
