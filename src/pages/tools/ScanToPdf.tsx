import { useRef, useState } from 'react'
import { PDFDocument } from 'pdf-lib'
import { ScanLine, Camera, ArrowUp, ArrowDown, Trash2 } from 'lucide-react'
import { ToolShell, PrimaryButton, StatusBanner, DownloadCard } from '../../components/ToolShell'
import { downloadBlob, readFileAsArrayBuffer, formatBytes } from '../../lib/pdfCore'
import { useToolHistory } from '../../hooks/useToolHistory'
import ToolHistoryPanel from '../../components/ToolHistoryPanel'

type Status = 'idle' | 'processing' | 'done' | 'error'

export default function ScanToPdf() {
  const [images, setImages] = useState<File[]>([])
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState('')
  const [result, setResult] = useState<{ blob: Blob; name: string } | null>(null)
  const history = useToolHistory('scan-to-pdf', 'Scan to PDF')
  const cameraRef = useRef<HTMLInputElement>(null)
  const galleryRef = useRef<HTMLInputElement>(null)

  const addFiles = (files: FileList | null) => {
    if (!files?.length) return
    setImages((prev) => [...prev, ...Array.from(files)])
    setStatus('idle')
    setResult(null)
  }

  const move = (idx: number, dir: -1 | 1) => {
    setImages((prev) => {
      const next = [...prev]
      const target = idx + dir
      if (target < 0 || target >= next.length) return prev
      ;[next[idx], next[target]] = [next[target], next[idx]]
      return next
    })
  }

  const build = async () => {
    if (images.length === 0) return
    setStatus('processing')
    setError('')
    setResult(null)
    try {
      const doc = await PDFDocument.create()
      const A4 = [595.28, 841.89] as [number, number]
      for (const file of images) {
        const bytes = await readFileAsArrayBuffer(file)
        const isPng = file.type === 'image/png'
        const image = isPng ? await doc.embedPng(bytes) : await doc.embedJpg(bytes)
        const page = doc.addPage(A4)
        const margin = 20
        const maxW = A4[0] - margin * 2
        const maxH = A4[1] - margin * 2
        const scale = Math.min(maxW / image.width, maxH / image.height, 1)
        const w = image.width * scale
        const h = image.height * scale
        page.drawImage(image, { x: (A4[0] - w) / 2, y: (A4[1] - h) / 2, width: w, height: h })
      }
      const outBytes = await doc.save()
      const blob = new Blob([outBytes as BlobPart], { type: 'application/pdf' })
      setResult({ blob, name: 'e-docs-scan.pdf' })
      history.saveResult(blob, 'e-docs-scan.pdf')
      setStatus('done')
    } catch (e) {
      console.error(e)
      setError('Could not build a PDF from these photos.')
      setStatus('error')
    }
  }

  return (
    <ToolShell icon={ScanLine} title="Scan to PDF" description="Capture photos with your camera and turn them into a clean PDF.">
      <div className="flex flex-col items-center gap-4 py-6">
        <div className="w-16 h-16 rounded-2xl brand-gradient flex items-center justify-center shadow-lg animate-float">
          <Camera className="text-white" size={30} />
        </div>
        <div className="flex flex-wrap gap-3 justify-center">
          <PrimaryButton onClick={() => cameraRef.current?.click()}>Take a photo</PrimaryButton>
          <button
            onClick={() => galleryRef.current?.click()}
            className="border-2 border-border text-primary font-semibold px-6 py-2.5 rounded-full hover:bg-surface transition"
          >
            Upload photos
          </button>
        </div>
        <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => addFiles(e.target.files)} />
        <input ref={galleryRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => addFiles(e.target.files)} />
      </div>

      {images.length > 0 && (
        <ul className="space-y-2">
          {images.map((f, i) => (
            <li key={`${f.name}-${i}`} className="flex items-center gap-2 bg-surface rounded-xl px-3 py-2">
              <span className="w-6 h-6 shrink-0 rounded-full brand-gradient text-white text-xs font-bold flex items-center justify-center">{i + 1}</span>
              <span className="flex-1 text-sm truncate text-foreground">{f.name}</span>
              <span className="text-xs text-muted-foreground shrink-0">{formatBytes(f.size)}</span>
              <button onClick={() => move(i, -1)} disabled={i === 0} className="text-muted-foreground hover:text-primary disabled:opacity-30">
                <ArrowUp size={16} />
              </button>
              <button onClick={() => move(i, 1)} disabled={i === images.length - 1} className="text-muted-foreground hover:text-primary disabled:opacity-30">
                <ArrowDown size={16} />
              </button>
              <button onClick={() => setImages(images.filter((_, idx) => idx !== i))} className="text-muted-foreground hover:text-red-500">
                <Trash2 size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-6 flex flex-col items-center gap-4">
        <PrimaryButton onClick={build} disabled={images.length === 0 || status === 'processing'}>
          {status === 'processing' ? 'Building PDF…' : `Create PDF from ${images.length || ''} photo${images.length === 1 ? '' : 's'}`}
        </PrimaryButton>
        <StatusBanner status={status} processingText="Building your scan…" errorText={error} />
        {result && <DownloadCard filename={result.name} onDownload={() => downloadBlob(result.blob, result.name)} />}
      </div>
      <ToolHistoryPanel history={history} />
    </ToolShell>
  )
}
