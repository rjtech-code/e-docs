import { extractPageText, loadPdfJs, readFileAsArrayBuffer } from './pdfCore'

export const TEXT_ACCEPT = '.pdf,.docx,.txt,.md,.csv,application/pdf,text/plain'

/** Pulls plain text out of a PDF, DOCX or text file so it can be translated. */
export async function extractDocumentText(file: File, onProgress?: (percent: number) => void): Promise<string> {
  const ext = (file.name.split('.').pop() || '').toLowerCase()
  if (ext === 'pdf' || file.type === 'application/pdf') {
    const doc = await loadPdfJs(await readFileAsArrayBuffer(file))
    const pages: string[] = []
    for (let i = 1; i <= doc.numPages; i++) {
      pages.push((await extractPageText(doc, i)).trim())
      onProgress?.(Math.round((i / doc.numPages) * 100))
    }
    return pages.filter(Boolean).join('\n\n')
  }
  if (ext === 'docx') {
    const mammoth = (await import('mammoth')).default
    return (await mammoth.extractRawText({ arrayBuffer: await readFileAsArrayBuffer(file) })).value.trim()
  }
  if (['txt', 'md', 'csv', 'text'].includes(ext) || file.type.startsWith('text/')) return (await file.text()).replace(/^﻿/, '').trim()
  throw new Error('Unsupported file type. Use PDF, DOCX or TXT.')
}
