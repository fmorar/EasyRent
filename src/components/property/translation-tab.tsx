"use client"

import { useState, useTransition, useEffect, useRef } from "react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import { RichTextEditor } from "@/components/ui/rich-text-editor"
import { Alert } from "@/components/ui/alert"
import {
  generatePropertyTranslation,
  regeneratePropertyTranslation,
  updatePropertyTranslation,
  markTranslationAsReviewed,
  type PropertyTranslation,
} from "@/lib/actions/translation.actions"
import { aiRewriteDescription } from "@/lib/actions/description.actions"
import type { DescriptionContext } from "@/lib/ai/rewrite-description"
import {
  ArrowPathIcon,
  SparklesIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
} from "@heroicons/react/24/outline"
import { CheckCircleIcon as CheckCircleSolid } from "@heroicons/react/24/solid"

interface Props {
  propertyId:       string
  locale:           string
  translation:      PropertyTranslation | null
  propertyContext?: Omit<DescriptionContext, "current_description" | "locale"> & { source_description?: string | null }
  onContentChange?: (fields: { title: string; description: string }) => void
}

const STATUS_CONFIG = {
  pending:          { label: "Pending",       variant: "secondary" as const, icon: ExclamationCircleIcon },
  auto_translated:  { label: "AI Translated", variant: "default"   as const, icon: SparklesIcon          },
  needs_review:     { label: "Needs Review",  variant: "outline"   as const, icon: ExclamationCircleIcon },
  reviewed:         { label: "Reviewed",      variant: "default"   as const, icon: CheckCircleSolid      },
}

export function TranslationTab({ propertyId, locale, translation: initial, propertyContext, onContentChange }: Props) {
  const [translation, setTranslation] = useState<PropertyTranslation | null>(initial)
  const [isPending, startTransition]  = useTransition()
  const [error, setError]             = useState<string | null>(null)
  const [saved, setSaved]             = useState(false)

  // Local editable state
  const [title,           setTitle]           = useState(translation?.title           ?? "")
  const [description,     setDescription]     = useState(translation?.description     ?? "")
  const [publicAddress,   setPublicAddress]   = useState(translation?.public_address  ?? "")
  const [seoTitle,        setSeoTitle]        = useState(translation?.seo_title       ?? "")
  const [seoDescription,  setSeoDescription]  = useState(translation?.seo_description ?? "")

  // Notify parent of live content changes (for preview)
  const [, startNotify] = useTransition()
  useEffect(() => {
    startNotify(() => onContentChange?.({ title, description }))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, description])

  // Auto-generate on first reveal when the property has no translation
  // yet. Without this, toggling "Mostrar inglés" just shows empty
  // fields and the EN public/unbranded view stays stuck on the ES
  // fallback — the agent has to remember to also click "Generate
  // with AI", which nobody does. We fire once per mount; a stable
  // ref prevents StrictMode double-invocations and parent re-renders
  // from triggering a second call mid-flight.
  const autoFiredRef = useRef(false)
  useEffect(() => {
    if (autoFiredRef.current) return
    if (initial) return
    autoFiredRef.current = true
    handleGenerate()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleGenerate = () => {
    setError(null)
    startTransition(async () => {
      const action = translation
        ? regeneratePropertyTranslation
        : generatePropertyTranslation

      const result = await action(propertyId, locale)
      if (!result.success) {
        setError(result.error ?? "Translation failed")
        toast.error(result.error ?? "Error al generar traducción")
        return
      }
      toast.success(translation ? "Traducción regenerada" : "Traducción generada")
      const t = result.data!
      setTranslation(t)
      setTitle(t.title           ?? "")
      setDescription(t.description     ?? "")
      setPublicAddress(t.public_address  ?? "")
      setSeoTitle(t.seo_title       ?? "")
      setSeoDescription(t.seo_description ?? "")
    })
  }

  const handleSave = () => {
    setError(null)
    setSaved(false)
    startTransition(async () => {
      const result = await updatePropertyTranslation(propertyId, locale, {
        title,
        description,
        public_address:  publicAddress,
        seo_title:       seoTitle,
        seo_description: seoDescription,
      })
      if (!result.success) {
        setError(result.error ?? "Save failed")
        return
      }
      setTranslation(result.data!)
      setSaved(true)
    })
  }

  const handleMarkReviewed = () => {
    setError(null)
    startTransition(async () => {
      const result = await markTranslationAsReviewed(propertyId, locale)
      if (!result.success) {
        setError(result.error ?? "Failed to mark as reviewed")
        toast.error(result.error ?? "Error al marcar como revisado")
        return
      }
      toast.success("Marcado como revisado")
      setTranslation(result.data!)
    })
  }

  // ── AI description rewrite (English) ─────────────────────────────
  async function handleAiRewriteDescription(currentHtml: string): Promise<string | null> {
    const result = await aiRewriteDescription({
      ...propertyContext,
      current_description: currentHtml,
      // Pass the Spanish description as source reference
      source_description:  propertyContext?.source_description ?? undefined,
      locale,
    })
    if (result.success && result.data) {
      // Mark as needing review since content changed
      setTranslation((prev) => prev ? { ...prev, status: "needs_review" } : prev)
    }
    return result.success ? result.data : null
  }

  const status    = translation?.status ?? "pending"
  const statusCfg = STATUS_CONFIG[status]
  const StatusIcon = statusCfg.icon

  return (
    <div className="space-y-6">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Status:</span>
          <Badge variant={statusCfg.variant} className="flex items-center gap-1">
            <StatusIcon className="h-3 w-3" />
            {statusCfg.label}
          </Badge>
          {translation?.source_hash && (
            <span className="text-xs text-muted-foreground font-mono">
              #{translation.source_hash.slice(0, 8)}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {translation && status !== "reviewed" && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleMarkReviewed}
              disabled={isPending}
            >
              <CheckCircleIcon className="h-4 w-4 mr-1" />
              Mark reviewed
            </Button>
          )}
          <Button
            size="sm"
            onClick={handleGenerate}
            disabled={isPending}
          >
            {isPending ? (
              <ArrowPathIcon className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <SparklesIcon className="h-4 w-4 mr-1" />
            )}
            {translation ? "Regenerate" : "Generate with AI"}
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <p className="text-sm">{error}</p>
        </Alert>
      )}

      {saved && (
        <p className="flex items-center gap-1.5 text-xs text-success">
          <span>✓</span> Traducción guardada
        </p>
      )}

      {!translation && !isPending && (
        <div className="border rounded-lg p-8 text-center text-muted-foreground text-sm">
          Sin traducción aún. Haz clic en &ldquo;Generar con IA&rdquo; para crearla automáticamente.
        </div>
      )}

      {(translation || isPending) && (
        <div className="space-y-5">
          <div className="space-y-1.5">
            <Label>Título</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={handleSave}
              disabled={isPending}
              placeholder="Título traducido"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Descripción</Label>
            <RichTextEditor
              value={description}
              onChange={setDescription}
              onBlur={handleSave}
              aiRewrite={propertyContext ? handleAiRewriteDescription : undefined}
              placeholder="Translated description…"
              disabled={isPending}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Zona / Dirección</Label>
            <Input
              value={publicAddress}
              onChange={(e) => setPublicAddress(e.target.value)}
              onBlur={handleSave}
              disabled={isPending}
              placeholder="Barrio o zona traducida"
            />
          </div>

          <Separator />

          <div className="space-y-4">
            <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">SEO</p>

            <div className="space-y-1.5">
              <Label>Título SEO <span className="text-muted-foreground font-normal">(50–60 chars)</span></Label>
              <Input
                value={seoTitle}
                onChange={(e) => setSeoTitle(e.target.value)}
                onBlur={handleSave}
                disabled={isPending}
                maxLength={70}
              />
              <p className="text-xs text-muted-foreground text-right">{seoTitle.length}/70</p>
            </div>

            <div className="space-y-1.5">
              <Label>Meta descripción <span className="text-muted-foreground font-normal">(150–160 chars)</span></Label>
              <Textarea
                value={seoDescription}
                onChange={(e) => setSeoDescription(e.target.value)}
                onBlur={handleSave}
                disabled={isPending}
                rows={3}
                maxLength={200}
              />
              <p className="text-xs text-muted-foreground text-right">{seoDescription.length}/200</p>
            </div>
          </div>

          {translation?.highlights && translation.highlights.length > 0 && (
            <div className="space-y-2">
              <Label>AI Highlights</Label>
              <ul className="text-sm text-muted-foreground space-y-1 pl-4 list-disc">
                {translation.highlights.map((h, i) => (
                  <li key={i}>{h}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Auto-saves on blur — no explicit save button needed */}
        </div>
      )}
    </div>
  )
}
