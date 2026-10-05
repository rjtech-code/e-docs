import { useState } from 'react'
import { degrees } from 'pdf-lib'
import { RotateCw, RotateCcw } from 'lucide-react'
import FileDrop from '../../components/FileDrop'
import { ToolShell, PrimaryButton, StatusBanner, DownloadCard } from '../../components/ToolShell'
import { downloadBlob, loadPdfLib, readFileAsArrayBuffer, stripExt } from '../../lib/pdfCore'
import { useToolHistory } from '../../hooks/useToolHistory'
import ToolHistoryPanel from '../../components/ToolHistoryPanel'

type Status = 'idle' | 'processing' | 'done' | 'error'

export default function RotatePdf() {
  const [files, setFiles] = useState<File[]>([])
  const [angle, setAngle] = useState(90)
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState('')
  const [result, setResult] = useState<{ blob: Blob; name: string } | null>(null)
  const history = useToolHistory('rotate-pdf', 'Rotate PDF')

  const rotate = async () => {
    const file = files[0]
    if (!file) return
    setStatus('processing')
    setError('')
    setResult(null)
    try {
      const bytes = await readFileAsArrayBuffer(file)
      const doc = await loadPdfLib(bytes)
      doc.getPages().forEach((page) => {
        const current = page.getRotation().angle
        page.setRotation(degrees((current + angle + 360) % 360))
      })
      const outBytes = await doc.save()
      const blob = new Blob([outBytes as BlobPart], { type: 'application/pdf' })
      const name = `${stripExt(file.name)}-rotated.pdf`
      setResult({ blob, name })
      history.saveResult(blob, name)
      setStatus('done')
    } catch (e) {
      console.error(e)
      setError('Could not rotate this PDF. Please try a different file.')
      setStatus('error')
    }
  }

  return (
    <ToolShell icon={RotateCw} title="Rotate PDF" description="Rotate every page of your PDF, permanently and for free.">
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
        <div className="mt-6 flex items-center justify-center gap-4">
          <button
            onClick={() => setAngle(-90)}
            className={`flex flex-col items-center gap-2 px-6 py-4 rounded-2xl border-2 transition ${angle === -90 ? 'border-primary bg-primary/10' : 'border-border'}`}
          >
            <RotateCcw size={28} className="text-primary" />
            <span className="text-sm font-medium">Left 90°</span>
          </button>
          <button
            onClick={() => setAngle(90)}
            className={`flex flex-col items-center gap-2 px-6 py-4 rounded-2xl border-2 transition ${angle === 90 ? 'border-primary bg-primary/10' : 'border-border'}`}
          >
            <RotateCw size={28} className="text-primary" />
            <span className="text-sm font-medium">Right 90°</span>
          </button>
          <button
            onClick={() => setAngle(180)}
            className={`flex flex-col items-center gap-2 px-6 py-4 rounded-2xl border-2 transition ${angle === 180 ? 'border-primary bg-primary/10' : 'border-border'}`}
          >
            <RotateCw size={28} className="text-muted-foreground rotate-180" />
            <span className="text-sm font-medium">180°</span>
          </button>
        </div>
      )}

      <div className="mt-6 flex flex-col items-center gap-4">
        <PrimaryButton onClick={rotate} disabled={files.length === 0 || status === 'processing'}>
          {status === 'processing' ? 'Rotating…' : 'Rotate PDF'}
        </PrimaryButton>
        <StatusBanner status={status} processingText="Rotating pages…" errorText={error} />
        {result && <DownloadCard filename={result.name} onDownload={() => downloadBlob(result.blob, result.name)} />}
      </div>
      <ToolHistoryPanel history={history} />
    </ToolShell>
  )
}
