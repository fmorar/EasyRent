import { format } from "date-fns"
import { MicrophoneIcon, PhotoIcon } from "@heroicons/react/24/outline"
import type { Database } from "@/types/supabase"

type Message = Database["public"]["Tables"]["conversation_messages"]["Row"]

interface Props {
  message: Message
}

/**
 * WhatsApp-style chat bubble.
 *
 *   Inbound  (from lead) → left,  neutral bubble.
 *   Outbound (from bot)  → right, primary-tinted bubble.
 *
 * Special cases:
 *   • Voice notes: the webhook persists Whisper's transcript as
 *     `content`, but the original audio URL stays on `media_url`.
 *     We surface a small mic chip + a "Reproducir audio original"
 *     link so the operator can verify the bot's understanding.
 *   • Image/PDF media (no transcript): show a generic media chip with
 *     the link to the original asset.
 *   • Otherwise: plain text body. We render newlines as line breaks
 *     but escape everything else (the persistence layer is the source
 *     of truth — never trust agent output as HTML).
 */
export function MessageBubble({ message }: Props) {
  const isInbound = message.direction === "inbound"
  const isAudio   = !!message.media_url && message.content && message.content !== "[media]"
  const isMediaOnly = !!message.media_url && (!message.content || message.content === "[media]")
  const ts = message.created_at ? new Date(message.created_at) : null

  return (
    <div className={isInbound ? "flex justify-start" : "flex justify-end"}>
      <div
        className={`max-w-[75%] rounded-2xl px-3.5 py-2 ${
          isInbound
            ? "bg-muted rounded-bl-md"
            : "bg-primary text-primary-foreground rounded-br-md"
        }`}
      >
        {/* Voice-note chip (inbound only — outbound is always text) */}
        {isInbound && isAudio && (
          <div className="flex items-center gap-1.5 text-[11px] opacity-70 mb-1">
            <MicrophoneIcon className="size-3" />
            <span>Nota de voz (transcrita)</span>
          </div>
        )}

        {/* Media-only fallback when we couldn't transcribe / not audio */}
        {isMediaOnly && (
          <div className="flex items-center gap-1.5 text-[11px] opacity-70 mb-1">
            <PhotoIcon className="size-3" />
            <span>Adjunto</span>
          </div>
        )}

        {/* Body. Whitespace-pre-line preserves newlines without
            opening up an HTML injection surface. */}
        {message.content && message.content !== "[media]" && (
          <p className="text-sm whitespace-pre-line break-words">{message.content}</p>
        )}

        {/* Footer: timestamp + (if media) link to original */}
        <div className="flex items-center justify-end gap-2 mt-1">
          {message.media_url && (
            <a
              href={message.media_url}
              target="_blank"
              rel="noreferrer"
              className={`text-[10px] underline ${
                isInbound ? "text-muted-foreground" : "text-primary-foreground/80"
              }`}
            >
              {isAudio ? "Audio original" : "Adjunto"}
            </a>
          )}
          {ts && (
            <time
              className={`text-[10px] font-numeric ${
                isInbound ? "text-muted-foreground" : "text-primary-foreground/70"
              }`}
              dateTime={ts.toISOString()}
              title={ts.toLocaleString("es-CR")}
            >
              {format(ts, "HH:mm")}
            </time>
          )}
        </div>
      </div>
    </div>
  )
}
