"use client"

import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"

interface Section {
  id:    string
  label: string
}

interface Props {
  sections: Section[]
  /** ID of the scroll container the sections live inside. */
  scrollContainerId?: string
  className?:         string
}

/**
 * Sticky table of contents for long forms — highlights the section currently
 * in view and lets the user jump between them.
 *
 * Designed for the "scrollable column" pattern: pass the scroll container's
 * id so the IntersectionObserver watches the right viewport.
 */
export function FormToc({ sections, scrollContainerId, className }: Props) {
  const [activeId, setActiveId] = useState<string>(sections[0]?.id ?? "")

  useEffect(() => {
    if (sections.length === 0) return

    const root = scrollContainerId
      ? document.getElementById(scrollContainerId)
      : null

    const observer = new IntersectionObserver(
      (entries) => {
        // Pick the first entry currently intersecting near the top
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]
        if (visible) setActiveId(visible.target.id)
      },
      {
        root,
        rootMargin: "-20% 0px -60% 0px",
        threshold:  0,
      },
    )

    sections.forEach((s) => {
      const el = document.getElementById(s.id)
      if (el) observer.observe(el)
    })

    return () => observer.disconnect()
  }, [sections, scrollContainerId])

  function handleJump(e: React.MouseEvent<HTMLAnchorElement>, id: string) {
    e.preventDefault()
    const el = document.getElementById(id)
    if (!el) return
    el.scrollIntoView({ behavior: "smooth", block: "start" })
    setActiveId(id)
  }

  return (
    <nav
      aria-label="Secciones del formulario"
      className={cn("sticky top-6 space-y-1", className)}
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground mb-3 px-2">
        Secciones
      </p>
      {sections.map((s, i) => {
        const active = s.id === activeId
        return (
          <a
            key={s.id}
            href={`#${s.id}`}
            onClick={(e) => handleJump(e, s.id)}
            className={cn(
              "flex items-center gap-3 px-2 py-1.5 rounded-md text-sm transition-colors",
              active
                ? "text-foreground font-medium bg-muted/60"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/40",
            )}
          >
            <span
              className={cn(
                "h-5 w-5 shrink-0 rounded-full text-[10px] font-numeric font-semibold flex items-center justify-center",
                active
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground",
              )}
            >
              {i + 1}
            </span>
            <span className="truncate">{s.label}</span>
          </a>
        )
      })}
    </nav>
  )
}
