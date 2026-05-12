"use client"

import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ArrowRightOnRectangleIcon as LogOut, Cog6ToothIcon as Settings, UserIcon as User } from "@heroicons/react/24/outline"
import { isAdminRole, getRoleLabelEs } from "@/lib/roles"
import type { Profile } from "@/types"

interface TopbarProps {
  profile: Profile
}

export function Topbar({ profile }: TopbarProps) {
  const router  = useRouter()
  const supabase = createClient()

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push("/login")
    router.refresh()
  }

  const initials = profile.full_name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()

  return (
    <header className="h-16 border-b bg-background flex items-center justify-between px-6 sticky top-0 z-30">
      {/* Left — page title placeholder (overridden by page) */}
      <div id="topbar-title" />

      {/* Right — user menu */}
      <DropdownMenu>
        <DropdownMenuTrigger className="flex items-center gap-2 outline-none">
          <Avatar className="h-8 w-8">
            <AvatarImage src={profile.avatar_url ?? undefined} alt={profile.full_name} />
            <AvatarFallback className="text-xs">{initials}</AvatarFallback>
          </Avatar>
          <span className="hidden sm:block text-sm font-medium">{profile.full_name}</span>
          <Badge
            variant={isAdminRole(profile.role) ? "default" : "secondary"}
            className="hidden sm:inline-flex text-xs"
          >
            {getRoleLabelEs(profile.role)}
          </Badge>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuLabel className="text-xs text-muted-foreground font-normal truncate">
            {profile.email}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => window.open(`/agents/${profile.slug}`, "_blank", "noopener,noreferrer")}>
            <User className="h-4 w-4 mr-2" />
            Public profile
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => router.push("/settings")}>
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleSignOut} className="text-destructive focus:text-destructive">
            <LogOut className="h-4 w-4 mr-2" />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  )
}
