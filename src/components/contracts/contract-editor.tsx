"use client"

import { useEditor, EditorContent } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import { useEffect } from "react"
import { cn } from "@/lib/utils"
import {
  BoldIcon,
  ItalicIcon,
  ListIcon,
  ListOrderedIcon,
  Heading2Icon,
} from "lucide-react"

function ToolbarBtn({
  active, disabled, onClick, title, children, className,
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
        "flex items-center justify-center h-7 rounded text-muted-foreground transition-colors px-2",
        active   ? "bg-accent text-foreground"      : "hover:bg-accent hover:text-foreground",
        disabled ? "opacity-40 pointer-events-none" : "",
        className,
      )}
    >
      {children}
    </button>
  )
}

interface Props {
  /** HTML content. Controlled. */
  value:    string
  onChange: (html: string) => void
  /** Disables editing — used for finalized/signed contracts. */
  readOnly?: boolean
  className?: string
}

/**
 * Long-form editor sized for full contracts. Differs from the
 * property-description editor in `components/ui/rich-text-editor.tsx`:
 *
 *   • Supports H2 (the contract has 15 H2 clauses).
 *   • Min-height ~720px so the page doesn't reflow as the user types.
 *   • No AI rewrite — this is a legal document, not marketing copy.
 *   • `readOnly` prop for finalized/signed contracts.
 *   • `tiptap` class on the editable area picks up the prose styles
 *     defined in globals.css (lists, headings).
 */
export function ContractEditor({ value, onChange, readOnly, className }: Props) {
  const editor = useEditor({
    immediatelyRender: false,
    editable:          !readOnly,
    extensions: [
      StarterKit.configure({
        heading:        { levels: [1, 2, 3] },
        codeBlock:      false,
        code:           false,
        blockquote:     false,
        horizontalRule: false,
      }),
    ],
    content: value,
    onUpdate: ({ editor }) => {
      const html = editor.isEmpty ? "" : editor.getHTML()
      onChange(html)
    },
    editorProps: {
      attributes: {
        class: "outline-none min-h-[720px] px-5 py-5 text-sm leading-relaxed tiptap prose prose-sm max-w-none",
      },
    },
  })

  // Sync external content changes (regenerate from structured data).
  useEffect(() => {
    if (!editor) return
    const current = editor.isEmpty ? "" : editor.getHTML()
    if (value !== current) editor.commands.setContent(value ?? "")
  }, [value, editor])

  // Mirror readOnly prop changes.
  useEffect(() => {
    editor?.setEditable(!readOnly)
  }, [readOnly, editor])

  return (
    <div
      className={cn(
        "rounded-lg border bg-background transition-colors focus-within:ring-1 focus-within:ring-ring",
        readOnly && "opacity-90",
        className,
      )}
    >
      {!readOnly && (
        <div className="flex items-center gap-1 px-2 py-2 border-b sticky top-0 bg-background z-10 rounded-t-lg">
          <ToolbarBtn
            title="Encabezado"
            active={editor?.isActive("heading", { level: 2 })}
            onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
          >
            <Heading2Icon className="h-3.5 w-3.5" />
          </ToolbarBtn>
          <div className="h-4 w-px bg-border mx-1" />
          <ToolbarBtn
            title="Negrita"
            active={editor?.isActive("bold")}
            onClick={() => editor?.chain().focus().toggleBold().run()}
          >
            <BoldIcon className="h-3.5 w-3.5" />
          </ToolbarBtn>
          <ToolbarBtn
            title="Cursiva"
            active={editor?.isActive("italic")}
            onClick={() => editor?.chain().focus().toggleItalic().run()}
          >
            <ItalicIcon className="h-3.5 w-3.5" />
          </ToolbarBtn>
          <div className="h-4 w-px bg-border mx-1" />
          <ToolbarBtn
            title="Lista con viñetas"
            active={editor?.isActive("bulletList")}
            onClick={() => editor?.chain().focus().toggleBulletList().run()}
          >
            <ListIcon className="h-3.5 w-3.5" />
          </ToolbarBtn>
          <ToolbarBtn
            title="Lista numerada"
            active={editor?.isActive("orderedList")}
            onClick={() => editor?.chain().focus().toggleOrderedList().run()}
          >
            <ListOrderedIcon className="h-3.5 w-3.5" />
          </ToolbarBtn>
        </div>
      )}

      <EditorContent editor={editor} />
    </div>
  )
}
