"use client"

import Link from "next/link"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ChevronDownIcon } from "@heroicons/react/24/outline"

export type PublicProjectLink = {
  slug:  string
  title: string
}

interface Props {
  projects: PublicProjectLink[]
  /** Optional label override (defaults to "Proyectos"). */
  label?:   string
}

/**
 * Renders the public-nav "Projects" entry:
 *   - 0 projects → nothing
 *   - 1 project  → direct link
 *   - 2+         → dropdown
 */
export function PublicProjectsNav({ projects, label = "Proyectos" }: Props) {
  if (projects.length === 0) return null

  if (projects.length === 1) {
    return (
      <Link
        href={`/projects/${projects[0].slug}`}
        className="text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        {label}
      </Link>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors outline-none"
          >
            {label}
            <ChevronDownIcon className="h-3.5 w-3.5" />
          </button>
        }
      />
      <DropdownMenuContent align="end" className="min-w-56">
        {projects.map((p) => (
          <DropdownMenuItem
            key={p.slug}
            render={
              <Link href={`/projects/${p.slug}`} className="cursor-pointer">
                {p.title}
              </Link>
            }
          />
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
