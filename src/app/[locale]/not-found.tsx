import Link from "next/link"
import { buttonVariants } from "@/components/ui/button"
import { ArrowRightIcon } from "@heroicons/react/24/outline"

/**
 * Per-locale 404 — used when a route under /[locale]/ doesn't match.
 * The non-locale fallback at /app/not-found.tsx covers other URLs.
 */
export default function NotFound() {
  return (
    <div className="min-h-[calc(100svh-4rem)] flex items-center justify-center px-6 py-20 bg-background">
      <div className="max-w-xl w-full text-center space-y-8">

        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Error 404
        </p>

        <h1
          className="font-numeric font-bold tracking-tight leading-none text-foreground"
          style={{
            fontSize: "clamp(6rem, 22vw, 12rem)",
            letterSpacing: "-0.05em",
          }}
        >
          404
        </h1>

        <div className="space-y-4">
          <h2 className="text-2xl sm:text-3xl font-heading font-bold tracking-tight">
            Esta página tomó otro camino
          </h2>
          <p className="text-base text-muted-foreground max-w-md mx-auto">
            No encontramos lo que buscabas. Puede que la propiedad o
            proyecto haya sido movido o ya no esté disponible.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3 pt-4">
          <Link
            href="/marketplace"
            className={buttonVariants({ size: "lg", variant: "outline" }) + " rounded-full"}
          >
            Ver listings
          </Link>
          <Link
            href="/"
            className={buttonVariants({ size: "lg" }) + " rounded-full"}
          >
            Volver al inicio
            <ArrowRightIcon className="h-4 w-4 ml-2" />
          </Link>
        </div>
      </div>
    </div>
  )
}
