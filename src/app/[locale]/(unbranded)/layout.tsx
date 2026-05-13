// Unbranded route group — no top nav, no marketplace links, no footer.
// Used by anonymous property links shared with third parties.
// The wrapping `[locale]/layout.tsx` still applies (provides next-intl
// context, fonts, and the html/body shell).
//
// We keep ONE control in the corner: the language switcher. Anonymous
// recipients still need to read the listing in their own language,
// and dropping the toggle entirely (because there's no header) hid
// the only way to flip locale.

import { LocaleSwitcher } from "@/components/layout/locale-switcher"

export default function UnbrandedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-background">
      <div className="absolute top-3 right-3 sm:top-4 sm:right-4 z-10">
        <LocaleSwitcher />
      </div>
      <main>{children}</main>
    </div>
  )
}
