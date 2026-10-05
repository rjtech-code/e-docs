import { useState } from 'react'
import { Combine, ArrowUp, ArrowDown, Trash2 } from 'lucide-react'
import { PDFDocument } from 'pdf-lib'
import FileDrop from '../../components/FileDrop'
import { ToolShell, PrimaryButton, StatusBanner, DownloadCard } from '../../components/ToolShell'
import { downloadBlob, loadPdfLib, readFileAsArrayBuffer, formatBytes } from '../../lib/pdfCore'
import { useToolHistory } from '../../hooks/useToolHistory'
import ToolHistoryPanel from '../../components/ToolHistoryPanel'

type Status = 'idle' | 'processing' | 'done' | 'error'

export default function MergePdf() {
  const [files, setFiles] = useState<File[]>([])
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState('')
  const [result, setResult] = useState<{ blob: Blob; name: string } | null>(null)
  const history = useToolHistory('merge-pdf', 'Merge PDF')

  const move = (idx: number, dir: -1 | 1) => {
    setFiles((prev) => {
      const next = [...prev]
      const target = idx + dir
      if (target < 0 || target >= next.length) return prev
      ;[next[idx], next[target]] = [next[target], next[idx]]
      return next
    })
  }

  const remove = (idx: number) => setFiles((prev) => prev.filter((_, i) => i !== idx))

  const merge = async () => {
    if (files.length < 2) return
    setStatus('processing')
    setError('')
    setResult(null)
    try {
      const merged = await PDFDocument.create()
      for (const file of files) {
        const bytes = await readFileAsArrayBuffer(file)
        const src = await loadPdfLib(bytes)
        const pages = await merged.copyPages(src, src.getPageIndices())
        pages.forEach((p) => merged.addPage(p))
      }
      const bytes = await merged.save()
      const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' })
      setResult({ blob, name: 'e-docs-merged.pdf' })
      history.saveResult(blob, 'e-docs-merged.pdf')
      setStatus('done')
    } catch (e) {
      console.error(e)
      setError('Could not merge these PDFs. Make sure all files are valid PDFs.')
      setStatus('error')
    }
  }

  return (
    <ToolShell
      icon={Combine}
      title="Merge PDF"
      description="Combine multiple PDF files into one, in the order you choose."
    >
      <FileDrop
        accept="application/pdf"
        multiple
        files={files}
        onFiles={(f) => {
          setFiles(f)
          setStatus('idle')
          setResult(null)
        }}
        label="Select PDF files or drag & drop here"
        hint="Add 2 or more PDFs to merge"
      />

      {files.length > 1 && (
        <ul className="mt-4 space-y-2">
          {files.map((f, i) => (
            <li key={`${f.name}-${i}`} className="flex items-center gap-2 bg-surface rounded-xl px-3 py-2">
              <span className="w-6 h-6 shrink-0 rounded-full brand-gradient text-white text-xs font-bold flex items-center justify-center">
                {i + 1}
              </span>
              <span className="flex-1 text-sm truncate text-foreground">{f.name}</span>
              <span className="text-xs text-muted-foreground shrink-0">{formatBytes(f.size)}</span>
              <button onClick={() => move(i, -1)} disabled={i === 0} className="text-muted-foreground hover:text-primary disabled:opacity-30">
                <ArrowUp size={16} />
              </button>
              <button onClick={() => move(i, 1)} disabled={i === files.length - 1} className="text-muted-foreground hover:text-primary disabled:opacity-30">
                <ArrowDown size={16} />
              </button>
              <button onClick={() => remove(i)} className="text-muted-foreground hover:text-red-500">
                <Trash2 size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-6 flex flex-col items-center gap-4">
        <PrimaryButton onClick={merge} disabled={files.length < 2 || status === 'processing'}>
          {status === 'processing' ? 'Merging…' : `Merge ${files.length || ''} PDF${files.length === 1 ? '' : 's'}`}
        </PrimaryButton>
        <StatusBanner status={status} processingText="Merging your PDFs…" errorText={error} />
        {result && <DownloadCard filename={result.name} onDownload={() => downloadBlob(result.blob, result.name)} />}
      </div>
      <ToolHistoryPanel history={history} />
    </ToolShell>
  )
}
