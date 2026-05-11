"use client"

import { useTranslations } from "next-intl"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Alert } from "@/components/ui/alert"
import { PlusIcon, XMarkIcon, ExclamationTriangleIcon } from "@heroicons/react/24/outline"
import { detectSource } from "@/lib/market-analysis/source-detector"

interface Props {
  urls:     string[]
  onChange: (urls: string[]) => void
}

export function SourceUrlInputList({ urls, onChange }: Props) {
  const t = useTranslations("marketAnalysisForm")

  function update(i: number, value: string) {
    const next = [...urls]
    next[i] = value
    onChange(next)
  }
  function add() { onChange([...urls, ""]) }
  function remove(i: number) { onChange(urls.filter((_, idx) => idx !== i)) }

  return (
    <div className="space-y-(--spacing-cluster)">
      {urls.map((url, i) => {
        const trimmed = url.trim()
        const detection = trimmed.length > 0 ? detectSource(trimmed) : null
        return (
          <div key={i} className="space-y-(--spacing-tight)">
            <div className="flex items-center gap-2">
              <Input
                value={url}
                placeholder={t("urlPlaceholder")}
                onChange={(e) => update(i, e.target.value)}
                className="flex-1"
              />
              {urls.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => remove(i)}
                  aria-label={t("removeUrl")}
                >
                  <XMarkIcon className="h-4 w-4" />
                </Button>
              )}
            </div>
            {detection && detection.source_type === "unsupported" && (
              <Alert variant="destructive" className="text-xs py-2">
                <ExclamationTriangleIcon className="h-3.5 w-3.5 inline mr-1" />
                {t("unsupportedSource")}
              </Alert>
            )}
            {detection && detection.source_type !== "unsupported" && detection.is_broad && (
              <Alert variant="default" className="text-xs py-2 border-warning/30 bg-warning-soft text-foreground">
                <ExclamationTriangleIcon className="h-3.5 w-3.5 inline mr-1" />
                {t("broadSourceWarning")}
              </Alert>
            )}
            {detection && detection.source_type !== "unsupported" && (
              <p className="text-[11px] text-muted-foreground pl-1">
                <span className="font-medium">{detection.source_name}</span>
                {detection.detected_category && <> · {detection.detected_category}</>}
                {" · "}{detection.source_type === "listing_page" ? "listing" : "detail"}
              </p>
            )}
          </div>
        )
      })}

      <Button type="button" variant="outline" size="sm" onClick={add}>
        <PlusIcon className="h-4 w-4 mr-1.5" />
        {t("addUrl")}
      </Button>
    </div>
  )
}
