import { useState } from 'react'
import JSZip from 'jszip'
import { Image as ImageIcon } from 'lucide-react'
import FileDrop from '../../components/FileDrop'
import { ToolShell, PrimaryButton, StatusBanner, DownloadCard, ProgressBar } from '../../components/ToolShell'
import { downloadBlob, loadPdfJs, readFileAsArrayBuffer, renderPageToCanvas, canvasToBlob, stripExt } from '../../lib/pdfCore'
import { useToolHistory } from '../../hooks/useToolHistory'
import ToolHistoryPanel from '../../components/ToolHistoryPanel'

type Status = 'idle' | 'processing' | 'done' | 'error'

export default function PdfToJpg() {
  const [files, setFiles] = useState<File[]>([])
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState('')
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState<{ blob: Blob; name: string } | null>(null)
  const history = useToolHistory('pdf-to-jpg', 'PDF to JPG')

  const convert = async () => {
    const file = files[0]
    if (!file) return
    setStatus('processing')
    setError('')
    setResult(null)
    setProgress(0)
    try {
      const bytes = await readFileAsArrayBuffer(file)
      const doc = await loadPdfJs(bytes)
      const baseName = stripExt(file.name)

      if (doc.numPages === 1) {
        const canvas = await renderPageToCanvas(doc, 1, 2)
        const blob = await canvasToBlob(canvas, 'image/jpeg', 0.92)
        const name = `${baseName}.jpg`
        setResult({ blob, name })
        history.saveResult(blob, name)
      } else {
        const zip = new JSZip()
        for (let i = 1; i <= doc.numPages; i++) {
          const canvas = await renderPageToCanvas(doc, i, 2)
          const blob = await canvasToBlob(canvas, 'image/jpeg', 0.92)
          zip.file(`${baseName}-page-${String(i).padStart(2, '0')}.jpg`, blob)
          setProgress(Math.round((i / doc.numPages) * 100))
        }
        const zipBlob = await zip.generateAsync({ type: 'blob' })
        const zipName = `${baseName}-images.zip`
        setResult({ blob: zipBlob, name: zipName })
        history.saveResult(zipBlob, zipName)
      }
      setStatus('done')
    } catch (e) {
      console.error(e)
      setError('Could not convert this PDF. Please try a different file.')
      setStatus('error')
    }
  }

  return (
    <ToolShell icon={ImageIcon} title="PDF to JPG" description="Convert every page of your PDF into a high-quality JPG image.">
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

      <div className="mt-6 flex flex-col items-center gap-4">
        <PrimaryButton onClick={convert} disabled={files.length === 0 || status === 'processing'}>
          {status === 'processing' ? 'Converting…' : 'Convert to JPG'}
        </PrimaryButton>
        {status === 'processing' && progress > 0 && <ProgressBar value={progress} label={`Rendering pages… ${progress}%`} />}
        <StatusBanner status={status} processingText="Rendering pages…" errorText={error} />
        {result && <DownloadCard filename={result.name} onDownload={() => downloadBlob(result.blob, result.name)} />}
      </div>
      <ToolHistoryPanel history={history} />
    </ToolShell>
  )
}
