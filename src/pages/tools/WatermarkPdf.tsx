import { useState } from 'react'
import { rgb, degrees, StandardFonts } from 'pdf-lib'
import { Stamp } from 'lucide-react'
import FileDrop from '../../components/FileDrop'
import { ToolShell, PrimaryButton, StatusBanner, DownloadCard } from '../../components/ToolShell'
import { downloadBlob, loadPdfLib, readFileAsArrayBuffer, stripExt } from '../../lib/pdfCore'
import { useToolHistory } from '../../hooks/useToolHistory'
import ToolHistoryPanel from '../../components/ToolHistoryPanel'

type Status = 'idle' | 'processing' | 'done' | 'error'

export default function WatermarkPdf() {
  const [files, setFiles] = useState<File[]>([])
  const [text, setText] = useState('E-Docs')
  const [opacity, setOpacity] = useState(0.25)
  const [fontSize, setFontSize] = useState(48)
  const [rotation, setRotation] = useState(45)
  const [colorHex, setColorHex] = useState('#2f7cf6')
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState('')
  const [result, setResult] = useState<{ blob: Blob; name: string } | null>(null)
  const history = useToolHistory('watermark-pdf', 'Watermark')

  const apply = async () => {
    const file = files[0]
    if (!file || !text.trim()) return
    setStatus('processing')
    setError('')
    setResult(null)
    try {
      const bytes = await readFileAsArrayBuffer(file)
      const doc = await loadPdfLib(bytes)
      const font = await doc.embedFont(StandardFonts.HelveticaBold)
      const r = parseInt(colorHex.slice(1, 3), 16) / 255
      const g = parseInt(colorHex.slice(3, 5), 16) / 255
      const b = parseInt(colorHex.slice(5, 7), 16) / 255

      doc.getPages().forEach((page) => {
        const { width, height } = page.getSize()
        const textWidth = font.widthOfTextAtSize(text, fontSize)
        page.drawText(text, {
          x: width / 2 - textWidth / 2,
          y: height / 2,
          size: fontSize,
          font,
          color: rgb(r, g, b),
          opacity,
          rotate: degrees(rotation),
        })
      })

      const outBytes = await doc.save()
      const blob = new Blob([outBytes as BlobPart], { type: 'application/pdf' })
      const name = `${stripExt(file.name)}-watermarked.pdf`
      setResult({ blob, name })
      history.saveResult(blob, name)
      setStatus('done')
    } catch (e) {
      console.error(e)
      setError('Could not add a watermark. Please try a different file.')
      setStatus('error')
    }
  }

  return (
    <ToolShell icon={Stamp} title="Watermark PDF" description="Stamp text over every page of your PDF in seconds.">
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
            <label className="block text-sm font-medium text-foreground/80 mb-1">Watermark text</label>
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-border focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Opacity</label>
              <input type="range" min={0.05} max={1} step={0.05} value={opacity} onChange={(e) => setOpacity(parseFloat(e.target.value))} className="w-full accent-primary" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Font size</label>
              <input type="range" min={12} max={120} value={fontSize} onChange={(e) => setFontSize(parseInt(e.target.value))} className="w-full accent-primary" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Rotation</label>
              <input type="range" min={0} max={360} value={rotation} onChange={(e) => setRotation(parseInt(e.target.value))} className="w-full accent-primary" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Color</label>
              <input type="color" value={colorHex} onChange={(e) => setColorHex(e.target.value)} className="w-full h-9 rounded-lg cursor-pointer" />
            </div>
          </div>
        </div>
      )}

      <div className="mt-6 flex flex-col items-center gap-4">
        <PrimaryButton onClick={apply} disabled={files.length === 0 || !text.trim() || status === 'processing'}>
          {status === 'processing' ? 'Adding watermark…' : 'Add Watermark'}
        </PrimaryButton>
        <StatusBanner status={status} processingText="Stamping pages…" errorText={error} />
        {result && <DownloadCard filename={result.name} onDownload={() => downloadBlob(result.blob, result.name)} />}
      </div>
      <ToolHistoryPanel history={history} />
    </ToolShell>
  )
}
