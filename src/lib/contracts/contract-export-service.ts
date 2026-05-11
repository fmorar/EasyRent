// ============================================================
// Contract export service — HTML → DOCX and HTML → PDF.
//
// We don't run a full Chromium (no puppeteer) — too heavy for a
// contract, and we already ship `@react-pdf/renderer` for the
// performance reports. We parse the editor's HTML with `cheerio`
// and emit the structure into:
//
//   • DOCX  — via the `docx` package (Document → Paragraph → TextRun)
//   • PDF   — via `@react-pdf/renderer` (<Document><Page><Text/></Page></Document>)
//
// Coverage of the HTML subset:
//   h1 / h2  → headings
//   p        → paragraph
//   ul / ol  → bulleted / numbered list (one level)
//   li       → list item
//   strong   → bold inline run
//   em       → italic inline run
//   br       → line break
//
// Anything outside this subset is rendered as plain text. The
// editor's StarterKit produces only this subset, so we're tight.
// ============================================================

import * as cheerio from "cheerio"
import type { Element as DomElement, AnyNode } from "domhandler"
import {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
} from "docx"
import { renderToBuffer } from "@react-pdf/renderer"
import {
  Document as PdfDocument,
  Page as PdfPage,
  Text as PdfText,
  View as PdfView,
  StyleSheet,
} from "@react-pdf/renderer"
import * as React from "react"

// ── DOCX ────────────────────────────────────────────────────────

interface InlineRun {
  text:  string
  bold?: boolean
  italic?: boolean
}

/** Walk a node's children and flatten into bold/italic-aware runs.
 *  Accepts `AnyNode` (Element + Text + Comment + …) because text
 *  nodes show up alongside tag children inside paragraphs. */
function flattenInline($: cheerio.CheerioAPI, $node: cheerio.Cheerio<DomElement>): InlineRun[] {
  const out: InlineRun[] = []

  function walk(node: AnyNode, ctx: { bold: boolean; italic: boolean }) {
    // Text nodes have a `data` field; tags have `tagName` + children.
    if (node.type === "text") {
      const t = ((node as { data?: string }).data ?? "").replace(/\s+/g, " ")
      if (t) out.push({ text: t, bold: ctx.bold, italic: ctx.italic })
      return
    }
    if (node.type !== "tag") return
    const el  = node as DomElement
    const tag = el.tagName.toLowerCase()
    const nextCtx = {
      bold:   ctx.bold   || tag === "strong" || tag === "b",
      italic: ctx.italic || tag === "em"     || tag === "i",
    }
    if (tag === "br") {
      out.push({ text: "\n", bold: ctx.bold, italic: ctx.italic })
      return
    }
    for (const child of (el.children ?? [])) walk(child as AnyNode, nextCtx)
  }

  $node.each((_, el) => walk(el as AnyNode, { bold: false, italic: false }))
  return out
}

/** Turn flattened runs into TextRun[] for a DOCX paragraph. */
function toDocxRuns(runs: InlineRun[]): TextRun[] {
  return runs.map((r) => new TextRun({
    text:    r.text,
    bold:    r.bold,
    italics: r.italic,
  }))
}

/** Convert editor HTML to a DOCX `Document` instance. */
function htmlToDocx(html: string, opts: { title: string }): Document {
  const $ = cheerio.load(`<body>${html}</body>`)
  const paragraphs: Paragraph[] = []

  // Title metadata + a pretty cover heading.
  paragraphs.push(new Paragraph({
    text:        opts.title,
    heading:     HeadingLevel.TITLE,
    alignment:   AlignmentType.CENTER,
    spacing:     { after: 240 },
  }))

  $("body").children().each((_, el) => {
    const tag = (el as DomElement).tagName?.toLowerCase()
    const $el = $(el as DomElement)

    if (tag === "h1") {
      paragraphs.push(new Paragraph({
        children:  toDocxRuns(flattenInline($, $el)),
        heading:   HeadingLevel.HEADING_1,
        alignment: AlignmentType.CENTER,
        spacing:   { before: 240, after: 120 },
      }))
      return
    }
    if (tag === "h2") {
      paragraphs.push(new Paragraph({
        children:  toDocxRuns(flattenInline($, $el)),
        heading:   HeadingLevel.HEADING_2,
        spacing:   { before: 200, after: 80 },
      }))
      return
    }
    if (tag === "p") {
      paragraphs.push(new Paragraph({
        children: toDocxRuns(flattenInline($, $el)),
        spacing:  { after: 120 },
        alignment: AlignmentType.JUSTIFIED,
      }))
      return
    }
    if (tag === "ul" || tag === "ol") {
      $el.children("li").each((i, li) => {
        const $li = $(li)
        const numbering = tag === "ol" ? `${i + 1}. ` : "• "
        paragraphs.push(new Paragraph({
          children: [
            new TextRun({ text: numbering }),
            ...toDocxRuns(flattenInline($, $li)),
          ],
          spacing:  { after: 60 },
          indent:   { left: 360 },
        }))
      })
      return
    }
    // Fallback: treat unknown block as a paragraph of its text.
    const text = $el.text().trim()
    if (text) paragraphs.push(new Paragraph({ text, spacing: { after: 120 } }))
  })

  return new Document({
    creator:  "Real Estate Tool",
    title:    opts.title,
    sections: [{
      properties: {
        page: {
          margin: { top: 1134, right: 1134, bottom: 1134, left: 1134 },  // ~2cm
        },
      },
      children: paragraphs,
    }],
  })
}

/** Public API: render editor HTML to a DOCX Buffer. */
export async function htmlToDocxBuffer(
  html: string, opts: { title: string },
): Promise<Buffer> {
  const doc = htmlToDocx(html, opts)
  return Packer.toBuffer(doc)
}

// ── PDF (via @react-pdf/renderer) ───────────────────────────────

const pdfStyles = StyleSheet.create({
  page: {
    paddingTop:    50,
    paddingBottom: 50,
    paddingLeft:   60,
    paddingRight:  60,
    fontSize:      11,
    fontFamily:    "Times-Roman",
    lineHeight:    1.45,
    color:         "#222222",
  },
  title:  { fontSize: 14, fontFamily: "Times-Bold", textAlign: "center", marginBottom: 12 },
  h1:     { fontSize: 13, fontFamily: "Times-Bold", textAlign: "center", marginTop: 14, marginBottom: 8 },
  h2:     { fontSize: 12, fontFamily: "Times-Bold", marginTop: 10, marginBottom: 4 },
  p:      { textAlign: "justify", marginBottom: 6 },
  liRow:  { flexDirection: "row", marginBottom: 3, marginLeft: 14 },
  bullet: { width: 18 },
  liText: { flex: 1, textAlign: "justify" },
})

function pdfRunsFromInline(runs: InlineRun[]): React.ReactNode {
  return runs.map((r, i) => {
    const fontFamily =
      r.bold && r.italic ? "Times-BoldItalic" :
      r.bold             ? "Times-Bold"       :
      r.italic           ? "Times-Italic"     :
                           "Times-Roman"
    return React.createElement(PdfText, { key: i, style: { fontFamily } }, r.text)
  })
}

function htmlToPdfDocument(html: string, opts: { title: string }): React.ReactElement {
  const $ = cheerio.load(`<body>${html}</body>`)
  const blocks: React.ReactNode[] = []

  $("body").children().each((_, el) => {
    const tag = (el as DomElement).tagName?.toLowerCase()
    const $el = $(el as DomElement)

    if (tag === "h1") {
      blocks.push(React.createElement(PdfText, { key: blocks.length, style: pdfStyles.h1 },
        pdfRunsFromInline(flattenInline($, $el))))
      return
    }
    if (tag === "h2") {
      blocks.push(React.createElement(PdfText, { key: blocks.length, style: pdfStyles.h2 },
        pdfRunsFromInline(flattenInline($, $el))))
      return
    }
    if (tag === "p") {
      blocks.push(React.createElement(PdfText, { key: blocks.length, style: pdfStyles.p },
        pdfRunsFromInline(flattenInline($, $el))))
      return
    }
    if (tag === "ul" || tag === "ol") {
      $el.children("li").each((i, li) => {
        const $li      = $(li)
        const bullet   = tag === "ol" ? `${i + 1}.` : "•"
        const k        = `${blocks.length}-${i}`
        blocks.push(React.createElement(PdfView, { key: k, style: pdfStyles.liRow },
          React.createElement(PdfText, { style: pdfStyles.bullet }, bullet),
          React.createElement(PdfText, { style: pdfStyles.liText },
            pdfRunsFromInline(flattenInline($, $li))),
        ))
      })
      return
    }
    // Fallback to plain text
    const text = $el.text().trim()
    if (text) blocks.push(React.createElement(PdfText, { key: blocks.length, style: pdfStyles.p }, text))
  })

  return React.createElement(PdfDocument, { title: opts.title },
    React.createElement(PdfPage, { size: "LETTER", style: pdfStyles.page },
      React.createElement(PdfText, { style: pdfStyles.title }, opts.title),
      ...blocks,
    ),
  )
}

/** Public API: render editor HTML to a PDF Buffer. */
export async function htmlToPdfBuffer(
  html: string, opts: { title: string },
): Promise<Buffer> {
  // The Document element we build via `React.createElement` has its
  // children types widened to `unknown`, which makes TS unhappy with
  // `renderToBuffer`'s `ReactElement<DocumentProps>` parameter. Cast
  // through `unknown` — the runtime IS a Document, this is purely a
  // typing limitation of `React.createElement` without JSX.
  const doc = htmlToPdfDocument(html, opts)
  const buffer = await renderToBuffer(
    doc as unknown as Parameters<typeof renderToBuffer>[0],
  )
  return buffer as Buffer
}

// ── Filename helpers ─────────────────────────────────────────────

/**
 * `contrato-alquiler-<property-slug>-<tenant-last-name>-<yyyyMMdd>.<ext>`
 * Falls back to `contrato-alquiler-<contractId>-<yyyyMMdd>.<ext>` when
 * data is missing.
 */
export function buildFilename(input: {
  contractId:      string
  propertySlug?:   string | null
  tenantFullName?: string | null
  date?:           Date
  ext:             "pdf" | "docx"
}): string {
  const date = input.date ?? new Date()
  const yyyy = date.getUTCFullYear()
  const mm   = String(date.getUTCMonth() + 1).padStart(2, "0")
  const dd   = String(date.getUTCDate()).padStart(2, "0")
  const stamp = `${yyyy}${mm}${dd}`

  const parts = ["contrato-alquiler"]
  if (input.propertySlug) parts.push(input.propertySlug)
  if (input.tenantFullName) {
    const last = input.tenantFullName.trim().split(/\s+/).pop()
    if (last) parts.push(slugify(last))
  } else {
    parts.push(input.contractId.slice(0, 8))
  }
  parts.push(stamp)
  return `${parts.join("-")}.${input.ext}`
}

function slugify(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}
