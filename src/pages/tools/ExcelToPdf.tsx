import { useState } from 'react'
import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { FileSpreadsheet } from 'lucide-react'
import FileDrop from '../../components/FileDrop'
import { ToolShell, PrimaryButton, StatusBanner, DownloadCard } from '../../components/ToolShell'
import { downloadBlob, readFileAsArrayBuffer, stripExt } from '../../lib/pdfCore'
import { useToolHistory } from '../../hooks/useToolHistory'
import ToolHistoryPanel from '../../components/ToolHistoryPanel'
import { convertOnServer } from '../../lib/serverConvert'

type Status = 'idle' | 'processing' | 'done' | 'error'

export default function ExcelToPdf() {
  const [files, setFiles] = useState<File[]>([])
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState('')
  const [result, setResult] = useState<{ blob: Blob; name: string } | null>(null)
  const history = useToolHistory('excel-to-pdf', 'Excel to PDF')

  const convert = async () => {
    const file = files[0]
    if (!file) return
    setStatus('processing')
    setError('')
    setResult(null)
    try {
      // Best fidelity: convert on the server (keeps layout, fonts, images). Falls back to the
      // in-browser converter below if the server can't do it.
      const server = await convertOnServer('excel-to-pdf', file, `${stripExt(file.name)}.pdf`)
      if (server) {
        setResult(server)
        history.saveResult(server.blob, server.name)
        setStatus('done')
        return
      }

      const bytes = await readFileAsArrayBuffer(file)
      const wb = XLSX.read(bytes, { type: 'array' })
      const pdf = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'landscape' })

      for (let s = 0; s < wb.SheetNames.length; s++) {
        const sheetName = wb.SheetNames[s]
        const ws = wb.Sheets[sheetName]
        const rows: string[][] = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false, defval: '' })
        const [head, ...body] = rows.length ? rows : [['']]

        if (s > 0) pdf.addPage('a4', 'landscape')
        pdf.setFont('helvetica', 'bold')
        pdf.setFontSize(14)
        pdf.setTextColor(20, 20, 20)
        pdf.text(sheetName, 30, 30)
        autoTable(pdf, {
          startY: 42,
          head: [head.map((c) => String(c))],
          body: body.map((r) => r.map((c) => String(c))),
          margin: { left: 30, right: 30 },
          styles: { fontSize: 9, textColor: [26, 26, 26] },
          headStyles: { fillColor: [224, 17, 109], textColor: [255, 255, 255] },
        })
      }

      const blob = pdf.output('blob')
      const name = `${stripExt(file.name)}.pdf`
      setResult({ blob, name })
      history.saveResult(blob, name)
      setStatus('done')
    } catch (e) {
      console.error(e)
      setError('Could not convert this spreadsheet. .xlsx and .xls files are supported.')
      setStatus('error')
    }
  }

  return (
    <ToolShell icon={FileSpreadsheet} title="Excel to PDF" description="Convert your Excel spreadsheet into a print-ready PDF.">
      <FileDrop
        accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
        files={files}
        onFiles={(f) => {
          setFiles(f)
          setStatus('idle')
          setResult(null)
        }}
        label="Select an Excel file or drag & drop here"
      />

      <div className="mt-6 flex flex-col items-center gap-4">
        <PrimaryButton onClick={convert} disabled={files.length === 0 || status === 'processing'}>
          {status === 'processing' ? 'Converting…' : 'Convert to PDF'}
        </PrimaryButton>
        <StatusBanner status={status} processingText="Rendering sheets…" errorText={error} />
        {result && <DownloadCard filename={result.name} onDownload={() => downloadBlob(result.blob, result.name)} />}
      </div>
      <ToolHistoryPanel history={history} />
    </ToolShell>
  )
}
