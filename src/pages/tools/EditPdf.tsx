import { useEffect, useRef, useState } from 'react'
import { rgb, StandardFonts } from 'pdf-lib'
import { FileEdit, Trash2 } from 'lucide-react'
import FileDrop from '../../components/FileDrop'
import { ToolShell, PrimaryButton, StatusBanner, DownloadCard } from '../../components/ToolShell'
import { downloadBlob, loadPdfLib, loadPdfJs, readFileAsArrayBuffer, renderPageToCanvas, stripExt } from '../../lib/pdfCore'
import { useToolHistory } from '../../hooks/useToolHistory'
import ToolHistoryPanel from '../../components/ToolHistoryPanel'

type Status = 'idle' | 'loading' | 'processing' | 'done' | 'error'

interface Annotation {
  id: number
  page: number // 0-based
  xPct: number
  yPct: number
  text: string
  fontSize: number
  color: string
}

let nextId = 1

export default function EditPdf() {
  const [file, setFile] = useState<File | null>(null)
  const [pageImages, setPageImages] = useState<string[]>([])
  const [pageIndex, setPageIndex] = useState(0)
  const [annotations, setAnnotations] = useState<Annotation[]>([])
  const [fontSize, setFontSize] = useState(16)
  const [color, setColor] = useState('#0f59d1')
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState('')
  const [result, setResult] = useState<{ blob: Blob; name: string } | null>(null)
  const history = useToolHistory('edit-pdf', 'Edit PDF')
  const imgRef = useRef<HTMLImageElement>(null)

  const onFiles = async (files: File[]) => {
    const f = files[0]
    setFile(f ?? null)
    setPageImages([])
    setAnnotations([])
    setResult(null)
    setStatus('idle')
    if (!f) return
    setStatus('loading')
    try {
      const bytes = await readFileAsArrayBuffer(f)
      const doc = await loadPdfJs(bytes)
      const imgs: string[] = []
      for (let i = 1; i <= doc.numPages; i++) {
        const canvas = await renderPageToCanvas(doc, i, 1.4)
        imgs.push(canvas.toDataURL('image/jpeg', 0.85))
      }
      setPageImages(imgs)
      setStatus('idle')
    } catch (e) {
      console.error(e)
      setError('Could not open this PDF.')
      setStatus('error')
    }
  }

  const addAt = (e: React.MouseEvent<HTMLImageElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const xPct = (e.clientX - rect.left) / rect.width
    const yPct = (e.clientY - rect.top) / rect.height
    const text = window.prompt('Text to add:')
    if (!text) return
    setAnnotations((prev) => [...prev, { id: nextId++, page: pageIndex, xPct, yPct, text, fontSize, color }])
  }

  const removeAnnotation = (id: number) => setAnnotations((prev) => prev.filter((a) => a.id !== id))

  const save = async () => {
    if (!file) return
    setStatus('processing')
    setError('')
    setResult(null)
    try {
      const bytes = await readFileAsArrayBuffer(file)
      const doc = await loadPdfLib(bytes)
      const font = await doc.embedFont(StandardFonts.Helvetica)
      const pages = doc.getPages()

      annotations.forEach((a) => {
        const page = pages[a.page]
        if (!page) return
        const { width, height } = page.getSize()
        const r = parseInt(a.color.slice(1, 3), 16) / 255
        const g = parseInt(a.color.slice(3, 5), 16) / 255
        const b = parseInt(a.color.slice(5, 7), 16) / 255
        page.drawText(a.text, {
          x: a.xPct * width,
          y: height - a.yPct * height - a.fontSize,
          size: a.fontSize,
          font,
          color: rgb(r, g, b),
        })
      })

      const outBytes = await doc.save()
      const blob = new Blob([outBytes as BlobPart], { type: 'application/pdf' })
      const name = `${stripExt(file.name)}-edited.pdf`
      setResult({ blob, name })
      history.saveResult(blob, name)
      setStatus('done')
    } catch (e) {
      console.error(e)
      setError('Could not save your edits.')
      setStatus('error')
    }
  }

  useEffect(() => {
    nextId = 1
  }, [])

  return (
    <ToolShell icon={FileEdit} title="Edit PDF" description="Click anywhere on the page to add text, then save your changes.">
      {pageImages.length === 0 && (
        <FileDrop accept="application/pdf" files={file ? [file] : []} onFiles={onFiles} label="Select a PDF file or drag & drop here" />
      )}
      {status === 'loading' && <p className="text-center text-muted-foreground py-8">Loading pages…</p>}

      {pageImages.length > 0 && (
        <>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <button
                disabled={pageIndex === 0}
                onClick={() => setPageIndex((p) => p - 1)}
                className="px-3 py-1.5 rounded-lg bg-surface text-foreground/80 border border-border hover:border-primary/40 disabled:opacity-30"
              >
                ← Prev
              </button>
              <span className="text-sm text-muted-foreground">
                Page {pageIndex + 1} / {pageImages.length}
              </span>
              <button
                disabled={pageIndex === pageImages.length - 1}
                onClick={() => setPageIndex((p) => p + 1)}
                className="px-3 py-1.5 rounded-lg bg-surface text-foreground/80 border border-border hover:border-primary/40 disabled:opacity-30"
              >
                Next →
              </button>
            </div>
            <div className="flex items-center gap-3">
              <label className="text-xs text-muted-foreground flex items-center gap-1">
                Size
                <input type="number" min={8} max={72} value={fontSize} onChange={(e) => setFontSize(parseInt(e.target.value) || 16)} className="w-14 px-2 py-1 rounded-lg border border-border" />
              </label>
              <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="w-8 h-8 rounded cursor-pointer" />
            </div>
          </div>

          <div className="relative inline-block w-full">
            <img
              ref={imgRef}
              src={pageImages[pageIndex]}
              onClick={addAt}
              className="w-full rounded-lg shadow-md cursor-crosshair"
              alt={`Page ${pageIndex + 1}`}
            />
            {annotations
              .filter((a) => a.page === pageIndex)
              .map((a) => (
                <div
                  key={a.id}
                  className="absolute group"
                  style={{ left: `${a.xPct * 100}%`, top: `${a.yPct * 100}%`, transform: 'translate(0, -2px)' }}
                >
                  <span style={{ color: a.color, fontSize: Math.max(10, a.fontSize * 0.75) }} className="font-medium whitespace-nowrap">
                    {a.text}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      removeAnnotation(a.id)
                    }}
                    className="hidden group-hover:inline-flex ml-1 align-middle text-red-500"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
          </div>
          <p className="text-xs text-muted-foreground mt-2">Click on the page to add a text box. Hover an added text to remove it.</p>

          <div className="mt-6 flex flex-col items-center gap-4">
            <PrimaryButton onClick={save} disabled={status === 'processing' || annotations.length === 0}>
              {status === 'processing' ? 'Saving…' : 'Save PDF'}
            </PrimaryButton>
            <StatusBanner status={status === 'loading' ? 'idle' : status} processingText="Applying your edits…" errorText={error} />
            {result && <DownloadCard filename={result.name} onDownload={() => downloadBlob(result.blob, result.name)} />}
          </div>
        </>
      )}
      <ToolHistoryPanel history={history} />
    </ToolShell>
  )
}
