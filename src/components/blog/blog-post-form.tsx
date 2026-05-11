"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import {
  ArrowLeftIcon,
  TrashIcon,
} from "@heroicons/react/24/outline"
import {
  createBlogPost,
  updateBlogPost,
  deleteBlogPost,
} from "@/lib/actions/blog.actions"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { FormSection } from "@/components/shared/form-section"
import { RichTextEditor } from "@/components/ui/rich-text-editor"
import { slugify } from "@/lib/utils"
import type { BlogPost, BlogPostStatus } from "@/types"

const schema = z.object({
  title:   z.string().min(3, "El título debe tener al menos 3 caracteres."),
  slug:    z.string().optional(),
  locale:  z.enum(["es", "en"]),
  excerpt: z.string().max(320, "Máximo 320 caracteres.").optional(),
  body_html: z.string().optional(),
  cover_url: z.string().url("URL inválida.").optional().or(z.literal("")),
  cover_alt: z.string().max(200).optional(),
  category:  z.string().max(60).optional(),
  reading_minutes: z.string().optional(),
  seo_title:       z.string().max(70, "Máximo 70 caracteres.").optional(),
  seo_description: z.string().max(200, "Máximo 200 caracteres.").optional(),
  og_image_url:    z.string().url("URL inválida.").optional().or(z.literal("")),
  status:    z.enum(["draft", "published", "archived"]),
})
type FormValues = z.infer<typeof schema>

interface Props {
  /** When provided, the form is in edit mode for this post. */
  post?: BlogPost
}

/**
 * Blog post editor. Used by both the create page (no `post` prop) and
 * the edit page. Auto-slugs from the title when the slug field is
 * empty; gives admins full control over SEO overrides + status.
 */
export function BlogPostForm({ post }: Props) {
  const router = useRouter()
  const isEdit = Boolean(post)

  const [pending,   startTransition] = useTransition()
  const [body,      setBody]    = useState(post?.body_html ?? "")
  const [deleting,  setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title:   post?.title   ?? "",
      slug:    post?.slug    ?? "",
      locale:  (post?.locale as "es" | "en") ?? "es",
      excerpt: post?.excerpt ?? "",
      body_html: post?.body_html ?? "",
      cover_url: post?.cover_url ?? "",
      cover_alt: post?.cover_alt ?? "",
      category:  post?.category  ?? "",
      reading_minutes: post?.reading_minutes != null ? String(post.reading_minutes) : "",
      seo_title:       post?.seo_title       ?? "",
      seo_description: post?.seo_description ?? "",
      og_image_url:    post?.og_image_url    ?? "",
      status:    (post?.status as BlogPostStatus) ?? "draft",
    },
  })

  const title  = watch("title")
  const locale = watch("locale")
  const status = watch("status")

  function onSubmit(values: FormValues) {
    startTransition(async () => {
      const payload = {
        title:           values.title,
        slug:            values.slug?.trim() || slugify(values.title),
        locale:          values.locale,
        excerpt:         values.excerpt        || undefined,
        body_html:       body                   || undefined,
        cover_url:       values.cover_url      || null,
        cover_alt:       values.cover_alt      || null,
        category:        values.category       || null,
        reading_minutes: values.reading_minutes ? Number(values.reading_minutes) : null,
        seo_title:       values.seo_title        || null,
        seo_description: values.seo_description  || null,
        og_image_url:    values.og_image_url     || null,
        status:          values.status,
      }
      const result = isEdit
        ? await updateBlogPost(post!.id, payload)
        : await createBlogPost(payload)
      if (!result.success) {
        toast.error(result.error ?? "No pudimos guardar el post.")
        return
      }
      toast.success(isEdit ? "Cambios guardados." : "Post creado.")
      router.push(`/dashboard/blog/${result.data.id}`)
      router.refresh()
    })
  }

  async function handleDelete() {
    if (!post) return
    setDeleting(true)
    const result = await deleteBlogPost(post.id)
    setDeleting(false)
    if (!result.success) {
      toast.error(result.error ?? "No pudimos eliminar el post.")
      return
    }
    toast.success("Post eliminado.")
    router.push("/dashboard/blog")
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-(--spacing-section)" noValidate>
      {/* Top bar */}
      <div className="flex items-center justify-between gap-(--spacing-cluster) flex-wrap">
        <Link
          href="/dashboard/blog"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeftIcon className="h-3.5 w-3.5" />
          Volver a posts
        </Link>
        <div className="flex items-center gap-2">
          {isEdit && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setConfirmDelete(true)}
              className="gap-1.5 text-destructive hover:text-destructive"
            >
              <TrashIcon className="h-4 w-4" />
              Eliminar
            </Button>
          )}
          <Button
            type="submit"
            disabled={pending}
            aria-busy={pending}
            size="sm"
          >
            {pending ? "Guardando…" : status === "published" ? "Publicar" : "Guardar borrador"}
          </Button>
        </div>
      </div>

      {/* ── Content ─────────────────────────────────────────── */}
      <FormSection
        id="content"
        number={1}
        title="Contenido"
        description="El título y el cuerpo se muestran en el blog público."
      >
        <div className="space-y-(--spacing-block)">
          <Field id="title" label="Título" error={errors.title?.message}>
            <Input
              id="title"
              placeholder="Cómo elegir tu primer apartamento en Escazú"
              {...register("title")}
            />
          </Field>

          <Field
            id="excerpt"
            label="Resumen / lead"
            helper="Texto corto que acompaña al título en el listado y en los compartidos. Hasta 320 caracteres."
            error={errors.excerpt?.message}
          >
            <Textarea
              id="excerpt"
              rows={3}
              maxLength={320}
              placeholder="Una vista rápida del artículo…"
              {...register("excerpt")}
            />
          </Field>

          <Field id="body" label="Cuerpo">
            <RichTextEditor
              value={body}
              onChange={setBody}
              placeholder="Escribí el contenido del artículo…"
            />
          </Field>
        </div>
      </FormSection>

      {/* ── Cover + classification ──────────────────────────── */}
      <FormSection
        id="cover"
        number={2}
        title="Portada y clasificación"
        description="La portada se usa como hero y como imagen de OpenGraph cuando no haya una específica."
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-(--spacing-cluster)">
          <Field
            id="cover_url"
            label="URL de la imagen de portada"
            helper="Recomendado: 1600×900 o más, JPG/WebP."
            error={errors.cover_url?.message}
          >
            <Input
              id="cover_url"
              type="url"
              placeholder="https://…"
              {...register("cover_url")}
            />
          </Field>
          <Field
            id="cover_alt"
            label="Texto alternativo de la portada"
            helper="Para accesibilidad y SEO."
            error={errors.cover_alt?.message}
          >
            <Input id="cover_alt" {...register("cover_alt")} />
          </Field>
          <Field id="category" label="Categoría / eyebrow" error={errors.category?.message}>
            <Input id="category" placeholder="Mercado, Guías, Inversión…" {...register("category")} />
          </Field>
          <Field
            id="reading_minutes"
            label="Tiempo de lectura (min)"
            error={errors.reading_minutes?.message}
          >
            <Input
              id="reading_minutes"
              type="number"
              inputMode="numeric"
              min="1"
              max="120"
              {...register("reading_minutes")}
            />
          </Field>
        </div>
      </FormSection>

      {/* ── SEO + URL ───────────────────────────────────────── */}
      <FormSection
        id="seo"
        number={3}
        title="SEO y URL"
        description="Si no llenás los campos, usamos el título y el resumen automáticamente."
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-(--spacing-cluster)">
          <Field
            id="slug"
            label="Slug"
            helper={`URL final: /blog/${watch("slug") || slugify(title || "")}`}
            error={errors.slug?.message}
          >
            <Input
              id="slug"
              placeholder="apartamento-escazu-2hab"
              {...register("slug")}
            />
          </Field>
          <Field id="locale" label="Idioma">
            <Select value={locale} onValueChange={(v) => setValue("locale", v as "es" | "en")}>
              <SelectTrigger id="locale"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="es">Español</SelectItem>
                <SelectItem value="en">English</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field
            id="seo_title"
            label="SEO title"
            helper="Hasta 70 caracteres. Ideal: incluye palabra clave principal."
            error={errors.seo_title?.message}
          >
            <Input id="seo_title" {...register("seo_title")} />
          </Field>
          <Field
            id="seo_description"
            label="SEO description"
            helper="Hasta 200 caracteres. Resumen para resultados de búsqueda."
            error={errors.seo_description?.message}
          >
            <Input id="seo_description" {...register("seo_description")} />
          </Field>
          <Field
            id="og_image_url"
            label="OG image (opcional)"
            helper="Imagen específica para compartir en redes. Si está vacía, se usa la portada."
            error={errors.og_image_url?.message}
          >
            <Input id="og_image_url" type="url" placeholder="https://…" {...register("og_image_url")} />
          </Field>
          <Field id="status" label="Estado">
            <Select
              value={status}
              onValueChange={(v) => setValue("status", v as BlogPostStatus)}
            >
              <SelectTrigger id="status"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Borrador</SelectItem>
                <SelectItem value="published">Publicado</SelectItem>
                <SelectItem value="archived">Archivado</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </div>
      </FormSection>

      {/* Submit bottom — duplicate of top for long forms */}
      <div className="flex items-center justify-end gap-2 pt-(--spacing-block) border-t">
        {isEdit && post?.status === "published" && (
          <Link
            href={`/blog/${post.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonVariants({ size: "sm", variant: "outline" })}
          >
            Ver en el blog →
          </Link>
        )}
        <Button type="submit" disabled={pending} aria-busy={pending}>
          {pending ? "Guardando…" : isEdit ? "Guardar cambios" : "Crear post"}
        </Button>
      </div>

      {/* Delete confirmation */}
      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Eliminar este post?</DialogTitle>
            <DialogDescription>
              Esta acción no se puede deshacer. El post deja de mostrarse en el
              blog público y en cualquier link compartido.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(false)} disabled={deleting}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? "Eliminando…" : "Eliminar post"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </form>
  )
}

// ── Field helper ─────────────────────────────────────────────────
function Field({
  id, label, helper, error, children,
}: {
  id:       string
  label:    string
  helper?:  string
  error?:   string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs font-medium text-foreground">
        {label}
      </Label>
      {children}
      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : helper ? (
        <p className="text-[11px] text-muted-foreground">{helper}</p>
      ) : null}
    </div>
  )
}
