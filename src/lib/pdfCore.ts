import { PDFDocument } from 'pdf-lib'
import { pdfjsLib } from './pdfjsSetup'
import type { PDFDocumentProxy } from 'pdfjs-dist'

/** Trigger a browser download for a Blob. */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}

export function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as ArrayBuffer)
    reader.onerror = reject
    reader.readAsArrayBuffer(file)
  })
}

export function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

/** Load a pdf-lib document, tolerating restricted-permission encryption. */
export async function loadPdfLib(bytes: ArrayBuffer | Uint8Array): Promise<PDFDocument> {
  return PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false })
}

/** Load a pdf.js document for rendering / text extraction. */
export async function loadPdfJs(bytes: ArrayBuffer | Uint8Array): Promise<PDFDocumentProxy> {
  const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  const task = pdfjsLib.getDocument({ data })
  return task.promise
}

export async function renderPageToCanvas(
  doc: PDFDocumentProxy,
  pageNumber: number,
  scale = 1.5,
): Promise<HTMLCanvasElement> {
  const page = await doc.getPage(pageNumber)
  const viewport = page.getViewport({ scale })
  const canvas = document.createElement('canvas')
  canvas.width = Math.ceil(viewport.width)
  canvas.height = Math.ceil(viewport.height)
  const ctx = canvas.getContext('2d')!
  await page.render({ canvasContext: ctx, viewport, canvas }).promise
  return canvas
}

export function canvasToBlob(canvas: HTMLCanvasElement, type = 'image/jpeg', quality = 0.92): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), type, quality)
  })
}

export async function extractPageText(doc: PDFDocumentProxy, pageNumber: number): Promise<string> {
  const page = await doc.getPage(pageNumber)
  const content = await page.getTextContent()
  // Group items by approximate line (y position) to keep basic line breaks.
  const lines: { y: number; parts: string[] }[] = []
  for (const item of content.items as any[]) {
    if (typeof item.str !== 'string') continue
    const y = Math.round(item.transform[5])
    let line = lines.find((l) => Math.abs(l.y - y) < 3)
    if (!line) {
      line = { y, parts: [] }
      lines.push(line)
    }
    line.parts.push(item.str)
  }
  lines.sort((a, b) => b.y - a.y)
  return lines.map((l) => l.parts.join(' ')).join('\n')
}

export interface WordLike {
  str: string
  x: number
  y: number
  width: number
  height: number
}

export async function extractPageWords(doc: PDFDocumentProxy, pageNumber: number): Promise<{ words: WordLike[]; width: number; height: number }> {
  const page = await doc.getPage(pageNumber)
  const viewport = page.getViewport({ scale: 1 })
  const content = await page.getTextContent()
  const words: WordLike[] = []
  for (const item of content.items as any[]) {
    if (typeof item.str !== 'string' || !item.str.trim()) continue
    const [a, , , d, e, f] = item.transform
    words.push({
      str: item.str,
      x: e,
      y: f,
      width: item.width ?? Math.abs(a) * item.str.length,
      height: Math.abs(d) || 10,
    })
  }
  return { words, width: viewport.width, height: viewport.height }
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 2)} ${units[i]}`
}

export function stripExt(filename: string): string {
  return filename.replace(/\.[^.]+$/, '')
}

export async function pdfPageCount(bytes: ArrayBuffer): Promise<number> {
  const doc = await loadPdfLib(bytes)
  return doc.getPageCount()
}

/** Parse a page-range string like "1-3,5,8-10" into a zero-based, deduped, sorted index list. */
export function parsePageRanges(input: string, pageCount: number): number[] {
  const set = new Set<number>()
  const parts = input.split(',').map((p) => p.trim()).filter(Boolean)
  for (const part of parts) {
    const m = part.match(/^(\d+)\s*-\s*(\d+)$/)
    if (m) {
      let start = parseInt(m[1], 10)
      let end = parseInt(m[2], 10)
      if (start > end) [start, end] = [end, start]
      for (let i = start; i <= end; i++) {
        if (i >= 1 && i <= pageCount) set.add(i - 1)
      }
    } else if (/^\d+$/.test(part)) {
      const n = parseInt(part, 10)
      if (n >= 1 && n <= pageCount) set.add(n - 1)
    }
  }
  return Array.from(set).sort((a, b) => a - b)
}
