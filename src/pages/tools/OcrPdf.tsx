import { useState } from 'react'
import { createWorker } from 'tesseract.js'
import { rgb } from 'pdf-lib'
import { ScanText, FileDown } from 'lucide-react'
import FileDrop from '../../components/FileDrop'
import { ToolShell, PrimaryButton, SecondaryButton, StatusBanner, DownloadCard, ProgressBar } from '../../components/ToolShell'
import { downloadBlob, loadPdfLib, loadPdfJs, readFileAsArrayBuffer, renderPageToCanvas, canvasToBlob, stripExt } from '../../lib/pdfCore'
import { useToolHistory } from '../../hooks/useToolHistory'
import ToolHistoryPanel from '../../components/ToolHistoryPanel'

type Status = 'idle' | 'processing' | 'done' | 'error'

export default function OcrPdf() {
  const [files, setFiles] = useState<File[]>([])
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState('')
  const [progress, setProgress] = useState(0)
  const [progressLabel, setProgressLabel] = useState('')
  const [result, setResult] = useState<{ blob: Blob; name: string } | null>(null)
  const [textResult, setTextResult] = useState<{ blob: Blob; name: string } | null>(null)
  const history = useToolHistory('ocr-pdf', 'OCR PDF')

  const run = async () => {
    const file = files[0]
    if (!file) return
    setStatus('processing')
    setError('')
    setResult(null)
    setTextResult(null)
    setProgress(0)
    try {
      const bytes = await readFileAsArrayBuffer(file)
      // pdf.js transfers its input buffer to a worker (detaching it), so give it an
      // independent copy and keep the original bytes intact for pdf-lib below.
      const pdfjsDoc = await loadPdfJs(bytes.slice(0))
      const outDoc = await loadPdfLib(bytes)
      const outPages = outDoc.getPages()

      setProgressLabel('Starting OCR engine…')
      const worker = await createWorker('eng')
      let allText = ''
      const scale = 2

      try {
        for (let i = 1; i <= pdfjsDoc.numPages; i++) {
          setProgressLabel(`Reading page ${i} of ${pdfjsDoc.numPages}…`)
          const canvas = await renderPageToCanvas(pdfjsDoc, i, scale)
          const blob = await canvasToBlob(canvas, 'image/png', 1)
          const { data } = await worker.recognize(blob)
          allText += `--- Page ${i} ---\n${data.text}\n\n`

          const page = outPages[i - 1]
          const words = (data.blocks ?? []).flatMap((b) => b.paragraphs.flatMap((p) => p.lines.flatMap((l) => l.words)))
          if (page && words.length) {
            const { width: pageW, height: pageH } = page.getSize()
            for (const word of words) {
              if (!word.text.trim()) continue
              const bbox = word.bbox
              const x = (bbox.x0 / canvas.width) * pageW
              const yTop = (bbox.y0 / canvas.height) * pageH
              const wHeight = ((bbox.y1 - bbox.y0) / canvas.height) * pageH
              try {
                page.drawText(word.text, {
                  x,
                  y: pageH - yTop - wHeight,
                  size: Math.max(4, wHeight * 0.9),
                  color: rgb(0, 0, 0),
                  opacity: 0.01,
                })
              } catch {
                /* skip characters the base font can't encode */
              }
            }
          }
          setProgress(Math.round((i / pdfjsDoc.numPages) * 100))
        }
      } finally {
        await worker.terminate()
      }

      const outBytes = await outDoc.save()
      const blob = new Blob([outBytes as BlobPart], { type: 'application/pdf' })
      const name = `${stripExt(file.name)}-ocr.pdf`
      setResult({ blob, name })
      history.saveResult(blob, name)
      setTextResult({ blob: new Blob([allText], { type: 'text/plain' }), name: `${stripExt(file.name)}.txt` })
      setStatus('done')
    } catch (e) {
      console.error(e)
      setError('Could not run OCR on this PDF.')
      setStatus('error')
    }
  }

  return (
    <ToolShell icon={ScanText} title="OCR PDF" description="Recognize text inside scanned PDFs to make them searchable.">
      <FileDrop
        accept="application/pdf"
        files={files}
        onFiles={(f) => {
          setFiles(f)
          setStatus('idle')
          setResult(null)
          setTextResult(null)
        }}
        label="Select a scanned PDF or drag & drop here"
      />
      <p className="text-xs text-muted-foreground mt-3">OCR runs entirely in your browser and may take a while for long documents.</p>

      <div className="mt-6 flex flex-col items-center gap-4">
        <PrimaryButton onClick={run} disabled={files.length === 0 || status === 'processing'}>
          {status === 'processing' ? 'Recognizing text…' : 'Run OCR'}
        </PrimaryButton>
        {status === 'processing' && <ProgressBar value={progress} label={progressLabel} />}
        <StatusBanner status={status} processingText={progressLabel || 'Recognizing text…'} errorText={error} />
        {result && (
          <div className="w-full flex flex-col gap-2">
            <DownloadCard filename={result.name} onDownload={() => downloadBlob(result.blob, result.name)} />
            {textResult && (
              <SecondaryButton onClick={() => downloadBlob(textResult.blob, textResult.name)}>
                <span className="flex items-center gap-2">
                  <FileDown size={16} /> Download extracted text (.txt)
                </span>
              </SecondaryButton>
            )}
          </div>
        )}
      </div>
      <ToolHistoryPanel history={history} />
    </ToolShell>
  )
}
