"use client"

import { useState } from "react"
import { PlayIcon } from "@heroicons/react/24/solid"

interface Props {
  /** YouTube video id (the `v=` query value or last path segment). */
  videoId: string
  /** Used for alt text + iframe title. Optional. */
  title?:  string | null
}

/**
 * Facade for a YouTube embed.
 *
 * Why: a `<iframe src="youtube.com/embed/...">` ships ~500 KB of
 * player JS + CSS and burns ~1s of CPU on the main thread, even
 * when the user never plays the video. PageSpeed flagged every
 * property page with the heaviest "unused CSS" + "JS execution
 * time" both pointing at YouTube.
 *
 * The fix is the lite-youtube-embed pattern: render the static
 * thumbnail (cheap, ~30 KB image) plus a play overlay until the
 * user clicks. On click we swap to the real iframe with
 * `autoplay=1` so the video starts immediately (no extra click).
 *
 * Net savings on first paint:
 *   • 105 KB of www-player.css avoided
 *   • ~960 ms of YouTube JS execution avoided
 *   • Two cross-origin connections deferred (youtube.com + ytimg)
 *
 * The thumbnail is served from `i.ytimg.com`. We deliberately do
 * NOT route it through next/image — it's already small (<50 KB),
 * the YouTube CDN caches well, and avoiding `images.remotePatterns`
 * config keeps this drop-in.
 */
export function YouTubeFacade({ videoId, title }: Props) {
  const [activated, setActivated] = useState(false)

  if (activated) {
    return (
      <iframe
        src={`https://www.youtube.com/embed/${videoId}?autoplay=1`}
        title={title ?? "Video"}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        className="w-full h-full"
      />
    )
  }

  // hqdefault is universally available (maxresdefault isn't generated
  // for older / low-res uploads). 480×360 looks crisp scaled into the
  // aspect-video container on standard DPI.
  // eslint-disable-next-line @next/next/no-img-element
  return (
    <button
      type="button"
      onClick={() => setActivated(true)}
      className="relative w-full h-full group cursor-pointer block"
      aria-label={title ? `Reproducir: ${title}` : "Reproducir video"}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`}
        alt={title ?? ""}
        loading="lazy"
        decoding="async"
        className="w-full h-full object-cover"
      />
      {/* Subtle vignette so the play button always has contrast,
          regardless of how busy the thumbnail is. */}
      <div className="absolute inset-0 bg-black/15 group-hover:bg-black/25 transition-colors duration-(--duration-state) ease-(--ease-out-quart)" />
      {/* YouTube-red play disc, sized + offset to match the brand. */}
      <span
        className="absolute inset-0 flex items-center justify-center"
        aria-hidden="true"
      >
        <span className="h-16 w-16 sm:h-20 sm:w-20 rounded-full bg-[#FF0033] shadow-lg flex items-center justify-center transition-transform duration-(--duration-state) ease-(--ease-out-quart) group-hover:scale-110">
          <PlayIcon className="h-8 w-8 sm:h-10 sm:w-10 text-white translate-x-[2px]" />
        </span>
      </span>
    </button>
  )
}
