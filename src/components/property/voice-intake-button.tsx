"use client"

import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import {
  MicrophoneIcon,
  StopIcon,
  ArrowPathIcon,
  CheckCircleIcon,
} from "@heroicons/react/24/outline"
import { Button } from "@/components/ui/button"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

/** Shape returned from the voice-intake endpoint. Keys mirror the
 *  property form schema; values can be missing when the dictation
 *  didn't mention that field clearly. */
export interface VoiceIntakeFields {
  title?:          string | null
  description?:    string | null
  property_type?:  "apartment" | "house" | "land" | "commercial" | "office" | "warehouse" | null
  listing_type?:   "sale" | "rent" | null
  status?:         "available" | "reserved" | "sold" | "off_market" | null
  is_furnished?:   boolean | null
  location_mode?:  "exact" | "approximate" | null
  public_address?: string | null
  price?:          number | null
  currency?:       "USD" | "CRC" | null
  bedrooms?:       number | null
  bathrooms?:      number | null
  area_sqm?:       number | null
  floor?:          number | null
  parking_spaces?: number | null
  amenities?:      string[] | null
}

interface Props {
  /** Called when the user clicks "Aplicar" on the parsed preview.
   *  Receives only the fields with non-null values — the parent
   *  decides which to merge into its form via `setValue`. */
  onApply: (fields: VoiceIntakeFields) => void
  /** Maximum recording duration. We stop at the cap to keep Whisper
   *  costs bounded; in practice 60s is more than enough for a
   *  property intake. */
  maxSeconds?: number
  className?:  string
}

type RecordingState =
  | { kind: "idle" }
  | { kind: "permission" }
  | { kind: "recording"; elapsed: number }
  | { kind: "uploading" }
  | { kind: "result"; transcript: string; parsed: VoiceIntakeFields }
  | { kind: "error";  message: string }

/**
 * "Dictar datos" button — opens the device microphone, records up to
 * `maxSeconds`, sends the audio to `/api/properties/voice-intake`, and
 * shows the transcript + parsed field preview in a dialog before
 * applying anything to the parent form.
 *
 * Why a dialog (and not auto-apply): the agent should always see what
 * the model heard before it overwrites form state. Lets them spot a
 * misheard zone or wrong listing type before committing.
 */
export function VoiceIntakeButton({ onApply, maxSeconds = 90, className }: Props) {
  const [state, setState] = useState<RecordingState>({ kind: "idle" })
  const mediaRef    = useRef<MediaRecorder | null>(null)
  const streamRef   = useRef<MediaStream | null>(null)
  const chunksRef   = useRef<Blob[]>([])
  const tickRef     = useRef<ReturnType<typeof setInterval> | null>(null)
  const startedAtMs = useRef<number>(0)

  // Defensive: if the page unmounts mid-recording, release the mic.
  useEffect(() => {
    return () => stopStream()
  }, [])

  function stopStream() {
    if (tickRef.current) clearInterval(tickRef.current)
    tickRef.current = null
    if (mediaRef.current && mediaRef.current.state !== "inactive") {
      try { mediaRef.current.stop() } catch { /* noop */ }
    }
    if (streamRef.current) {
      for (const t of streamRef.current.getTracks()) t.stop()
      streamRef.current = null
    }
  }

  async function start() {
    if (state.kind === "recording" || state.kind === "uploading") return
    setState({ kind: "permission" })

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      // Prefer Opus in WebM (Chrome, Firefox); Safari emits MP4 by default.
      const mimeType = pickMimeType()
      const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      mediaRef.current = rec
      chunksRef.current = []

      rec.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data)
      }
      rec.onstop = handleStop

      rec.start()
      startedAtMs.current = Date.now()
      setState({ kind: "recording", elapsed: 0 })

      tickRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startedAtMs.current) / 1000)
        if (elapsed >= maxSeconds) {
          stop()
        } else {
          setState({ kind: "recording", elapsed })
        }
      }, 250)
    } catch (err) {
      const msg = err instanceof DOMException && err.name === "NotAllowedError"
        ? "Permitinos acceder al micrófono desde la barra del navegador."
        : err instanceof Error ? err.message : "No pudimos abrir el micrófono."
      setState({ kind: "error", message: msg })
      toast.error(msg)
    }
  }

  function stop() {
    // Triggers handleStop via the recorder's `onstop` callback.
    if (mediaRef.current && mediaRef.current.state === "recording") {
      mediaRef.current.stop()
    }
    if (tickRef.current) {
      clearInterval(tickRef.current)
      tickRef.current = null
    }
  }

  async function handleStop() {
    // Release the mic stream as soon as the recorder is done.
    if (streamRef.current) {
      for (const t of streamRef.current.getTracks()) t.stop()
      streamRef.current = null
    }

    setState({ kind: "uploading" })
    const blob = new Blob(chunksRef.current, {
      type: mediaRef.current?.mimeType || "audio/webm",
    })
    chunksRef.current = []

    if (blob.size === 0) {
      setState({ kind: "error", message: "No grabamos audio. Probá de nuevo." })
      return
    }

    try {
      const fd = new FormData()
      fd.append("audio", blob, `voice-intake.${extFor(blob.type)}`)
      const res = await fetch("/api/properties/voice-intake", { method: "POST", body: fd })
      const json = (await res.json()) as
        | { transcript: string; parsed: VoiceIntakeFields; warning?: string }
        | { error: string }

      if (!res.ok || "error" in json) {
        const msg = "error" in json ? json.error : `HTTP ${res.status}`
        setState({ kind: "error", message: msg })
        toast.error(msg)
        return
      }

      if (json.warning) toast.warning(json.warning)
      setState({ kind: "result", transcript: json.transcript, parsed: json.parsed })
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error de red."
      setState({ kind: "error", message: msg })
      toast.error(msg)
    }
  }

  function apply() {
    if (state.kind !== "result") return
    // Strip null fields so the parent only sees confident extractions.
    const clean: VoiceIntakeFields = {}
    for (const [k, v] of Object.entries(state.parsed)) {
      if (v !== null && v !== undefined) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (clean as any)[k] = v
      }
    }
    onApply(clean)
    setState({ kind: "idle" })
    toast.success("Aplicamos los campos detectados al formulario.")
  }

  function discard() { setState({ kind: "idle" }) }

  // ── UI states ──────────────────────────────────────────────────
  const isBusy = state.kind === "recording" || state.kind === "uploading" || state.kind === "permission"
  const showDialog = state.kind === "result"

  return (
    <>
      <Button
        type="button"
        variant={state.kind === "recording" ? "destructive" : "outline"}
        size="sm"
        onClick={state.kind === "recording" ? stop : start}
        disabled={state.kind === "uploading" || state.kind === "permission"}
        className={cn("gap-2", className)}
      >
        {state.kind === "recording" ? (
          <>
            <StopIcon className="h-4 w-4" />
            Detener · {formatTime(state.elapsed)}
            <span className="ml-1 inline-block h-2 w-2 rounded-full bg-white animate-pulse" />
          </>
        ) : state.kind === "uploading" ? (
          <>
            <ArrowPathIcon className="h-4 w-4 animate-spin" />
            Procesando…
          </>
        ) : state.kind === "permission" ? (
          <>
            <ArrowPathIcon className="h-4 w-4 animate-spin" />
            Pidiendo permiso…
          </>
        ) : (
          <>
            <MicrophoneIcon className="h-4 w-4" />
            Dictar datos
          </>
        )}
      </Button>

      {/* Result preview — agent reviews transcript + parsed fields
          before applying anything to the form. */}
      <Dialog open={showDialog} onOpenChange={(o) => { if (!o) discard() }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircleIcon className="h-5 w-5 text-success" />
              Detectamos estos campos
            </DialogTitle>
            <DialogDescription>
              Revisá lo que el sistema entendió. Al aplicar, vamos a llenar
              los campos del formulario — podés ajustar cualquier valor
              después.
            </DialogDescription>
          </DialogHeader>

          {state.kind === "result" && (
            <div className="space-y-(--spacing-block) max-h-[60vh] overflow-y-auto">
              {/* Transcript */}
              <section className="space-y-1.5">
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                  Transcripción
                </p>
                <p className="text-sm text-foreground/80 leading-relaxed bg-muted/40 rounded-lg p-3">
                  “{state.transcript}”
                </p>
              </section>

              {/* Parsed preview */}
              <section className="space-y-1.5">
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                  Campos detectados
                </p>
                <ParsedPreview fields={state.parsed} />
              </section>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={discard}>Descartar</Button>
            <Button onClick={apply} className="gap-2">
              <CheckCircleIcon className="h-4 w-4" />
              Aplicar al formulario
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

// ── Sub-components ─────────────────────────────────────────────────
function ParsedPreview({ fields }: { fields: VoiceIntakeFields }) {
  const rows = pairsForDisplay(fields)
  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground italic">
        No detectamos campos claros. Probá dictando con más detalle (tipo,
        zona, precio, habitaciones).
      </p>
    )
  }
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
      {rows.map(([label, value]) => (
        <div key={label} className="flex flex-col gap-0.5">
          <span className="text-[11px] text-muted-foreground">{label}</span>
          <span className="font-medium truncate" title={String(value)}>{String(value)}</span>
        </div>
      ))}
    </div>
  )
}

// ── Helpers ────────────────────────────────────────────────────────
function formatTime(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${String(s).padStart(2, "0")}`
}

function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined
  for (const t of [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg;codecs=opus",
  ]) {
    if (MediaRecorder.isTypeSupported(t)) return t
  }
  return undefined
}

function extFor(mime: string): string {
  const m = mime.toLowerCase()
  if (m.includes("webm")) return "webm"
  if (m.includes("mp4"))  return "mp4"
  if (m.includes("ogg"))  return "ogg"
  return "webm"
}

const TYPE_LABEL: Record<NonNullable<VoiceIntakeFields["property_type"]>, string> = {
  apartment: "Apartamento", house: "Casa", land: "Terreno",
  commercial: "Comercial",  office: "Oficina", warehouse: "Bodega",
}
const LISTING_LABEL: Record<NonNullable<VoiceIntakeFields["listing_type"]>, string> = {
  sale: "Venta", rent: "Alquiler",
}

function pairsForDisplay(f: VoiceIntakeFields): Array<[string, string | number | boolean]> {
  const rows: Array<[string, string | number | boolean]> = []
  if (f.title)          rows.push(["Título", f.title])
  if (f.property_type)  rows.push(["Tipo", TYPE_LABEL[f.property_type]])
  if (f.listing_type)   rows.push(["Operación", LISTING_LABEL[f.listing_type]])
  if (f.price != null)  rows.push(["Precio", `${f.currency ?? ""} ${f.price.toLocaleString("en-US")}`.trim()])
  if (f.bedrooms != null)       rows.push(["Habitaciones", f.bedrooms])
  if (f.bathrooms != null)      rows.push(["Baños", f.bathrooms])
  if (f.area_sqm != null)       rows.push(["Área (m²)", f.area_sqm])
  if (f.parking_spaces != null) rows.push(["Parqueos", f.parking_spaces])
  if (f.floor != null)          rows.push(["Piso", f.floor])
  if (f.is_furnished != null)   rows.push(["Amueblado", f.is_furnished ? "Sí" : "No"])
  if (f.public_address)         rows.push(["Zona / dirección", f.public_address])
  if (f.amenities && f.amenities.length > 0) {
    rows.push(["Amenidades", f.amenities.join(", ")])
  }
  if (f.description)    rows.push(["Descripción", `${f.description.slice(0, 80)}${f.description.length > 80 ? "…" : ""}`])
  return rows
}

// Badge import is referenced for future variant rendering (kept here
// so the import doesn't tree-shake away on rebuilds).
void Badge
