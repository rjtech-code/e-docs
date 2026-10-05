import { useState } from 'react'
import { rgb, StandardFonts } from 'pdf-lib'
import { Hash } from 'lucide-react'
import FileDrop from '../../components/FileDrop'
import { ToolShell, PrimaryButton, StatusBanner, DownloadCard } from '../../components/ToolShell'
import { downloadBlob, loadPdfLib, readFileAsArrayBuffer, stripExt } from '../../lib/pdfCore'
import { useToolHistory } from '../../hooks/useToolHistory'
import ToolHistoryPanel from '../../components/ToolHistoryPanel'

type Status = 'idle' | 'processing' | 'done' | 'error'
type Position = 'bottom-center' | 'bottom-right' | 'bottom-left' | 'top-center' | 'top-right' | 'top-left'

const positions: { id: Position; label: string }[] = [
  { id: 'top-left', label: 'Top left' },
  { id: 'top-center', label: 'Top center' },
  { id: 'top-right', label: 'Top right' },
  { id: 'bottom-left', label: 'Bottom left' },
  { id: 'bottom-center', label: 'Bottom center' },
  { id: 'bottom-right', label: 'Bottom right' },
]

export default function PageNumbers() {
  const [files, setFiles] = useState<File[]>([])
  const [position, setPosition] = useState<Position>('bottom-center')
  const [startAt, setStartAt] = useState(1)
  const [format, setFormat] = useState('{n}')
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState('')
  const [result, setResult] = useState<{ blob: Blob; name: string } | null>(null)
  const history = useToolHistory('page-numbers', 'Page Numbers')

  const apply = async () => {
    const file = files[0]
    if (!file) return
    setStatus('processing')
    setError('')
    setResult(null)
    try {
      const bytes = await readFileAsArrayBuffer(file)
      const doc = await loadPdfLib(bytes)
      const font = await doc.embedFont(StandardFonts.Helvetica)
      const pages = doc.getPages()
      const total = pages.length

      pages.forEach((page, idx) => {
        const num = startAt + idx
        const text = format.replace('{n}', String(num)).replace('{total}', String(total))
        const size = 11
        const width = font.widthOfTextAtSize(text, size)
        const { width: pw, height: ph } = page.getSize()
        const margin = 24
        let x = pw / 2 - width / 2
        let y = margin
        if (position.startsWith('top')) y = ph - margin
        if (position.endsWith('left')) x = margin
        if (position.endsWith('right')) x = pw - margin - width
        page.drawText(text, { x, y, size, font, color: rgb(0.15, 0.15, 0.2) })
      })

      const outBytes = await doc.save()
      const blob = new Blob([outBytes as BlobPart], { type: 'application/pdf' })
      const name = `${stripExt(file.name)}-numbered.pdf`
      setResult({ blob, name })
      history.saveResult(blob, name)
      setStatus('done')
    } catch (e) {
      console.error(e)
      setError('Could not add page numbers. Please try a different file.')
      setStatus('error')
    }
  }

  return (
    <ToolShell icon={Hash} title="Page Numbers" description="Add page numbers into your PDF with the position and style you want.">
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
        <div className="mt-6 space-y-5">
          <div>
            <p className="text-sm font-medium text-foreground/80 mb-2">Position</p>
            <div className="grid grid-cols-3 gap-2">
              {positions.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setPosition(p.id)}
                  className={`px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
                    position === p.id ? 'bg-primary text-white' : 'bg-surface text-foreground/80 border border-border hover:border-primary/40'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-4 flex-wrap">
            <div>
              <label className="block text-sm font-medium text-foreground/80 mb-1">Start at</label>
              <input
                type="number"
                min={0}
                value={startAt}
                onChange={(e) => setStartAt(parseInt(e.target.value) || 1)}
                className="w-28 px-4 py-2.5 rounded-xl border border-border focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground/80 mb-1">Format</label>
              <input
                value={format}
                onChange={(e) => setFormat(e.target.value)}
                placeholder="{n} or Page {n} of {total}"
                className="w-56 px-4 py-2.5 rounded-xl border border-border focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
          </div>
        </div>
      )}

      <div className="mt-6 flex flex-col items-center gap-4">
        <PrimaryButton onClick={apply} disabled={files.length === 0 || status === 'processing'}>
          {status === 'processing' ? 'Adding numbers…' : 'Add Page Numbers'}
        </PrimaryButton>
        <StatusBanner status={status} processingText="Numbering pages…" errorText={error} />
        {result && <DownloadCard filename={result.name} onDownload={() => downloadBlob(result.blob, result.name)} />}
      </div>
      <ToolHistoryPanel history={history} />
    </ToolShell>
  )
}
