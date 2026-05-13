import type { VideoRow } from "@/lib/actions/media.actions"

interface Props {
  videos:  VideoRow[]
  heading: string
}

function extractYouTubeId(url: string): string | null {
  try {
    const u = new URL(url)
    if (["www.youtube.com", "youtube.com", "m.youtube.com"].includes(u.hostname)) {
      return u.searchParams.get("v")
    }
    if (u.hostname === "youtu.be") return u.pathname.slice(1)
  } catch { /* ignore */ }
  return null
}

/**
 * Renders the list of YouTube videos attached to a property as embeds.
 * Returns null when there are no usable videos — every consumer can
 * mount it unconditionally and let it decide whether to render.
 */
export function PropertyVideos({ videos, heading }: Props) {
  const sorted = [...videos]
    .sort((a, b) => a.order_index - b.order_index)
    .map((v) => ({ ...v, ytId: extractYouTubeId(v.youtube_url) }))
    .filter((v): v is typeof v & { ytId: string } => v.ytId !== null)

  if (sorted.length === 0) return null

  return (
    <section className="space-y-(--spacing-cluster)">
      <h2 className="text-lg font-heading font-semibold">{heading}</h2>
      <div className="space-y-(--spacing-cluster)">
        {sorted.map((v) => (
          <div key={v.id} className="rounded-xl overflow-hidden bg-muted aspect-video">
            <iframe
              src={`https://www.youtube.com/embed/${v.ytId}`}
              title={v.title ?? "Video"}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="w-full h-full"
            />
          </div>
        ))}
      </div>
    </section>
  )
}
