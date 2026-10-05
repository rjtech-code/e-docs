import { useState } from 'react'
import { Unlock, Eye, EyeOff } from 'lucide-react'
import FileDrop from '../../components/FileDrop'
import { ToolShell, PrimaryButton, StatusBanner, DownloadCard } from '../../components/ToolShell'
import { downloadBlob, loadPdfLib, readFileAsArrayBuffer, stripExt } from '../../lib/pdfCore'
import { unlockPdfDocument } from '../../lib/pdfEncrypt'
import { useToolHistory } from '../../hooks/useToolHistory'
import ToolHistoryPanel from '../../components/ToolHistoryPanel'

type Status = 'idle' | 'processing' | 'done' | 'error'

export default function UnlockPdf() {
  const [files, setFiles] = useState<File[]>([])
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState('')
  const [result, setResult] = useState<{ blob: Blob; name: string } | null>(null)
  const history = useToolHistory('unlock-pdf', 'Unlock PDF')

  const unlock = async () => {
    const file = files[0]
    if (!file) return
    setStatus('processing')
    setError('')
    setResult(null)
    try {
      const bytes = await readFileAsArrayBuffer(file)
      const doc = await loadPdfLib(bytes)
      const outcome = unlockPdfDocument(doc, password)

      if (!outcome.success) {
        if (outcome.reason === 'wrong-password') {
          setError('Incorrect password. Please try again.')
        } else if (outcome.reason === 'unsupported') {
          setError('This PDF uses an encryption method that is not supported yet (e.g. AES).')
        } else {
          setError('Could not unlock this PDF.')
        }
        setStatus('error')
        return
      }

      const outBytes = await doc.save()
      const blob = new Blob([outBytes as BlobPart], { type: 'application/pdf' })
      const name = `${stripExt(file.name)}-unlocked.pdf`
      setResult({ blob, name })
      history.saveResult(blob, name)
      setStatus('done')
    } catch (e) {
      console.error(e)
      setError('Could not unlock this PDF. Please try a different file.')
      setStatus('error')
    }
  }

  return (
    <ToolShell icon={Unlock} title="Unlock PDF" description="Remove password protection from your PDF so you can use it freely.">
      <FileDrop
        accept="application/pdf"
        files={files}
        onFiles={(f) => {
          setFiles(f)
          setStatus('idle')
          setResult(null)
        }}
        label="Select a protected PDF file or drag & drop here"
      />

      {files.length > 0 && (
        <div className="mt-6 max-w-sm mx-auto">
          <label className="block text-sm font-medium text-foreground/80 mb-1">Password (leave blank if none needed to open)</label>
          <div className="relative">
            <input
              type={showPw ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2.5 pr-10 rounded-xl border border-border focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
            <button type="button" onClick={() => setShowPw((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>
      )}

      <div className="mt-6 flex flex-col items-center gap-4">
        <PrimaryButton onClick={unlock} disabled={files.length === 0 || status === 'processing'}>
          {status === 'processing' ? 'Unlocking…' : 'Unlock PDF'}
        </PrimaryButton>
        <StatusBanner status={status} processingText="Removing protection…" errorText={error} />
        {result && <DownloadCard filename={result.name} onDownload={() => downloadBlob(result.blob, result.name)} />}
      </div>
      <ToolHistoryPanel history={history} />
    </ToolShell>
  )
}
