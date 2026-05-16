"use client"

import { useMemo } from "react"
import { MapContainer, TileLayer, Marker, Circle, useMap } from "react-leaflet"
import L from "leaflet"
import { renderToStaticMarkup } from "react-dom/server"
import { HomeIcon } from "@heroicons/react/24/solid"
import "leaflet/dist/leaflet.css"

interface Props {
  lat:           number
  lng:           number
  /** `exact` → custom pin · `approximate` → fuzzy circle, no pin. */
  locationMode:  "exact" | "approximate"
  /** Address text shown below the map for context. */
  address?:      string | null
  /** Approximate-mode radius in metres. Default ~1 km. */
  approxRadius?: number
  /** Visual height of the map. Defaults to 360 px. */
  height?:       number
  className?:    string
}

// CartoDB Voyager — free, no API key, POI-rich tile style that closely
// matches modern map products (clean labels, soft greens for parks,
// muted greys for buildings). Subdomains a/b/c/d for parallel HTTP/2.
const TILE_URL_VOYAGER =
  "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
const TILE_URL_VOYAGER_LABELS_OVER =
  "https://{s}.basemaps.cartocdn.com/rastertiles/voyager_labels_under/{z}/{x}/{y}{r}.png"
const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'

/**
 * Build the custom black-pin-with-house marker as a Leaflet `divIcon`
 * (pure HTML/CSS — no PNG sprites needed). Shape:
 *
 *   ┌──────┐
 *   │  ⌂   │   ← black circle, white house glyph, white ring
 *   └──╲╱──┘   ← small rotated tail
 */
function makeHouseIcon(): L.DivIcon {
  // Inline the heroicons solid SVG and force white fill.
  const houseSvg = renderToStaticMarkup(<HomeIcon />).replace(
    "<svg",
    '<svg width="18" height="18" style="color:#fff;display:block"',
  )

  // ONE unified teardrop pin shape — drawn as a single SVG path so the
  // round head and pointed tail are visually fused (no separate diamond).
  // Path: starts at the bottom point, sweeps up around the head, and
  // back down. Stroke is white for the ring, fill black for the body.
  // Box is 40×52: head Ø ~34, tail extends to y=52.
  const pinSvg = `
    <svg width="40" height="52" viewBox="0 0 40 52" xmlns="http://www.w3.org/2000/svg" style="display:block; filter: drop-shadow(0 4px 6px rgba(0,0,0,.25));">
      <path
        d="M20 51
           C 20 51,  3 31,  3 18
           A 17 17 0 1 1 37 18
           C 37 31, 20 51, 20 51
           Z"
        fill="#222222"
        stroke="#ffffff"
        stroke-width="3"
        stroke-linejoin="round"
      />
    </svg>
  `

  // House icon positioned over the head of the pin (centred horizontally,
  // y≈10 so it lands inside the round top portion).
  const html = `
    <div style="position:relative; width:40px; height:52px;">
      ${pinSvg}
      <div style="
        position:absolute;
        top:10px; left:0; width:100%;
        display:flex; justify-content:center; align-items:center;
        pointer-events:none;
      ">${houseSvg}</div>
    </div>
  `

  return L.divIcon({
    html,
    className:   "property-marker",  // CSS override resets Leaflet's default white box
    iconSize:    [40, 52],
    iconAnchor:  [20, 51],           // tail tip = geo coordinate
    popupAnchor: [0, -48],
  })
}

/** Re-centres the map when coordinates change (e.g. live preview). */
function Recenter({ lat, lng, zoom }: { lat: number; lng: number; zoom: number }) {
  const map = useMap()
  map.setView([lat, lng], zoom)
  return null
}

/**
 * Public-facing property location map.
 *
 *   • `exact`        → custom black-pin-with-house marker, zoomed in
 *   • `approximate`  → soft circle (`approxRadius`, default 1 km),
 *                      NO marker — coordinate precision stays hidden
 */
export function PropertyLocationMap({
  lat,
  lng,
  locationMode,
  address,
  approxRadius = 1000,
  height       = 360,
  className,
}: Props) {
  const isExact = locationMode === "exact"
  const zoom    = isExact ? 16 : 14

  const center = useMemo<[number, number]>(() => [lat, lng], [lat, lng])
  const icon   = useMemo(() => makeHouseIcon(), [])

  return (
    // Outer wrapper has NO fixed height — only the map gets the fixed
    // height. Previously the address `<p>` was inside a 360px-tall
    // container, so long Costa Rica addresses (3 lines on mobile)
    // overflowed and visually overlapped the next section's heading.
    <div className={className}>
      <div style={{ height }}>
        <MapContainer
          center={center}
          zoom={zoom}
          scrollWheelZoom={false}
          zoomControl
          attributionControl
          className="h-full w-full rounded-xl overflow-hidden border"
        >
          {/* Base layer — buildings, roads, parks */}
          <TileLayer
            url={TILE_URL_VOYAGER}
            attribution={TILE_ATTRIBUTION}
            // High-DPI tiles when supported for crispness on retina screens
            detectRetina
          />
          {/* Top labels layer — keeps text crisp over the markers */}
          <TileLayer
            url={TILE_URL_VOYAGER_LABELS_OVER}
            detectRetina
            // Allow blank attribution since the base layer already attributes
            attribution=""
          />

          {/* Marker is shown in BOTH modes — in approximate mode the
              position has already been snapped server-side (~1 km grid)
              so the visual pin doesn't reveal the exact street. */}
          <Marker position={center} icon={icon} />

          {/* Circle reinforces "approximate area" in approximate mode. */}
          {!isExact && (
            <Circle
              center={center}
              radius={approxRadius}
              pathOptions={{
                color:       "#222222",
                fillColor:   "#222222",
                fillOpacity: 0.12,
                weight:      2,
                opacity:     0.5,
              }}
            />
          )}

          <Recenter lat={lat} lng={lng} zoom={zoom} />
        </MapContainer>
      </div>

      {address && (
        <p className="mt-2 text-xs text-muted-foreground leading-relaxed break-words">
          {address}
          {!isExact && (
            <span className="ml-1 italic opacity-70">· zona aproximada</span>
          )}
        </p>
      )}
    </div>
  )
}
