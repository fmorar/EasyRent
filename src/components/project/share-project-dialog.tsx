"use client"

import { useEffect, useState, useTransition } from "react"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { ShareDialog } from "@/components/sharing/share-dialog"
import { ShareLinkRow } from "@/components/sharing/share-link-row"
import {
  GlobeAltIcon,
  UsersIcon,
  UserIcon,
} from "@heroicons/react/24/outline"
import {
  listMyNetworkForProject,
  listProjectShares,
  shareProjectWith,
  unshareProjectWith,
  type NetworkAgent,
} from "@/lib/actions/project.actions"

interface Props {
  projectId:    string
  projectTitle: string
  projectSlug:  string
  isPublic:     boolean
  /** "owner" exposes collaborators panel; "public" only shows the public link. */
  mode?:        "owner" | "public"
  /** Optional trigger override. */
  children?:    React.ReactNode
}

export function ShareProjectDialog({
  projectId,
  projectTitle,
  projectSlug,
  isPublic,
  mode = "owner",
  children,
}: Props) {
  const t = useTranslations("shareDialog")
  const [open,    setOpen]    = useState(false)
  const [network, setNetwork] = useState<NetworkAgent[] | null>(null)
  const [shared,  setShared]  = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [, startTransition]   = useTransition()

  // Load network + current shares when dialog opens (owner mode only)
  useEffect(() => {
    if (!open || mode !== "owner") return
    let cancelled = false
    setLoading(true)
    Promise.all([
      listMyNetworkForProject(projectId),
      listProjectShares(projectId),
    ]).then(([networkRes, sharesRes]) => {
      if (cancelled) return
      if (networkRes.success) setNetwork(networkRes.data)
      else                    toast.error(networkRes.error)
      if (sharesRes.success)  setShared(new Set(sharesRes.data))
      else                    toast.error(sharesRes.error)
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [open, projectId, mode])

  function toggle(agent: NetworkAgent) {
    const isCurrentlyShared = shared.has(agent.id)
    setShared((prev) => {
      const next = new Set(prev)
      if (isCurrentlyShared) next.delete(agent.id)
      else                    next.add(agent.id)
      return next
    })

    startTransition(async () => {
      const result = isCurrentlyShared
        ? await unshareProjectWith(projectId, agent.id)
        : await shareProjectWith(projectId, agent.id)

      if (!result.success) {
        setShared((prev) => {
          const next = new Set(prev)
          if (isCurrentlyShared) next.add(agent.id)
          else                    next.delete(agent.id)
          return next
        })
        toast.error(result.error)
      } else {
        toast.success(
          isCurrentlyShared
            ? `Acceso retirado a ${agent.full_name}`
            : `Compartido con ${agent.full_name}`,
        )
      }
    })
  }

  // ── URL building ─────────────────────────────────────────────────
  const origin    = typeof window !== "undefined" ? window.location.origin : ""
  const publicUrl = isPublic ? `${origin}/projects/${projectSlug}` : null

  // ── Body composition ─────────────────────────────────────────────
  const body = (
    <div className="space-y-5">
      {/* Public branded link */}
      <ShareLinkRow
        icon={<GlobeAltIcon />}
        tone="success"
        title={t("publicLinkTitle")}
        description={publicUrl ? t("publicLinkProjectActive") : t("publicLinkProjectInactive")}
        url={publicUrl}
      />

      {mode === "owner" && (
        <>
          <Separator />

          {/* Collaborators */}
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <span className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0 bg-primary/15 text-foreground [&>svg]:h-4 [&>svg]:w-4">
                <UsersIcon />
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{t("collaboratorsTitle")}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {t("collaboratorsDescProject")}
                </p>
              </div>
            </div>

            <div className="pl-12 -mr-1 max-h-72 overflow-y-auto pr-1 divide-y">
              {loading && (
                <p className="py-6 text-sm text-muted-foreground text-center">
                  {t("loading")}
                </p>
              )}

              {!loading && network?.length === 0 && (
                <p className="py-6 text-sm text-muted-foreground text-center">
                  No hay nadie en tu red elegible para este proyecto.
                </p>
              )}

              {!loading && network?.map((agent) => {
                const isShared = shared.has(agent.id)
                return (
                  <button
                    key={agent.id}
                    type="button"
                    onClick={() => toggle(agent)}
                    className="w-full flex items-center gap-3 py-2.5 text-left hover:bg-muted/50 transition-colors -mx-2 px-2 rounded-md"
                  >
                    <div className="h-8 w-8 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
                      <UserIcon className="h-4 w-4 text-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{agent.full_name}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <Badge variant="outline" className="text-[10px] py-0 px-1.5">
                          {agent.relation === "upline" ? "me invitó" : "lo invité"}
                        </Badge>
                        {agent.email && (
                          <span className="text-xs text-muted-foreground truncate">
                            {agent.email}
                          </span>
                        )}
                      </div>
                    </div>
                    <span
                      className={[
                        "ml-2 text-xs font-medium px-2 py-1 rounded-md shrink-0",
                        isShared
                          ? "bg-primary/15 text-foreground"
                          : "bg-muted text-muted-foreground",
                      ].join(" ")}
                    >
                      {isShared ? "Compartido" : "Compartir"}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        </>
      )}
    </div>
  )

  return (
    <ShareDialog
      title={`Compartir "${projectTitle}"`}
      description={mode === "public" ? t("publicModeDesc") : undefined}
      open={open}
      onOpenChange={setOpen}
      body={body}
      maxWidth={mode === "public" ? "lg" : "3xl"}
    >
      {children}
    </ShareDialog>
  )
}
