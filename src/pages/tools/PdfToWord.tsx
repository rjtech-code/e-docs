import { useState } from 'react'
import { Document, Packer, Paragraph, PageBreak, TextRun } from 'docx'
import { FileText } from 'lucide-react'
import FileDrop from '../../components/FileDrop'
import { ToolShell, PrimaryButton, StatusBanner, DownloadCard, ProgressBar } from '../../components/ToolShell'
import { downloadBlob, loadPdfJs, extractPageText, readFileAsArrayBuffer, stripExt } from '../../lib/pdfCore'
import { useToolHistory } from '../../hooks/useToolHistory'
import ToolHistoryPanel from '../../components/ToolHistoryPanel'
import { convertOnServer } from '../../lib/serverConvert'

type Status = 'idle' | 'processing' | 'done' | 'error'

export default function PdfToWord() {
  const [files, setFiles] = useState<File[]>([])
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState('')
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState<{ blob: Blob; name: string } | null>(null)
  const history = useToolHistory('pdf-to-word', 'PDF to Word')

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
      const server = await convertOnServer('pdf-to-word', file, `${stripExt(file.name)}.docx`)
      if (server) {
        setResult(server)
        history.saveResult(server.blob, server.name)
        setStatus('done')
        return
      }

      const bytes = await readFileAsArrayBuffer(file)
      const doc = await loadPdfJs(bytes)
      const children: Paragraph[] = []

      for (let i = 1; i <= doc.numPages; i++) {
        const text = await extractPageText(doc, i)
        const lines = text.split('\n')
        lines.forEach((line) => {
          children.push(new Paragraph({ children: [new TextRun(line || ' ')] }))
        })
        if (i < doc.numPages) {
          children.push(new Paragraph({ children: [new PageBreak()] }))
        }
        setProgress(Math.round((i / doc.numPages) * 100))
      }

      const wordDoc = new Document({
        sections: [{ properties: {}, children: children.length ? children : [new Paragraph('')] }],
      })
      const blob = await Packer.toBlob(wordDoc)
      const name = `${stripExt(file.name)}.docx`
      setResult({ blob, name })
      history.saveResult(blob, name)
      setStatus('done')
    } catch (e) {
      console.error(e)
      setError('Could not convert this PDF. It may be scanned/image-only — try OCR PDF first.')
      setStatus('error')
    }
  }

  return (
    <ToolShell icon={FileText} title="PDF to Word" description="Extract the text of your PDF into an editable Word document.">
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
      <p className="text-xs text-muted-foreground mt-3">
        Converts text content page by page. Complex layouts, tables and images are simplified —
        for scanned pages, run OCR PDF first.
      </p>

      <div className="mt-6 flex flex-col items-center gap-4">
        <PrimaryButton onClick={convert} disabled={files.length === 0 || status === 'processing'}>
          {status === 'processing' ? 'Converting…' : 'Convert to Word'}
        </PrimaryButton>
        {status === 'processing' && progress > 0 && <ProgressBar value={progress} label={`${progress}%`} />}
        <StatusBanner status={status} processingText="Extracting text…" errorText={error} />
        {result && <DownloadCard filename={result.name} onDownload={() => downloadBlob(result.blob, result.name)} />}
      </div>
      <ToolHistoryPanel history={history} />
    </ToolShell>
  )
}
