import {
  ArrowTrendingUpIcon,
  EyeIcon,
  HomeModernIcon,
  GlobeAltIcon,
} from "@heroicons/react/24/outline"
import { EasyrentLogo } from "@/components/shared/easyrent-logo"
import { cn } from "@/lib/utils"

/**
 * Right-side scene for `<AuthShell>`. A soft brand-tinted canvas with
 * three layered cards that fade-in on mount via CSS keyframes:
 *
 *   ┌──────────────────────────────────────────┐
 *   │                        ┌──┐  ← brand logo │
 *   │                        └──┘                │
 *   │   ┌─────────────────────────────┐         │
 *   │   │  Dashboard preview          │         │
 *   │   │  KPIs · chart · listing row │         │
 *   │   └─────────────────────────────┘         │
 *   │     ┌────────────────────┐                │
 *   │     │  Floating KPI       │                │
 *   │     └────────────────────┘                │
 *   └──────────────────────────────────────────┘
 *
 * Pure CSS animations (see `animate-auth-*` in globals.css) — no
 * client JS required, so the cards fade in even before hydration
 * and we sidestep motion/react's quirks inside an aria-hidden tree.
 */
export function AuthFeatureShowcase() {
  return (
    <div className="relative h-full w-full overflow-hidden bg-primary/10 flex items-center justify-center px-12 py-16">
      <div
        className="absolute -top-32 -right-24 w-[420px] h-[420px] rounded-full blur-3xl pointer-events-none"
        style={{ background: "radial-gradient(circle, var(--primary) 0%, transparent 60%)" }}
        aria-hidden
      />
      <div
        className="absolute -bottom-40 -left-20 w-[480px] h-[480px] rounded-full blur-3xl pointer-events-none opacity-60"
        style={{ background: "radial-gradient(circle, var(--editorial) 0%, transparent 60%)" }}
        aria-hidden
      />

      {/* Composition anchor — dashboard flows in normal layout so the
          composition's centroid is its own center; badge + KPI overlap
          at corners relative to it. */}
      <div className="relative w-full max-w-xl">
        {/* Brand logo badge — top-right corner. */}
        <div className="absolute -top-10 -right-6 z-30 animate-auth-badge">
          <div className="h-16 w-20 rounded-2xl bg-card shadow-xl ring-1 ring-foreground/5 flex items-center justify-center">
            <EasyrentLogo className="h-3 w-auto text-foreground" />
          </div>
        </div>

        {/* Main dashboard preview. */}
        <div className="relative z-10 animate-auth-dashboard">
          <DashboardPreviewCard />
        </div>

        {/* Floating KPI — bottom-left, overlapping the dashboard. */}
        <div className="absolute -bottom-12 -left-10 z-20 w-[240px] animate-auth-kpi">
          <div className="rounded-2xl bg-card shadow-xl ring-1 ring-foreground/5 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-medium">
                Visitas (7d)
              </p>
              <ArrowTrendingUpIcon className="h-4 w-4 text-success" />
            </div>
            <p className="font-numeric tabular-nums font-bold text-2xl leading-none">
              18,200
            </p>
            <div className="flex items-center gap-1 text-[11px]">
              <span className="text-success font-numeric font-medium">↑ 10.2%</span>
              <span className="text-muted-foreground">vs semana pasada</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Dashboard preview card ─────────────────────────────────────────
function DashboardPreviewCard() {
  return (
    <div className="rounded-2xl bg-card shadow-2xl ring-1 ring-foreground/5 overflow-hidden">
      {/* Window chrome row */}
      <div className="flex items-center gap-1.5 px-4 py-3 border-b bg-muted/30">
        <span className="h-2.5 w-2.5 rounded-full bg-foreground/15" />
        <span className="h-2.5 w-2.5 rounded-full bg-foreground/15" />
        <span className="h-2.5 w-2.5 rounded-full bg-foreground/15" />
        <span className="ml-3 text-[10px] text-muted-foreground font-numeric truncate">
          easyrent.cr/dashboard
        </span>
      </div>

      <div className="flex">
        <aside className="w-28 shrink-0 border-r bg-muted/20 py-3 px-2 space-y-1.5">
          <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-md bg-foreground text-background">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            <span className="text-[10px] font-medium">Panel</span>
          </div>
          {["Propiedades", "Leads", "Reportes", "Blog"].map((label) => (
            <div key={label} className="flex items-center gap-1.5 px-2 py-1.5 rounded-md">
              <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/30" />
              <span className="text-[10px] text-muted-foreground">{label}</span>
            </div>
          ))}
        </aside>

        <div className="flex-1 min-w-0 p-4 space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <MiniKpi label="Propiedades" value="124" />
            <MiniKpi label="Leads" value="47" trend="up" />
            <MiniKpi label="Captaciones" value="9" highlight />
          </div>

          <div className="rounded-lg bg-muted/30 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-medium">
                Visitas mensuales
              </p>
              <p className="text-[10px] text-muted-foreground font-numeric">2026</p>
            </div>
            <BarChart />
          </div>

          <div className="rounded-lg border bg-card p-2.5 flex items-center gap-2.5">
            <div className="h-10 w-12 rounded-md bg-gradient-to-br from-primary/30 to-editorial/20 shrink-0 flex items-center justify-center">
              <HomeModernIcon className="h-4 w-4 text-foreground/60" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold leading-tight truncate">
                Apartamento en Escazú
              </p>
              <p className="text-[10px] text-muted-foreground font-numeric">
                $1,500/mes · 95 m²
              </p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-[10px] font-medium text-success">↑ Top hoy</p>
              <p className="text-[10px] text-muted-foreground font-numeric">183 vistas</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function MiniKpi({
  label, value, trend, highlight,
}: {
  label:      string
  value:      string
  trend?:     "up" | "down"
  highlight?: boolean
}) {
  return (
    <div
      className={cn(
        "rounded-lg px-2.5 py-2 space-y-1",
        highlight ? "bg-primary/20 ring-1 ring-primary/40" : "bg-muted/30",
      )}
    >
      <div className="flex items-center justify-between">
        <p className="text-[9px] uppercase tracking-[0.16em] text-muted-foreground font-medium truncate">
          {label}
        </p>
        {trend === "up" && <EyeIcon className="h-2.5 w-2.5 text-success shrink-0" />}
        {highlight && <GlobeAltIcon className="h-2.5 w-2.5 text-foreground shrink-0" />}
      </div>
      <p className="font-numeric tabular-nums font-bold text-base leading-none">
        {value}
      </p>
    </div>
  )
}

function BarChart() {
  const heights = [40, 55, 38, 62, 70, 58, 75, 82, 70, 88, 95, 78]
  const months = ["E", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"]
  return (
    <div className="space-y-1.5">
      <div className="flex items-end gap-1 h-16">
        {heights.map((h, i) => (
          <div
            key={i}
            className={cn(
              "flex-1 rounded-t-sm",
              i === 10 ? "bg-foreground" : "bg-foreground/15",
            )}
            style={{ height: `${h}%` }}
          />
        ))}
      </div>
      <div className="flex items-end gap-1">
        {months.map((m, i) => (
          <span
            key={i}
            className="flex-1 text-center text-[8px] text-muted-foreground font-numeric"
          >
            {m}
          </span>
        ))}
      </div>
    </div>
  )
}
