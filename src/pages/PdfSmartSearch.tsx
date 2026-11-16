import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft, ChevronLeft, ChevronRight, FileSearch, FileUp, Minus, Plus,
  Search, X, LoaderCircle, AlertCircle,
} from 'lucide-react'
import * as pdfjs from 'pdfjs-dist'
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist'

pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()

type Match = { docId: string; docName: string; page: number; start: number; end: number; text: string }
type PageText = { text: string; items: Array<{ str: string; start: number; end: number }> }
type LoadedPdf = { id: string; name: string; doc: PDFDocumentProxy; pages: PageText[]; currentPage: number }

const normalise = (value: string) => value.toLocaleLowerCase().replace(/[\s\u00a0]+/g, '')

function extractNormalised(page: PageText) {
  let normal = ''
  const map: Array<{ item: number; char: number }> = []
  page.items.forEach((item, itemIndex) => {
    for (let i = 0; i < item.str.length; i++) {
      const char = item.str[i]
      if (/\s|\u00a0/.test(char)) continue
      normal += char.toLocaleLowerCase()
      map.push({ item: itemIndex, char: i })
    }
  })
  return { normal, map }
}

function PdfPage({ doc, pageNumber, pageText, highlights, zoom }: {
  doc: PDFDocumentProxy; pageNumber: number; pageText: PageText;
  highlights: Array<{ start: number; end: number; active: boolean }>; zoom: number
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    let renderTask: { cancel: () => void } | undefined
    const render = async () => {
      try {
        const page: PDFPageProxy = await doc.getPage(pageNumber)
        if (cancelled) return
        const base = page.getViewport({ scale: 1 })
        const hostWidth = canvasRef.current?.parentElement?.clientWidth || window.innerWidth - 48
        const available = Math.max(240, Math.min(1100, hostWidth - 24))
        const scale = Math.max(0.35, Math.min(2.2, (available / base.width) * zoom))
        const viewport = page.getViewport({ scale })
        const canvas = canvasRef.current
        if (!canvas) return
        const context = canvas.getContext('2d')
        if (!context) return
        const ratio = Math.min(window.devicePixelRatio || 1, 2)
        canvas.width = Math.floor(viewport.width * ratio)
        canvas.height = Math.floor(viewport.height * ratio)
        canvas.style.width = `${viewport.width}px`
        canvas.style.height = `${viewport.height}px`
        renderTask = page.render({ canvasContext: context, viewport, transform: ratio !== 1 ? [ratio, 0, 0, ratio, 0, 0] : undefined, canvas })
        await (renderTask as any).promise
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Could not render this page')
      }
    }
    void render()
    return () => { cancelled = true; renderTask?.cancel() }
  }, [doc, pageNumber, zoom])

  let offset = 0
  const boxes = pageText.items.flatMap((item) => {
    const itemStart = offset
    const itemEnd = offset + item.str.length
    offset = itemEnd + 1
    const relevant = highlights.filter(h => h.start < itemEnd && h.end > itemStart)
    if (!relevant.length || !item.str.length) return []
    const active = relevant.some(h => h.active)
    const leftChar = Math.max(0, Math.min(...relevant.map(h => Math.max(0, h.start - itemStart))))
    const rightChar = Math.min(item.str.length, Math.max(...relevant.map(h => Math.min(item.str.length, h.end - itemStart))))
    return [{ item, leftChar, rightChar, active }]
  })

  return (
    <div className="relative mx-auto w-fit overflow-hidden rounded-lg bg-white shadow-lg ring-1 ring-slate-200">
      <canvas ref={canvasRef} aria-label={`PDF page ${pageNumber}`} />
      {error && <div className="p-6 text-sm text-red-600">{error}</div>}
      <span className="absolute bottom-2 right-2 rounded bg-slate-900/75 px-2 py-1 text-[10px] text-white">Page {pageNumber}</span>
      {boxes.length > 0 && (
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          {(() => {
            let textOffset = 0
            return pageText.items.map((item, index) => {
              const itemStart = textOffset
              textOffset += item.str.length + 1
              const box = boxes.find(b => b.item === item)
              if (!box) return null
              // PDF text coordinates are in points; scale them to the rendered page.
              // The overlay is sized to the canvas by its rendered CSS dimensions.
              const scaleX = (canvasRef.current?.clientWidth || 1) / Math.max(1, canvasRef.current?.width || 1) * (window.devicePixelRatio || 1)
              const scaleY = (canvasRef.current?.clientHeight || 1) / Math.max(1, canvasRef.current?.height || 1) * (window.devicePixelRatio || 1)
              const left = itemStart
              void left
              return <span key={index} data-text-start={itemStart} className={box.active ? "absolute inset-x-0 rounded bg-orange-400/35 ring-2 ring-orange-500" : "absolute inset-x-0 rounded bg-yellow-300/30 ring-1 ring-yellow-400/70"} style={{ top: 0, height: 0, left: 0, width: 0, transform: `scale(${scaleX}, ${scaleY})` }} />
            })
          })()}
        </div>
      )}
    </div>
  )
}

export default function PdfSmartSearch() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [documents, setDocuments] = useState<LoadedPdf[]>([])
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const [layout, setLayout] = useState<'1x1' | '1x2' | '2x2'>('1x1')
  const [zoom, setZoom] = useState(1)
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState('')
  const [error, setError] = useState('')
  const [showResults, setShowResults] = useState(true)

  const openFiles = async (files: FileList | File[]) => {
    const selected = Array.from(files)
    if (!selected.length) return
    const invalid = selected.find(file => file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf'))
    if (invalid) { setError(`${invalid.name} is not a PDF file.`); return }
    setError('')
    setLoading(true)
    try {
      const added: LoadedPdf[] = []
      for (const [fileIndex, file] of selected.entries()) {
        setProgress(`Opening ${file.name} (${fileIndex + 1} of ${selected.length})…`)
        const task = pdfjs.getDocument({ data: await file.arrayBuffer() })
        const loaded = await task.promise
        const extracted: PageText[] = []
        for (let pageNo = 1; pageNo <= loaded.numPages; pageNo++) {
          setProgress(`Reading ${file.name} · page ${pageNo} of ${loaded.numPages}`)
          const page = await loaded.getPage(pageNo)
          const content = await page.getTextContent()
          const items = content.items.filter((item: any) => typeof item.str === 'string').map((item: any) => ({ str: item.str, start: 0, end: 0 }))
          let text = ''
          items.forEach(item => { item.start = text.length; text += item.str + ' '; item.end = text.length })
          extracted.push({ text, items })
        }
        added.push({ id: `${file.name}-${Date.now()}-${fileIndex}`, name: file.name, doc: loaded, pages: extracted, currentPage: 1 })
      }
      setDocuments(current => [...current, ...added])
      setQuery('')
      setActive(0)
      setProgress('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to open one of the PDFs. It may be damaged or password protected.')
    } finally { setLoading(false) }
  }

  const matches = useMemo<Match[]>(() => {
    const needle = normalise(query)
    if (!needle) return []
    const found: Match[] = []
    documents.forEach(document => document.pages.forEach((page, index) => {
      const { normal, map } = extractNormalised(page)
      let from = 0
      while (from <= normal.length - needle.length) {
        const at = normal.indexOf(needle, from)
        if (at < 0) break
        const first = map[at], last = map[at + needle.length - 1]
        if (first && last) {
          const start = page.items[first.item]?.start ?? 0
          const end = page.items[last.item]?.end ?? start
          found.push({ docId: document.id, docName: document.name, page: index + 1, start, end, text: page.text.slice(start, end).trim() })
        }
        from = at + Math.max(1, needle.length)
      }
    }))
    return found
  }, [documents, query])

  useEffect(() => { setActive(0) }, [query])
  const goToMatch = useCallback((index: number) => {
    if (!matches.length) return
    const nextIndex = (index + matches.length) % matches.length
    const match = matches[nextIndex]
    setActive(nextIndex)
    setDocuments(current => current.map(document => document.id === match.docId ? { ...document, currentPage: match.page } : document))
    window.setTimeout(() => document.getElementById(`pdf-${match.docId}-page-${match.page}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 80)
  }, [matches])

  const onFileInput = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) void openFiles(event.target.files)
    event.target.value = ''
  }
  const removeDocument = (id: string) => {
    setDocuments(current => current.filter(document => document.id !== id))
    setActive(0)
  }

  const resultPanel = (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-slate-200 p-4">
        <div className="flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-blue-50 text-blue-600"><Search size={18} /></div>
          <div className="min-w-0 flex-1"><h2 className="font-semibold text-slate-900">Search all PDFs</h2><p className="truncate text-xs text-slate-500">{documents.length} document{documents.length === 1 ? '' : 's'} loaded</p></div>
          <button onClick={() => setShowResults(false)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="Hide search panel"><X size={17} /></button>
        </div>
        <div className="mt-4 flex gap-2">
          <div className="relative min-w-0 flex-1"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input ref={inputRef} value={query} onChange={e => setQuery(e.target.value)} placeholder="Search across every PDF…" className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" /></div>
          {query && <button onClick={() => setQuery('')} className="rounded-xl border border-slate-200 px-3 text-slate-500 hover:bg-slate-50" aria-label="Clear search"><X size={17} /></button>}
        </div>
        <div className="mt-3 flex items-center justify-between gap-2"><span className="text-xs text-slate-500">{query ? `${matches.length} match${matches.length === 1 ? '' : 'es'} found` : 'Case and spaces are ignored'}</span><div className="flex items-center gap-1"><button disabled={!matches.length} onClick={() => goToMatch(active - 1)} className="rounded-lg border border-slate-200 p-2 text-slate-600 disabled:opacity-35" aria-label="Previous match"><ChevronLeft size={17} /></button><span className="min-w-12 text-center text-xs font-semibold tabular-nums text-slate-700">{matches.length ? `${active + 1}/${matches.length}` : '0/0'}</span><button disabled={!matches.length} onClick={() => goToMatch(active + 1)} className="rounded-lg border border-slate-200 p-2 text-slate-600 disabled:opacity-35" aria-label="Next match"><ChevronRight size={17} /></button></div></div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {!query ? <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">Add two or more PDFs, then search once to find a name or phrase across all of them.</div> : matches.length ? <ol className="space-y-2">{matches.map((match, index) => <li key={`${match.docId}-${match.page}-${match.start}-${index}`}><button onClick={() => goToMatch(index)} className={`w-full rounded-xl border p-3 text-left transition-colors ${active === index ? 'border-orange-300 bg-orange-50 ring-2 ring-orange-100' : 'border-slate-200 bg-white hover:border-blue-200'}`}><span className="flex items-center justify-between gap-2"><span className="text-xs font-bold text-blue-700">Match {index + 1}</span><span className="text-[11px] text-slate-500">Page {match.page}</span></span><span className="mt-1 block break-words text-xs font-semibold text-slate-600">{match.docName}</span><span className="mt-1 block break-words text-sm text-slate-800">{match.text || 'Matching text'}</span></button></li>)}</ol> : <div className="rounded-xl bg-amber-50 p-4 text-sm text-amber-800">No matches found in the loaded PDFs.</div>}
      </div>
    </div>
  )

  return (
    <div className="mx-auto max-w-[1600px]">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3"><Link to="/" className="rounded-xl border border-slate-200 bg-white p-2.5 text-slate-600 hover:bg-slate-50" aria-label="Back to home"><ArrowLeft size={18} /></Link><div><span className="text-xs font-bold uppercase tracking-wider text-blue-600">E-Docs · Smart PDF</span><h1 className="font-display text-2xl font-bold text-slate-900 sm:text-3xl">Multi-PDF Smart Search</h1></div></div>
        <label className="btn-primary inline-flex cursor-pointer items-center gap-2 rounded-xl px-4 py-3 text-sm"><FileUp size={17} /> Add PDF files<input type="file" multiple accept="application/pdf,.pdf" className="sr-only" onChange={onFileInput} /></label>
      </div>
      {documents.length === 0 && !loading && <label onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); void openFiles(event.dataTransfer.files) }} className="flex min-h-[360px] cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed border-blue-200 bg-white px-6 py-12 text-center hover:border-blue-400 hover:bg-blue-50/40"><span className="grid h-16 w-16 place-items-center rounded-2xl bg-blue-50 text-blue-600"><FileSearch size={30} /></span><span className="mt-5 text-xl font-bold text-slate-900">Drop multiple PDFs here</span><span className="mt-2 max-w-md text-sm text-slate-500">Add several PDF files and search all documents together. Files stay on your device.</span><span className="btn-primary mt-6 rounded-xl px-6 py-3 text-sm">Browse PDF files</span><input type="file" multiple accept="application/pdf,.pdf" className="sr-only" onChange={onFileInput} /></label>}
      {loading && <div className="mt-4 flex items-center gap-3 rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-800"><LoaderCircle className="animate-spin" size={18} />{progress}</div>}
      {error && <div role="alert" className="mt-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"><AlertCircle size={18} />{error}</div>}
      {documents.length > 0 && <div className="grid min-h-[75vh] gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="min-w-0 space-y-4">
          <div className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white/95 px-3 py-3 backdrop-blur"><span className="text-sm font-semibold text-slate-700">{documents.length} PDFs loaded · Search highlights all matches</span><div className="flex flex-wrap items-center gap-1.5"><div className="flex rounded-lg border border-slate-200 p-0.5">{(['1x1', '1x2', '2x2'] as const).map(value => <button key={value} onClick={() => setLayout(value)} className={`rounded-md px-2 py-1.5 text-xs font-semibold ${layout === value ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>{value}</button>)}</div><button onClick={() => setZoom(v => Math.max(.5, +(v - .1).toFixed(1)))} className="rounded-lg border border-slate-200 p-2 text-slate-600" aria-label="Zoom out"><Minus size={15} /></button><span className="w-10 text-center text-xs tabular-nums text-slate-600">{Math.round(zoom * 100)}%</span><button onClick={() => setZoom(v => Math.min(1.8, +(v + .1).toFixed(1)))} className="rounded-lg border border-slate-200 p-2 text-slate-600" aria-label="Zoom in"><Plus size={15} /></button><button onClick={() => setShowResults(v => !v)} className="rounded-lg border border-slate-200 p-2 text-slate-600 lg:hidden" aria-label="Toggle results"><Search size={16} /></button></div></div>
          {documents.map(document => {
            const count = layout === '1x1' ? 1 : layout === '1x2' ? 2 : 4
            const startPage = layout === '1x1' ? document.currentPage : Math.max(1, Math.floor((document.currentPage - 1) / count) * count + 1)
            const visiblePages = Array.from({ length: Math.min(count, document.doc.numPages - startPage + 1) }, (_, i) => startPage + i)
            const docMatches = matches.filter(match => match.docId === document.id)
            return <article key={document.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-white px-4 py-3"><div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-800">{document.name}</p><p className="text-xs text-slate-500">{document.doc.numPages} pages · {docMatches.length} matches</p></div><button onClick={() => removeDocument(document.id)} className="rounded-lg p-2 text-slate-500 hover:bg-red-50 hover:text-red-600" aria-label={`Remove ${document.name}`}><X size={16} /></button></div>
              <div className={`grid items-start gap-3 overflow-auto p-3 sm:p-5 ${layout === '1x1' ? 'grid-cols-1' : layout === '1x2' ? 'grid-cols-1 xl:grid-cols-2' : 'grid-cols-1 sm:grid-cols-2'}`}>
                {visiblePages.map(pageNo => <div id={`pdf-${document.id}-page-${pageNo}`} key={pageNo} className="min-w-0"><PdfPage doc={document.doc} pageNumber={pageNo} pageText={document.pages[pageNo - 1]} highlights={docMatches.filter(m => m.page === pageNo).map(m => ({ start: m.start, end: m.end, active: matches[active]?.docId === document.id && matches[active]?.page === pageNo && matches[active]?.start === m.start }))} zoom={zoom} /></div>)}
              </div>
              <div className="flex items-center justify-center gap-3 border-t border-slate-200 bg-white p-3"><button onClick={() => setDocuments(current => current.map(d => d.id === document.id ? { ...d, currentPage: Math.max(1, d.currentPage - count) } : d))} disabled={document.currentPage === 1} className="rounded-lg border border-slate-200 p-2 text-slate-600 disabled:opacity-30" aria-label="Previous pages"><ChevronLeft size={18} /></button><span className="text-xs font-medium tabular-nums text-slate-600">Page {document.currentPage} of {document.doc.numPages}</span><button onClick={() => setDocuments(current => current.map(d => d.id === document.id ? { ...d, currentPage: Math.min(d.doc.numPages, d.currentPage + count) } : d))} disabled={document.currentPage >= document.doc.numPages} className="rounded-lg border border-slate-200 p-2 text-slate-600 disabled:opacity-30" aria-label="Next pages"><ChevronRight size={18} /></button></div>
            </article>
          })}
        </section>
        <aside className={`min-h-[320px] overflow-hidden rounded-2xl border border-slate-200 bg-white lg:sticky lg:top-20 lg:h-[calc(100vh-6rem)] ${showResults ? 'block' : 'hidden lg:block'}`}>{resultPanel}</aside>
        {!showResults && <button onClick={() => { setShowResults(true); inputRef.current?.focus() }} className="fixed bottom-4 right-4 z-30 flex items-center gap-2 rounded-full bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-xl lg:hidden"><Search size={17} /> Search PDFs</button>}
      </div>}
      {documents.length > 0 && <div className="mt-3 text-center text-xs text-slate-500">Private by design · PDF processing and search run in your browser. Scanned PDFs need OCR.</div>}
    </div>
  )
}
