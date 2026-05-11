// Unbranded route group — no top nav, no marketplace links, no footer.
// Used by anonymous property links shared with third parties.
// The wrapping `[locale]/layout.tsx` still applies (provides next-intl
// context, fonts, and the html/body shell).

export default function UnbrandedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-background">
      <main>{children}</main>
    </div>
  )
}
