import { EasyrentLogo } from "@/components/shared/easyrent-logo"

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-muted/40 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8 flex flex-col items-center gap-1">
          <EasyrentLogo className="h-7 w-auto text-foreground" />
          <p className="text-sm text-muted-foreground mt-1">Private Real Estate Operations</p>
        </div>
        {children}
      </div>
    </div>
  )
}
