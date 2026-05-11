"use client"

import { useLocale } from "next-intl"
import { usePathname, useRouter } from "@/i18n/navigation"
import { useTransition } from "react"

const LOCALES = [
  { code: "es", label: "ES" },
  { code: "en", label: "EN" },
]

export function LocaleSwitcher() {
  const locale = useLocale()
  const pathname = usePathname()
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function switchLocale(next: string) {
    if (next === locale) return
    startTransition(() => {
      router.replace(pathname, { locale: next })
    })
  }

  return (
    <div className="flex items-center gap-0.5 rounded-md border bg-background p-0.5 text-xs font-medium">
      {LOCALES.map(({ code, label }) => (
        <button
          key={code}
          onClick={() => switchLocale(code)}
          disabled={isPending}
          className={[
            "rounded px-2 py-1 transition-colors",
            locale === code
              ? "bg-foreground text-background"
              : "text-muted-foreground hover:text-foreground",
          ].join(" ")}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
