import {
  ShieldCheckIcon,
  KeyIcon,
  TruckIcon,
  FireIcon,
  UserGroupIcon,
  SparklesIcon,
  ArrowsUpDownIcon,
  BuildingOfficeIcon,
  ComputerDesktopIcon,
  EyeIcon,
  CheckIcon,
} from "@heroicons/react/24/outline"

/**
 * Maps a free-form amenity name (matches common Spanish names case-insensitively
 * with substring matching) to an appropriate icon.
 * Custom amenities the user typed in fall back to a generic check.
 */
export function getAmenityIcon(name: string, className = "h-4 w-4"): React.ReactNode {
  const n = name.trim().toLowerCase()

  // Heroicons matches
  if (n.includes("seguridad")     || n.includes("security"))     return <ShieldCheckIcon       className={className} />
  if (n.includes("acceso")        || n.includes("access"))       return <KeyIcon               className={className} />
  if (n.includes("parqueo")       || n.includes("parking")
   || n.includes("garage"))                                       return <TruckIcon             className={className} />
  if (n.includes("bbq")           || n.includes("asador")
   || n.includes("sauna"))                                        return <FireIcon              className={className} />
  if (n.includes("salón comunal") || n.includes("salon comunal")
   || n.includes("casa club")     || n.includes("clubhouse"))     return <UserGroupIcon         className={className} />
  if (n.includes("spa"))                                          return <SparklesIcon          className={className} />
  if (n.includes("ascensor")      || n.includes("elevator"))      return <ArrowsUpDownIcon      className={className} />
  if (n.includes("co-working")    || n.includes("coworking")
   || n.includes("oficina"))                                      return <ComputerDesktopIcon   className={className} />
  if (n.includes("vista"))                                        return <EyeIcon               className={className} />
  if (n.includes("recepción")     || n.includes("recepcion")
   || n.includes("lobby"))                                        return <BuildingOfficeIcon    className={className} />

  // Custom inline SVGs (no good heroicon match)
  if (n.includes("piscina") || n.includes("pool"))     return <PoolIcon       className={className} />
  if (n.includes("gimnasio") || n.includes("gym"))     return <GymIcon        className={className} />
  if (n.includes("área verde") || n.includes("area verde")
   || n.includes("jardín") || n.includes("jardin")
   || n.includes("verde"))                              return <TreeIcon       className={className} />
  if (n.includes("juegos") || n.includes("infantiles")
   || n.includes("playground"))                         return <PlaygroundIcon className={className} />
  if (n.includes("cancha") || n.includes("deport"))    return <SportsIcon     className={className} />
  if (n.includes("lavander"))                          return <LaundryIcon    className={className} />
  if (n.includes("pet"))                               return <PawIcon        className={className} />
  if (n.includes("playa") || n.includes("beach")
   || n.includes("mar"))                                return <WaveIcon       className={className} />
  if (n.includes("aire") || n.includes("a/c")
   || n.includes("ac"))                                 return <SnowflakeIcon  className={className} />

  // Fallback
  return <CheckIcon className={className} />
}

// ── Inline SVG icons (consistent stroke width with heroicons outline) ──

function PoolIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 18c1.5 0 1.5-1 3-1s1.5 1 3 1 1.5-1 3-1 1.5 1 3 1 1.5-1 3-1 1.5 1 3 1M7 14V6a3 3 0 016 0M7 10h6M17 14V6" />
    </svg>
  )
}

function GymIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 7v10M7 5v14M17 5v14M20 7v10M7 12h10" />
    </svg>
  )
}

function TreeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 21v-6m0 0c-3 0-5-2-5-5 0-1 .3-2 1-3-.7-.8-1-1.8-1-3 0-2 1.5-3 3-3 1 0 2 .5 2.5 1.5C13 1.5 14 1 15 1c1.5 0 3 1 3 3 0 1.2-.3 2.2-1 3 .7 1 1 2 1 3 0 3-2 5-5 5z" />
    </svg>
  )
}

function PlaygroundIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 21V8m0 0L12 3l7 5m-14 0v0M19 21V8M12 21v-7m-3-2h6" />
      <circle cx="12" cy="6" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  )
}

function SportsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <circle cx="12" cy="12" r="9" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 12h18M12 3v18M5 5l14 14M19 5L5 19" />
    </svg>
  )
}

function LaundryIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <circle cx="12" cy="14" r="4" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h2" />
    </svg>
  )
}

function PawIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 14a3 3 0 014-2 3 3 0 014 2c0 2-2 3-4 5-2-2-4-3-4-5z" />
      <circle cx="6" cy="9" r="1.5" />
      <circle cx="10" cy="6" r="1.5" />
      <circle cx="14" cy="6" r="1.5" />
      <circle cx="18" cy="9" r="1.5" />
    </svg>
  )
}

function WaveIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 8c2 0 2-2 4.5-2S10 8 12 8s2-2 4.5-2S19 8 21 8M3 14c2 0 2-2 4.5-2s2.5 2 4.5 2 2-2 4.5-2 2.5 2 4.5 2M3 20c2 0 2-2 4.5-2s2.5 2 4.5 2 2-2 4.5-2 2.5 2 4.5 2" />
    </svg>
  )
}

function SnowflakeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v18M3 12h18M5 5l14 14M19 5L5 19M9 6l3-3 3 3M9 18l3 3 3-3M6 9l-3 3 3 3M18 9l3 3-3 3" />
    </svg>
  )
}
