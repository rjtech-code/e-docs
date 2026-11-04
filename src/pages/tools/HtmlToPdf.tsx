import { useEffect, useRef, useState } from 'react'
import { Code2, Monitor, Smartphone } from 'lucide-react'
import { ToolShell, PrimaryButton, SecondaryButton, StatusBanner, DownloadCard } from '../../components/ToolShell'
import { downloadBlob } from '../../lib/pdfCore'
import { renderHtmlToPdfBlob } from '../../lib/htmlToPdf'
import { API_BASE } from '../../lib/api'
import { useToolHistory } from '../../hooks/useToolHistory'
import ToolHistoryPanel from '../../components/ToolHistoryPanel'

type Status = 'idle' | 'processing' | 'done' | 'error'
type Mode = 'url' | 'html'
type Viewport = 'desktop' | 'mobile'

const sample = `<h1 style="color:#1c74f2">Hello from E-Docs</h1>
<p>Paste any HTML markup here and convert it straight to a PDF document — right in your browser.</p>
<ul><li>Fast</li><li>Free</li><li>Private</li></ul>`

function getPdfErrorMessage(message: string) {
  try {
    const data = JSON.parse(message)
    if (typeof data?.error === 'string') return data.error
  } catch {
    // Non-JSON responses often mean the frontend host returned an HTML error page.
  }
  return 'Could not convert webpage. Check that the backend is running with Chromium support.'
}

export default function HtmlToPdf() {
  const [mode, setMode] = useState<Mode>('html')
  const [html, setHtml] = useState(sample)
  const [url, setUrl] = useState('')
  const [viewport, setViewport] = useState<Viewport>('desktop')
  const [savePdfOnShortcut, setSavePdfOnShortcut] = useState(false)
  const conversionInProgress = useRef(false)
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState('')
  const [result, setResult] = useState<{ blob: Blob; name: string } | null>(null)
  const history = useToolHistory('html-to-pdf', 'HTML to PDF')

  const convert = async (downloadImmediately = false) => {
    if (conversionInProgress.current) return
    conversionInProgress.current = true
    setStatus('processing')
    setError('')
    setResult(null)
    try {
      let blob: Blob
      let filename: string

      if (mode === 'html') {
        blob = renderHtmlToPdfBlob(html)
        filename = 'e-docs-html.pdf'
      } else {
        let target: URL
        try {
          target = new URL(url.trim())
        } catch {
          throw new Error('Enter a valid webpage URL, including https://')
        }
        if (!['http:', 'https:'].includes(target.protocol)) {
          throw new Error('Only HTTP and HTTPS webpage URLs are supported.')
        }

        const response = await fetch(`${API_BASE}/api/convert/webpage-to-pdf`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: target.href, viewport }),
        })
        if (!response.ok) {
          const message = await response.text()
          throw new Error(getPdfErrorMessage(message) || `Could not convert webpage (HTTP ${response.status}).`)
        }

        blob = await response.blob()
        if (!blob.size || blob.type !== 'application/pdf') {
          throw new Error('The server returned an invalid PDF. Please try again.')
        }
        const safeHost = target.hostname.replace(/[^a-z0-9.-]/gi, '-').slice(0, 80) || 'webpage'
        filename = `e-docs-${safeHost}.pdf`
      }

      setResult({ blob, name: filename })
      history.saveResult(blob, filename)
      if (downloadImmediately) downloadBlob(blob, filename)
      setStatus('done')
    } catch (e) {
      console.error('[HTML to PDF]', e)
      setError(e instanceof Error ? e.message : 'Could not render this content to PDF.')
      setStatus('error')
    } finally {
      conversionInProgress.current = false
    }
  }

  useEffect(() => {
    if (mode !== 'url' || !savePdfOnShortcut) return

    const handleSaveShortcut = (event: KeyboardEvent) => {
      const isSaveShortcut = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's'
      if (!isSaveShortcut) return

      const target = event.target
      if (target instanceof HTMLElement && target.closest('input, textarea, select, [contenteditable="true"], [role="textbox"]')) return

      event.preventDefault()
      void convertRef.current(true)
    }

    window.addEventListener('keydown', handleSaveShortcut)
    return () => window.removeEventListener('keydown', handleSaveShortcut)
  }, [mode, savePdfOnShortcut])

  const convertRef = useRef<(downloadImmediately?: boolean) => Promise<void>>(async () => {})
  convertRef.current = convert

  return (
    <ToolShell icon={Code2} title="HTML to PDF" description="Convert HTML markup or capture a complete live webpage as a multi-page PDF.">
      <div className="mb-4 flex gap-2">
        <button onClick={() => { setMode('html'); setStatus('idle'); setError(''); setResult(null) }} className={`rounded-full px-4 py-2 text-sm font-semibold ${mode === 'html' ? 'bg-primary text-white' : 'border border-border bg-surface text-foreground/80 hover:border-primary/40'}`}>
          Paste HTML
        </button>
        <button onClick={() => { setMode('url'); setStatus('idle'); setError(''); setResult(null) }} className={`rounded-full px-4 py-2 text-sm font-semibold ${mode === 'url' ? 'bg-primary text-white' : 'border border-border bg-surface text-foreground/80 hover:border-primary/40'}`}>
          From URL
        </button>
      </div>

      {mode === 'html' ? (
        <textarea
          aria-label="HTML markup"
          value={html}
          onChange={(e) => setHtml(e.target.value)}
          rows={12}
          className="w-full rounded-xl border border-border px-4 py-3 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
      ) : (
        <div className="space-y-4">
          <label className="block">
            <span className="mb-2 block text-sm font-semibold">Webpage URL</span>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && url.trim() && status !== 'processing') void convert() }}
              placeholder="https://example.com/article"
              aria-label="Webpage URL"
              className="w-full rounded-xl border border-border px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </label>

          <div className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-surface p-4">
            <div className="min-w-0">
              <div className="text-sm font-semibold">Ctrl + S → Save as PDF</div>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">When enabled, pressing Ctrl + S (or Cmd + S on Mac) downloads this URL as a PDF.</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={savePdfOnShortcut}
              aria-label="Enable Ctrl+S to save as PDF"
              onClick={() => setSavePdfOnShortcut((enabled) => !enabled)}
              className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2 ${savePdfOnShortcut ? 'bg-primary' : 'bg-border'}`}
            >
              <span className={`inline-block size-5 rounded-full bg-white shadow transition-transform ${savePdfOnShortcut ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>

          <fieldset>
            <legend className="mb-2 text-sm font-semibold">Choose page layout</legend>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <button
                type="button"
                aria-pressed={viewport === 'desktop'}
                onClick={() => setViewport('desktop')}
                className={`flex items-center gap-3 rounded-2xl border p-4 text-left transition ${viewport === 'desktop' ? 'border-primary bg-primary-soft ring-1 ring-primary/30' : 'border-border bg-surface hover:border-primary/40'}`}
              >
                <Monitor size={22} className="shrink-0" />
                <span>
                  <span className="block font-semibold">Desktop</span>
                  <span className="block text-xs text-muted-foreground">Wide, 1440px layout</span>
                </span>
                <span className="ml-auto text-sm" aria-hidden="true">{viewport === 'desktop' ? '✓' : ''}</span>
              </button>
              <button
                type="button"
                aria-pressed={viewport === 'mobile'}
                onClick={() => setViewport('mobile')}
                className={`flex items-center gap-3 rounded-2xl border p-4 text-left transition ${viewport === 'mobile' ? 'border-primary bg-primary-soft ring-1 ring-primary/30' : 'border-border bg-surface hover:border-primary/40'}`}
              >
                <Smartphone size={22} className="shrink-0" />
                <span>
                  <span className="block font-semibold">Mobile</span>
                  <span className="block text-xs text-muted-foreground">Phone, 390px layout</span>
                </span>
                <span className="ml-auto text-sm" aria-hidden="true">{viewport === 'mobile' ? '✓' : ''}</span>
              </button>
            </div>
          </fieldset>

          <p className="text-xs leading-relaxed text-muted-foreground">
            E-Docs opens the public page in a browser, loads content as you scroll, and paginates the full page into an A4 PDF. Pages that require login or block automated browsers may not be available.
          </p>
        </div>
      )}

      <div className="mt-6 flex flex-col items-center gap-4">
        <div className="flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
          {mode === 'html' && <SecondaryButton onClick={() => setHtml(sample)}>Reset sample</SecondaryButton>}
          <PrimaryButton onClick={convert} disabled={status === 'processing' || (mode === 'html' ? !html.trim() : !url.trim())}>
            {status === 'processing' ? (mode === 'url' ? 'Loading page & creating PDF…' : 'Converting…') : 'Convert to PDF'}
          </PrimaryButton>
        </div>
        <StatusBanner status={status} processingText={mode === 'url' ? 'Opening webpage, loading content, and creating PDF… This can take up to a minute.' : 'Rendering…'} errorText={error} />
        {result && <DownloadCard filename={result.name} onDownload={() => downloadBlob(result.blob, result.name)} />}
      </div>
      <ToolHistoryPanel history={history} />
    </ToolShell>
  )
}
