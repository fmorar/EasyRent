/**
 * Decorative band with oversized headline that intentionally overflows the
 * container. Mirrors the "FIND COMFORT, LIVE WITH ARUNA" treatment from the
 * reference design.
 */
export function MarketplaceBigBand({ headline }: { headline: string }) {
  return (
    <section className="border-y overflow-hidden py-(--spacing-section) md:py-(--spacing-major) bg-background">
      <h2
        className="font-heading font-bold tracking-tight text-foreground text-center whitespace-nowrap"
        style={{
          fontSize: "clamp(3rem, 13vw, 12rem)",
          lineHeight: 0.9,
          letterSpacing: "-0.04em",
        }}
      >
        {headline}
      </h2>
    </section>
  )
}
