import { useRef, useState } from 'react'
import { Crop } from 'lucide-react'
import FileDrop from '../../components/FileDrop'
import { ToolShell, PrimaryButton, StatusBanner, DownloadCard } from '../../components/ToolShell'
import { downloadBlob, loadPdfJs, loadPdfLib, readFileAsArrayBuffer, renderPageToCanvas, stripExt } from '../../lib/pdfCore'
import { useToolHistory } from '../../hooks/useToolHistory'
import ToolHistoryPanel from '../../components/ToolHistoryPanel'

type Status = 'idle' | 'loading' | 'processing' | 'done' | 'error'

interface Box {
  x: number
  y: number
  w: number
  h: number
}

export default function CropPdf() {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [box, setBox] = useState<Box>({ x: 0.05, y: 0.05, w: 0.9, h: 0.9 })
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState('')
  const [result, setResult] = useState<{ blob: Blob; name: string } | null>(null)
  const history = useToolHistory('crop-pdf', 'Crop PDF')
  const dragRef = useRef<{ startX: number; startY: number; box: Box } | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const onFiles = async (files: File[]) => {
    const f = files[0]
    setFile(f ?? null)
    setPreview(null)
    setResult(null)
    setStatus('idle')
    if (!f) return
    setStatus('loading')
    try {
      const bytes = await readFileAsArrayBuffer(f)
      const doc = await loadPdfJs(bytes)
      const canvas = await renderPageToCanvas(doc, 1, 1.2)
      setPreview(canvas.toDataURL('image/jpeg', 0.85))
      setStatus('idle')
    } catch (e) {
      console.error(e)
      setError('Could not preview this PDF.')
      setStatus('error')
    }
  }

  const onPointerDown = (e: React.PointerEvent) => {
    dragRef.current = { startX: e.clientX, startY: e.clientY, box }
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current || !containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const dx = (e.clientX - dragRef.current.startX) / rect.width
    const dy = (e.clientY - dragRef.current.startY) / rect.height
    const nb = { ...dragRef.current.box }
    nb.x = Math.min(0.95, Math.max(0, nb.x + dx))
    nb.y = Math.min(0.95, Math.max(0, nb.y + dy))
    nb.w = Math.min(1 - nb.x, Math.max(0.05, dragRef.current.box.w))
    nb.h = Math.min(1 - nb.y, Math.max(0.05, dragRef.current.box.h))
    setBox(nb)
  }

  const resize = (edge: 'w' | 'h', delta: number) => {
    setBox((prev) => ({ ...prev, [edge]: Math.min(1 - (prev as any)[edge === 'w' ? 'x' : 'y'], Math.max(0.05, prev[edge] + delta)) }))
  }

  const crop = async () => {
    if (!file) return
    setStatus('processing')
    setError('')
    setResult(null)
    try {
      const bytes = await readFileAsArrayBuffer(file)
      const doc = await loadPdfLib(bytes)
      doc.getPages().forEach((page) => {
        const { width, height } = page.getSize()
        const cropX = box.x * width
        const cropY = (1 - box.y - box.h) * height
        const cropW = box.w * width
        const cropH = box.h * height
        page.setCropBox(cropX, cropY, cropW, cropH)
      })
      const outBytes = await doc.save()
      const blob = new Blob([outBytes as BlobPart], { type: 'application/pdf' })
      const name = `${stripExt(file.name)}-cropped.pdf`
      setResult({ blob, name })
      history.saveResult(blob, name)
      setStatus('done')
    } catch (e) {
      console.error(e)
      setError('Could not crop this PDF.')
      setStatus('error')
    }
  }

  return (
    <ToolShell icon={Crop} title="Crop PDF" description="Drag the frame to select the area to keep — applied to every page.">
      {!preview && <FileDrop accept="application/pdf" files={file ? [file] : []} onFiles={onFiles} label="Select a PDF file or drag & drop here" />}
      {status === 'loading' && <p className="text-center text-muted-foreground py-8">Loading preview…</p>}

      {preview && (
        <>
          <div ref={containerRef} className="relative mx-auto max-w-md select-none touch-none" onPointerMove={onPointerMove}>
            <img src={preview} alt="Page preview" className="w-full rounded-lg shadow-md pointer-events-none" draggable={false} />
            <div
              onPointerDown={onPointerDown}
              className="absolute border-2 border-primary bg-primary cursor-move"
              style={{ left: `${box.x * 100}%`, top: `${box.y * 100}%`, width: `${box.w * 100}%`, height: `${box.h * 100}%` }}
            >
              <div className="absolute -top-2 -left-2 w-3 h-3 bg-primary rounded-full" />
              <div className="absolute -bottom-2 -right-2 w-3 h-3 bg-primary rounded-full" />
            </div>
          </div>
          <div className="flex justify-center gap-6 mt-4 text-sm text-muted-foreground">
            <label className="flex items-center gap-2">
              Width
              <input type="range" min={0.05} max={1} step={0.01} value={box.w} onChange={(e) => resize('w', parseFloat(e.target.value) - box.w)} className="accent-primary" />
            </label>
            <label className="flex items-center gap-2">
              Height
              <input type="range" min={0.05} max={1} step={0.01} value={box.h} onChange={(e) => resize('h', parseFloat(e.target.value) - box.h)} className="accent-primary" />
            </label>
          </div>
        </>
      )}

      <div className="mt-6 flex flex-col items-center gap-4">
        <PrimaryButton onClick={crop} disabled={!file || status === 'processing'}>
          {status === 'processing' ? 'Cropping…' : 'Crop PDF'}
        </PrimaryButton>
        <StatusBanner status={status === 'loading' ? 'idle' : status} processingText="Applying crop box…" errorText={error} />
        {result && <DownloadCard filename={result.name} onDownload={() => downloadBlob(result.blob, result.name)} />}
      </div>
      <ToolHistoryPanel history={history} />
    </ToolShell>
  )
}
