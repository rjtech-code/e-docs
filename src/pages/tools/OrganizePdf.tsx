import { useState } from 'react'
import { degrees } from 'pdf-lib'
import { ListOrdered, ArrowLeft, ArrowRight, RotateCw, Trash2, Undo2 } from 'lucide-react'
import FileDrop from '../../components/FileDrop'
import { ToolShell, PrimaryButton, StatusBanner, DownloadCard } from '../../components/ToolShell'
import { downloadBlob, loadPdfLib, loadPdfJs, readFileAsArrayBuffer, renderPageToCanvas, stripExt } from '../../lib/pdfCore'
import { useToolHistory } from '../../hooks/useToolHistory'
import ToolHistoryPanel from '../../components/ToolHistoryPanel'

type Status = 'idle' | 'loading' | 'processing' | 'done' | 'error'

interface PageItem {
  originalIndex: number
  thumb: string
  rotation: 0 | 90 | 180 | 270
  removed: boolean
}

export default function OrganizePdf() {
  const [file, setFile] = useState<File | null>(null)
  const [pages, setPages] = useState<PageItem[]>([])
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState('')
  const [result, setResult] = useState<{ blob: Blob; name: string } | null>(null)
  const history = useToolHistory('organize-pdf', 'Organize PDF')

  const onFiles = async (files: File[]) => {
    const f = files[0]
    setFile(f ?? null)
    setResult(null)
    setStatus('idle')
    setPages([])
    if (!f) return
    setStatus('loading')
    try {
      const bytes = await readFileAsArrayBuffer(f)
      const doc = await loadPdfJs(bytes)
      const items: PageItem[] = []
      for (let i = 1; i <= doc.numPages; i++) {
        const canvas = await renderPageToCanvas(doc, i, 0.35)
        items.push({ originalIndex: i - 1, thumb: canvas.toDataURL('image/jpeg', 0.7), rotation: 0, removed: false })
      }
      setPages(items)
      setStatus('idle')
    } catch (e) {
      console.error(e)
      setError('Could not open this PDF.')
      setStatus('error')
    }
  }

  const move = (idx: number, dir: -1 | 1) => {
    setPages((prev) => {
      const next = [...prev]
      const target = idx + dir
      if (target < 0 || target >= next.length) return prev
      ;[next[idx], next[target]] = [next[target], next[idx]]
      return next
    })
  }

  const rotate = (idx: number) => {
    setPages((prev) => prev.map((p, i) => (i === idx ? { ...p, rotation: ((p.rotation + 90) % 360) as 0 | 90 | 180 | 270 } : p)))
  }

  const toggleRemove = (idx: number) => {
    setPages((prev) => prev.map((p, i) => (i === idx ? { ...p, removed: !p.removed } : p)))
  }

  const save = async () => {
    if (!file) return
    const kept = pages.filter((p) => !p.removed)
    if (kept.length === 0) return
    setStatus('processing')
    setError('')
    setResult(null)
    try {
      const bytes = await readFileAsArrayBuffer(file)
      const src = await loadPdfLib(bytes)
      const { PDFDocument } = await import('pdf-lib')
      const out = await PDFDocument.create()
      const copied = await out.copyPages(src, kept.map((p) => p.originalIndex))
      copied.forEach((page, i) => {
        const rot = kept[i].rotation
        if (rot) page.setRotation(degrees((page.getRotation().angle + rot) % 360))
        out.addPage(page)
      })
      const outBytes = await out.save()
      const blob = new Blob([outBytes as BlobPart], { type: 'application/pdf' })
      const name = `${stripExt(file.name)}-organized.pdf`
      setResult({ blob, name })
      history.saveResult(blob, name)
      setStatus('done')
    } catch (e) {
      console.error(e)
      setError('Could not save the organized PDF.')
      setStatus('error')
    }
  }

  return (
    <ToolShell icon={ListOrdered} title="Organize PDF" description="Reorder, rotate and delete pages of your PDF visually.">
      {pages.length === 0 && (
        <FileDrop accept="application/pdf" files={file ? [file] : []} onFiles={onFiles} label="Select a PDF file or drag & drop here" />
      )}
      {status === 'loading' && <p className="text-center text-muted-foreground py-8">Loading pages…</p>}

      {pages.length > 0 && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {pages.map((p, i) => (
              <div
                key={p.originalIndex}
                className={`relative rounded-xl border-2 p-2 transition ${p.removed ? 'opacity-40 border-red-500/30' : 'border-border'}`}
              >
                <img
                  src={p.thumb}
                  alt={`Page ${p.originalIndex + 1}`}
                  className="w-full rounded-lg shadow-sm bg-paper"
                  style={{ transform: `rotate(${p.rotation}deg)` }}
                />
                <p className="text-center text-xs font-semibold text-muted-foreground mt-1">Page {p.originalIndex + 1}</p>
                <div className="flex items-center justify-center gap-1 mt-1">
                  <button onClick={() => move(i, -1)} disabled={i === 0} className="p-1.5 rounded-lg hover:bg-surface disabled:opacity-30 text-muted-foreground">
                    <ArrowLeft size={14} />
                  </button>
                  <button onClick={() => rotate(i)} className="p-1.5 rounded-lg hover:bg-surface text-muted-foreground">
                    <RotateCw size={14} />
                  </button>
                  <button onClick={() => move(i, 1)} disabled={i === pages.length - 1} className="p-1.5 rounded-lg hover:bg-surface disabled:opacity-30 text-muted-foreground">
                    <ArrowRight size={14} />
                  </button>
                  <button onClick={() => toggleRemove(i)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-red-600">
                    {p.removed ? <Undo2 size={14} /> : <Trash2 size={14} />}
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 flex flex-col items-center gap-4">
            <PrimaryButton onClick={save} disabled={status === 'processing' || pages.every((p) => p.removed)}>
              {status === 'processing' ? 'Saving…' : 'Save PDF'}
            </PrimaryButton>
            <StatusBanner status={status === 'loading' ? 'idle' : status} processingText="Rebuilding your PDF…" errorText={error} />
            {result && <DownloadCard filename={result.name} onDownload={() => downloadBlob(result.blob, result.name)} />}
          </div>
        </>
      )}
      <ToolHistoryPanel history={history} />
    </ToolShell>
  )
}
