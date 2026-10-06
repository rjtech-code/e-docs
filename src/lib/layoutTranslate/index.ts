// Layout-preserving document translation.
//
//   UPLOAD → FILE TYPE DETECTION → STRUCTURE ANALYSIS → TEXT ELEMENT EXTRACTION
//   (text + position/metadata) → TRANSLATION ENGINE → TRANSLATED TEXT MAPPING
//   → ORIGINAL DOCUMENT RECONSTRUCTION → LAYOUT VALIDATION → FINAL FILE (same type)
//
// Translation (translateSegments → the existing translateText engines) is completely separate
// from reconstruction (analyzeDocx / analyzePptx / analyzePdf → rebuild).
import { getLanguage } from '../translate'
import { readFileAsArrayBuffer, stripExt } from '../pdfCore'
import type { DocKind, LayoutOptions, LayoutResult } from './types'
import { translateSegments } from './segments'

export type { DocKind, LayoutResult, LayoutReport, TextElement } from './types'

export const LAYOUT_ACCEPT = '.pdf,.docx,.pptx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.presentationml.presentation'

export class UnsupportedDocumentError extends Error {}

/** File type detection by signature first (the extension can lie), then by name. */
export async function detectDocKind(file: File): Promise<DocKind | null> {
  const head = new Uint8Array(await file.slice(0, 5).arrayBuffer())
  const ext = (file.name.split('.').pop() || '').toLowerCase()
  if (head[0] === 0x25 && head[1] === 0x50 && head[2] === 0x44 && head[3] === 0x46) return 'pdf' // %PDF
  const isZip = head[0] === 0x50 && head[1] === 0x4b
  if (isZip && ext === 'docx') return 'docx'
  if (isZip && ext === 'pptx') return 'pptx'
  if (ext === 'doc' || ext === 'ppt') {
    throw new UnsupportedDocumentError(`Old .${ext} files can't be edited in the browser. Open it in ${ext === 'doc' ? 'Word' : 'PowerPoint'} and "Save As" .${ext}x, then upload that.`)
  }
  return null
}

const EXT: Record<DocKind, string> = { pdf: 'pdf', docx: 'docx', pptx: 'pptx' }

export async function translateDocument(file: File, from: string, to: string, opts: LayoutOptions = {}): Promise<LayoutResult> {
  const lang = getLanguage(to)
  if (!lang) throw new Error('Unknown target language')
  const kind = await detectDocKind(file)
  if (!kind) throw new UnsupportedDocumentError('Unsupported file type. Use PDF, DOCX or PPTX.')
  const bytes = await readFileAsArrayBuffer(file)
  const progress = (start: number, span: number) => (p: number, label: string) => opts.onProgress?.(Math.round(start + (p / 100) * span), label)

  // 1–3. structure analysis + text elements with position/style metadata
  opts.onProgress?.(0, 'Analysing document layout…')
  const analysis =
    kind === 'pdf'
      ? await (await import('./pdf')).analyzePdf(bytes, from, to, lang, { signal: opts.signal, onProgress: progress(0, 25) })
      : kind === 'docx'
        ? await (await import('./docx')).analyzeDocx(bytes, lang)
        : await (await import('./pptx')).analyzePptx(bytes, lang)
  const { elements } = analysis
  if (elements.length === 0 || !elements.some((e) => /\p{L}/u.test(e.originalText))) {
    throw new UnsupportedDocumentError('No text was found in this document to translate.')
  }

  // 4. translation engine (separate from rendering)
  opts.onProgress?.(25, `Translating ${elements.length} text blocks…`)
  const { translations, detected } = await translateSegments(elements.map((e) => e.originalText), from, to, {
    signal: opts.signal,
    onProgress: (p) => opts.onProgress?.(Math.round(25 + p * 0.5), 'Translating…'),
  })
  // 5. mapping: every element keeps its own translation
  elements.forEach((e, i) => { e.translatedText = translations[i] })

  // 6. reconstruct the ORIGINAL document with the translated text in place
  opts.onProgress?.(75, 'Placing translated text in the original layout…')
  const rebuildProgress = progress(75, 24)
  const blob = kind === 'pdf'
    ? await (analysis as Awaited<ReturnType<typeof import('./pdf')['analyzePdf']>>).rebuild(translations, rebuildProgress)
    : await analysis.rebuild(translations)

  // 7. layout validation report
  const warnings = 'warnings' in analysis ? [...analysis.warnings()] : []
  let outputPages = analysis.pages
  if (kind === 'pdf') {
    const { loadPdfLib } = await import('../pdfCore')
    outputPages = (await loadPdfLib(await blob.arrayBuffer())).getPageCount()
    if (outputPages !== analysis.pages) warnings.push(`Page count changed (${analysis.pages} → ${outputPages}).`)
  }
  const translatedCount = elements.filter((e) => e.translatedText && e.translatedText !== e.originalText).length
  const overflow = analysis.overflow()
  if (overflow) warnings.push(`${overflow} text block${overflow === 1 ? '' : 's'} could not fully fit the original space even at a smaller size.`)
  opts.onProgress?.(100, 'Done')

  return {
    blob,
    fileName: `${stripExt(file.name)}-${to}.${EXT[kind]}`,
    elements,
    detected,
    report: {
      kind,
      inputPages: analysis.pages,
      outputPages,
      elements: elements.length,
      translated: translatedCount,
      shrunk: analysis.shrunk(),
      overflow,
      ocrPages: 'ocrPages' in analysis ? (analysis.ocrPages as number) : 0,
      warnings,
    },
  }
}
