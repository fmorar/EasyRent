import { ImageResponse } from "next/og"
import { createClient } from "@/lib/supabase/server"
import type { Profile } from "@/types"

/**
 * Dynamic Open Graph image for public agent profile pages.
 *
 * Composition (1200×630):
 *   • Cream background (matches public-site cream surface)
 *   • Left column: editorial copy — eyebrow, agent name, role,
 *     listing count, easyrent wordmark
 *   • Right column: agent avatar disc with a subtle ring (falls
 *     back to initials when no avatar uploaded)
 *   • Bottom accent bar in brand yellow
 *
 * Why the editorial layout (not a hero-photo with overlay like the
 * property OG): an agent's identity is the avatar + name, not a
 * single representative photo. A clean editorial card photographs
 * better in WhatsApp's small preview and gives crawlers stable
 * content even when the agent hasn't uploaded an avatar.
 */

export const alt         = "Vista previa de agente inmobiliario en easyrent"
export const size        = { width: 1200, height: 630 }
export const contentType = "image/png"

interface Props {
  params: Promise<{ locale: string; slug: string }>
}

// Brand tokens — kept literal because Satori doesn't run Tailwind.
const FOREGROUND = "#0A0A0A"
const BACKGROUND = "#FAFAF7"
const MUTED      = "#6B7280"
const ACCENT     = "#FACC15"
const RING       = "rgba(10,10,10,0.08)"

export default async function AgentOgImage({ params }: Props) {
  const { slug } = await params
  const supabase = await createClient()

  // Pull the same row the page itself queries — keeps the preview
  // in lockstep with what visitors see.
  const { data: agent } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url, bio, role")
    .eq("slug", slug)
    .eq("status", "active")
    .is("deleted_at", null)
    .single() as {
      data: Pick<Profile, "id" | "full_name" | "avatar_url" | "bio" | "role"> | null
    }

  // Count active marketplace listings the agent created (cheap head
  // query — we only need the count, not the rows). Used in the
  // bottom-left meta line ("12 propiedades publicadas"). We hit the
  // base `properties` table (not v_marketplace, which doesn't expose
  // `created_by`) but mirror the marketplace filters so the count
  // matches what visitors actually see on the profile.
  let listingsCount = 0
  if (agent?.id) {
    const { count } = await supabase
      .from("properties")
      .select("id", { count: "exact", head: true })
      .eq("created_by",             agent.id)
      .eq("is_marketplace_visible", true)
      .is("deleted_at", null)
    listingsCount = count ?? 0
  }

  const fullName     = agent?.full_name ?? "Agente"
  const initials     = fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("") || "·"
  const isAgency     = agent?.role === "owner_admin" || agent?.role === "super_admin"
  const roleLabel    = isAgency ? "Agencia" : "Agente inmobiliario"
  const listingsLine = listingsCount > 0
    ? `${listingsCount} ${listingsCount === 1 ? "propiedad publicada" : "propiedades publicadas"}`
    : "Asesoría personalizada · Respuesta en menos de 24h"

  return new ImageResponse(
    (
      <div
        style={{
          width:          "100%",
          height:         "100%",
          display:        "flex",
          position:       "relative",
          background:     BACKGROUND,
          fontFamily:     "system-ui, -apple-system, 'Segoe UI', sans-serif",
          color:          FOREGROUND,
          padding:        72,
        }}
      >
        {/* Left column — editorial copy */}
        <div
          style={{
            display:        "flex",
            flexDirection:  "column",
            flex:           1,
            gap:            24,
            paddingRight:   48,
          }}
        >
          {/* Wordmark */}
          <div style={{ display: "flex", alignItems: "center" }}>
            <Wordmark color={FOREGROUND} height={36} />
          </div>

          {/* Spacer */}
          <div style={{ flex: 1, display: "flex" }} />

          {/* Role chip */}
          <div
            style={{
              display:        "flex",
              alignSelf:      "flex-start",
              padding:        "8px 16px",
              background:     ACCENT,
              color:          FOREGROUND,
              borderRadius:   999,
              fontSize:       22,
              fontWeight:     700,
              letterSpacing:  "0.04em",
              textTransform:  "uppercase",
            }}
          >
            {roleLabel}
          </div>

          {/* Name */}
          <div
            style={{
              display:       "flex",
              fontSize:      72,
              fontWeight:    800,
              lineHeight:    1.02,
              letterSpacing: "-0.025em",
              maxWidth:      600,
            }}
          >
            {clamp(fullName, 40)}
          </div>

          {/* Listings line */}
          <div
            style={{
              display:    "flex",
              fontSize:   24,
              color:      MUTED,
              maxWidth:   620,
            }}
          >
            {listingsLine}
          </div>
        </div>

        {/* Right column — avatar */}
        <div
          style={{
            display:        "flex",
            alignItems:     "center",
            justifyContent: "center",
            width:          360,
            flexShrink:     0,
          }}
        >
          {agent?.avatar_url ? (
            <img
              src={agent.avatar_url}
              alt=""
              width={320}
              height={320}
              style={{
                width:         320,
                height:        320,
                borderRadius:  "50%",
                objectFit:     "cover",
                boxShadow:     `0 0 0 12px ${RING}`,
              }}
            />
          ) : (
            <div
              style={{
                display:        "flex",
                alignItems:     "center",
                justifyContent: "center",
                width:          320,
                height:         320,
                borderRadius:   "50%",
                background:     FOREGROUND,
                color:          BACKGROUND,
                fontSize:       128,
                fontWeight:     800,
                letterSpacing:  "-0.03em",
                boxShadow:      `0 0 0 12px ${RING}`,
              }}
            >
              {initials}
            </div>
          )}
        </div>

        {/* Bottom accent bar */}
        <div
          style={{
            position:   "absolute",
            left:       0,
            right:      0,
            bottom:     0,
            height:     8,
            background: ACCENT,
            display:    "flex",
          }}
        />
      </div>
    ),
    { ...size },
  )
}

function clamp(s: string, max: number) {
  return s.length <= max ? s : s.slice(0, max - 1).trimEnd() + "…"
}

/**
 * Inline wordmark for Satori. Same paths as `<EasyrentLogo>` but with
 * explicit fill — Satori doesn't resolve `currentColor` in SVG.
 */
function Wordmark({ color, height }: { color: string; height: number }) {
  const width = Math.round(height * 3.99)
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={width}
      height={height}
      viewBox="8 130 590 148"
      fill={color}
    >
      <path d="M291.47,235.59c-10.78-5.53-16.94-14.16-17.25-26.17-.43-16.86-.32-33.73-.4-50.6-.02-4.05,3.14-6.9,7.49-6.85,4.42.05,7.23,2.67,7.25,6.77.09,15.38.35,30.76.24,46.14-.1,13.58,11.27,21.65,24.14,18.67,8.16-1.89,13.59-6.86,15.36-15.29.3-1.44.27-2.96.29-4.44.14-14.99.33-29.98.34-44.98,0-3.95,1.84-5.81,5.35-6.71,3.66-.94,7.69.8,9.04,3.87.32.73.38,1.63.38,2.45-.02,25.27.02,50.54-.11,75.81-.08,16.05-10.21,30.86-26.31,36.46-22.91,7.97-43.98,4.19-62.23-12.42-2.46-2.23-3.41-5.03-2.45-8.24.84-2.82,2.85-4.58,5.73-5.19,2.75-.58,5.11.37,7.04,2.33,6.69,6.81,14.95,10.45,24.24,11.8,8.06,1.17,16.02.56,23.44-3.09,9.26-4.56,14.72-11.9,15.52-22.4.02-.25-.02-.5-.05-.96-11.88,6.98-24.13,8.54-37.04,3.02Z" />
      <path d="M107.96,218.19c-9.13-17.92-8.23-35.18,3.61-51.28,7.34-9.98,17.94-14.68,30.25-15.25,10.84-.5,20.86,2.01,29.57,9.17.3-1.51.43-2.84.83-4.09,1.28-4.03,4.94-5.9,9.82-5.12,3.59.58,6.07,3.67,6.07,7.61,0,23.9,0,47.8-.02,71.71,0,4.91-2.71,7.47-8.14,7.74-4.51.23-7.71-2.51-8.15-6.95-.06-.63-.15-1.26-.25-2.13-12.73,9.2-26.55,11.29-41.22,6.85-9.78-2.96-17.13-9.3-22.38-18.25M126.8,217.02c12.03,10.67,29.2,9.36,38.85-3.1,6.23-8.04,7.78-17.2,5.31-26.93-2.66-10.47-9.15-17.67-19.82-20.1-10.44-2.38-19.65.31-26.56,8.86-9.7,12-8.75,29.96,2.22,41.26Z" />
      <path d="M31.59,212.33c6.91,9.87,16.52,13.33,28.03,12.34,6.19-.54,11.81-2.67,16.54-6.77,1.45-1.26,2.69-2.78,3.9-4.28,2.61-3.25,6-4.65,9.31-3.72,5.19,1.45,7.02,7.67,3.59,12.26-6.48,8.65-15.17,13.83-25.63,16.14-11.56,2.55-22.94,2.18-33.55-3.5-16.05-8.59-23.65-22.4-23.36-40.42.35-22.32,16.36-40.21,38.55-42.97,10.75-1.34,21.32-.21,30.8,5.77,6.34,3.99,10.76,9.47,11.77,17.12,1.33,10.01-3.5,19.22-12.31,24.14-6.55,3.65-13.69,4.87-21.03,5.12-3.14.11-6.31,0-9.44-.31-3.42-.34-5.77-3.39-5.69-6.93.07-3.58,2.3-6.26,5.82-6.6,3.21-.31,6.44-.32,9.67-.43,4.19-.13,8.19-.96,11.86-3.06,7.17-4.09,7.56-12.2.71-16.78-5.89-3.94-12.56-4.72-19.34-3.62-13.33,2.17-22.26,10.95-24.81,24.21-1.53,7.95.21,15.37,4.61,22.31Z" />
      <path d="M400.24,200.05c-.68-10.9,1.58-20.92,7.77-29.75,8.69-12.39,20.83-18.24,35.91-17.39,8.11.46,15.51,3.29,21.6,8.9,11.7,10.8,9.1,28.96-5.25,37.14-5.4,3.08-11.3,4.34-17.41,4.59-3.21.13-6.47.07-9.66-.31-3.59-.43-5.61-3.32-5.41-7.04.2-3.7,2.74-6.34,6.38-6.53,3.55-.18,7.11-.17,10.65-.43,3.9-.29,7.42-1.67,10.23-4.49,4.67-4.68,3.68-11.47-2.1-14.65-10.35-5.69-23.05-3.29-30.69,5.78-9.93,11.8-9.81,29.4.28,40.68,10.34,11.56,30,10.06,38.45-2.95,1.73-2.66,4.04-4.2,7.25-3.92,6.06.52,8.68,6.72,5.04,11.81-5.79,8.11-13.55,13.39-23.19,15.79-23.24,5.77-44.86-8.32-49.08-31.89-.31-1.71-.5-3.44-.75-5.35Z" />
      <path d="M205.22,184.91c-6.06-11.05-2.6-23.75,8.6-29.18,13.52-6.55,27.3-6.23,40.75.7,1.64.84,3.15,2.05,4.49,3.33,3.25,3.11,3.37,7.99.43,11.14-2.83,3.03-7.92,3.4-10.96.22-3.12-3.26-6.93-4.57-11.08-5.29-4.97-.87-9.91-.77-14.53,1.65-5.87,3.06-6.43,9.85-.84,13.35,3.29,2.06,7.03,3.45,10.67,4.87,5.57,2.18,11.39,3.78,16.82,6.24,9.32,4.22,14.7,11.46,14.49,22-.18,8.78-4.32,15.68-12.07,19.61-13.59,6.87-27.42,6.96-40.93-.55-4.6-2.56-8.14-6.32-10.8-10.88-2.37-4.08-1.31-8.72,2.49-10.97,3.88-2.29,8.67-.96,10.92,3.23,3.48,6.48,9.3,9.04,16.16,9.73,4.75.47,9.42.02,13.65-2.52,4.25-2.56,5.83-6.72,4.31-11.28-.87-2.61-2.57-4.43-5.14-5.43-7.73-3-15.48-5.98-23.2-9.01-5.75-2.26-10.88-5.36-14.25-10.96Z" />
      <path d="M486.67,171.01c4.91-11.33,13.59-17.44,25.51-18.99,10.76-1.39,20.24,1.55,27.89,9.39,5.15,5.28,7.88,11.75,7.94,19.19.15,16.99.24,33.98.34,50.97.03,4.77-4.04,7.9-8.71,6.74-4.17-1.04-5.2-2.35-5.21-6.58-.02-15.76.01-31.53-.12-47.29-.02-2.54-.32-5.23-1.22-7.58-2.55-6.72-7.67-10.3-14.84-10.92-4.09-.35-7.98.3-11.55,2.42-5.18,3.08-7.92,7.59-7.97,13.69-.12,16.8-.25,33.59-.39,50.39-.03,3.53-2.93,6.08-6.86,6.1-4.16.03-7.03-2.39-7.03-6.07-.02-16.93-.13-33.86.09-50.78.05-3.52,1.34-7.02,2.11-10.68Z" />
      <path d="M574.36,151.14c.49.46.95.97,1.43.99,3.87.15,7.76.41,11.62.23,3.82-.18,6.36,2.39,6.61,6.51.24,3.81-2.9,7.06-6.66,7.11-3.94.05-7.88.05-11.83.07-.31,0-.62.05-1.11.1-.03.75-.09,1.44-.09,2.12.01,15.19.03,30.37.05,45.56,0,6.16,4.36,10.59,10.55,10.78,1.92.06,3.84.23,5.76.24,2.97.02,5.19,2.68,5.41,5.57.3,3.91-1.21,6.71-4.47,7.67-3.64,1.08-7.37.99-11.12.44-9.73-1.43-17.69-8.62-19.85-18.22-.45-1.99-.61-4.09-.61-6.14-.05-25.33-.04-50.66-.05-75.99,0-3.7,2.77-6.27,6.79-6.31,4.2-.05,7.16,2.41,7.27,6.11.13,4.33.18,8.65.29,13.16Z" />
      <path d="M356.03,221.45c.03-13.76.04-27.33.08-40.89.05-15.07,11.33-27.16,26.36-28.59,5.47-.52,10.82-.3,16.14.92,4.33,1,6.8,4.47,6.02,8.29-.88,4.31-4.53,6.55-9.11,5.37-4.06-1.04-8.12-1.51-12.24-.58-7.47,1.67-12.44,7.3-12.87,14.99-.34,6.18-.36,12.39-.4,18.58-.08,10.79-.06,21.58-.09,32.37,0,3.42-1.57,5.34-4.97,6.15-3.28.78-7.18-.53-8.4-2.94-.36-.71-.49-1.6-.5-2.42-.05-3.68-.02-7.36-.02-11.24Z" />
    </svg>
  )
}
