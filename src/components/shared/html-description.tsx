interface Props {
  /** HTML body of the description. We trust it because it comes from
   *  our own Tiptap editor / DB; never bind raw user input here. */
  html?:    string | null
  /** Section heading (caller passes localized copy). */
  heading?: string
  /** Reading-width strategy:
   *   - `"prose"`  — clamp to ~65ch (default; ideal for sidebars / narrow rails)
   *   - `"full"`   — let the parent container decide (use on wide editorial sections) */
  width?:   "prose" | "full"
  /** Optional body text size override. Defaults to `"sm"` (matches the
   *  property-page sidebar). Pass `"base"` on wider editorial layouts. */
  size?:    "sm" | "base"
}

/**
 * Editorial HTML description block — shared between the property and
 * project detail pages so the typography and prose styles match.
 *
 *   ─ Heading ───────────
 *   Long-form description rendered through the `.preview-prose`
 *   class (defined in `globals.css`) so list/heading styles inside
 *   the rich text behave consistently.
 *
 * Renders nothing when `html` is empty.
 */
export function HtmlDescription({
  html,
  heading = "Descripción",
  width   = "prose",
  size    = "sm",
}: Props) {
  const trimmed = (html ?? "").trim()
  if (!trimmed) return null

  const widthCls = width === "full" ? "" : "max-w-prose"
  const sizeCls  = size === "base" ? "text-base" : "text-sm"

  return (
    <section className="space-y-(--spacing-cluster)">
      <h2 className="text-lg font-heading font-semibold">{heading}</h2>
      <div
        className={`preview-prose ${sizeCls} text-muted-foreground leading-relaxed ${widthCls}`}
        dangerouslySetInnerHTML={{ __html: trimmed }}
      />
    </section>
  )
}
