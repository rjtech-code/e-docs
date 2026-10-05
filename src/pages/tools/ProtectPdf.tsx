import { useState } from 'react'
import { Lock, Eye, EyeOff } from 'lucide-react'
import FileDrop from '../../components/FileDrop'
import { ToolShell, PrimaryButton, StatusBanner, DownloadCard } from '../../components/ToolShell'
import { downloadBlob, loadPdfLib, readFileAsArrayBuffer, stripExt } from '../../lib/pdfCore'
import { protectPdfDocument } from '../../lib/pdfEncrypt'
import { useToolHistory } from '../../hooks/useToolHistory'
import ToolHistoryPanel from '../../components/ToolHistoryPanel'

type Status = 'idle' | 'processing' | 'done' | 'error'

export default function ProtectPdf() {
  const [files, setFiles] = useState<File[]>([])
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [allowPrinting, setAllowPrinting] = useState(true)
  const [allowCopying, setAllowCopying] = useState(true)
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState('')
  const [result, setResult] = useState<{ blob: Blob; name: string } | null>(null)
  const history = useToolHistory('protect-pdf', 'Protect PDF')

  const canSubmit = files.length > 0 && password.length > 0 && password === confirm

  const protect = async () => {
    const file = files[0]
    if (!file || !canSubmit) return
    setStatus('processing')
    setError('')
    setResult(null)
    try {
      const bytes = await readFileAsArrayBuffer(file)
      const doc = await loadPdfLib(bytes)
      await protectPdfDocument(doc, {
        userPassword: password,
        strength: 'rc4-128',
        allowPrinting,
        allowCopying,
      })
      const outBytes = await doc.save({ useObjectStreams: false })
      const blob = new Blob([outBytes as BlobPart], { type: 'application/pdf' })
      const name = `${stripExt(file.name)}-protected.pdf`
      setResult({ blob, name })
      history.saveResult(blob, name)
      setStatus('done')
    } catch (e) {
      console.error(e)
      setError('Could not protect this PDF. Please try a different file.')
      setStatus('error')
    }
  }

  return (
    <ToolShell icon={Lock} title="Protect PDF" description="Add a password so only people who know it can open your PDF.">
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
        <div className="mt-6 space-y-4 max-w-sm mx-auto">
          <div>
            <label className="block text-sm font-medium text-foreground/80 mb-1">Password</label>
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
          <div>
            <label className="block text-sm font-medium text-foreground/80 mb-1">Confirm password</label>
            <input
              type={showPw ? 'text' : 'password'}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-border focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
            {confirm.length > 0 && confirm !== password && <p className="text-xs text-red-500 mt-1">Passwords don't match</p>}
          </div>
          <div className="flex flex-col gap-2 pt-1">
            <label className="flex items-center gap-2 text-sm text-foreground/80">
              <input type="checkbox" checked={allowPrinting} onChange={(e) => setAllowPrinting(e.target.checked)} className="accent-primary" />
              Allow printing
            </label>
            <label className="flex items-center gap-2 text-sm text-foreground/80">
              <input type="checkbox" checked={allowCopying} onChange={(e) => setAllowCopying(e.target.checked)} className="accent-primary" />
              Allow copying text & images
            </label>
          </div>
        </div>
      )}

      <div className="mt-6 flex flex-col items-center gap-4">
        <PrimaryButton onClick={protect} disabled={!canSubmit || status === 'processing'}>
          {status === 'processing' ? 'Protecting…' : 'Protect PDF'}
        </PrimaryButton>
        <StatusBanner status={status} processingText="Encrypting your PDF…" errorText={error} />
        {result && <DownloadCard filename={result.name} onDownload={() => downloadBlob(result.blob, result.name)} />}
      </div>
      <ToolHistoryPanel history={history} />
    </ToolShell>
  )
}
