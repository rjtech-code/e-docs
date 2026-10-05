import { useState } from 'react'
import PptxGenJS from 'pptxgenjs'
import { Presentation } from 'lucide-react'
import FileDrop from '../../components/FileDrop'
import { ToolShell, PrimaryButton, StatusBanner, DownloadCard, ProgressBar } from '../../components/ToolShell'
import { downloadBlob, loadPdfJs, readFileAsArrayBuffer, renderPageToCanvas, stripExt } from '../../lib/pdfCore'
import { useToolHistory } from '../../hooks/useToolHistory'
import ToolHistoryPanel from '../../components/ToolHistoryPanel'
import { convertOnServer } from '../../lib/serverConvert'

type Status = 'idle' | 'processing' | 'done' | 'error'

export default function PdfToPowerpoint() {
  const [files, setFiles] = useState<File[]>([])
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState('')
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState<{ blob: Blob; name: string } | null>(null)
  const history = useToolHistory('pdf-to-powerpoint', 'PDF to PowerPoint')

  const convert = async () => {
    const file = files[0]
    if (!file) return
    setStatus('processing')
    setError('')
    setResult(null)
    setProgress(0)
    try {
      // Best fidelity: convert on the server (keeps layout, fonts, images). Falls back to the
      // in-browser converter below if the server can't do it.
      const server = await convertOnServer('pdf-to-powerpoint', file, `${stripExt(file.name)}.pptx`)
      if (server) {
        setResult(server)
        history.saveResult(server.blob, server.name)
        setStatus('done')
        return
      }

      const bytes = await readFileAsArrayBuffer(file)
      const doc = await loadPdfJs(bytes)
      const pptx = new PptxGenJS()
      pptx.defineLayout({ name: 'A4', width: 10, height: 7.5 })
      pptx.layout = 'A4'

      for (let i = 1; i <= doc.numPages; i++) {
        const canvas = await renderPageToCanvas(doc, i, 2)
        const dataUrl = canvas.toDataURL('image/jpeg', 0.9)
        const slide = pptx.addSlide()
        const ratio = canvas.width / canvas.height
        let w = 10
        let h = w / ratio
        if (h > 7.5) {
          h = 7.5
          w = h * ratio
        }
        slide.addImage({ data: dataUrl, x: (10 - w) / 2, y: (7.5 - h) / 2, w, h })
        setProgress(Math.round((i / doc.numPages) * 100))
      }

      const blob = (await pptx.write({ outputType: 'blob' })) as Blob
      const name = `${stripExt(file.name)}.pptx`
      setResult({ blob, name })
      history.saveResult(blob, name)
      setStatus('done')
    } catch (e) {
      console.error(e)
      setError('Could not convert this PDF to PowerPoint.')
      setStatus('error')
    }
  }

  return (
    <ToolShell icon={Presentation} title="PDF to PowerPoint" description="Turn every PDF page into a slide in a PowerPoint presentation.">
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
          {status === 'processing' ? 'Converting…' : 'Convert to PowerPoint'}
        </PrimaryButton>
        {status === 'processing' && progress > 0 && <ProgressBar value={progress} label={`${progress}%`} />}
        <StatusBanner status={status} processingText="Building slides…" errorText={error} />
        {result && <DownloadCard filename={result.name} onDownload={() => downloadBlob(result.blob, result.name)} />}
      </div>
      <ToolHistoryPanel history={history} />
    </ToolShell>
  )
}
