import { useRef, useState } from 'react'
import { PenTool, Eraser, Check } from 'lucide-react'
import FileDrop from '../../components/FileDrop'
import { ToolShell, PrimaryButton, SecondaryButton, StatusBanner, DownloadCard } from '../../components/ToolShell'
import { downloadBlob, loadPdfLib, loadPdfJs, readFileAsArrayBuffer, renderPageToCanvas, stripExt } from '../../lib/pdfCore'
import { useToolHistory } from '../../hooks/useToolHistory'
import ToolHistoryPanel from '../../components/ToolHistoryPanel'

type Status = 'idle' | 'loading' | 'processing' | 'done' | 'error'
type Stage = 'upload' | 'draw' | 'place'

export default function SignPdf() {
  const [file, setFile] = useState<File | null>(null)
  const [stage, setStage] = useState<Stage>('upload')
  const [pageImages, setPageImages] = useState<string[]>([])
  const [pageIndex, setPageIndex] = useState(0)
  const [signatureData, setSignatureData] = useState<string | null>(null)
  const [placement, setPlacement] = useState<{ xPct: number; yPct: number; widthPct: number } | null>(null)
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState('')
  const [result, setResult] = useState<{ blob: Blob; name: string } | null>(null)
  const history = useToolHistory('sign-pdf', 'Sign PDF')

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)

  const onFiles = async (files: File[]) => {
    const f = files[0]
    setFile(f ?? null)
    setResult(null)
    setStatus('idle')
    if (!f) return
    setStatus('loading')
    try {
      const bytes = await readFileAsArrayBuffer(f)
      const doc = await loadPdfJs(bytes)
      const imgs: string[] = []
      for (let i = 1; i <= doc.numPages; i++) {
        imgs.push((await renderPageToCanvas(doc, i, 1.4)).toDataURL('image/jpeg', 0.85))
      }
      setPageImages(imgs)
      setStage('draw')
      setStatus('idle')
    } catch (e) {
      console.error(e)
      setError('Could not open this PDF.')
      setStatus('error')
    }
  }

  const getPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  const startDraw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    drawing.current = true
    const ctx = canvasRef.current!.getContext('2d')!
    const { x, y } = getPos(e)
    ctx.beginPath()
    ctx.moveTo(x, y)
  }
  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return
    const ctx = canvasRef.current!.getContext('2d')!
    const { x, y } = getPos(e)
    ctx.lineTo(x, y)
    ctx.strokeStyle = '#0f172a'
    ctx.lineWidth = 2.5
    ctx.lineCap = 'round'
    ctx.stroke()
  }
  const endDraw = () => {
    drawing.current = false
  }
  const clearPad = () => {
    const canvas = canvasRef.current!
    canvas.getContext('2d')!.clearRect(0, 0, canvas.width, canvas.height)
  }
  const confirmSignature = () => {
    const canvas = canvasRef.current!
    setSignatureData(canvas.toDataURL('image/png'))
    setPlacement({ xPct: 0.35, yPct: 0.8, widthPct: 0.3 })
    setStage('place')
  }

  const placeAt = (e: React.MouseEvent<HTMLImageElement>) => {
    if (!placement) return
    const rect = e.currentTarget.getBoundingClientRect()
    const xPct = (e.clientX - rect.left) / rect.width
    const yPct = (e.clientY - rect.top) / rect.height
    setPlacement((p) => (p ? { ...p, xPct, yPct } : p))
  }

  const apply = async () => {
    if (!file || !signatureData || !placement) return
    setStatus('processing')
    setError('')
    setResult(null)
    try {
      const bytes = await readFileAsArrayBuffer(file)
      const doc = await loadPdfLib(bytes)
      const pngBytes = Uint8Array.from(atob(signatureData.split(',')[1]), (c) => c.charCodeAt(0))
      const pngImage = await doc.embedPng(pngBytes)
      const page = doc.getPages()[pageIndex]
      const { width, height } = page.getSize()
      const sigWidth = placement.widthPct * width
      const sigHeight = sigWidth * (pngImage.height / pngImage.width)
      page.drawImage(pngImage, {
        x: placement.xPct * width - sigWidth / 2,
        y: height - placement.yPct * height - sigHeight / 2,
        width: sigWidth,
        height: sigHeight,
      })
      const outBytes = await doc.save()
      const blob = new Blob([outBytes as BlobPart], { type: 'application/pdf' })
      const name = `${stripExt(file.name)}-signed.pdf`
      setResult({ blob, name })
      history.saveResult(blob, name)
      setStatus('done')
    } catch (e) {
      console.error(e)
      setError('Could not add your signature.')
      setStatus('error')
    }
  }

  return (
    <ToolShell icon={PenTool} title="Sign PDF" description="Draw your signature and place it anywhere on your PDF.">
      {stage === 'upload' && (
        <FileDrop accept="application/pdf" files={file ? [file] : []} onFiles={onFiles} label="Select a PDF file or drag & drop here" />
      )}
      {status === 'loading' && <p className="text-center text-muted-foreground py-8">Loading…</p>}

      {stage === 'draw' && (
        <div className="flex flex-col items-center gap-4">
          <p className="text-sm text-muted-foreground">Draw your signature below</p>
          <canvas
            ref={canvasRef}
            width={480}
            height={180}
            onPointerDown={startDraw}
            onPointerMove={move}
            onPointerUp={endDraw}
            onPointerLeave={endDraw}
            className="border-2 border-dashed border-primary/40 rounded-xl bg-paper touch-none w-full max-w-md"
          />
          <div className="flex gap-3">
            <SecondaryButton onClick={clearPad}>
              <span className="flex items-center gap-2">
                <Eraser size={16} /> Clear
              </span>
            </SecondaryButton>
            <PrimaryButton onClick={confirmSignature}>
              <span className="flex items-center gap-2">
                <Check size={16} /> Use signature
              </span>
            </PrimaryButton>
          </div>
        </div>
      )}

      {stage === 'place' && signatureData && placement && (
        <>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
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
            <label className="text-xs text-muted-foreground flex items-center gap-2">
              Size
              <input
                type="range"
                min={0.1}
                max={0.6}
                step={0.02}
                value={placement.widthPct}
                onChange={(e) => setPlacement((p) => (p ? { ...p, widthPct: parseFloat(e.target.value) } : p))}
                className="accent-primary"
              />
            </label>
          </div>
          <div className="relative inline-block w-full">
            <img src={pageImages[pageIndex]} onClick={placeAt} className="w-full rounded-lg shadow-md cursor-crosshair" alt={`Page ${pageIndex + 1}`} />
            <img
              src={signatureData}
              className="absolute pointer-events-none"
              style={{ left: `${placement.xPct * 100}%`, top: `${placement.yPct * 100}%`, width: `${placement.widthPct * 100}%`, transform: 'translate(-50%, -50%)' }}
              alt="Signature preview"
            />
          </div>
          <p className="text-xs text-muted-foreground mt-2">Click on the page to move your signature.</p>

          <div className="mt-6 flex flex-col items-center gap-4">
            <PrimaryButton onClick={apply} disabled={status === 'processing'}>
              {status === 'processing' ? 'Signing…' : 'Sign PDF'}
            </PrimaryButton>
            <StatusBanner status={status === 'loading' ? 'idle' : status} processingText="Placing your signature…" errorText={error} />
            {result && <DownloadCard filename={result.name} onDownload={() => downloadBlob(result.blob, result.name)} />}
          </div>
        </>
      )}
      <ToolHistoryPanel history={history} />
    </ToolShell>
  )
}
