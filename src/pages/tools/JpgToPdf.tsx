import { useState } from 'react'
import { PDFDocument } from 'pdf-lib'
import { FileImage, ArrowUp, ArrowDown, Trash2 } from 'lucide-react'
import FileDrop from '../../components/FileDrop'
import { ToolShell, PrimaryButton, StatusBanner, DownloadCard } from '../../components/ToolShell'
import { downloadBlob, readFileAsArrayBuffer } from '../../lib/pdfCore'
import { useToolHistory } from '../../hooks/useToolHistory'
import ToolHistoryPanel from '../../components/ToolHistoryPanel'

type Status = 'idle' | 'processing' | 'done' | 'error'
type PageSize = 'fit' | 'a4'

export default function JpgToPdf() {
  const [files, setFiles] = useState<File[]>([])
  const [pageSize, setPageSize] = useState<PageSize>('fit')
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState('')
  const [result, setResult] = useState<{ blob: Blob; name: string } | null>(null)
  const history = useToolHistory('jpg-to-pdf', 'JPG to PDF')

  const move = (idx: number, dir: -1 | 1) => {
    setFiles((prev) => {
      const next = [...prev]
      const target = idx + dir
      if (target < 0 || target >= next.length) return prev
      ;[next[idx], next[target]] = [next[target], next[idx]]
      return next
    })
  }

  const convert = async () => {
    if (files.length === 0) return
    setStatus('processing')
    setError('')
    setResult(null)
    try {
      const doc = await PDFDocument.create()
      for (const file of files) {
        const bytes = await readFileAsArrayBuffer(file)
        const isPng = file.type === 'image/png' || file.name.toLowerCase().endsWith('.png')
        const image = isPng ? await doc.embedPng(bytes) : await doc.embedJpg(bytes)
        const A4 = [595.28, 841.89]

        if (pageSize === 'a4') {
          const page = doc.addPage(A4 as [number, number])
          const margin = 24
          const maxW = A4[0] - margin * 2
          const maxH = A4[1] - margin * 2
          const scale = Math.min(maxW / image.width, maxH / image.height, 1)
          const w = image.width * scale
          const h = image.height * scale
          page.drawImage(image, { x: (A4[0] - w) / 2, y: (A4[1] - h) / 2, width: w, height: h })
        } else {
          const page = doc.addPage([image.width, image.height])
          page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height })
        }
      }
      const outBytes = await doc.save()
      const blob = new Blob([outBytes as BlobPart], { type: 'application/pdf' })
      setResult({ blob, name: 'e-docs-images.pdf' })
      history.saveResult(blob, 'e-docs-images.pdf')
      setStatus('done')
    } catch (e) {
      console.error(e)
      setError('Could not convert these images. Please use JPG or PNG files.')
      setStatus('error')
    }
  }

  return (
    <ToolShell icon={FileImage} title="JPG to PDF" description="Convert JPG and PNG images into a single PDF document.">
      <FileDrop
        accept="image/jpeg,image/png"
        multiple
        files={files}
        onFiles={(f) => {
          setFiles(f)
          setStatus('idle')
          setResult(null)
        }}
        label="Select images or drag & drop here"
        hint="JPG and PNG supported"
      />

      {files.length > 1 && (
        <ul className="mt-4 space-y-2">
          {files.map((f, i) => (
            <li key={`${f.name}-${i}`} className="flex items-center gap-2 bg-surface rounded-xl px-3 py-2">
              <span className="w-6 h-6 shrink-0 rounded-full brand-gradient text-white text-xs font-bold flex items-center justify-center">
                {i + 1}
              </span>
              <span className="flex-1 text-sm truncate text-foreground">{f.name}</span>
              <button onClick={() => move(i, -1)} disabled={i === 0} className="text-muted-foreground hover:text-primary disabled:opacity-30">
                <ArrowUp size={16} />
              </button>
              <button onClick={() => move(i, 1)} disabled={i === files.length - 1} className="text-muted-foreground hover:text-primary disabled:opacity-30">
                <ArrowDown size={16} />
              </button>
              <button onClick={() => setFiles(files.filter((_, idx) => idx !== i))} className="text-muted-foreground hover:text-red-500">
                <Trash2 size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {files.length > 0 && (
        <div className="mt-5 flex gap-2">
          <button
            onClick={() => setPageSize('fit')}
            className={`px-4 py-2 rounded-full text-sm font-semibold ${pageSize === 'fit' ? 'bg-primary text-white' : 'bg-surface text-foreground/80 border border-border hover:border-primary/40'}`}
          >
            Fit to image
          </button>
          <button
            onClick={() => setPageSize('a4')}
            className={`px-4 py-2 rounded-full text-sm font-semibold ${pageSize === 'a4' ? 'bg-primary text-white' : 'bg-surface text-foreground/80 border border-border hover:border-primary/40'}`}
          >
            A4 page
          </button>
        </div>
      )}

      <div className="mt-6 flex flex-col items-center gap-4">
        <PrimaryButton onClick={convert} disabled={files.length === 0 || status === 'processing'}>
          {status === 'processing' ? 'Converting…' : 'Convert to PDF'}
        </PrimaryButton>
        <StatusBanner status={status} processingText="Building your PDF…" errorText={error} />
        {result && <DownloadCard filename={result.name} onDownload={() => downloadBlob(result.blob, result.name)} />}
      </div>
      <ToolHistoryPanel history={history} />
    </ToolShell>
  )
}
