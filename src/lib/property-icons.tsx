/**
 * Inline icons used for property specs (beds / baths / area).
 * Stroke width matches Heroicons outline icons so they sit consistently
 * next to other UI icons. Default size: h-4 w-4.
 */

interface IconProps { className?: string }

export function BedIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M3 19V8m0 0V6a2 2 0 012-2h14a2 2 0 012 2v2M3 8h18m0 0v11M3 14h18M7 11h4a1 1 0 011 1v2H6v-2a1 1 0 011-1z" />
    </svg>
  )
}

export function BathIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M4 12V7a3 3 0 016 0M3 12h18l-1 6H4l-1-6zM6 18l-1 3M18 18l1 3" />
    </svg>
  )
}

export function RulerIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M3 21l18-18m-3 6l-2-2m-2 4l-2-2m-2 4l-2-2m-2 4l-2-2" />
    </svg>
  )
}
