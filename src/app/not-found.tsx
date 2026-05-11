import Link from "next/link"
import { buttonVariants } from "@/components/ui/button"
import { ArrowRightIcon } from "@heroicons/react/24/outline"

export default function NotFound() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <main className="flex-1 flex items-center justify-center px-6 py-20">
        <div className="max-w-xl w-full text-center space-y-8">

          {/* Eyebrow */}
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Error 404
          </p>

          {/* Big number */}
          <h1
            className="font-numeric font-bold tracking-tight leading-none"
            style={{
              fontSize: "clamp(6rem, 22vw, 12rem)",
              letterSpacing: "-0.05em",
            }}
          >
            404
          </h1>

          {/* Heading */}
          <div className="space-y-4">
            <h2 className="text-2xl sm:text-3xl font-heading font-bold tracking-tight">
              Esta página tomó otro camino
            </h2>
            <p className="text-base text-muted-foreground max-w-md mx-auto">
              No encontramos lo que buscabas. Puede que la propiedad o
              proyecto haya sido movido o ya no esté disponible.
            </p>
          </div>

          {/* CTAs */}
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
      </main>
    </div>
  )
}
