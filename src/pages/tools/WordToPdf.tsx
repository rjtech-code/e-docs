import { useState } from 'react'
import mammoth from 'mammoth'
import { FileType2 } from 'lucide-react'
import FileDrop from '../../components/FileDrop'
import { ToolShell, PrimaryButton, StatusBanner, DownloadCard } from '../../components/ToolShell'
import { downloadBlob, readFileAsArrayBuffer, stripExt } from '../../lib/pdfCore'
import { renderHtmlToPdfBlob } from '../../lib/htmlToPdf'
import { useToolHistory } from '../../hooks/useToolHistory'
import ToolHistoryPanel from '../../components/ToolHistoryPanel'
import { convertOnServer } from '../../lib/serverConvert'

type Status = 'idle' | 'processing' | 'done' | 'error'

export default function WordToPdf() {
  const [files, setFiles] = useState<File[]>([])
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState('')
  const [result, setResult] = useState<{ blob: Blob; name: string } | null>(null)
  const history = useToolHistory('word-to-pdf', 'Word to PDF')

  const convert = async () => {
    const file = files[0]
    if (!file) return
    setStatus('processing')
    setError('')
    setResult(null)
    try {
      // Best fidelity: convert on the server (keeps layout, fonts, images). Falls back to the
      // in-browser converter below if the server can't do it.
      const server = await convertOnServer('word-to-pdf', file, `${stripExt(file.name)}.pdf`)
      if (server) {
        setResult(server)
        history.saveResult(server.blob, server.name)
        setStatus('done')
        return
      }

      const bytes = await readFileAsArrayBuffer(file)
      const { value: html } = await mammoth.convertToHtml({ arrayBuffer: bytes })
      const blob = renderHtmlToPdfBlob(html || '<p></p>')
      const name = `${stripExt(file.name)}.pdf`
      setResult({ blob, name })
      history.saveResult(blob, name)
      setStatus('done')
    } catch (e) {
      console.error(e)
      setError('Could not convert this Word document. Only .docx files are supported.')
      setStatus('error')
    }
  }

  return (
    <ToolShell icon={FileType2} title="Word to PDF" description="Convert your DOCX document into a ready-to-share PDF.">
      <FileDrop
        accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        files={files}
        onFiles={(f) => {
          setFiles(f)
          setStatus('idle')
          setResult(null)
        }}
        label="Select a .docx file or drag & drop here"
      />

      <div className="mt-6 flex flex-col items-center gap-4">
        <PrimaryButton onClick={convert} disabled={files.length === 0 || status === 'processing'}>
          {status === 'processing' ? 'Converting…' : 'Convert to PDF'}
        </PrimaryButton>
        <StatusBanner status={status} processingText="Rendering document…" errorText={error} />
        {result && <DownloadCard filename={result.name} onDownload={() => downloadBlob(result.blob, result.name)} />}
      </div>
      <ToolHistoryPanel history={history} />
    </ToolShell>
  )
}
