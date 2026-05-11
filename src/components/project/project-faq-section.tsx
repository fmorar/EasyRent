"use client"

import { useState } from "react"
import { ChevronDownIcon } from "@heroicons/react/24/outline"
import { cn } from "@/lib/utils"

interface Faq { id: string; question: string; answer: string }

export function ProjectFaqSection({ faqs }: { faqs: Faq[] }) {
  const [openId, setOpenId] = useState<string | null>(null)

  if (faqs.length === 0) return null

  // Split into two columns on desktop (alternating left/right preserves order)
  const leftCol  = faqs.filter((_, i) => i % 2 === 0)
  const rightCol = faqs.filter((_, i) => i % 2 === 1)

  return (
    <div className="grid md:grid-cols-2 gap-3">
      {[leftCol, rightCol].map((col, ci) => (
        <div key={ci} className="space-y-3">
          {col.map((f) => {
            const isOpen = openId === f.id
            return (
              <div
                key={f.id}
                className="border rounded-xl bg-card overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => setOpenId(isOpen ? null : f.id)}
                  className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left hover:bg-muted/40 transition-colors"
                  aria-expanded={isOpen}
                >
                  <span className="text-sm font-medium">{f.question}</span>
                  <ChevronDownIcon
                    className={cn(
                      "h-4 w-4 shrink-0 transition-transform duration-200",
                      isOpen && "rotate-180",
                    )}
                  />
                </button>
                {isOpen && (
                  <div className="px-5 pb-4 pt-1 text-sm text-muted-foreground whitespace-pre-line">
                    {f.answer}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}
