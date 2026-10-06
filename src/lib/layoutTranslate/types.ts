// Layout-preserving document translation — shared types.
//
// Pipeline: upload → file-type detection → structure analysis → text-element extraction
// (text + position/style metadata) → translation engine → translated-text mapping →
// reconstruction of the ORIGINAL document → layout validation → final file (same type).

export type DocKind = 'pdf' | 'docx' | 'pptx'

export type Alignment = 'left' | 'center' | 'right' | 'justify'

/** One translatable unit and everything needed to put its translation back in the same place. */
export interface TextElement {
  id: string
  /** 1-based page (PDF) or slide (PPTX) number; 0 for flow documents (DOCX) and shared parts. */
  page: number
  /** Where it lives, e.g. "word/document.xml" or "ppt/slides/slide3.xml" (for debugging/reports). */
  part?: string
  originalText: string
  translatedText?: string
  /** Position/size in points (PDF: top-left page origin; PPTX: slide coordinates). Absent for flow text. */
  x?: number
  y?: number
  width?: number
  height?: number
  font?: string
  fontSize?: number
  bold?: boolean
  italic?: boolean
  color?: string
  alignment?: Alignment
  /** Text came from OCR of a scanned page. */
  ocr?: boolean
}

export interface LayoutReport {
  kind: DocKind
  /** Pages (PDF) / slides (PPTX) in the input and in the output — must match. */
  inputPages: number
  outputPages: number
  elements: number
  translated: number
  /** Elements whose text had to be shrunk to fit its original box. */
  shrunk: number
  /** Elements that still overflow their box at the smallest allowed size. */
  overflow: number
  /** PDF pages that were read with OCR (scanned). */
  ocrPages: number
  warnings: string[]
}

export interface LayoutResult {
  blob: Blob
  fileName: string
  elements: TextElement[]
  report: LayoutReport
  detected?: string
}

export interface LayoutOptions {
  onProgress?: (percent: number, label: string) => void
  signal?: AbortSignal
}
