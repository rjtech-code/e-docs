import { useState } from 'react'
import * as XLSX from 'xlsx'
import { Sheet } from 'lucide-react'
import FileDrop from '../../components/FileDrop'
import { ToolShell, PrimaryButton, StatusBanner, DownloadCard, ProgressBar } from '../../components/ToolShell'
import { downloadBlob, loadPdfJs, extractPageWords, readFileAsArrayBuffer, stripExt } from '../../lib/pdfCore'
import { useToolHistory } from '../../hooks/useToolHistory'
import ToolHistoryPanel from '../../components/ToolHistoryPanel'
import { convertOnServer } from '../../lib/serverConvert'

type Status = 'idle' | 'processing' | 'done' | 'error'

export default function PdfToExcel() {
  const [files, setFiles] = useState<File[]>([])
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState('')
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState<{ blob: Blob; name: string } | null>(null)
  const history = useToolHistory('pdf-to-excel', 'PDF to Excel')

  const convert = async () => {
    const file = files[0]
    if (!file) return
    setStatus('processing')
    setError('')
    setResult(null)
    setProgress(0)
    try {
      // Best fidelity: convert on the server (keeps layout, fonts, images). Falls back to the
      // in-browser converter below if the server can't do it.
      const server = await convertOnServer('pdf-to-excel', file, `${stripExt(file.name)}.xlsx`)
      if (server) {
        setResult(server)
        history.saveResult(server.blob, server.name)
        setStatus('done')
        return
      }

      const bytes = await readFileAsArrayBuffer(file)
      const doc = await loadPdfJs(bytes)
      const wb = XLSX.utils.book_new()

      for (let i = 1; i <= doc.numPages; i++) {
        const { words } = await extractPageWords(doc, i)
        // Group words into rows by y-position, then sort each row left-to-right.
        const rows: { y: number; words: typeof words }[] = []
        for (const w of words) {
          let row = rows.find((r) => Math.abs(r.y - w.y) < 5)
          if (!row) {
            row = { y: w.y, words: [] }
            rows.push(row)
          }
          row.words.push(w)
        }
        rows.sort((a, b) => b.y - a.y)
        rows.forEach((r) => r.words.sort((a, b) => a.x - b.x))

        // Cluster x-positions across the page into columns for a simple table grid.
        const xs = Array.from(new Set(words.map((w) => Math.round(w.x / 10) * 10))).sort((a, b) => a - b)
        const columnFor = (x: number) => {
          let idx = 0
          let best = Infinity
          xs.forEach((cx, ci) => {
            const d = Math.abs(cx - Math.round(x / 10) * 10)
            if (d < best) {
              best = d
              idx = ci
            }
          })
          return idx
        }

        const grid: string[][] = rows.map((r) => {
          const line: string[] = new Array(xs.length).fill('')
          r.words.forEach((w) => {
            const c = columnFor(w.x)
            line[c] = line[c] ? `${line[c]} ${w.str}` : w.str
          })
          return line
        })
        // Drop fully-empty columns for a tidier sheet.
        const usedCols = xs.map((_, ci) => grid.some((row) => row[ci]))
        const trimmed = grid.map((row) => row.filter((_, ci) => usedCols[ci]))

        const ws = XLSX.utils.aoa_to_sheet(trimmed.length ? trimmed : [['']])
        XLSX.utils.book_append_sheet(wb, ws, `Page ${i}`.slice(0, 31))
        setProgress(Math.round((i / doc.numPages) * 100))
      }

      const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
      const blob = new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const name = `${stripExt(file.name)}.xlsx`
      setResult({ blob, name })
      history.saveResult(blob, name)
      setStatus('done')
    } catch (e) {
      console.error(e)
      setError('Could not convert this PDF to Excel.')
      setStatus('error')
    }
  }

  return (
    <ToolShell icon={Sheet} title="PDF to Excel" description="Pull tabular data from your PDF into an Excel spreadsheet.">
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
      <p className="text-xs text-muted-foreground mt-3">
        Best for PDFs with clear rows and columns (tables, invoices, reports). One sheet is
        created per page.
      </p>

      <div className="mt-6 flex flex-col items-center gap-4">
        <PrimaryButton onClick={convert} disabled={files.length === 0 || status === 'processing'}>
          {status === 'processing' ? 'Converting…' : 'Convert to Excel'}
        </PrimaryButton>
        {status === 'processing' && progress > 0 && <ProgressBar value={progress} label={`${progress}%`} />}
        <StatusBanner status={status} processingText="Detecting tables…" errorText={error} />
        {result && <DownloadCard filename={result.name} onDownload={() => downloadBlob(result.blob, result.name)} />}
      </div>
      <ToolHistoryPanel history={history} />
    </ToolShell>
  )
}
