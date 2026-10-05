import { PDFDocument } from 'pdf-lib'
import { Document, Packer, Paragraph, TextRun } from 'docx'
import type { Language } from './translate'
import { canvasToBlob } from './pdfCore'

/** Plain UTF-8 text (with BOM so Windows Notepad shows Indic scripts correctly). */
export const textBlob = (text: string) => new Blob(['﻿', text], { type: 'text/plain;charset=utf-8' })

export async function docxBlob(text: string, lang: Language): Promise<Blob> {
  const paragraphs = text.split('\n').map(
    (line) =>
      new Paragraph({
        bidirectional: !!lang.rtl,
        spacing: { after: 120, line: 320 },
        children: [new TextRun({ text: line, size: 24, rightToLeft: !!lang.rtl, font: { ascii: 'Calibri', hAnsi: 'Calibri', cs: lang.docxFont } })],
      }),
  )
  return Packer.toBlob(new Document({ sections: [{ children: paragraphs }] }))
}

/**
 * Draws the text onto A4 canvases using the browser's own text shaping (so Devanagari, Bengali,
 * Tamil, Urdu… render correctly) and packs the pages into a PDF. Pages are images — use Word/TXT
 * when editable text is needed.
 */
export async function pdfBlob(text: string, lang: Language): Promise<Blob> {
  const W = 1240, H = 1754, M = 110, size = 28
  const lineH = Math.round(size * 1.7)
  const family = lang.font
  try { await document.fonts.load(`${size}px ${family}`, text.slice(0, 400)) } catch { /* offline fonts */ }

  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas is not available in this browser')
  const rtl = !!lang.rtl
  const maxW = W - M * 2
  const pdf = await PDFDocument.create()
  let pageNo = 0
  let y = 0

  const startPage = () => {
    pageNo++
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, W, H)
    ctx.fillStyle = '#12151f'
    ctx.font = `${size}px ${family}`
    ctx.textBaseline = 'alphabetic'
    ctx.direction = rtl ? 'rtl' : 'ltr'
    ctx.textAlign = rtl ? 'right' : 'left'
    y = M + size
  }
  const finishPage = async () => {
    ctx.save()
    ctx.fillStyle = '#8a90a5'
    ctx.font = `20px ${family}`
    ctx.direction = 'ltr'
    ctx.textAlign = 'center'
    ctx.fillText(String(pageNo), W / 2, H - 60)
    ctx.restore()
    const blob = await canvasToBlob(canvas, 'image/jpeg', 0.92)
    const img = await pdf.embedJpg(new Uint8Array(await blob.arrayBuffer()))
    pdf.addPage([595.28, 841.89]).drawImage(img, { x: 0, y: 0, width: 595.28, height: 841.89 })
  }
  const wrap = (paragraph: string): string[] => {
    if (paragraph.trim() === '') return ['']
    const lines: string[] = []
    let cur = ''
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const cand = cur ? `${cur} ${word}` : word
      if (ctx.measureText(cand).width <= maxW) { cur = cand; continue }
      if (cur) { lines.push(cur); cur = '' }
      if (ctx.measureText(word).width <= maxW) { cur = word; continue }
      let part = ''
      for (const ch of Array.from(word)) {
        if (ctx.measureText(part + ch).width > maxW) { lines.push(part); part = ch } else part += ch
      }
      cur = part
    }
    if (cur) lines.push(cur)
    return lines
  }

  startPage()
  for (const paragraph of text.split('\n')) {
    for (const line of wrap(paragraph)) {
      if (y > H - M - 30) { await finishPage(); startPage() }
      if (line) ctx.fillText(line, rtl ? W - M : M, y)
      y += lineH
    }
  }
  await finishPage()
  return new Blob([(await pdf.save()) as BlobPart], { type: 'application/pdf' })
}
