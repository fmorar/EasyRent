"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import {
  ArrowTopRightOnSquareIcon,
  ArrowPathIcon,
  ClipboardDocumentIcon,
  MagnifyingGlassIcon,
} from "@heroicons/react/24/outline"
import {
  analyzeOwnerListings,
  type ProspectorResult,
  type OwnerProspect,
} from "@/lib/actions/owner-prospector.actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

const SCAN_DEPTH_OPTIONS = [
  { value: "1",  label: "1 página"  },
  { value: "3",  label: "3 páginas" },
  { value: "5",  label: "5 páginas" },
  { value: "10", label: "10 páginas" },
  { value: "15", label: "15 páginas" },
  { value: "20", label: "20 páginas" },
] as const

const MAX_LISTINGS_OPTIONS = [
  { value: "30",  label: "30 listados"  },
  { value: "60",  label: "60 listados"  },
  { value: "100", label: "100 listados" },
  { value: "150", label: "150 listados" },
  { value: "200", label: "200 listados" },
  { value: "300", label: "300 listados" },
] as const

const TIER_BADGE: Record<OwnerProspect["classification"]["tier"], { label: string; cls: string }> = {
  high:   { label: "Alta",  cls: "bg-success text-success-foreground" },
  medium: { label: "Media", cls: "bg-warning text-warning-foreground" },
  low:    { label: "Baja",  cls: "bg-muted text-muted-foreground" },
}

export function OwnerProspectorClient() {
  const [url,          setUrl]          = useState("")
  const [scanDepth,    setScanDepth]    = useState<"1" | "3" | "5" | "10" | "15" | "20">("3")
  const [maxListings,  setMaxListings]  = useState<"30" | "60" | "100" | "150" | "200" | "300">("60")
  /** When enabled we follow each listing's detail page + the
   *  advertiser's profile to count their total active listings.
   *  Disable for fast scans of huge result sets — accuracy drops to
   *  text-only heuristics but you don't wait minutes for results. */
  const [enrich,       setEnrich]       = useState(true)
  const [pending, startTransition]      = useTransition()
  const [result, setResult] = useState<ProspectorResult | null>(null)
  const [error,  setError]  = useState<string | null>(null)
  /** When the admin filters the table to "alta only", we just hide
   *  the mid/low rows — we don't re-query. */
  const [highOnly, setHighOnly] = useState(false)

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    // Intentionally DON'T clear `result` here — that would unmount the
    // results section and collapse the page height during the analysis,
    // making the form card look like it's shrinking. We keep the prior
    // results visible with a dimmed overlay (see JSX below) and replace
    // them atomically when the new analysis returns.
    startTransition(async () => {
      const r = await analyzeOwnerListings({
        url:         url.trim(),
        scanDepth:   Number(scanDepth),
        maxListings: Number(maxListings),
        enrich,
      })
      if (!r.success) {
        setError(r.error ?? "No pudimos analizar la URL.")
        toast.error(r.error ?? "No pudimos analizar la URL.")
        return
      }
      setResult(r.data)
      if (r.data.warning) toast.warning(r.data.warning)
      if (r.data.high_count > 0) {
        toast.success(`Detectamos ${r.data.high_count} listado(s) probable(s) por dueño.`)
      } else if (r.data.total_found > 0) {
        toast.info("Sin coincidencias claras de dueño directo. Revisá los de tier medio.")
      }
    })
  }

  async function copyExcerpt(p: OwnerProspect) {
    const advertiserLine = [
      p.advertiser_name,
      p.advertiser_role ? `(${p.advertiser_role === "particular" ? "Particular" : "Profesional"})` : null,
      p.advertiser_total_listings != null ? `· ${p.advertiser_total_listings} listados en su perfil` : null,
    ].filter(Boolean).join(" ")
    const lines = [
      p.title ?? "",
      p.price_text ? `Precio: ${p.price_text}` : "",
      p.location ? `Zona: ${p.location}` : "",
      advertiserLine ? `Anunciante: ${advertiserLine}` : "",
      p.advertiser_profile_url ? `Perfil: ${p.advertiser_profile_url}` : "",
      p.advertiser_phone ? `Teléfono: ${p.advertiser_phone}` : "",
      p.listing_url ? `Link: ${p.listing_url}` : "",
      p.excerpt ? `\n${p.excerpt}` : "",
    ].filter(Boolean).join("\n")
    try {
      await navigator.clipboard.writeText(lines)
      toast.success("Datos del listado copiados.")
    } catch {
      toast.error("No pudimos copiar al portapapeles.")
    }
  }

  const visibleProspects = result
    ? highOnly
      ? result.prospects.filter((p) => p.classification.tier === "high")
      : result.prospects
    : []

  return (
    // `w-full min-w-0` keeps the tool anchored to the parent's width
    // regardless of internal content. Without `min-w-0`, a wide table
    // child can blow the flex parent open and make the form card look
    // narrower in idle state.
    <div className="w-full min-w-0 space-y-(--spacing-section)">
      {/* ── Search form ──────────────────────────────────────── */}
      <form
        onSubmit={onSubmit}
        className="w-full rounded-2xl border bg-card p-(--spacing-block) space-y-(--spacing-cluster)"
        noValidate
      >
        <div className="space-y-1.5">
          <Label htmlFor="url" className="text-xs font-medium text-foreground">
            URL del portal
          </Label>
          <Input
            id="url"
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://www.encuentra24.com/costa-rica-es/bienes-raices-venta-…"
            autoComplete="off"
            disabled={pending}
          />
          <p className="text-[11px] text-muted-foreground">
            Encuentra24, MercadoLibre o cualquier portal soportado. Funciona
            con páginas de búsqueda (varios listados) o con la ficha de un
            listado individual.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-(--spacing-cluster)">
          <div className="space-y-1.5">
            <Label htmlFor="scan-depth" className="text-xs font-medium text-muted-foreground">
              Profundidad de escaneo
            </Label>
            <Select value={scanDepth} onValueChange={(v) => setScanDepth(v as typeof scanDepth)}>
              <SelectTrigger id="scan-depth"><SelectValue /></SelectTrigger>
              <SelectContent>
                {SCAN_DEPTH_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="max-listings" className="text-xs font-medium text-muted-foreground">
              Máximo de listados
            </Label>
            <Select value={maxListings} onValueChange={(v) => setMaxListings(v as typeof maxListings)}>
              <SelectTrigger id="max-listings"><SelectValue /></SelectTrigger>
              <SelectContent>
                {MAX_LISTINGS_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button type="submit" disabled={pending} aria-busy={pending} className="w-full gap-2">
              {pending ? (
                <>
                  <ArrowPathIcon className="h-4 w-4 animate-spin" />
                  Analizando…
                </>
              ) : (
                <>
                  <MagnifyingGlassIcon className="h-4 w-4" />
                  Analizar
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Enrichment toggle + estimated-time hint. Sits below the
            main controls because most scans use the default (on) — the
            user only toggles it off when they want a fast skim over a
            big result set. */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-(--spacing-cluster) pt-(--spacing-tight) border-t">
          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={enrich}
              onChange={(e) => setEnrich(e.target.checked)}
              disabled={pending}
              className="mt-0.5 h-3.5 w-3.5 shrink-0"
            />
            <div className="space-y-0.5">
              <p className="text-xs font-medium">Enriquecer perfiles del anunciante</p>
              <p className="text-[11px] text-muted-foreground">
                Sigue links de cada listado y del perfil para contar listados
                totales — clasifica mejor, pero agrega ~1 segundo por listado.
              </p>
            </div>
          </label>
          <p className="text-[11px] text-muted-foreground whitespace-nowrap">
            ≈ {estimateSeconds(Number(maxListings), enrich)}s estimados
          </p>
        </div>
      </form>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* ── Results region — always mounted so the page doesn't
              snap between empty / pending / result states. Each
              placeholder card uses the SAME compact min-height as
              well, so the idle state doesn't loom over the page
              with empty space. */}
      <section
        className={cn(
          "w-full min-w-0 space-y-(--spacing-cluster) transition-opacity duration-(--duration-state) ease-(--ease-out-quart)",
          // Dim the previous results while a new analysis runs.
          pending && result && "opacity-50 pointer-events-none",
        )}
        aria-busy={pending}
      >
        {/* Idle — no prior scan, nothing pending. Explain the tool. */}
        {!result && !pending && (
          <Placeholder
            icon={<MagnifyingGlassIcon className="h-5 w-5" />}
            title="Pegá un link arriba para empezar"
            body="Crawleamos la URL, clasificamos cada listado por probabilidad de estar publicado por dueño directo, y abrimos el perfil de cada anunciante para contar cuántas propiedades tiene publicadas en total."
          />
        )}

        {/* First-time pending — no prior result to dim. */}
        {pending && !result && (
          <Placeholder
            icon={<ArrowPathIcon className="h-5 w-5 animate-spin" />}
            title="Analizando el portal…"
            body="Estamos crawleando la URL, abriendo cada ficha y contando los listados del perfil de cada anunciante. Puede tardar varios minutos en scans grandes."
          />
        )}

        {/* Empty-results card (success but 0 found). */}
        {result && result.total_found === 0 && (
          <Placeholder
            title="Sin resultados"
            body={result.warning ?? "La URL no devolvió listados. Probá con otra URL, ampliá la profundidad de escaneo, o quitá filtros del portal."}
          />
        )}

        {/* Has-results view — table + summary. */}
        {result && result.total_found > 0 && (
          <>
          {/* Re-analysis banner — visible only while pending, above
              the stale summary so the agent knows the table they see
              is the previous run, not the in-progress one. */}
          {pending && (
            <div className="flex items-center gap-2 rounded-xl border border-warning/30 bg-warning-soft/40 px-4 py-2.5 text-xs">
              <ArrowPathIcon className="h-3.5 w-3.5 animate-spin text-warning" />
              <span className="text-foreground/80">
                Re-analizando… mostramos los resultados anteriores mientras tanto.
              </span>
            </div>
          )}
          {/* Summary row */}
          <div className="flex flex-wrap items-center justify-between gap-(--spacing-cluster) rounded-xl bg-muted/40 px-4 py-3">
            <div className="flex items-center gap-3 text-sm">
              <span className="font-numeric font-semibold">{result.total_found}</span>
              <span className="text-muted-foreground">listados analizados</span>
              <span className="text-muted-foreground">·</span>
              <span className="font-numeric font-semibold text-success">{result.high_count}</span>
              <span className="text-muted-foreground">probablemente por dueño</span>
              <span className="text-muted-foreground">·</span>
              <span className="text-muted-foreground capitalize">{result.source_name}</span>
            </div>
            <label className="inline-flex items-center gap-2 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={highOnly}
                onChange={(e) => setHighOnly(e.target.checked)}
                className="h-3.5 w-3.5"
              />
              Solo tier alto (≥70)
            </label>
          </div>

          {visibleProspects.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No quedan filas con ese filtro.
            </p>
          ) : (
            // `overflow-x-auto` keeps any column overflow inside the
            // table wrapper instead of letting it push the parent
            // section wider than the form card above.
            <div className="rounded-xl border overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium w-16">Score</th>
                    <th className="text-left px-4 py-3 font-medium">Listado</th>
                    <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Anunciante</th>
                    <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Precio · zona</th>
                    <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Señales</th>
                    <th className="text-right px-4 py-3 font-medium">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleProspects.map((p, i) => (
                    <ProspectRow key={`${p.listing_url}-${i}`} p={p} onCopy={() => copyExcerpt(p)} />
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Datos extraídos de portales públicos al momento del análisis.
            Cualquier outreach debe respetar las reglas del portal y la ley
            de protección de datos. La clasificación es referencial — siempre
            confirmá el estatus antes de contactar.
          </p>
          </>
        )}
      </section>
    </div>
  )
}

// ── Helpers ─────────────────────────────────────────────────────────
/**
 * Rough budget estimate so the admin sees what they're about to commit
 * to. The fetcher rate-limits at 1 req/sec/host; without enrichment we
 * just do the listing page(s) (~3 fetches per 60 listings). With
 * enrichment we add 1 fetch per listing + ~1 per unique advertiser.
 */
function estimateSeconds(maxListings: number, enrich: boolean): number {
  const listingPages = Math.max(1, Math.ceil(maxListings / 20))  // ~20 cards / page
  if (!enrich) return listingPages
  const detailFetches  = maxListings
  const profileFetches = Math.max(1, Math.ceil(maxListings / 6)) // rough — ~6 listings per agent on average
  return listingPages + detailFetches + profileFetches
}

// ── Placeholder card ────────────────────────────────────────────────
/**
 * Compact card used for the idle, pending-first-time, and empty-result
 * states. All three share the same visual footprint so transitioning
 * between them doesn't make the page jump.
 *
 * Sized via padding (not a min-height) so the card hugs its content
 * naturally — looks intentional in any layout instead of looming over
 * the rest of the page with empty space.
 */
function Placeholder({
  icon, title, body,
}: {
  icon?: React.ReactNode
  title: string
  body:  string
}) {
  return (
    <div className="rounded-2xl border border-dashed bg-muted/20 px-6 py-10 sm:py-12 text-center space-y-2">
      {icon && (
        <div className="flex justify-center text-muted-foreground">{icon}</div>
      )}
      <p className="text-sm font-medium">{title}</p>
      <p className="text-xs text-muted-foreground max-w-md mx-auto leading-relaxed">
        {body}
      </p>
    </div>
  )
}

// ── Row ─────────────────────────────────────────────────────────────
function ProspectRow({
  p, onCopy,
}: {
  p:      OwnerProspect
  onCopy: () => void
}) {
  const tier = TIER_BADGE[p.classification.tier]
  return (
    <tr className="border-t hover:bg-muted/30 transition-colors align-top">
      <td className="px-4 py-3 align-top">
        <span className={cn(
          "inline-flex items-center justify-center h-7 min-w-12 rounded-full px-2 text-xs font-numeric font-semibold",
          tier.cls,
        )}>
          {p.classification.score}
        </span>
        <p className="mt-1 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{tier.label}</p>
      </td>
      <td className="px-4 py-3 max-w-md">
        <p className="font-medium leading-snug line-clamp-2" title={p.title ?? ""}>
          {p.title ?? "(sin título)"}
        </p>
        {p.excerpt && (
          <p
            className="text-xs text-muted-foreground line-clamp-2 mt-1"
            title={p.excerpt}
          >
            {p.excerpt}
          </p>
        )}
      </td>
      <td className="px-4 py-3 hidden md:table-cell text-xs">
        {p.advertiser_name ? (
          <>
            {p.advertiser_profile_url ? (
              <a
                href={p.advertiser_profile_url}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium leading-tight line-clamp-2 hover:underline decoration-foreground/30 underline-offset-2"
                title={p.advertiser_name}
                onClick={(e) => e.stopPropagation()}
              >
                {p.advertiser_name}
              </a>
            ) : (
              <p className="font-medium leading-tight line-clamp-2" title={p.advertiser_name}>
                {p.advertiser_name}
              </p>
            )}
            <div className="mt-1 flex items-center gap-1.5 flex-wrap">
              {p.advertiser_role === "professional" && (
                <Badge variant="outline" className="text-[10px] font-normal border-destructive/30 text-destructive">
                  Profesional
                </Badge>
              )}
              {p.advertiser_role === "particular" && (
                <Badge variant="outline" className="text-[10px] font-normal border-success/30 text-success">
                  Particular
                </Badge>
              )}
              {/* Profile-page total — the real signal. We show it when
                  available; otherwise the in-scan count appears as a
                  weaker fallback. */}
              {p.advertiser_total_listings != null ? (
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[10px] font-normal",
                    p.advertiser_total_listings >= 5
                      ? "border-destructive/30 text-destructive"
                      : p.advertiser_total_listings === 1
                        ? "border-success/30 text-success"
                        : "",
                  )}
                >
                  {p.advertiser_total_listings} en perfil
                </Badge>
              ) : p.advertiser_occurrences > 1 ? (
                <Badge variant="outline" className="text-[10px] font-normal">
                  {p.advertiser_occurrences}× en este scan
                </Badge>
              ) : null}
            </div>
            {p.advertiser_phone && (
              <p className="text-[11px] text-muted-foreground font-numeric mt-0.5">
                {p.advertiser_phone}
              </p>
            )}
          </>
        ) : (
          <div className="space-y-0.5">
            <span className="text-muted-foreground italic">—</span>
            {p.enrichment_status === "fetch_failed" && (
              <p className="text-[10px] text-destructive/70">No pudimos abrir la ficha</p>
            )}
            {p.enrichment_status === "no_match" && (
              <p className="text-[10px] text-warning/80">Ficha sin bloque del anunciante</p>
            )}
            {p.enrichment_status === "skipped" && (
              <p className="text-[10px] text-muted-foreground">Enriquecimiento desactivado</p>
            )}
          </div>
        )}
      </td>
      <td className="px-4 py-3 hidden md:table-cell text-xs">
        {p.price_text && <p className="font-numeric font-medium">{p.price_text}</p>}
        {p.location && <p className="text-muted-foreground line-clamp-2 mt-0.5">{p.location}</p>}
      </td>
      <td className="px-4 py-3 hidden lg:table-cell text-xs">
        {p.classification.signals.length === 0 ? (
          <span className="text-muted-foreground italic">—</span>
        ) : (
          <div className="flex flex-wrap gap-1">
            {p.classification.signals.slice(0, 4).map((s, i) => (
              <Badge
                key={i}
                variant="outline"
                className={cn(
                  "text-[10px] font-normal",
                  s.startsWith("+") ? "border-success/30 text-success" : "border-destructive/30 text-destructive",
                )}
              >
                {s}
              </Badge>
            ))}
          </div>
        )}
      </td>
      <td className="px-4 py-3 text-right">
        <div className="inline-flex items-center gap-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onCopy}
            className="h-8 gap-1.5 px-2"
            title="Copiar datos"
          >
            <ClipboardDocumentIcon className="h-3.5 w-3.5" />
          </Button>
          {p.listing_url && (
            <a
              href={p.listing_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 h-8 px-2 rounded-md border bg-background hover:bg-muted text-xs font-medium transition-colors"
              title="Abrir listado"
            >
              Abrir
              <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5" />
            </a>
          )}
        </div>
      </td>
    </tr>
  )
}
