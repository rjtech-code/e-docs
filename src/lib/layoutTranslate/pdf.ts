// PDF: the ORIGINAL file is the output. Its pages, size, images, graphics, tables, headers and
// footers are kept; the original text is removed from the content streams and the translation
// is drawn back in the same blocks, at the same size, colour and alignment. Text that is part of
// an image (scans, or text we can't remove) is covered with its own background colour first.
import { PDFArray, PDFName } from 'pdf-lib'
import type { PDFDocument, PDFPage } from 'pdf-lib'
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist'
import type { Worker as OcrWorker, Page as OcrPage } from 'tesseract.js'
import { pdfjsLib } from '../pdfjsSetup'
import { loadPdfJs, loadPdfLib, canvasToBlob } from '../pdfCore'
import { AUTO, type Language } from '../translate'
import type { Alignment, LayoutOptions, TextElement } from './types'
import { stripPageText } from './pdfContent'
import { fitText, cssFont } from './fit'

interface Item { str: string; x0: number; x1: number; base: number; size: number; fontName: string }
interface Line { items: Item[]; text: string; x0: number; x1: number; base: number; size: number; fontName: string }
interface Block {
  lines: Line[]
  text: string
  x0: number; x1: number; top: number; bottom: number
  size: number; pitch: number
  fontName: string
  align: Alignment
  angle: number
  ocr: boolean
  maxW: number; maxH: number
}
interface PageInfo { width: number; height: number; view: number[]; blocks: Block[]; ocr: boolean }

const BULLET = /^([•▪◦●■□➢►✓\-–—*]|\(?\d{1,3}[.)]|[a-z][.)])\s/u
const OCR_LANG: Record<string, string> = { en: 'eng', hi: 'hin', mr: 'mar', gu: 'guj', bn: 'ben', ta: 'tam', te: 'tel', kn: 'kan', ml: 'mal', pa: 'pan', ur: 'urd' }

/* ───────────── analysis: text items → lines → blocks ───────────── */

function toItems(page: PDFPageProxy, content: Awaited<ReturnType<PDFPageProxy['getTextContent']>>) {
  const vp = page.getViewport({ scale: 1, rotation: 0 })
  const flat: Item[] = []
  const rotated: Block[] = []
  for (const raw of content.items as { str?: string; transform: number[]; width: number; fontName: string }[]) {
    if (typeof raw.str !== 'string' || !raw.str.trim()) continue
    const m = pdfjsLib.Util.transform(vp.transform, raw.transform) as number[]
    const size = Math.hypot(m[2], m[3])
    if (size < 1) continue
    const angle = Math.atan2(m[1], m[0])
    if (Math.abs(angle) > 0.03) {
      const w = raw.width
      rotated.push({ lines: [], text: raw.str, x0: m[4], x1: m[4] + w, top: m[5] - size, bottom: m[5], size, pitch: size * 1.2, fontName: raw.fontName, align: 'left', angle, ocr: false, maxW: w, maxH: size * 1.3 })
      continue
    }
    flat.push({ str: raw.str, x0: m[4], x1: m[4] + raw.width, base: m[5], size, fontName: raw.fontName })
  }
  return { items: flat, rotated, width: vp.width, height: vp.height }
}

function buildLines(items: Item[]): Line[] {
  const lines: Line[] = []
  for (const it of [...items].sort((a, b) => a.x0 - b.x0)) {
    let best: Line | undefined
    for (const l of lines) {
      const tol = 0.4 * Math.min(l.size, it.size)
      const gap = it.x0 - l.x1
      if (Math.abs(l.base - it.base) <= tol && gap < 1.4 * Math.max(l.size, it.size) && gap > -0.6 * it.size && it.size / l.size < 1.6 && l.size / it.size < 1.6) {
        if (!best || Math.abs(l.base - it.base) < Math.abs(best.base - it.base)) best = l
      }
    }
    if (!best) {
      lines.push({ items: [it], text: it.str, x0: it.x0, x1: it.x1, base: it.base, size: it.size, fontName: it.fontName })
      continue
    }
    const gap = it.x0 - best.x1
    if (gap > 0.15 * it.size && !/\s$/.test(best.text) && !/^\s/.test(it.str)) best.text += ' '
    best.text += it.str
    best.items.push(it)
    best.x1 = Math.max(best.x1, it.x1)
    if (it.str.trim().length > (best.items.reduce((a, b) => (b.str.length > a.str.length ? b : a)).str.trim().length) - 1) best.fontName = it.fontName
    best.size = Math.max(best.size, it.size)
  }
  for (const l of lines) l.text = l.text.replace(/\s+/g, ' ').trim()
  return lines.filter((l) => l.text)
}

function buildBlocks(lines: Line[], pageW: number): Block[] {
  const blocks: Block[] = []
  for (const line of [...lines].sort((a, b) => a.base - b.base || a.x0 - b.x0)) {
    let best: Block | undefined
    let bestD = Infinity
    if (!BULLET.test(line.text)) {
      for (const b of blocks) {
        const last = b.lines[b.lines.length - 1]
        const d = line.base - last.base
        const sameStyle = Math.abs(line.size - b.size) / b.size < 0.15 && line.fontName === last.fontName
        const overlap = Math.min(line.x1, b.x1) - Math.max(line.x0, b.x0)
        const pitchOk = b.lines.length < 2 || Math.abs(d - b.pitch) < 0.35 * b.size
        if (sameStyle && d > 0.5 * b.size && d < 1.9 * b.size && overlap > 0 && pitchOk && d < bestD) { best = b; bestD = d }
      }
    }
    if (best) {
      best.pitch = best.lines.length === 1 ? bestD : (best.pitch * (best.lines.length - 1) + bestD) / best.lines.length
      best.lines.push(line)
      best.x0 = Math.min(best.x0, line.x0)
      best.x1 = Math.max(best.x1, line.x1)
      best.bottom = line.base + line.size * 0.25
    } else {
      blocks.push({ lines: [line], text: '', x0: line.x0, x1: line.x1, top: line.base - line.size * 0.82, bottom: line.base + line.size * 0.25, size: line.size, pitch: line.size * 1.2, fontName: line.fontName, align: 'left', angle: 0, ocr: false, maxW: 0, maxH: 0 })
    }
  }
  for (const b of blocks) {
    // join lines; re-join words hyphenated across a line break
    b.text = b.lines.reduce((acc, l) => (!acc ? l.text : /\p{Ll}-$/u.test(acc) && /^\p{Ll}/u.test(l.text) ? acc.slice(0, -1) + l.text : `${acc} ${l.text}`), '')
    b.align = detectAlign(b, pageW)
  }
  return blocks
}

function spread(v: number[]) { return Math.max(...v) - Math.min(...v) }
function detectAlign(b: Block, pageW: number): Alignment {
  if (b.lines.length >= 2) {
    const body = b.lines.slice(0, -1) // last line of a paragraph is usually short
    const tol = 0.6 * b.size
    if (spread(b.lines.map((l) => (l.x0 + l.x1) / 2)) <= tol && spread(b.lines.map((l) => l.x0)) > tol) return 'center'
    if (spread(b.lines.map((l) => l.x1)) <= tol && spread(b.lines.map((l) => l.x0)) > tol) return 'right'
    if (body.length >= 2 && spread(body.map((l) => l.x1)) <= tol) return 'justify'
    return 'left'
  }
  const c = (b.x0 + b.x1) / 2
  if (Math.abs(c - pageW / 2) < pageW * 0.04 && b.x0 > pageW * 0.12) return 'center'
  if (b.x1 > pageW * 0.86 && b.x0 > pageW * 0.5) return 'right'
  return 'left'
}

/** How far each block may grow without touching its neighbours (the box itself never moves). */
function computeRoom(blocks: Block[], pageW: number, pageH: number) {
  const margin = Math.max(18, Math.min(Math.min(...blocks.map((b) => b.x0)), pageW - Math.max(...blocks.map((b) => b.x1))))
  const marginL = margin
  const marginR = margin
  for (const b of blocks) {
    if (b.angle) continue
    const vOverlap = (o: Block) => o !== b && o.top < b.bottom && o.bottom > b.top
    const hOverlap = (o: Block) => o !== b && o.x0 < b.x1 && o.x1 > b.x0
    // 2) a one-line block that shares its row with other blocks (table cell, columns) isn't "centred on the page"
    if (b.lines.length <= 1 && b.align === 'center' && !b.ocr && blocks.some(vOverlap)) b.align = 'left'
    const rightLimit = Math.min(pageW - marginR, ...blocks.filter((o) => vOverlap(o) && o.x0 >= b.x1 - 1).map((o) => o.x0 - 0.6 * b.size))
    const leftLimit = Math.max(marginL, ...blocks.filter((o) => vOverlap(o) && o.x1 <= b.x0 + 1).map((o) => o.x1 + 0.6 * b.size))
    const width = b.x1 - b.x0
    if (b.lines.length > 1) b.maxW = width * 1.02
    else if (b.align === 'center') b.maxW = Math.max(width, 2 * Math.min((b.x0 + b.x1) / 2 - leftLimit, rightLimit - (b.x0 + b.x1) / 2))
    else if (b.align === 'right') b.maxW = Math.max(width, b.x1 - leftLimit)
    else b.maxW = Math.max(width, rightLimit - b.x0)
    const below = blocks.filter((o) => hOverlap(o) && o.top >= b.bottom - 0.3 * b.size).map((o) => o.top)
    const floor = Math.min(pageH - 12, ...below)
    b.maxH = Math.max(b.bottom - b.top, floor - b.top - 0.15 * b.size)
  }
}

/* ───────────── OCR for scanned pages ───────────── */

async function ocrBlocks(canvas: HTMLCanvasElement, scale: number, worker: OcrWorker) {
  const { data } = (await worker.recognize(canvas, {}, { blocks: true })) as { data: OcrPage }
  const out: Block[] = []
  for (const para of (data.blocks ?? []).flatMap((b) => b.paragraphs)) {
    const text = para.text.replace(/\s+/g, ' ').trim()
    if (!text || para.confidence < 35 || !/\p{L}/u.test(text)) continue
    const lineH = para.lines.map((l) => (l.bbox.y1 - l.bbox.y0) / scale)
    const size = Math.max(6, (lineH.reduce((a, b) => a + b, 0) / Math.max(1, lineH.length)) * 0.9)
    const box = { x0: para.bbox.x0 / scale, x1: para.bbox.x1 / scale, top: para.bbox.y0 / scale, bottom: para.bbox.y1 / scale }
    out.push({ lines: [], text, ...box, size, pitch: para.lines.length > 1 ? (box.bottom - box.top - size) / (para.lines.length - 1) : size * 1.2, fontName: '', align: 'left', angle: 0, ocr: true, maxW: box.x1 - box.x0, maxH: box.bottom - box.top })
  }
  return out
}

/* ───────────── rendering helpers ───────────── */

function renderScale(w: number, h: number) { return Math.max(1.5, Math.min(3, 2600 / Math.max(w, h))) }

async function renderPage(page: PDFPageProxy, scale: number) {
  const viewport = page.getViewport({ scale, rotation: 0 })
  const canvas = document.createElement('canvas')
  canvas.width = Math.ceil(viewport.width)
  canvas.height = Math.ceil(viewport.height)
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  await page.render({ canvasContext: ctx, viewport, canvas }).promise
  return { canvas, pixels: ctx.getImageData(0, 0, canvas.width, canvas.height) }
}

type Rect = { x: number; y: number; w: number; h: number }
function pxRect(b: { x0: number; x1: number; top: number; bottom: number }, s: number, img: ImageData): Rect {
  const x = Math.max(0, Math.floor(b.x0 * s) - 1)
  const y = Math.max(0, Math.floor(b.top * s) - 1)
  return { x, y, w: Math.max(1, Math.min(img.width, Math.ceil(b.x1 * s) + 1) - x), h: Math.max(1, Math.min(img.height, Math.ceil(b.bottom * s) + 1) - y) }
}

/** Background (most common colour) and text colour (most common colour clearly different from it). */
function sampleColors(img: ImageData, r: Rect) {
  const hist = new Map<number, { n: number; r: number; g: number; b: number }>()
  const d = img.data
  const step = Math.max(1, Math.floor(Math.sqrt((r.w * r.h) / 40000)))
  for (let y = r.y; y < r.y + r.h; y += step) for (let x = r.x; x < r.x + r.w; x += step) {
    const i = (y * img.width + x) * 4
    const key = ((d[i] >> 4) << 8) | ((d[i + 1] >> 4) << 4) | (d[i + 2] >> 4)
    const e = hist.get(key) ?? { n: 0, r: 0, g: 0, b: 0 }
    e.n++; e.r += d[i]; e.g += d[i + 1]; e.b += d[i + 2]
    hist.set(key, e)
  }
  const sorted = [...hist.values()].sort((a, b) => b.n - a.n)
  const avg = (e: { n: number; r: number; g: number; b: number }) => [e.r / e.n, e.g / e.n, e.b / e.n]
  const bg = sorted[0] ? avg(sorted[0]) : [255, 255, 255]
  const dist = (c: number[]) => Math.abs(c[0] - bg[0]) + Math.abs(c[1] - bg[1]) + Math.abs(c[2] - bg[2])
  const fgEntry = sorted.find((e) => dist(avg(e)) > 90)
  let fg = fgEntry ? avg(fgEntry) : null
  if (fg) {
    // prefer the most contrasting colour among frequent candidates (anti-aliased edges are lighter)
    const cands = sorted.filter((e) => dist(avg(e)) > 90).slice(0, 4)
    fg = avg(cands.reduce((a, b) => (dist(avg(b)) > dist(avg(a)) && b.n > a.n * 0.35 ? b : a)))
  }
  const lum = 0.299 * bg[0] + 0.587 * bg[1] + 0.114 * bg[2]
  const hex = (c: number[]) => `#${c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`
  return { bg: hex(bg), fg: fg ? hex(fg) : lum > 128 ? '#111111' : '#ffffff' }
}

/** Fraction of pixels in `r` that differ between the original and the text-stripped render. */
function changedRatio(a: ImageData, b: ImageData, r: Rect) {
  let changed = 0
  let total = 0
  for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) {
    const i = (y * a.width + x) * 4
    total++
    if (Math.abs(a.data[i] - b.data[i]) + Math.abs(a.data[i + 1] - b.data[i + 1]) + Math.abs(a.data[i + 2] - b.data[i + 2]) > 60) changed++
  }
  return total ? changed / total : 0
}

function fontStyle(page: PDFPageProxy, fontName: string, styles: Record<string, { fontFamily: string }>) {
  let name = ''
  let bold = false
  let italic = false
  try {
    const f = page.commonObjs.get(fontName) as { name?: string; bold?: boolean; black?: boolean; italic?: boolean } | undefined
    name = f?.name ?? ''
    bold = !!(f?.bold || f?.black)
    italic = !!f?.italic
  } catch { /* font not loaded */ }
  bold ||= /bold|black|heavy|semibold|demi/i.test(name)
  italic ||= /italic|oblique/i.test(name)
  const fam = styles[fontName]?.fontFamily ?? ''
  const serif = fam === 'serif' || (/times|georgia|garamond|cambria|minion|book|serif/i.test(name) && !/sans/i.test(name))
  const mono = fam === 'monospace' || /courier|mono|consol/i.test(name)
  return { name, bold, italic, serif, mono }
}

function familyFor(lang: Language, serif: boolean, mono: boolean) {
  const latin = mono ? '"Courier New", Courier, monospace' : serif ? '"Times New Roman", Tinos, Times, serif' : 'Arial, "Liberation Sans", Helvetica, sans-serif'
  return lang.code === 'en' ? latin : `${lang.font.replace(/,\s*(sans-serif|serif)\s*$/, '')}, ${latin}`
}

/** Fallback when a page can't be edited: wrap its content in q … Q so our overlay is positioned correctly. */
function isolatePage(doc: PDFDocument, page: PDFPage) {
  const node = page.node
  const contents = node.Contents()
  const q = doc.context.register(doc.context.stream('q\n'))
  const Q = doc.context.register(doc.context.stream('\nQ\n'))
  const refs = contents instanceof PDFArray ? contents.asArray() : contents ? [node.get(PDFName.of('Contents'))!] : []
  node.set(PDFName.of('Contents'), doc.context.obj([q, ...refs, Q]))
}

/* ───────────── public API ───────────── */

export async function analyzePdf(bytes: ArrayBuffer, from: string, to: string, lang: Language, opts: LayoutOptions) {
  const src: PDFDocumentProxy = await loadPdfJs(bytes.slice(0))
  const pages: PageInfo[] = []
  const elements: TextElement[] = []
  const blockList: Block[] = []
  let ocrWorker: OcrWorker | null = null
  let ocrPages = 0

  try {
    for (let n = 1; n <= src.numPages; n++) {
      opts.signal?.throwIfAborted()
      opts.onProgress?.(Math.round(((n - 1) / src.numPages) * 100), `Analysing page ${n} of ${src.numPages}…`)
      const page = await src.getPage(n)
      const content = await page.getTextContent()
      const { items, rotated, width, height } = toItems(page, content)
      const letters = items.reduce((s, it) => s + (it.str.match(/\p{L}/gu)?.length ?? 0), 0)
      let blocks: Block[]
      let ocr = false
      if (letters < 12) {
        // Scanned / image-only page → find text and its position with OCR.
        opts.onProgress?.(Math.round(((n - 1) / src.numPages) * 100), `Reading scanned page ${n} with OCR…`)
        if (!ocrWorker) {
          const { createWorker } = await import('tesseract.js')
          const code = from === AUTO ? (to === 'en' ? 'hin+eng' : 'eng') : OCR_LANG[from] ?? 'eng'
          ocrWorker = await createWorker(code)
        }
        const s = renderScale(width, height) * 0.8
        const { canvas } = await renderPage(page, s)
        blocks = await ocrBlocks(canvas, s, ocrWorker)
        ocr = blocks.length > 0
        if (ocr) ocrPages++
      } else {
        blocks = buildBlocks(buildLines(items), width)
      }
      blocks.push(...rotated)
      computeRoom(blocks.filter((b) => !b.angle), width, height)
      pages.push({ width, height, view: page.view, blocks, ocr })
      blocks.forEach((b, i) => {
        blockList.push(b)
        elements.push({
          id: `p${n}.b${i}`,
          page: n,
          originalText: b.text,
          x: b.x0, y: b.top, width: b.x1 - b.x0, height: b.bottom - b.top,
          fontSize: Math.round(b.size * 10) / 10,
          alignment: b.align,
          ocr: b.ocr,
        })
      })
    }
  } finally {
    await ocrWorker?.terminate()
  }

  let shrunk = 0
  let overflow = 0
  const warnings: string[] = []

  const rebuild = async (translations: string[], onProgress?: (p: number, label: string) => void): Promise<Blob> => {
    const out = await loadPdfLib(bytes)
    const outPages = out.getPages()
    const canStrip = !out.isEncrypted
    if (!canStrip) warnings.push('This PDF is encrypted, so the original text was covered instead of removed.')
    const seen = new Set<string>()
    const stripped = pages.map((p, i) => (p.blocks.length && !p.ocr && canStrip ? stripPageText(out, outPages[i], seen) : false))
    const strippedDoc = stripped.some(Boolean) ? await loadPdfJs(await out.save({ useObjectStreams: false })) : null
    try { await document.fonts.load(cssFont(24, lang.font), translations.find(Boolean)?.slice(0, 200) || 'a') } catch { /* offline fonts */ }

    let k = 0
    for (let n = 1; n <= pages.length; n++) {
      opts.signal?.throwIfAborted()
      const info = pages[n - 1]
      const indices = info.blocks.map(() => k++)
      if (!info.blocks.length) continue
      onProgress?.(Math.round(((n - 1) / pages.length) * 100), `Rebuilding page ${n} of ${pages.length}…`)
      const page = await src.getPage(n)
      const S = renderScale(info.width, info.height)
      const orig = await renderPage(page, S)
      const strip = stripped[n - 1] && strippedDoc ? await renderPage(await strippedDoc.getPage(n), S) : null
      const content = await page.getTextContent()
      const styles = content.styles as Record<string, { fontFamily: string }>

      const overlay = document.createElement('canvas')
      overlay.width = orig.canvas.width
      overlay.height = orig.canvas.height
      const ctx = overlay.getContext('2d')!
      ctx.textBaseline = 'alphabetic'
      ctx.direction = lang.rtl ? 'rtl' : 'ltr'

      info.blocks.forEach((b, j) => {
        const el = elements[indices[j]]
        const text = translations[indices[j]] || b.text
        el.translatedText = text
        const r = pxRect(b, S, orig.pixels)
        const colors = sampleColors(orig.pixels, r)
        el.color = colors.fg
        // Cover the old text when it is still visible (scan, image text, or page we couldn't edit).
        const cover = b.ocr || !strip || changedRatio(orig.pixels, strip.pixels, r) < 0.003
        if (cover) {
          ctx.fillStyle = colors.bg
          ctx.fillRect(r.x - 1, r.y - 1, r.w + 2, r.h + 2)
        }
        const st = b.ocr ? { bold: false, italic: false, serif: false, mono: false, name: '' } : fontStyle(page, b.fontName, styles)
        Object.assign(el, { bold: st.bold, italic: st.italic, font: st.name || undefined })
        const family = familyFor(lang, st.serif, st.mono)
        ctx.fillStyle = colors.fg

        if (b.angle) {
          ctx.save()
          ctx.translate(b.x0 * S, b.bottom * S)
          ctx.rotate(b.angle)
          let size = b.size * S
          ctx.font = cssFont(size, family, st.bold, st.italic)
          const w = ctx.measureText(text).width
          if (w > b.maxW * S * 1.05) { size *= Math.max(0.6, (b.maxW * S) / w); shrunk++ }
          ctx.font = cssFont(size, family, st.bold, st.italic)
          ctx.textAlign = 'left'
          ctx.fillText(text, 0, 0)
          ctx.restore()
          return
        }

        const fit = fitText({ text, family, bold: st.bold, italic: st.italic, fontSize: b.size * S, lineHeight: b.pitch * S, maxW: b.maxW * S, maxH: b.maxH * S })
        if (fit.scale < 0.999) shrunk++
        if (fit.overflow) overflow++
        ctx.font = cssFont(fit.fontSize, family, st.bold, st.italic)
        const left = b.x0 * S
        const center = ((b.x0 + b.x1) / 2) * S
        // Anchor: centre/right blocks keep their axis; RTL text (Urdu) is right-aligned inside its box.
        const widest = Math.max(...fit.lines.map((l) => ctx.measureText(l).width))
        const anchor: CanvasTextAlign = b.align === 'center' ? 'center' : b.align === 'right' || lang.rtl ? 'right' : 'left'
        const anchorX = anchor === 'center' ? center : anchor === 'right' ? (b.align === 'right' ? b.x1 * S : left + Math.max((b.x1 - b.x0) * S, widest)) : left
        let y = b.top * S + fit.fontSize * 0.82
        fit.lines.forEach((line, li) => {
          const justify = b.align === 'justify' && li < fit.lines.length - 1 && b.lines.length > 1
          if (justify && !lang.rtl) {
            const words = line.split(' ')
            const natural = ctx.measureText(line.replace(/ /g, '')).width
            const width = (b.x1 - b.x0) * S
            const gap = words.length > 1 ? (width - natural) / (words.length - 1) : 0
            if (gap > 0 && gap < fit.fontSize * 1.2) {
              let x = left
              ctx.textAlign = 'left'
              for (const w of words) { ctx.fillText(w, x, y); x += ctx.measureText(w).width + gap }
              y += fit.lineHeight
              return
            }
          }
          ctx.textAlign = anchor
          ctx.fillText(line, anchorX, y)
          y += fit.lineHeight
        })
      })

      const png = await canvasToBlob(overlay, 'image/png')
      const img = await out.embedPng(new Uint8Array(await png.arrayBuffer()))
      const target = outPages[n - 1]
      if (!stripped[n - 1]) isolatePage(out, target)
      const [vx0, vy0, vx1, vy1] = info.view
      target.drawImage(img, { x: vx0, y: vy0, width: vx1 - vx0, height: vy1 - vy0 })
    }
    if (out.getPageCount() !== src.numPages) warnings.push('Page count changed during reconstruction.')
    return new Blob([(await out.save()) as BlobPart], { type: 'application/pdf' })
  }

  return {
    elements,
    pages: src.numPages,
    ocrPages,
    rebuild,
    shrunk: () => shrunk,
    overflow: () => overflow,
    warnings: () => warnings,
  }
}
