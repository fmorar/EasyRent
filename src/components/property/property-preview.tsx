"use client"

import { useState } from "react"
import { formatPrice } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  MapPinIcon,
  ArrowsPointingOutIcon,
  TruckIcon,
  PhoneIcon,
  EnvelopeIcon,
  XMarkIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from "@heroicons/react/24/outline"
import { StarIcon } from "@heroicons/react/24/solid"
import type { Property, Owner } from "@/types"
import type { PhotoRow } from "@/components/property/photo-uploader"
import type { VideoRow } from "@/lib/actions/media.actions"
import { PropertyGallery } from "@/components/property/property-gallery"

// ── Constants ─────────────────────────────────────────────────────
const TYPE_LABELS: Record<string, string> = {
  apartment:  "Apartamento",
  house:      "Casa",
  land:       "Terreno",
  commercial: "Comercial",
  office:     "Oficina",
  warehouse:  "Bodega",
}

const STATUS_LABELS: Record<string, string> = {
  available:  "En venta",
  reserved:   "Reservado",
  sold:       "Vendido",
  off_market: "Fuera de mercado",
  rented:     "Alquilado",
}

// ── Helpers ───────────────────────────────────────────────────────
function extractYouTubeId(url: string): string | null {
  try {
    const u = new URL(url)
    if (["www.youtube.com", "youtube.com", "m.youtube.com"].includes(u.hostname)) {
      return u.searchParams.get("v")
    }
    if (u.hostname === "youtu.be") return u.pathname.slice(1)
  } catch { /* ignore */ }
  return null
}

// ── Types ─────────────────────────────────────────────────────────
interface Props {
  property: Property
  photos:   PhotoRow[]
  videos:   VideoRow[]
  owner:    Owner | null
}

// ── Component ─────────────────────────────────────────────────────
export default function PropertyPreview({ property, photos, videos, owner }: Props) {
  // Hoist the cover photo to position 0 so the gallery's hero shows it.
  const sortedRaw = [...photos].sort((a, b) => a.order_index - b.order_index)
  const coverIdx  = sortedRaw.findIndex((p) => p.is_cover)
  const sorted    = coverIdx > 0
    ? [sortedRaw[coverIdx], ...sortedRaw.slice(0, coverIdx), ...sortedRaw.slice(coverIdx + 1)]
    : sortedRaw

  const [lbOpen,  setLbOpen]  = useState(false)
  const [lbIndex, setLbIndex] = useState(0)

  const ownerInitials = owner?.full_name
    .split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase() ?? "PR"

  return (
    <div className="text-sm">

      {/* ── Notice ──────────────────────────────────────── */}
      <div className="mx-5 mt-4 mb-5 flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/60 border border-dashed text-xs text-muted-foreground">
        <span className="h-1.5 w-1.5 rounded-full bg-warning shrink-0" />
        Vista previa · se actualiza en tiempo real
      </div>

      {/* ── Photo gallery ───────────────────────────────── */}
      <div className="mx-5">
        <PropertyGallery
          photos={sorted}
          alt={property.title ?? ""}
          compact
          onPhotoClick={(i) => { setLbIndex(i); setLbOpen(true) }}
        />
      </div>

      {/* ── Main info ───────────────────────────────────── */}
      <div className="px-5 pt-4 space-y-4">

        {/* Type + featured badge */}
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="secondary" className="text-xs">
            {TYPE_LABELS[property.property_type ?? ""] ?? "Propiedad"}
          </Badge>
          {property.is_featured && (
            <Badge className="text-xs">Destacado</Badge>
          )}
          <Badge
            variant="outline"
            className="text-xs ml-auto"
          >
            {STATUS_LABELS[property.status ?? ""] ?? property.status}
          </Badge>
        </div>

        {/* Title + price */}
        <div>
          <h1 className="text-xl font-bold leading-snug">{property.title}</h1>
          <div className="flex items-end justify-between mt-1.5">
            {property.display_address || property.public_address ? (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <MapPinIcon className="h-3 w-3 shrink-0" />
                {property.display_address ?? property.public_address}
              </span>
            ) : <span />}
            <div className="text-right shrink-0">
              <p className="text-lg font-bold text-foreground leading-none">
                {property.price != null && property.currency
                  ? formatPrice(property.price, property.currency)
                  : "A consultar"}
              </p>
              {property.currency && (
                <p className="text-xs text-muted-foreground mt-0.5">{property.currency}</p>
              )}
            </div>
          </div>
        </div>

        {/* Quick specs chips */}
        {(property.bedrooms != null || property.bathrooms != null ||
          property.area_sqm != null || property.parking_spaces != null) && (
          <div className="flex flex-wrap gap-2">
            {property.bedrooms != null && (
              <Chip>{property.bedrooms} hab.</Chip>
            )}
            {property.bathrooms != null && (
              <Chip>{property.bathrooms} baños</Chip>
            )}
            {property.area_sqm != null && (
              <Chip>
                <ArrowsPointingOutIcon className="h-3 w-3" />
                {property.area_sqm} m²
              </Chip>
            )}
            {property.parking_spaces != null && (
              <Chip>
                <TruckIcon className="h-3 w-3" />
                {property.parking_spaces} parqueo{property.parking_spaces !== 1 ? "s" : ""}
              </Chip>
            )}
          </div>
        )}

        <Separator />

        {/* Description */}
        {property.description && (
          <div className="space-y-1.5">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Descripción</p>
            <div
              className="text-sm text-muted-foreground leading-relaxed preview-prose"
              // description is HTML from Tiptap — always agent-authored, never user-supplied
              // eslint-disable-next-line react/no-danger
              dangerouslySetInnerHTML={{ __html: property.description }}
            />
          </div>
        )}

        {/* Videos */}
        {videos.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Videos</p>
            {[...videos].sort((a, b) => a.order_index - b.order_index).map((v) => {
              const vid = extractYouTubeId(v.youtube_url)
              if (!vid) return null
              return (
                <div key={v.id} className="rounded-lg overflow-hidden bg-muted aspect-video">
                  <iframe
                    src={`https://www.youtube.com/embed/${vid}`}
                    title={v.title ?? "Video"}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    className="w-full h-full"
                  />
                </div>
              )
            })}
          </div>
        )}

        {/* Details table */}
        <div className="space-y-1.5">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Detalles</p>
          <div className="rounded-xl border divide-y text-xs overflow-hidden">
            <Row label="Estado"   value={STATUS_LABELS[property.status ?? ""] ?? property.status ?? "—"} />
            {(property.display_address ?? property.public_address) && (
              <Row label="Ubicación" value={(property.display_address ?? property.public_address)!} />
            )}
            {property.area_sqm != null && (
              <Row label="Área" value={`${property.area_sqm.toLocaleString()} m²`} />
            )}
            {property.floor != null && (
              <Row label="Piso" value={String(property.floor)} />
            )}
            {property.parking_spaces != null && (
              <Row label="Parqueos" value={String(property.parking_spaces)} />
            )}
            <Row label="ID" value={property.id?.slice(0, 8).toUpperCase() ?? "—"} />
          </div>
        </div>

        {/* Owner contact card */}
        {owner && (
          <div className="rounded-xl border p-4 space-y-3">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-full bg-primary/15 flex items-center justify-center text-foreground text-xs font-bold shrink-0">
                {ownerInitials}
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-sm truncate">{owner.full_name}</p>
                <div className="flex items-center gap-1 mt-0.5">
                  <StarIcon className="h-3 w-3 text-foreground fill-foreground" />
                  <span className="text-xs text-muted-foreground">Propietario</span>
                </div>
              </div>
            </div>
            {(owner.phone || owner.email) && (
              <>
                <Separator />
                <div className="space-y-2">
                  {owner.phone && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground flex items-center gap-1.5 text-xs">
                        <PhoneIcon className="h-3.5 w-3.5" /> Teléfono
                      </span>
                      <span className="font-medium text-xs">{owner.phone}</span>
                    </div>
                  )}
                  {owner.email && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground flex items-center gap-1.5 text-xs">
                        <EnvelopeIcon className="h-3.5 w-3.5" /> Email
                      </span>
                      <span className="font-medium text-xs truncate max-w-[160px]">{owner.email}</span>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* Bottom padding */}
        <div className="h-4" />
      </div>

      {/* ── Lightbox ────────────────────────────────────── */}
      {lbOpen && sorted.length > 0 && (
        <div
          className="fixed inset-0 z-50 bg-black/92 flex items-center justify-center"
          onClick={() => setLbOpen(false)}
        >
          <button
            type="button"
            className="absolute top-4 right-4 text-white p-2 hover:bg-white/10 rounded-full transition-colors"
            onClick={() => setLbOpen(false)}
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
          <p className="absolute top-5 left-1/2 -translate-x-1/2 text-white/70 text-xs tabular-nums">
            {lbIndex + 1} / {sorted.length}
          </p>
          {sorted.length > 1 && (
            <button
              type="button"
              className="absolute left-3 text-white p-2 hover:bg-white/10 rounded-full transition-colors"
              onClick={(e) => { e.stopPropagation(); setLbIndex((i) => (i - 1 + sorted.length) % sorted.length) }}
            >
              <ChevronLeftIcon className="h-7 w-7" />
            </button>
          )}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={sorted[lbIndex].url}
            alt={sorted[lbIndex].caption ?? ""}
            className="max-w-[90vw] max-h-[85vh] object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
          {sorted.length > 1 && (
            <button
              type="button"
              className="absolute right-3 text-white p-2 hover:bg-white/10 rounded-full transition-colors"
              onClick={(e) => { e.stopPropagation(); setLbIndex((i) => (i + 1) % sorted.length) }}
            >
              <ChevronRightIcon className="h-7 w-7" />
            </button>
          )}
          {sorted[lbIndex].caption && (
            <p className="absolute bottom-5 left-1/2 -translate-x-1/2 text-white text-xs bg-black/50 px-3 py-1 rounded-full">
              {sorted[lbIndex].caption}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

// ── Tiny helpers ──────────────────────────────────────────────────
function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-muted text-xs font-medium text-muted-foreground">
      {children}
    </span>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center px-3 py-2.5">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right">{value}</span>
    </div>
  )
}
