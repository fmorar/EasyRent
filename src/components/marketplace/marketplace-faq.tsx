"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { ChevronDownIcon } from "@heroicons/react/24/outline"
import { cn } from "@/lib/utils"

const FAQ_KEYS = [
  ["q1Q", "q1A"],
  ["q2Q", "q2A"],
  ["q3Q", "q3A"],
  ["q4Q", "q4A"],
  ["q5Q", "q5A"],
  ["q6Q", "q6A"],
  ["q7Q", "q7A"],
  ["q8Q", "q8A"],
] as const

export function MarketplaceFaq() {
  const t = useTranslations("marketplace.faq")
  const [openIdx, setOpenIdx] = useState<number | null>(0)

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-(--spacing-section) md:py-(--spacing-major)">
      {/* Asymmetric 5/7 split — title gets less width, answers get the bulk. */}
      <div className="grid lg:grid-cols-12 gap-(--spacing-section) lg:gap-(--spacing-major)">
        <div className="lg:col-span-5 lg:sticky lg:top-24 lg:self-start">
          <h2
            className="font-heading font-bold tracking-tight leading-[1.02]"
            style={{ fontSize: "clamp(1.875rem, 5vw, 3.5rem)" }}
          >
            {t("title")}
          </h2>
          <p className="mt-(--spacing-block) text-base text-muted-foreground max-w-md leading-relaxed">
            {t("subtitle")}
          </p>
        </div>

        <div className="lg:col-span-7 space-y-1">
          {FAQ_KEYS.map(([qKey, aKey], idx) => {
            const isOpen = openIdx === idx
            return (
              <div key={qKey} className="border-b">
                <button
                  type="button"
                  onClick={() => setOpenIdx(isOpen ? null : idx)}
                  className="w-full flex items-center justify-between gap-4 py-4 text-left hover:text-foreground transition-colors"
                  aria-expanded={isOpen}
                >
                  <span className="text-sm font-medium pr-2">{t(qKey)}</span>
                  <ChevronDownIcon
                    className={cn(
                      "h-4 w-4 shrink-0 transition-transform duration-200 text-muted-foreground",
                      isOpen && "rotate-180",
                    )}
                  />
                </button>
                {isOpen && (
                  <p className="pb-5 text-sm text-muted-foreground leading-relaxed pr-8">
                    {t(aKey)}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
