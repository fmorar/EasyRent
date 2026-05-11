"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import {
  EyeIcon, LinkIcon, ArrowDownTrayIcon, ArrowPathIcon,
  TrashIcon, EllipsisVerticalIcon,
} from "@heroicons/react/24/outline"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { deletePerformanceReport } from "@/lib/actions/performance-report.actions"
import type { PropertyPerformanceReport } from "@/types"

interface Props {
  report: Pick<PropertyPerformanceReport, "id" | "status" | "public_token" | "pdf_path">
}

export function PerformanceReportActions({ report }: Props) {
  const router = useRouter()
  const t = useTranslations("performanceReports")

  const [confirming, setConfirming] = useState(false)
  const [pending, startTransition] = useTransition()

  const publicUrl = report.public_token && typeof window !== "undefined"
    ? `${window.location.origin}/reports/property-performance/${report.public_token}`
    : null

  async function copyLink() {
    if (!publicUrl) return
    try {
      await navigator.clipboard.writeText(publicUrl)
      toast.success(t("linkCopiedToast"))
    } catch { /* ignore */ }
  }

  function regenerate() {
    toast.success(t("regenStarted"))
    fetch(`/api/performance-reports/${report.id}/run`, { method: "POST" })
      .then((res) => { if (!res.ok) toast.error(t("regenError")) })
      .catch(() => toast.error(t("regenError")))
    startTransition(() => {
      window.setTimeout(() => {
        router.push(`/performance-reports/${report.id}`)
        router.refresh()
      }, 600)
    })
  }

  async function confirmDelete() {
    const res = await deletePerformanceReport(report.id)
    if (res.success) {
      setConfirming(false)
      router.refresh()
    } else {
      toast.error(res.error)
    }
  }

  const isActive = report.status === "active"

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button
              type="button"
              className="h-8 w-8 inline-flex items-center justify-center rounded-md hover:bg-muted"
              aria-label="Más acciones"
            >
              <EllipsisVerticalIcon className="h-4 w-4" />
            </button>
          }
        />
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem render={<Link href={`/performance-reports/${report.id}`} />}>
            <EyeIcon className="h-4 w-4 mr-2" />
            {t("actions.view")}
          </DropdownMenuItem>
          {isActive && (
            <>
              <DropdownMenuItem onClick={copyLink}>
                <LinkIcon className="h-4 w-4 mr-2" />
                {t("actions.copyLink")}
              </DropdownMenuItem>
              <DropdownMenuItem render={<a href={`/api/performance-reports/${report.id}/pdf`} target="_blank" rel="noopener noreferrer" />}>
                <ArrowDownTrayIcon className="h-4 w-4 mr-2" />
                {t("actions.downloadPdf")}
              </DropdownMenuItem>
            </>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={regenerate} disabled={pending}>
            <ArrowPathIcon className="h-4 w-4 mr-2" />
            {t("actions.regenerate")}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => setConfirming(true)}
            className="text-destructive focus:text-destructive"
          >
            <TrashIcon className="h-4 w-4 mr-2" />
            {t("actions.delete")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("deleteConfirmTitle")}</DialogTitle>
            <DialogDescription>{t("deleteConfirmBody")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirming(false)}>
              {t("deleteCancel")}
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              {t("deleteConfirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
