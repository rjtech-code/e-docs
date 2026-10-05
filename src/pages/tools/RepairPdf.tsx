import { useState } from 'react'
import { PDFDocument } from 'pdf-lib'
import { Wrench } from 'lucide-react'
import FileDrop from '../../components/FileDrop'
import { ToolShell, PrimaryButton, StatusBanner, DownloadCard } from '../../components/ToolShell'
import { downloadBlob, readFileAsArrayBuffer, stripExt } from '../../lib/pdfCore'
import { useToolHistory } from '../../hooks/useToolHistory'
import ToolHistoryPanel from '../../components/ToolHistoryPanel'

type Status = 'idle' | 'processing' | 'done' | 'error'

export default function RepairPdf() {
  const [files, setFiles] = useState<File[]>([])
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState('')
  const [result, setResult] = useState<{ blob: Blob; name: string } | null>(null)
  const history = useToolHistory('repair-pdf', 'Repair PDF')

  const repair = async () => {
    const file = files[0]
    if (!file) return
    setStatus('processing')
    setError('')
    setResult(null)
    try {
      const bytes = await readFileAsArrayBuffer(file)
      // Parse as leniently as possible, rebuilding the cross-reference table & object streams.
      const doc = await PDFDocument.load(bytes, {
        ignoreEncryption: true,
        throwOnInvalidObject: false,
        updateMetadata: false,
        parseSpeed: 1,
      } as any)
      // Re-saving with fresh object streams discards any corrupt xref/stream data.
      const outBytes = await doc.save({ useObjectStreams: true })
      const blob = new Blob([outBytes as BlobPart], { type: 'application/pdf' })
      const name = `${stripExt(file.name)}-repaired.pdf`
      setResult({ blob, name })
      history.saveResult(blob, name)
      setStatus('done')
    } catch (e) {
      console.error(e)
      setError('This PDF is too damaged to be repaired automatically.')
      setStatus('error')
    }
  }

  return (
    <ToolShell icon={Wrench} title="Repair PDF" description="Repair a damaged PDF and recover as much data as possible.">
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
        <PrimaryButton onClick={repair} disabled={files.length === 0 || status === 'processing'}>
          {status === 'processing' ? 'Repairing…' : 'Repair PDF'}
        </PrimaryButton>
        <StatusBanner status={status} processingText="Rebuilding document structure…" errorText={error} />
        {result && <DownloadCard filename={result.name} onDownload={() => downloadBlob(result.blob, result.name)} />}
      </div>
      <ToolHistoryPanel history={history} />
    </ToolShell>
  )
}
