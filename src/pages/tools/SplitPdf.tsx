import { useState } from 'react'
import JSZip from 'jszip'
import { PDFDocument } from 'pdf-lib'
import { Scissors } from 'lucide-react'
import FileDrop from '../../components/FileDrop'
import { ToolShell, PrimaryButton, StatusBanner, DownloadCard, ProgressBar } from '../../components/ToolShell'
import { downloadBlob, loadPdfLib, readFileAsArrayBuffer, parsePageRanges, stripExt } from '../../lib/pdfCore'
import { useToolHistory } from '../../hooks/useToolHistory'
import ToolHistoryPanel from '../../components/ToolHistoryPanel'

type Status = 'idle' | 'processing' | 'done' | 'error'
type Mode = 'ranges' | 'every' | 'each'

export default function SplitPdf() {
  const [files, setFiles] = useState<File[]>([])
  const [mode, setMode] = useState<Mode>('ranges')
  const [ranges, setRanges] = useState('1-2, 3-4')
  const [everyN, setEveryN] = useState(1)
  const [pageCount, setPageCount] = useState<number | null>(null)
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState('')
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState<{ blob: Blob; name: string } | null>(null)
  const history = useToolHistory('split-pdf', 'Split PDF')

  const onFiles = async (f: File[]) => {
    setFiles(f)
    setStatus('idle')
    setResult(null)
    setPageCount(null)
    if (f[0]) {
      try {
        const bytes = await readFileAsArrayBuffer(f[0])
        const doc = await loadPdfLib(bytes)
        setPageCount(doc.getPageCount())
      } catch {
        /* ignore, validated on split */
      }
    }
  }

  const split = async () => {
    const file = files[0]
    if (!file) return
    setStatus('processing')
    setError('')
    setResult(null)
    setProgress(0)
    try {
      const bytes = await readFileAsArrayBuffer(file)
      const src = await loadPdfLib(bytes)
      const total = src.getPageCount()
      const baseName = stripExt(file.name)

      let groups: number[][] = []
      if (mode === 'ranges') {
        const indices = parsePageRanges(ranges, total)
        if (indices.length === 0) throw new Error('No valid pages selected')
        groups = [indices]
      } else if (mode === 'each') {
        groups = Array.from({ length: total }, (_, i) => [i])
      } else {
        const n = Math.max(1, everyN)
        for (let i = 0; i < total; i += n) {
          groups.push(Array.from({ length: Math.min(n, total - i) }, (_, k) => i + k))
        }
      }

      if (groups.length === 1) {
        const out = await PDFDocument.create()
        const pages = await out.copyPages(src, groups[0])
        pages.forEach((p) => out.addPage(p))
        const outBytes = await out.save()
        const singleName = `${baseName}-split.pdf`
        const singleBlob = new Blob([outBytes as BlobPart], { type: 'application/pdf' })
        setResult({ blob: singleBlob, name: singleName })
        history.saveResult(singleBlob, singleName)
      } else {
        const zip = new JSZip()
        for (let i = 0; i < groups.length; i++) {
          const out = await PDFDocument.create()
          const pages = await out.copyPages(src, groups[i])
          pages.forEach((p) => out.addPage(p))
          const outBytes = await out.save()
          zip.file(`${baseName}-part-${String(i + 1).padStart(2, '0')}.pdf`, outBytes)
          setProgress(Math.round(((i + 1) / groups.length) * 100))
        }
        const zipBlob = await zip.generateAsync({ type: 'blob' })
        const zipName = `${baseName}-split.zip`
        setResult({ blob: zipBlob, name: zipName })
        history.saveResult(zipBlob, zipName)
      }
      setStatus('done')
    } catch (e) {
      console.error(e)
      setError(e instanceof Error && e.message === 'No valid pages selected' ? 'Please enter a valid page range.' : 'Could not split this PDF. Please try a different file.')
      setStatus('error')
    }
  }

  return (
    <ToolShell icon={Scissors} title="Split PDF" description="Extract pages or split your PDF into multiple files.">
      <FileDrop accept="application/pdf" files={files} onFiles={onFiles} label="Select a PDF file or drag & drop here" />

      {files.length > 0 && (
        <div className="mt-6 space-y-4">
          {pageCount && <p className="text-sm text-muted-foreground">This PDF has {pageCount} pages.</p>}
          <div className="flex flex-wrap gap-2">
            {(
              [
                ['ranges', 'Custom ranges'],
                ['every', 'Split every N pages'],
                ['each', 'Extract every page'],
              ] as [Mode, string][]
            ).map(([m, label]) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`px-4 py-2 rounded-full text-sm font-semibold transition-colors ${
                  mode === m ? 'bg-primary text-white shadow-sm' : 'bg-surface text-foreground/80 border border-border hover:border-primary/40'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {mode === 'ranges' && (
            <div>
              <label className="block text-sm font-medium text-foreground/80 mb-1">Page ranges</label>
              <input
                value={ranges}
                onChange={(e) => setRanges(e.target.value)}
                placeholder="e.g. 1-3, 5, 8-10"
                className="w-full px-4 py-2.5 rounded-xl border border-border focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
              <p className="text-xs text-muted-foreground mt-1">Each comma-separated group becomes... one file when there's a single group, or a zip with one file per group.</p>
            </div>
          )}
          {mode === 'every' && (
            <div>
              <label className="block text-sm font-medium text-foreground/80 mb-1">Pages per file</label>
              <input
                type="number"
                min={1}
                value={everyN}
                onChange={(e) => setEveryN(parseInt(e.target.value) || 1)}
                className="w-32 px-4 py-2.5 rounded-xl border border-border focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
          )}
        </div>
      )}

      <div className="mt-6 flex flex-col items-center gap-4">
        <PrimaryButton onClick={split} disabled={files.length === 0 || status === 'processing'}>
          {status === 'processing' ? 'Splitting…' : 'Split PDF'}
        </PrimaryButton>
        {status === 'processing' && progress > 0 && <ProgressBar value={progress} label={`${progress}%`} />}
        <StatusBanner status={status} processingText="Splitting your PDF…" errorText={error} />
        {result && <DownloadCard filename={result.name} onDownload={() => downloadBlob(result.blob, result.name)} />}
      </div>
      <ToolHistoryPanel history={history} />
    </ToolShell>
  )
}
