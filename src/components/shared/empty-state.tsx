import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface Props {
  icon?:    React.ReactNode
  title?:   string
  message:  string
  action?:  React.ReactNode
  /** Render outside a Card wrapper (when caller already has its own container). */
  bare?:    boolean
  className?: string
}

/**
 * Shared empty-state block — used when a list / table has no rows.
 * Wraps in a <Card> by default; pass `bare` to skip the wrapper.
 */
export function EmptyState({
  icon, title, message, action, bare, className,
}: Props) {
  const content = (
    <div className="text-center py-10 sm:py-12 px-6 space-y-3">
      {icon && (
        <div className="text-muted-foreground/40 flex justify-center">{icon}</div>
      )}
      {title && (
        <p className="text-sm font-medium">{title}</p>
      )}
      <p className="text-sm text-muted-foreground">{message}</p>
      {action && <div className="pt-2 flex justify-center">{action}</div>}
    </div>
  )

  if (bare) return <div className={className}>{content}</div>
  return <Card className={cn("border-dashed", className)}>{content}</Card>
}
