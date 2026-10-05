import { useState } from 'react'
import { PDFDocument } from 'pdf-lib'
import { Minimize2 } from 'lucide-react'
import FileDrop from '../../components/FileDrop'
import { ToolShell, PrimaryButton, StatusBanner, DownloadCard, ProgressBar } from '../../components/ToolShell'
import { downloadBlob, loadPdfLib, loadPdfJs, readFileAsArrayBuffer, renderPageToCanvas, canvasToBlob, stripExt, formatBytes } from '../../lib/pdfCore'
import { useToolHistory } from '../../hooks/useToolHistory'
import ToolHistoryPanel from '../../components/ToolHistoryPanel'

type Status = 'idle' | 'processing' | 'done' | 'error'
type Level = 'low' | 'recommended' | 'extreme'

const levelInfo: Record<Level, { label: string; desc: string; scale: number; quality: number }> = {
  low: { label: 'Low compression', desc: 'Best quality, smallest size reduction', scale: 1.5, quality: 0.9 },
  recommended: { label: 'Recommended', desc: 'Great quality, good size reduction', scale: 1.15, quality: 0.75 },
  extreme: { label: 'Extreme compression', desc: 'Smaller file size, lower quality', scale: 0.85, quality: 0.55 },
}

export default function CompressPdf() {
  const [files, setFiles] = useState<File[]>([])
  const [level, setLevel] = useState<Level>('recommended')
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState('')
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState<{ blob: Blob; name: string; originalSize: number } | null>(null)
  const history = useToolHistory('compress-pdf', 'Compress PDF')

  const compress = async () => {
    const file = files[0]
    if (!file) return
    setStatus('processing')
    setError('')
    setResult(null)
    setProgress(0)
    try {
      const bytes = await readFileAsArrayBuffer(file)

      if (level === 'low') {
        // Safe pass: rebuild object/xref streams without touching content.
        const doc = await loadPdfLib(bytes)
        const outBytes = await doc.save({ useObjectStreams: true })
        const blob = new Blob([outBytes as BlobPart], { type: 'application/pdf' })
        setResult({ blob, name: `${stripExt(file.name)}-compressed.pdf`, originalSize: file.size })
        history.saveResult(blob, `${stripExt(file.name)}-compressed.pdf`)
      } else {
        // Rasterize each page at a reduced scale/quality — very effective for scan-heavy PDFs.
        const cfg = levelInfo[level]
        const pdfjsDoc = await loadPdfJs(bytes)
        const out = await PDFDocument.create()
        for (let i = 1; i <= pdfjsDoc.numPages; i++) {
          const canvas = await renderPageToCanvas(pdfjsDoc, i, cfg.scale)
          const jpgBlob = await canvasToBlob(canvas, 'image/jpeg', cfg.quality)
          const jpgBytes = new Uint8Array(await jpgBlob.arrayBuffer())
          const img = await out.embedJpg(jpgBytes)
          const page = out.addPage([img.width, img.height])
          page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height })
          setProgress(Math.round((i / pdfjsDoc.numPages) * 100))
        }
        const outBytes = await out.save()
        const blob = new Blob([outBytes as BlobPart], { type: 'application/pdf' })
        setResult({ blob, name: `${stripExt(file.name)}-compressed.pdf`, originalSize: file.size })
        history.saveResult(blob, `${stripExt(file.name)}-compressed.pdf`)
      }
      setStatus('done')
    } catch (e) {
      console.error(e)
      setError('Could not compress this PDF. Please try a different file.')
      setStatus('error')
    }
  }

  return (
    <ToolShell icon={Minimize2} title="Compress PDF" description="Reduce the file size of your PDF while keeping the best possible quality.">
      <FileDrop
        accept="application/pdf"
        files={files}
        onFiles={(f) => {
          setFiles(f)
          setStatus('idle')
          setResult(null)
        }}
        label="Select a PDF file or drag & drop here"
      />

      {files.length > 0 && (
        <div className="mt-6 grid sm:grid-cols-3 gap-3">
          {(Object.keys(levelInfo) as Level[]).map((l) => (
            <button
              key={l}
              onClick={() => setLevel(l)}
              className={`text-left rounded-2xl border-2 p-4 transition ${level === l ? 'border-primary bg-primary/10' : 'border-border bg-surface'}`}
            >
              <p className="font-bold text-foreground">{levelInfo[l].label}</p>
              <p className="text-xs text-muted-foreground mt-1">{levelInfo[l].desc}</p>
            </button>
          ))}
        </div>
      )}

      <div className="mt-6 flex flex-col items-center gap-4">
        <PrimaryButton onClick={compress} disabled={files.length === 0 || status === 'processing'}>
          {status === 'processing' ? 'Compressing…' : 'Compress PDF'}
        </PrimaryButton>
        {status === 'processing' && progress > 0 && <ProgressBar value={progress} label={`${progress}%`} />}
        <StatusBanner status={status} processingText="Optimizing your PDF…" errorText={error} />
        {result && (
          <div className="w-full space-y-2">
            <p className="text-center text-sm text-muted-foreground">
              {formatBytes(result.originalSize)} → <span className="font-semibold text-primary">{formatBytes(result.blob.size)}</span>{' '}
              {result.blob.size < result.originalSize && `(${Math.round((1 - result.blob.size / result.originalSize) * 100)}% smaller)`}
            </p>
            <DownloadCard filename={result.name} onDownload={() => downloadBlob(result.blob, result.name)} />
          </div>
        )}
      </div>
      <ToolHistoryPanel history={history} />
    </ToolShell>
  )
}
