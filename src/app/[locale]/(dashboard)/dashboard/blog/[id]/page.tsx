import { requireAuth } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { notFound } from "next/navigation"
import { BlogPostForm } from "@/components/blog/blog-post-form"
import type { BlogPost } from "@/types"

interface Props {
  params: Promise<{ id: string }>
}

export default async function EditBlogPostPage({ params }: Props) {
  await requireAuth()
  const { id } = await params
  const supabase = await createClient()

  const { data: post } = await supabase
    .from("blog_posts")
    .select("*")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle() as { data: BlogPost | null }

  if (!post) notFound()

  return (
    <div className="mx-auto max-w-4xl">
      <BlogPostForm post={post} />
    </div>
  )
}
