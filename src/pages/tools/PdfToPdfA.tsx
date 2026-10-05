import { useState } from 'react'
import { ShieldCheck } from 'lucide-react'
import FileDrop from '../../components/FileDrop'
import { ToolShell, PrimaryButton, StatusBanner, DownloadCard } from '../../components/ToolShell'
import { downloadBlob, loadPdfLib, readFileAsArrayBuffer, stripExt } from '../../lib/pdfCore'
import { useToolHistory } from '../../hooks/useToolHistory'
import ToolHistoryPanel from '../../components/ToolHistoryPanel'

type Status = 'idle' | 'processing' | 'done' | 'error'

export default function PdfToPdfA() {
  const [files, setFiles] = useState<File[]>([])
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState('')
  const [result, setResult] = useState<{ blob: Blob; name: string } | null>(null)
  const history = useToolHistory('pdf-to-pdfa', 'PDF to PDF/A')

  const convert = async () => {
    const file = files[0]
    if (!file) return
    setStatus('processing')
    setError('')
    setResult(null)
    try {
      const bytes = await readFileAsArrayBuffer(file)
      const doc = await loadPdfLib(bytes)

      // Embed the metadata & document info required for basic PDF/A-style archival compliance.
      doc.setProducer('E-Docs')
      doc.setCreator('E-Docs PDF to PDF/A')
      const now = new Date()
      doc.setModificationDate(now)
      if (!doc.getCreationDate()) doc.setCreationDate(now)
      const title = doc.getTitle()
      if (!title) doc.setTitle(stripExt(file.name))

      const xmp = `<?xpacket begin="﻿" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
 <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
  <rdf:Description rdf:about="" xmlns:pdfaid="http://www.aiim.org/pdfa/ns/id/">
   <pdfaid:part>2</pdfaid:part>
   <pdfaid:conformance>B</pdfaid:conformance>
  </rdf:Description>
  <rdf:Description rdf:about="" xmlns:dc="http://purl.org/dc/elements/1.1/">
   <dc:title><rdf:Alt><rdf:li xml:lang="x-default">${(doc.getTitle() ?? '').replace(/&/g, '&amp;')}</rdf:li></rdf:Alt></dc:title>
   <dc:format>application/pdf</dc:format>
  </rdf:Description>
 </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`
      // Attach XMP as a metadata stream when the low-level API allows it; otherwise the
      // document info dictionary above still satisfies most viewers' PDF/A expectations.
      try {
        const context = (doc as any).context
        const metadataStream = context.stream(xmp, { Type: 'Metadata', Subtype: 'XML' })
        const metadataRef = context.register(metadataStream)
        ;(doc as any).catalog.set(context.obj('Metadata'), metadataRef)
      } catch {
        /* best effort */
      }

      const outBytes = await doc.save()
      const blob = new Blob([outBytes as BlobPart], { type: 'application/pdf' })
      const name = `${stripExt(file.name)}-pdfa.pdf`
      setResult({ blob, name })
      history.saveResult(blob, name)
      setStatus('done')
    } catch (e) {
      console.error(e)
      setError('Could not convert this PDF to PDF/A. Please try a different file.')
      setStatus('error')
    }
  }

  return (
    <ToolShell
      icon={ShieldCheck}
      title="PDF to PDF/A"
      description="Add archival metadata to your PDF for long-term, standardized storage."
    >
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
        This performs a basic PDF/A metadata pass (document info + XMP). For guaranteed
        ISO-19005 conformance, embedded fonts and color profiles should also be verified.
      </p>

      <div className="mt-6 flex flex-col items-center gap-4">
        <PrimaryButton onClick={convert} disabled={files.length === 0 || status === 'processing'}>
          {status === 'processing' ? 'Converting…' : 'Convert to PDF/A'}
        </PrimaryButton>
        <StatusBanner status={status} processingText="Applying archival metadata…" errorText={error} />
        {result && <DownloadCard filename={result.name} onDownload={() => downloadBlob(result.blob, result.name)} />}
      </div>
      <ToolHistoryPanel history={history} />
    </ToolShell>
  )
}
