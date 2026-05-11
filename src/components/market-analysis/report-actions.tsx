"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import {
  EyeIcon, LinkIcon, ArrowDownTrayIcon, ArrowPathIcon,
  DocumentDuplicateIcon, TrashIcon, EllipsisVerticalIcon,
} from "@heroicons/react/24/outline"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import {
  duplicateMarketReport, deleteMarketReport,
} from "@/lib/actions/market-report.actions"
import type { MarketReport } from "@/types"

interface Props {
  report: Pick<MarketReport, "id" | "status" | "public_token" | "pdf_path">
}

export function ReportActions({ report }: Props) {
  const router  = useRouter()
  const t       = useTranslations("marketAnalysis.actions")
  const tDel    = useTranslations("marketAnalysis")
  const tCopy   = useTranslations("marketAnalysis")
  const [confirming, setConfirming] = useState(false)
  const [pending, startTransition]  = useTransition()

  const publicUrl = report.public_token
    ? (typeof window !== "undefined" ? `${window.location.origin}/reports/market/${report.public_token}` : "")
    : null

  async function copyLink() {
    if (!publicUrl) return
    try {
      await navigator.clipboard.writeText(publicUrl)
      toast.success(tCopy("linkCopiedToast"))
    } catch {
      toast.error(tCopy("linkCopyError"))
    }
  }

  function regenerate() {
    // Fire-and-forget: the run handler updates the report's status
    // to 'processing' as its first DB write. We don't await the full
    // response (it can take 30s+) — instead we toast immediately and
    // refresh shortly after, so the page reflects 'processing' and
    // its built-in auto-refresh polling takes over.
    toast.success(tCopy("regenStarted"))
    fetch(`/api/market-reports/${report.id}/run`, { method: "POST" })
      .then((res) => { if (!res.ok) toast.error(tCopy("regenError")) })
      .catch(() => toast.error(tCopy("regenError")))

    startTransition(() => {
      // Small delay so the run handler has time to flip status to
      // 'processing' before we re-render. Without this the refresh
      // can race the UPDATE and miss the new state.
      window.setTimeout(() => {
        router.push(`/market-analysis/${report.id}`)
        router.refresh()
      }, 600)
    })
  }

  async function duplicate() {
    const res = await duplicateMarketReport(report.id)
    if (res.success) {
      router.push(`/market-analysis/${res.data.id}`)
    } else {
      toast.error(res.error)
    }
  }

  async function confirmDelete() {
    const res = await deleteMarketReport(report.id)
    if (res.success) {
      setConfirming(false)
      router.refresh()
    } else {
      toast.error(res.error)
    }
  }

  const isCompleted = report.status === "completed"

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button className="h-8 w-8 inline-flex items-center justify-center rounded-md hover:bg-muted">
              <EllipsisVerticalIcon className="h-4 w-4" />
            </button>
          }
        />
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem render={<Link href={`/market-analysis/${report.id}`} />}>
            <EyeIcon className="h-4 w-4 mr-2" />
            {t("view")}
          </DropdownMenuItem>
          {isCompleted && (
            <>
              <DropdownMenuItem onClick={copyLink}>
                <LinkIcon className="h-4 w-4 mr-2" />
                {t("copyLink")}
              </DropdownMenuItem>
              {report.pdf_path && (
                <DropdownMenuItem render={<a href={`/api/market-reports/${report.id}/pdf`} target="_blank" rel="noopener noreferrer" />}>
                  <ArrowDownTrayIcon className="h-4 w-4 mr-2" />
                  {t("downloadPdf")}
                </DropdownMenuItem>
              )}
            </>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={regenerate} disabled={pending}>
            <ArrowPathIcon className="h-4 w-4 mr-2" />
            {t("regenerate")}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={duplicate}>
            <DocumentDuplicateIcon className="h-4 w-4 mr-2" />
            {t("duplicate")}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setConfirming(true)} className="text-destructive">
            <TrashIcon className="h-4 w-4 mr-2" />
            {t("delete")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tDel("deleteConfirmTitle")}</DialogTitle>
            <DialogDescription>{tDel("deleteConfirmBody")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirming(false)}>
              {tDel("deleteCancel")}
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              {tDel("deleteConfirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
