import { useState } from 'react'
import JSZip from 'jszip'
import jsPDF from 'jspdf'
import { FileImage } from 'lucide-react'
import FileDrop from '../../components/FileDrop'
import { ToolShell, PrimaryButton, StatusBanner, DownloadCard } from '../../components/ToolShell'
import { downloadBlob, readFileAsArrayBuffer, stripExt } from '../../lib/pdfCore'
import { useToolHistory } from '../../hooks/useToolHistory'
import ToolHistoryPanel from '../../components/ToolHistoryPanel'
import { convertOnServer } from '../../lib/serverConvert'

type Status = 'idle' | 'processing' | 'done' | 'error'

function extractSlideTexts(xml: string): string[] {
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  const nodes = Array.from(doc.getElementsByTagName('a:t'))
  return nodes.map((n) => n.textContent ?? '').filter((t) => t.trim().length > 0)
}

export default function PowerpointToPdf() {
  const [files, setFiles] = useState<File[]>([])
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState('')
  const [result, setResult] = useState<{ blob: Blob; name: string } | null>(null)
  const history = useToolHistory('powerpoint-to-pdf', 'PowerPoint to PDF')

  const convert = async () => {
    const file = files[0]
    if (!file) return
    setStatus('processing')
    setError('')
    setResult(null)
    try {
      // Best fidelity: convert on the server (keeps layout, fonts, images). Falls back to the
      // in-browser converter below if the server can't do it.
      const server = await convertOnServer('powerpoint-to-pdf', file, `${stripExt(file.name)}.pdf`)
      if (server) {
        setResult(server)
        history.saveResult(server.blob, server.name)
        setStatus('done')
        return
      }

      const bytes = await readFileAsArrayBuffer(file)
      const zip = await JSZip.loadAsync(bytes)

      const slideFiles = Object.keys(zip.files)
        .filter((p) => /^ppt\/slides\/slide\d+\.xml$/.test(p))
        .sort((a, b) => {
          const na = parseInt(a.match(/slide(\d+)\.xml/)![1], 10)
          const nb = parseInt(b.match(/slide(\d+)\.xml/)![1], 10)
          return na - nb
        })

      if (slideFiles.length === 0) throw new Error('No slides found')

      const pdf = new jsPDF({ unit: 'pt', format: [720, 405] }) // 16:9 slide
      const margin = 40

      for (let i = 0; i < slideFiles.length; i++) {
        const xml = await zip.files[slideFiles[i]].async('text')
        const texts = extractSlideTexts(xml)
        if (i > 0) pdf.addPage([720, 405])

        pdf.setFillColor(255, 255, 255)
        pdf.rect(0, 0, 720, 405, 'F')
        pdf.setDrawColor(249, 46, 130)
        pdf.setLineWidth(3)
        pdf.line(margin, 64, 680, 64)

        let y = 50
        texts.forEach((t, idx) => {
          const isTitle = idx === 0
          pdf.setFont('helvetica', isTitle ? 'bold' : 'normal')
          pdf.setFontSize(isTitle ? 24 : 14)
          pdf.setTextColor(isTitle ? 224 : 51, isTitle ? 17 : 65, isTitle ? 109 : 85)
          const lines = pdf.splitTextToSize(t, 640)
          if (isTitle) y = 40
          else if (idx === 1) y = 90
          lines.forEach((line: string) => {
            if (y > 380) return
            pdf.text(line, margin, y)
            y += isTitle ? 30 : 20
          })
          if (!isTitle) y += 6
        })

        pdf.setFontSize(9)
        pdf.setTextColor(180, 180, 180)
        pdf.text(`${i + 1}`, 690, 395)
      }

      const blob = pdf.output('blob')
      const name = `${stripExt(file.name)}.pdf`
      setResult({ blob, name })
      history.saveResult(blob, name)
      setStatus('done')
    } catch (e) {
      console.error(e)
      setError('Could not convert this presentation. Only .pptx files are supported.')
      setStatus('error')
    }
  }

  return (
    <ToolShell icon={FileImage} title="PowerPoint to PDF" description="Convert your PPTX slides into a shareable PDF.">
      <FileDrop
        accept=".pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation"
        files={files}
        onFiles={(f) => {
          setFiles(f)
          setStatus('idle')
          setResult(null)
        }}
        label="Select a .pptx file or drag & drop here"
      />
      <p className="text-xs text-muted-foreground mt-3">
        Rebuilds each slide's text content as a clean PDF page. Complex slide graphics and
        transitions are not reproduced.
      </p>

      <div className="mt-6 flex flex-col items-center gap-4">
        <PrimaryButton onClick={convert} disabled={files.length === 0 || status === 'processing'}>
          {status === 'processing' ? 'Converting…' : 'Convert to PDF'}
        </PrimaryButton>
        <StatusBanner status={status} processingText="Reading slides…" errorText={error} />
        {result && <DownloadCard filename={result.name} onDownload={() => downloadBlob(result.blob, result.name)} />}
      </div>
      <ToolHistoryPanel history={history} />
    </ToolShell>
  )
}
