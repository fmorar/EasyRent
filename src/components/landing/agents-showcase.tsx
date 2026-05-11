import Link from "next/link"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ArrowRightIcon, CheckBadgeIcon } from "@heroicons/react/24/outline"

export interface AgentCard {
  id:         string
  full_name:  string
  slug:       string | null
  avatar_url: string | null
  /** Short bio (first sentence) — falls back to a generic byline. */
  bio:        string | null
  /** "Agente" / "Agencia" — derived from `role` server-side. */
  role_label: string
}

interface Props {
  agents: AgentCard[]
}

/**
 * "Meet the team" section. Renders the team's profile cards using
 * the Avatar primitive + a short bio. Each card links to the agent's
 * public profile (`/agents/[slug]`).
 *
 * The server is expected to limit/sort agents — this component just
 * renders what it gets.
 */
export function AgentsShowcase({ agents }: Props) {
  if (agents.length === 0) return null

  return (
    <section
      aria-label="Equipo de asesores"
      className="py-(--spacing-section) md:py-(--spacing-major)"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <header className="max-w-2xl mb-(--spacing-section)">
          <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            Quiénes te acompañan
          </p>
          <h2 className="mt-(--spacing-cluster) text-3xl sm:text-4xl lg:text-5xl font-heading font-bold tracking-tight leading-[1.05]">
            Conocé a{" "}
            <span className="text-foreground/40">tu asesor</span>
          </h2>
          <p className="mt-(--spacing-block) text-sm text-muted-foreground leading-relaxed max-w-md">
            Cada propiedad la atiende un asesor verificado, con experiencia local y disponibilidad para coordinar visitas y resolver dudas.
          </p>
        </header>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-(--spacing-block) sm:gap-(--spacing-section)">
          {agents.map((a) => {
            const initials = (a.full_name || "")
              .split(/\s+/)
              .map((s) => s[0])
              .filter(Boolean)
              .slice(0, 2)
              .join("")
              .toUpperCase()

            const card = (
              <article className="group rounded-2xl bg-background ring-1 ring-foreground/5 hover:ring-foreground/15 hover:shadow-md transition-all p-5 sm:p-6 h-full flex flex-col gap-4">
                <div className="flex items-center gap-4">
                  <Avatar className="h-14 w-14 ring-2 ring-background shadow-sm">
                    <AvatarImage src={a.avatar_url ?? undefined} alt={a.full_name} />
                    <AvatarFallback className="text-sm">{initials || "?"}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <p className="text-base font-heading font-semibold leading-tight truncate">
                      {a.full_name}
                    </p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <CheckBadgeIcon className="h-3.5 w-3.5 text-foreground shrink-0" />
                      {/* Agreement: "Agencia verificada" / "Agente verificado". */}
                      {a.role_label} {a.role_label === "Agencia" ? "verificada" : "verificado"}
                    </p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3 flex-1">
                  {a.bio ?? "Asesor verificado en la plataforma. Especializado en acompañamiento personalizado, validación de documentos y coordinación de visitas."}
                </p>
                <div className="flex items-center gap-1.5 text-sm font-medium text-foreground group-hover:gap-2 transition-all">
                  Ver perfil
                  <ArrowRightIcon className="h-3.5 w-3.5" />
                </div>
              </article>
            )

            return a.slug ? (
              <Link key={a.id} href={`/agents/${a.slug}`} className="block h-full">
                {card}
              </Link>
            ) : (
              <div key={a.id} className="block h-full">{card}</div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
