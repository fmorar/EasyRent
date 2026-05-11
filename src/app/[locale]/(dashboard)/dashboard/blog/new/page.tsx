import { requireAuth } from "@/lib/auth"
import { BlogPostForm } from "@/components/blog/blog-post-form"

export default async function NewBlogPostPage() {
  await requireAuth()
  return (
    <div className="mx-auto max-w-4xl">
      <BlogPostForm />
    </div>
  )
}
