"use client"

import { InformationCircleIcon } from "@heroicons/react/24/outline"
import { Button } from "@/components/ui/button"
import {
  Sheet, SheetContent, SheetTrigger, SheetTitle, SheetDescription,
} from "@/components/ui/sheet"

interface Props {
  /** Server-rendered <LeadProfileCard> goes here. Passing it as
   *  children means the heavy data fetching stays on the server;
   *  this wrapper only adds the trigger UI + sheet chrome. */
  children: React.ReactNode
}

/**
 * Slide-over for the lead profile.
 *
 * Trigger lives in the chat header; content is the full profile
 * card (visit-gate progress, preferences, mentioned property,
 * everything the agent's prompt sees). Replaces the inline right-
 * rail from the previous detail page so the chat itself gets full
 * width on every screen.
 */
export function LeadProfileSheet({ children }: Props) {
  return (
    <Sheet>
      <SheetTrigger
        render={
          <Button variant="outline" size="sm">
            <InformationCircleIcon className="size-4" />
            Perfil del lead
          </Button>
        }
      />
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto px-5 py-6">
        <SheetTitle className="text-base font-heading font-semibold mb-1">
          Perfil del lead
        </SheetTitle>
        <SheetDescription className="sr-only">
          Información del lead, preferencias capturadas por el bot y propiedad mencionada.
        </SheetDescription>
        <div className="mt-4">
          {children}
        </div>
      </SheetContent>
    </Sheet>
  )
}
