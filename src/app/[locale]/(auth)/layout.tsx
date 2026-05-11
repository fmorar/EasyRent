// Auth layout — neutral. Each child page defines its own visual
// shell because the surfaces are very different:
//   /login                — split-screen marketing photo + form
//   /invite/[token]       — centred Card on muted background
//
// Keeping the layout transparent lets each page own the chrome
// without us juggling overrides at the layout level.

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-background">
      {children}
    </div>
  )
}
