"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/outline"
import { cn } from "@/lib/utils"

interface Props {
  currentPage: number
  totalPages:  number
}

export function MarketplacePagination({ currentPage, totalPages }: Props) {
  const router = useRouter()
  const params = useSearchParams()

  if (totalPages <= 1) return null

  const goTo = (page: number) => {
    if (page < 1 || page > totalPages) return
    const next = new URLSearchParams(params.toString())
    if (page === 1) next.delete("page")
    else            next.set("page", String(page))
    router.push(`?${next.toString()}`)
  }

  // Page number list with ellipses for long ranges
  const pages: (number | "…")[] = []
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i)
  } else {
    pages.push(1)
    if (currentPage > 3) pages.push("…")
    const start = Math.max(2, currentPage - 1)
    const end   = Math.min(totalPages - 1, currentPage + 1)
    for (let i = start; i <= end; i++) pages.push(i)
    if (currentPage < totalPages - 2) pages.push("…")
    pages.push(totalPages)
  }

  return (
    <div className="flex items-center justify-between gap-4 pt-4">
      <button
        type="button"
        onClick={() => goTo(currentPage - 1)}
        disabled={currentPage === 1}
        className="h-10 w-10 rounded-full border flex items-center justify-center text-foreground/70 hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        aria-label="Página anterior"
      >
        <ChevronLeftIcon className="h-4 w-4" />
      </button>

      <div className="flex items-center gap-1">
        {pages.map((p, i) =>
          p === "…" ? (
            <span key={`e-${i}`} className="px-2 text-muted-foreground text-sm">…</span>
          ) : (
            <button
              key={p}
              type="button"
              onClick={() => goTo(p)}
              className={cn(
                "h-9 min-w-9 px-3 rounded-md text-sm font-numeric font-medium transition-[background-color,color] duration-(--duration-state) ease-(--ease-out-quart)",
                p === currentPage
                  ? "bg-foreground text-background shadow-sm"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {p}
            </button>
          ),
        )}
      </div>

      <button
        type="button"
        onClick={() => goTo(currentPage + 1)}
        disabled={currentPage === totalPages}
        className="h-10 w-10 rounded-full border flex items-center justify-center text-foreground/70 hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        aria-label="Página siguiente"
      >
        <ChevronRightIcon className="h-4 w-4" />
      </button>
    </div>
  )
}
