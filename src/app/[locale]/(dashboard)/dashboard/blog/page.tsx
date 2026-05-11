// Admin blog index — list of posts the current user can manage.
// RLS already scopes the visible rows (admins see all, authors see
// their own); we just sort by most recent activity.

import Link from "next/link"
import { requireAuth } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { getTranslations } from "next-intl/server"
import { buttonVariants } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { EmptyState } from "@/components/shared/empty-state"
import { DocumentTextIcon, PlusIcon } from "@heroicons/react/24/outline"
import type { BlogPost } from "@/types"

const STATUS_LABEL: Record<BlogPost["status"], string> = {
  draft:     "Borrador",
  published: "Publicado",
  archived:  "Archivado",
}

const STATUS_BADGE: Record<BlogPost["status"], "default" | "secondary" | "outline"> = {
  draft:     "outline",
  published: "default",
  archived:  "secondary",
}

export default async function AdminBlogPage() {
  await requireAuth()
  const supabase = await createClient()
  const t        = await getTranslations("dashboardBlog")

  const { data: posts } = await supabase
    .from("blog_posts")
    .select("id, slug, title, status, locale, category, published_at, updated_at, cover_url, author_id")
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .limit(100) as { data:
      Pick<BlogPost,
        "id" | "slug" | "title" | "status" | "locale" | "category" |
        "published_at" | "updated_at" | "cover_url" | "author_id"
      >[] | null
    }

  return (
    <div className="space-y-(--spacing-section)">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl sm:text-3xl font-heading font-bold tracking-tight">
            {t("title")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{t("subtitle")}</p>
        </div>
        <Link
          href="/dashboard/blog/new"
          className={buttonVariants({ size: "sm" }) + " gap-2"}
        >
          <PlusIcon className="h-4 w-4" />
          {t("newPost")}
        </Link>
      </div>

      {!posts || posts.length === 0 ? (
        <EmptyState
          icon={<DocumentTextIcon className="h-6 w-6" />}
          title={t("emptyTitle")}
          message={t("emptyBody")}
          action={
            <Link href="/dashboard/blog/new" className={buttonVariants({ size: "sm" })}>
              {t("newPost")}
            </Link>
          }
        />
      ) : (
        <div className="border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-[0.18em] text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-3 font-medium">{t("colTitle")}</th>
                <th className="text-left px-4 py-3 font-medium hidden md:table-cell">{t("colCategory")}</th>
                <th className="text-left px-4 py-3 font-medium hidden md:table-cell">{t("colLocale")}</th>
                <th className="text-left px-4 py-3 font-medium">{t("colStatus")}</th>
                <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">{t("colUpdated")}</th>
              </tr>
            </thead>
            <tbody>
              {posts.map((p) => (
                <tr key={p.id} className="border-t hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <Link
                      href={`/dashboard/blog/${p.id}`}
                      className="font-medium hover:underline underline-offset-4 decoration-foreground/30"
                    >
                      {p.title}
                    </Link>
                    <p className="text-xs text-muted-foreground font-numeric mt-0.5">/{p.slug}</p>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-muted-foreground">
                    {p.category ?? "—"}
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-muted-foreground uppercase font-numeric text-xs">
                    {p.locale}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={STATUS_BADGE[p.status]} className="text-xs">
                      {STATUS_LABEL[p.status]}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell text-xs text-muted-foreground font-numeric">
                    {new Date(p.updated_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
