import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"

interface AgentLike {
  full_name:  string
  avatar_url: string | null
}

interface Props {
  agent:    AgentLike | null
  /** Show the name next to the avatar (default: true). */
  withName?: boolean
  /** Size: "xs" (24px) / "sm" (28px) / "md" (32px) / "lg" (40px). */
  size?:    "xs" | "sm" | "md" | "lg"
  /** Optional secondary line shown below the name. */
  meta?:    React.ReactNode
  className?: string
}

const SIZES: Record<NonNullable<Props["size"]>, {
  avatar:     string
  text:       string
  initials:   string
  thumbWidth: number    // rendered px width — fed to Supabase image transform
}> = {
  xs: { avatar: "h-6 w-6",  text: "text-xs",  initials: "text-[9px]",  thumbWidth: 24 },
  sm: { avatar: "h-7 w-7",  text: "text-sm",  initials: "text-[10px]", thumbWidth: 28 },
  md: { avatar: "h-8 w-8",  text: "text-sm",  initials: "text-xs",     thumbWidth: 32 },
  lg: { avatar: "h-10 w-10",text: "text-sm",  initials: "text-sm",     thumbWidth: 40 },
}

/**
 * Avatar + name (+ optional meta line) chip for agent / user references.
 * Used everywhere we need to display a person inline.
 */
export function AgentChip({ agent, withName = true, size = "sm", meta, className }: Props) {
  if (!agent) return <span className="text-sm text-muted-foreground">—</span>

  const initials = agent.full_name
    .split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()
  const cls = SIZES[size]

  return (
    <div className={cn("flex items-center gap-2 min-w-0", className)}>
      <Avatar className={cn(cls.avatar, "shrink-0")}>
        <AvatarImage src={agent.avatar_url ?? undefined} thumbWidth={cls.thumbWidth} />
        <AvatarFallback className={cls.initials}>{initials}</AvatarFallback>
      </Avatar>
      {withName && (
        <div className="min-w-0">
          <p className={cn(cls.text, "font-medium truncate")}>{agent.full_name}</p>
          {meta && <div className="text-xs text-muted-foreground truncate">{meta}</div>}
        </div>
      )}
    </div>
  )
}
