"use client"

import { useTranslations } from "next-intl"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  MapPinIcon,
  BuildingOffice2Icon,
  AcademicCapIcon,
  ShoppingBagIcon,
  HeartIcon,
  HomeModernIcon,
  TruckIcon,
  CakeIcon,
  BanknotesIcon,
  GlobeAltIcon,
} from "@heroicons/react/24/outline"
import type { SiteAnalysis } from "@/lib/market-analysis/site-analysis-service"

interface Props {
  site: SiteAnalysis | null | undefined
}

/**
 * Public-report card. Shows the deterministic site analysis derived
 * from OpenStreetMap (POIs, distances, walkability, environment).
 *
 * Layout (mobile-first):
 *   1. Walkability + environment chips
 *   2. Distances to key services (icon + label + distance)
 *   3. POI counts within 1 km
 *   4. Notable nearby places (when available)
 *   5. Coverage / data-source disclaimer
 *
 * When `site` is null/undefined we render a small "no disponible"
 * note so the report doesn't have a silent gap.
 */
export function SiteAnalysisCard({ site }: Props) {
  const t = useTranslations("marketReportPublic.site")

  if (!site) {
    return (
      <section className="space-y-3">
        <header className="space-y-1">
          <h2 className="text-base font-heading font-semibold">{t("title")}</h2>
          <p className="text-xs text-muted-foreground">{t("subtitle")}</p>
        </header>
        <Card className="bg-muted/30 border-dashed">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">{t("unavailable")}</p>
          </CardContent>
        </Card>
      </section>
    )
  }

  const tierLabel =
    site.walkability.tier === "high"   ? t("tierHigh")   :
    site.walkability.tier === "medium" ? t("tierMedium") : t("tierLow")

  const envLabel =
    site.environment === "commercial"        ? t("envCommercial") :
    site.environment === "residential_mixed" ? t("envMixed")      :
    site.environment === "residential_quiet" ? t("envQuiet")      : t("envUnknown")

  return (
    <section className="space-y-4">
      <header className="space-y-1">
        <h2 className="text-base font-heading font-semibold">{t("title")}</h2>
        <p className="text-xs text-muted-foreground">{t("subtitle")}</p>
      </header>

      {/* ── Walkability + environment chips ───────────────────── */}
      <div className="flex flex-wrap gap-2">
        <Badge
          className={
            site.walkability.tier === "high"   ? "bg-success-soft text-success border-success/20" :
            site.walkability.tier === "medium" ? "bg-warning-soft text-warning border-warning/20" :
                                                  "bg-muted text-muted-foreground"
          }
          variant="outline"
        >
          {t("walkability")}: {tierLabel}
          <span className="ml-1.5 font-numeric text-[10px]">({site.walkability.score}/100)</span>
        </Badge>
        <Badge variant="outline">{envLabel}</Badge>
      </div>

      {/* ── Distances to key services ─────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">{t("nearestHeading")}</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <NearestRow
            icon={<HeartIcon className="h-4 w-4" />}
            label={t("nearestHospital")}
            poi={site.nearest.hospital}
          />
          <NearestRow
            icon={<AcademicCapIcon className="h-4 w-4" />}
            label={t("nearestSchool")}
            poi={site.nearest.school}
          />
          <NearestRow
            icon={<ShoppingBagIcon className="h-4 w-4" />}
            label={t("nearestSupermarket")}
            poi={site.nearest.supermarket}
          />
          <NearestRow
            icon={<HomeModernIcon className="h-4 w-4" />}
            label={t("nearestPark")}
            poi={site.nearest.park}
          />
          <NearestRow
            icon={<TruckIcon className="h-4 w-4" />}
            label={t("nearestTransit")}
            poi={site.nearest.transit}
          />
          <NearestRow
            icon={<CakeIcon className="h-4 w-4" />}
            label={t("nearestRestaurant")}
            poi={site.nearest.restaurant}
          />
          <NearestRow
            icon={<BuildingOffice2Icon className="h-4 w-4" />}
            label={t("nearestPharmacy")}
            poi={site.nearest.pharmacy}
          />
          <NearestRow
            icon={<BanknotesIcon className="h-4 w-4" />}
            label={t("nearestBank")}
            poi={site.nearest.bank}
          />
          {site.nearest.main_road && (
            <NearestRow
              icon={<GlobeAltIcon className="h-4 w-4" />}
              label={t("nearestRoad")}
              poi={{
                name:       site.nearest.main_road.name,
                distance_m: site.nearest.main_road.distance_m,
              }}
            />
          )}
        </CardContent>
      </Card>

      {/* ── POI counts within 1 km ───────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">{t("countsHeading")}</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <CountTile label={t("countSupermarkets")} value={site.counts.r1km.supermarkets} />
          <CountTile label={t("countSchools")}      value={site.counts.r1km.schools} />
          <CountTile label={t("countParks")}        value={site.counts.r1km.parks} />
          <CountTile label={t("countRestaurants")}  value={site.counts.r1km.restaurants} />
          <CountTile label={t("countPharmacies")}   value={site.counts.r1km.pharmacies} />
          <CountTile label={t("countBanks")}        value={site.counts.r1km.banks} />
          <CountTile label={t("countTransit")}      value={site.counts.r1km.transit_stops} />
          <CountTile label={t("countMalls")}        value={site.counts.r1km.malls} />
        </CardContent>
      </Card>

      {/* ── Notable named landmarks ──────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">{t("landmarksHeading")}</CardTitle>
        </CardHeader>
        <CardContent>
          {site.landmarks.length === 0 ? (
            <p className="text-xs text-muted-foreground">{t("noLandmarks")}</p>
          ) : (
            <ul className="space-y-2">
              {site.landmarks.map((l, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <MapPinIcon className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0 flex items-baseline justify-between gap-2">
                    <span className="truncate">{l.name}</span>
                    <span className="font-numeric text-xs text-muted-foreground shrink-0">
                      {formatDistance(l.distance_m, t)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* ── Disclaimer ───────────────────────────────────────── */}
      <p className="text-[11px] text-muted-foreground leading-relaxed">
        {site.coverage_note ? `${site.coverage_note} ${t("disclaimer")}` : t("disclaimer")}
      </p>
    </section>
  )
}

// ── Sub-components ──────────────────────────────────────────────
function NearestRow({
  icon, label, poi,
}: {
  icon: React.ReactNode
  label: string
  poi?: { name: string; distance_m: number }
}) {
  const t = useTranslations("marketReportPublic.site")
  if (!poi) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <span className="text-muted-foreground">{icon}</span>
        <span className="text-muted-foreground">{label}</span>
        <span className="ml-auto text-xs text-muted-foreground">—</span>
      </div>
    )
  }
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-muted-foreground">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="truncate" title={poi.name}>{poi.name}</p>
      </div>
      <span className="font-numeric text-xs font-medium shrink-0">
        {formatDistance(poi.distance_m, t)}
      </span>
    </div>
  )
}

function CountTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-muted/40 px-3 py-2">
      <p className="font-numeric font-semibold text-lg leading-tight">{value}</p>
      <p className="text-[11px] text-muted-foreground leading-tight">{label}</p>
    </div>
  )
}

function formatDistance(meters: number, t: (k: string, v?: Record<string, string | number>) => string): string {
  if (meters < 1000) return t("metersShort", { m: meters })
  return t("kmShort", { km: (meters / 1000).toFixed(1) })
}
