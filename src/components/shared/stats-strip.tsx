interface Stat {
  /** The big number / value (`+10`, `100%`, `1,250 m²`, etc.). */
  number: string
  /** Two-line uppercase label. Newline (`\n`) inserts a hard break;
   *  short labels wrap naturally without it. */
  label:  string
}

interface Props {
  stats: Stat[]
}

/**
 * Inline stats strip — pair of [BIG NUMBER] [SMALL UPPERCASE LABEL].
 * Shared between the landing's "TrustSignals" band and the project
 * page so both surfaces speak the same numeric language.
 *
 *   +10   AÑOS              +200   PROPIEDADES   …
 *         EN BIENES RAÍCES         VERIFICADAS
 *
 * Mobile: 2x2 grid. Desktop: 4 columns inline.
 */
export function StatsStrip({ stats }: Props) {
  if (!stats || stats.length === 0) return null

  // Tailwind doesn't compile `lg:grid-cols-{n}` from a runtime variable,
  // so we cap the inline columns at 4 (matching the design) and wrap
  // any extras to the next row. 1/2/3/4 stats render cleanly.
  const lgCols =
    stats.length === 1 ? "lg:grid-cols-1"
    : stats.length === 2 ? "lg:grid-cols-2"
    : stats.length === 3 ? "lg:grid-cols-3"
    : "lg:grid-cols-4"

  return (
    <dl className={`grid grid-cols-2 ${lgCols} gap-x-(--spacing-block) gap-y-(--spacing-section)`}>
      {stats.map((s) => (
        <div
          key={s.label}
          className="flex items-center gap-3 sm:gap-(--spacing-cluster)"
        >
          <dd
            className="font-heading font-bold tracking-tight text-foreground font-numeric tabular-nums leading-[0.95] shrink-0"
            style={{ fontSize: "clamp(2rem, 4.5vw, 3.75rem)", letterSpacing: "-0.03em" }}
          >
            {s.number}
          </dd>
          <dt className="text-[10px] sm:text-[11px] uppercase tracking-[0.18em] text-muted-foreground leading-[1.35] whitespace-pre-line max-w-[140px] sm:max-w-none">
            {s.label}
          </dt>
        </div>
      ))}
    </dl>
  )
}
