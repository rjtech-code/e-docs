import { useRef, useState } from 'react'
import { PDFDocument } from 'pdf-lib'
import { EyeOff, Trash2 } from 'lucide-react'
import FileDrop from '../../components/FileDrop'
import { ToolShell, PrimaryButton, StatusBanner, DownloadCard } from '../../components/ToolShell'
import { downloadBlob, loadPdfJs, readFileAsArrayBuffer, renderPageToCanvas, canvasToBlob, stripExt } from '../../lib/pdfCore'
import { useToolHistory } from '../../hooks/useToolHistory'
import ToolHistoryPanel from '../../components/ToolHistoryPanel'

type Status = 'idle' | 'loading' | 'processing' | 'done' | 'error'

interface Box {
  id: number
  page: number
  x: number
  y: number
  w: number
  h: number
}

let nextId = 1

export default function RedactPdf() {
  const [file, setFile] = useState<File | null>(null)
  const [pageImages, setPageImages] = useState<string[]>([])
  const [pageIndex, setPageIndex] = useState(0)
  const [boxes, setBoxes] = useState<Box[]>([])
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState('')
  const [result, setResult] = useState<{ blob: Blob; name: string } | null>(null)
  const history = useToolHistory('redact-pdf', 'Redact PDF')
  const dragStart = useRef<{ x: number; y: number } | null>(null)
  const [draft, setDraft] = useState<{ x: number; y: number; w: number; h: number } | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const onFiles = async (files: File[]) => {
    const f = files[0]
    setFile(f ?? null)
    setPageImages([])
    setBoxes([])
    setResult(null)
    setStatus('idle')
    if (!f) return
    setStatus('loading')
    try {
      const bytes = await readFileAsArrayBuffer(f)
      const doc = await loadPdfJs(bytes)
      const imgs: string[] = []
      for (let i = 1; i <= doc.numPages; i++) {
        imgs.push((await renderPageToCanvas(doc, i, 1.5)).toDataURL('image/jpeg', 0.85))
      }
      setPageImages(imgs)
      setStatus('idle')
    } catch (e) {
      console.error(e)
      setError('Could not open this PDF.')
      setStatus('error')
    }
  }

  const startBox = (e: React.PointerEvent) => {
    if (!containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width
    const y = (e.clientY - rect.top) / rect.height
    dragStart.current = { x, y }
    setDraft({ x, y, w: 0, h: 0 })
  }
  const moveBox = (e: React.PointerEvent) => {
    if (!dragStart.current || !containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width
    const y = (e.clientY - rect.top) / rect.height
    const sx = dragStart.current.x
    const sy = dragStart.current.y
    setDraft({ x: Math.min(sx, x), y: Math.min(sy, y), w: Math.abs(x - sx), h: Math.abs(y - sy) })
  }
  const endBox = () => {
    if (draft && draft.w > 0.01 && draft.h > 0.01) {
      setBoxes((prev) => [...prev, { id: nextId++, page: pageIndex, ...draft }])
    }
    dragStart.current = null
    setDraft(null)
  }

  const removeBox = (id: number) => setBoxes((prev) => prev.filter((b) => b.id !== id))

  const apply = async () => {
    if (!file) return
    setStatus('processing')
    setError('')
    setResult(null)
    try {
      const bytes = await readFileAsArrayBuffer(file)
      const pdfjsDoc = await loadPdfJs(bytes)
      const out = await PDFDocument.create()

      for (let i = 1; i <= pdfjsDoc.numPages; i++) {
        const canvas = await renderPageToCanvas(pdfjsDoc, i, 2.5)
        const ctx = canvas.getContext('2d')!
        ctx.fillStyle = '#000'
        boxes
          .filter((b) => b.page === i - 1)
          .forEach((b) => {
            ctx.fillRect(b.x * canvas.width, b.y * canvas.height, b.w * canvas.width, b.h * canvas.height)
          })
        const jpgBlob = await canvasToBlob(canvas, 'image/jpeg', 0.88)
        const jpgBytes = new Uint8Array(await jpgBlob.arrayBuffer())
        const img = await out.embedJpg(jpgBytes)
        const page = out.addPage([img.width, img.height])
        page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height })
      }

      const outBytes = await out.save()
      const blob = new Blob([outBytes as BlobPart], { type: 'application/pdf' })
      const name = `${stripExt(file.name)}-redacted.pdf`
      setResult({ blob, name })
      history.saveResult(blob, name)
      setStatus('done')
    } catch (e) {
      console.error(e)
      setError('Could not redact this PDF.')
      setStatus('error')
    }
  }

  return (
    <ToolShell icon={EyeOff} title="Redact PDF" description="Draw black boxes over sensitive content — pages are flattened so nothing underneath can be recovered.">
      {pageImages.length === 0 && (
        <FileDrop accept="application/pdf" files={file ? [file] : []} onFiles={onFiles} label="Select a PDF file or drag & drop here" />
      )}
      {status === 'loading' && <p className="text-center text-muted-foreground py-8">Loading pages…</p>}

      {pageImages.length > 0 && (
        <>
          <div className="flex items-center justify-center gap-2 mb-4">
            <button disabled={pageIndex === 0} onClick={() => setPageIndex((p) => p - 1)} className="px-3 py-1.5 rounded-lg bg-surface text-foreground/80 border border-border hover:border-primary/40 disabled:opacity-30">
              ← Prev
            </button>
            <span className="text-sm text-muted-foreground">
              Page {pageIndex + 1} / {pageImages.length}
            </span>
            <button disabled={pageIndex === pageImages.length - 1} onClick={() => setPageIndex((p) => p + 1)} className="px-3 py-1.5 rounded-lg bg-surface text-foreground/80 border border-border hover:border-primary/40 disabled:opacity-30">
              Next →
            </button>
          </div>

          <div
            ref={containerRef}
            className="relative mx-auto max-w-lg select-none touch-none cursor-crosshair"
            onPointerDown={startBox}
            onPointerMove={moveBox}
            onPointerUp={endBox}
          >
            <img src={pageImages[pageIndex]} className="w-full rounded-lg shadow-md pointer-events-none" draggable={false} alt={`Page ${pageIndex + 1}`} />
            {boxes
              .filter((b) => b.page === pageIndex)
              .map((b) => (
                <div
                  key={b.id}
                  className="absolute bg-black group"
                  style={{ left: `${b.x * 100}%`, top: `${b.y * 100}%`, width: `${b.w * 100}%`, height: `${b.h * 100}%` }}
                >
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      removeBox(b.id)
                    }}
                    className="hidden group-hover:flex absolute -top-2 -right-2 w-5 h-5 bg-paper rounded-full items-center justify-center shadow"
                  >
                    <Trash2 size={11} className="text-red-500" />
                  </button>
                </div>
              ))}
            {draft && (
              <div
                className="absolute bg-black/60 border border-white"
                style={{ left: `${draft.x * 100}%`, top: `${draft.y * 100}%`, width: `${draft.w * 100}%`, height: `${draft.h * 100}%` }}
              />
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-2 text-center">Click and drag on the page to mark an area to redact.</p>

          <div className="mt-6 flex flex-col items-center gap-4">
            <PrimaryButton onClick={apply} disabled={status === 'processing' || boxes.length === 0}>
              {status === 'processing' ? 'Redacting…' : 'Apply Redactions'}
            </PrimaryButton>
            <StatusBanner status={status === 'loading' ? 'idle' : status} processingText="Flattening pages…" errorText={error} />
            {result && <DownloadCard filename={result.name} onDownload={() => downloadBlob(result.blob, result.name)} />}
          </div>
        </>
      )}
      <ToolHistoryPanel history={history} />
    </ToolShell>
  )
}
