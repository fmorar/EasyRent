"use client"

import { useEditor, EditorContent } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Placeholder from "@tiptap/extension-placeholder"
import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"
import {
  BoldIcon,
  ItalicIcon,
  ListIcon,
  ListOrderedIcon,
  SparklesIcon,
} from "lucide-react"

// ── Toolbar button ────────────────────────────────────────────────
function ToolbarBtn({
  active,
  disabled,
  onClick,
  title,
  children,
  className,
}: {
  active?:    boolean
  disabled?:  boolean
  onClick:    () => void
  title:      string
  children:   React.ReactNode
  className?: string
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onMouseDown={(e) => { e.preventDefault(); onClick() }}
      className={cn(
        "flex items-center justify-center h-6 rounded text-muted-foreground transition-colors px-1.5",
        active   ? "bg-accent text-foreground"       : "hover:bg-accent hover:text-foreground",
        disabled ? "opacity-40 pointer-events-none"  : "",
        className,
      )}
    >
      {children}
    </button>
  )
}

// ── Props ─────────────────────────────────────────────────────────
interface Props {
  value:       string          // HTML string
  onChange:    (html: string) => void
  onBlur?:     () => void
  // Called when user clicks "Rewrite with AI" — returns new HTML or null on error
  aiRewrite?:  (currentHtml: string) => Promise<string | null>
  placeholder?: string
  disabled?:   boolean
  className?:  string
}

// ── Component ─────────────────────────────────────────────────────
export function RichTextEditor({
  value, onChange, onBlur, aiRewrite, placeholder, disabled, className,
}: Props) {
  const [aiLoading, setAiLoading] = useState(false)

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading:         { levels: [2, 3] },
        codeBlock:       false,
        code:            false,
        blockquote:      false,
        horizontalRule:  false,
      }),
      Placeholder.configure({
        placeholder:       placeholder ?? "Describe las características de la propiedad…",
        emptyEditorClass:  "is-editor-empty",
      }),
    ],
    content:  value,
    editable: !disabled && !aiLoading,
    onUpdate: ({ editor }) => {
      const html = editor.isEmpty ? "" : editor.getHTML()
      onChange(html)
    },
    editorProps: {
      attributes: {
        class: "outline-none min-h-[96px] px-3 py-2.5 text-sm leading-relaxed tiptap",
      },
      handleDOMEvents: {
        blur: () => { onBlur?.(); return false },
      },
    },
  })

  // Sync external value changes (e.g. form reset / AI result)
  useEffect(() => {
    if (!editor) return
    const current = editor.isEmpty ? "" : editor.getHTML()
    if (value !== current) editor.commands.setContent(value ?? "")
  }, [value, editor])

  // Sync disabled / aiLoading → editable
  useEffect(() => {
    editor?.setEditable(!disabled && !aiLoading)
  }, [disabled, aiLoading, editor])

  async function handleAiRewrite() {
    if (!aiRewrite || aiLoading) return
    setAiLoading(true)
    try {
      const currentHtml = editor?.isEmpty ? "" : (editor?.getHTML() ?? "")
      const result = await aiRewrite(currentHtml)
      if (result && editor) {
        editor.commands.setContent(result)
        onChange(result)
      }
    } finally {
      setAiLoading(false)
    }
  }

  return (
    <div
      className={cn(
        "rounded-md border bg-background transition-colors focus-within:ring-1 focus-within:ring-ring",
        (disabled || aiLoading) && "opacity-60",
        aiLoading && "cursor-wait",
        className,
      )}
    >
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 px-2 py-1.5 border-b">
        {/* Formatting tools */}
        <ToolbarBtn
          title="Negrita"
          active={editor?.isActive("bold")}
          disabled={aiLoading}
          onClick={() => editor?.chain().focus().toggleBold().run()}
        >
          <BoldIcon className="h-3.5 w-3.5" />
        </ToolbarBtn>
        <ToolbarBtn
          title="Cursiva"
          active={editor?.isActive("italic")}
          disabled={aiLoading}
          onClick={() => editor?.chain().focus().toggleItalic().run()}
        >
          <ItalicIcon className="h-3.5 w-3.5" />
        </ToolbarBtn>

        <div className="h-4 w-px bg-border mx-1" />

        <ToolbarBtn
          title="Lista con viñetas"
          active={editor?.isActive("bulletList")}
          disabled={aiLoading}
          onClick={() => editor?.chain().focus().toggleBulletList().run()}
        >
          <ListIcon className="h-3.5 w-3.5" />
        </ToolbarBtn>
        <ToolbarBtn
          title="Lista numerada"
          active={editor?.isActive("orderedList")}
          disabled={aiLoading}
          onClick={() => editor?.chain().focus().toggleOrderedList().run()}
        >
          <ListOrderedIcon className="h-3.5 w-3.5" />
        </ToolbarBtn>

        {/* AI rewrite — only shown when wired up */}
        {aiRewrite && (
          <>
            <div className="flex-1" />
            <ToolbarBtn
              title="Reescribir con IA"
              disabled={aiLoading}
              onClick={handleAiRewrite}
              className={cn(
                "gap-1.5 text-xs font-medium px-2",
                aiLoading
                  ? "text-muted-foreground"
                  : "text-luxe hover:text-luxe hover:bg-luxe/5",
              )}
            >
              <SparklesIcon
                className={cn("h-3.5 w-3.5", aiLoading && "animate-pulse")}
              />
              {aiLoading ? "Generando…" : "Reescribir con IA"}
            </ToolbarBtn>
          </>
        )}
      </div>

      {/* Editable area */}
      <EditorContent editor={editor} />
    </div>
  )
}
