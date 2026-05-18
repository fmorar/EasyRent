import { ChatBubbleLeftEllipsisIcon } from "@heroicons/react/24/outline"

/**
 * Right-pane content for /conversations when no specific thread is
 * selected. Desktop-only — on mobile this route renders the LIST
 * pane full-width (the empty state never shows).
 */
export function ChatEmptyState() {
  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="text-center max-w-sm">
        <div className="size-12 mx-auto rounded-full bg-muted flex items-center justify-center mb-4">
          <ChatBubbleLeftEllipsisIcon className="size-6 text-muted-foreground" />
        </div>
        <p className="text-base font-medium">Seleccioná una conversación</p>
        <p className="text-sm text-muted-foreground mt-1">
          Cliqueá una de la lista para ver el thread completo, el perfil del lead, y responder manualmente si hace falta.
        </p>
      </div>
    </div>
  )
}
