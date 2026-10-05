import { useEffect, useRef, useState } from 'react'
import { Languages, ArrowLeftRight, Upload, Copy, Check, Clipboard, X, FileText, FileType2, FileDown, Loader2, Square } from 'lucide-react'
import { ToolShell, PrimaryButton, StatusBanner, ProgressBar } from '../../components/ToolShell'
import ToolHistoryPanel from '../../components/ToolHistoryPanel'
import { useToolHistory } from '../../hooks/useToolHistory'
import { AUTO, LANGUAGES, getLanguage, guessLanguage, translateText, TranslateError } from '../../lib/translate'
import { extractDocumentText, TEXT_ACCEPT } from '../../lib/docText'
import { docxBlob, pdfBlob, textBlob } from '../../lib/translateExport'
import { downloadBlob, stripExt } from '../../lib/pdfCore'

type Status = 'idle' | 'reading' | 'processing' | 'done' | 'error'

const STORE = 'edocs_translate_langs'
const MAX_CHARS = 60000
const WARN_CHARS = 15000

function loadPrefs(): { from: string; to: string } {
  try {
    const p = JSON.parse(localStorage.getItem(STORE) || '{}')
    if ((p.from === AUTO || getLanguage(p.from)) && getLanguage(p.to)) return { from: p.from, to: p.to }
  } catch { /* ignore */ }
  return { from: AUTO, to: 'hi' }
}

const PRESETS = [
  { label: 'English → हिन्दी', from: 'en', to: 'hi' },
  { label: 'हिन्दी → English', from: 'hi', to: 'en' },
  { label: 'English → मराठी', from: 'en', to: 'mr' },
  { label: 'English → தமிழ்', from: 'en', to: 'ta' },
]

export default function Translate() {
  const [prefs] = useState(loadPrefs)
  const [from, setFrom] = useState(prefs.from)
  const [to, setTo] = useState(prefs.to)
  const [input, setInput] = useState('')
  const [output, setOutput] = useState('')
  const [detected, setDetected] = useState<string | null>(null)
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState('')
  const [progress, setProgress] = useState(0)
  const [fileName, setFileName] = useState('')
  const [copied, setCopied] = useState(false)
  const [exporting, setExporting] = useState<'txt' | 'docx' | 'pdf' | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const history = useToolHistory('translate', 'Translate')

  useEffect(() => {
    try { localStorage.setItem(STORE, JSON.stringify({ from, to })) } catch { /* ignore */ }
  }, [from, to])

  const toLang = getLanguage(to)!
  const srcCode = from === AUTO ? detected ?? (input.trim() ? guessLanguage(input) : 'en') : from
  const srcLang = getLanguage(srcCode)
  const busy = status === 'processing' || status === 'reading'
  const tooLong = input.length > MAX_CHARS

  const reset = () => { setOutput(''); setDetected(null); if (status !== 'idle') setStatus('idle') }

  const run = async () => {
    if (!input.trim() || busy || tooLong) return
    const controller = new AbortController()
    abortRef.current = controller
    setStatus('processing'); setError(''); setProgress(0); setOutput('')
    try {
      const res = await translateText(input, from, to, { signal: controller.signal, onProgress: setProgress })
      setOutput(res.text)
      setDetected(from === AUTO ? res.detected ?? null : null)
      setStatus('done')
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') { setStatus('idle'); return }
      console.error(e)
      setError(e instanceof TranslateError ? e.message : 'Translation failed. Please try again.')
      setStatus('error')
    } finally {
      abortRef.current = null
    }
  }

  const swap = () => {
    const newTo = from === AUTO ? (srcCode === to ? 'en' : srcCode) : from
    setFrom(to)
    setTo(getLanguage(newTo) ? newTo : 'en')
    if (output) setInput(output)
    setOutput(''); setDetected(null); setStatus('idle')
  }

  const onFile = async (file: File | undefined) => {
    if (!file) return
    setStatus('reading'); setError(''); setProgress(0); setOutput(''); setDetected(null)
    try {
      const text = await extractDocumentText(file, setProgress)
      if (!text) { setError('No selectable text found in this file. If it is a scan, run OCR PDF first.'); setStatus('error'); return }
      setInput(text); setFileName(file.name); setStatus('idle')
    } catch (e) {
      console.error(e)
      setError(e instanceof Error && e.message.startsWith('Unsupported') ? e.message : 'Could not read this file. Please try another one.')
      setStatus('error')
    }
  }

  const paste = async () => {
    try {
      const t = await navigator.clipboard.readText()
      if (t) { setInput(t); setFileName(''); reset() }
    } catch { /* clipboard permission denied */ }
  }
  const copy = async () => {
    try { await navigator.clipboard.writeText(output); setCopied(true); setTimeout(() => setCopied(false), 1600) } catch { /* ignore */ }
  }

  const baseName = `${fileName ? stripExt(fileName) : 'translation'}-${to}`
  const exportAs = async (kind: 'txt' | 'docx' | 'pdf') => {
    if (!output || exporting) return
    setExporting(kind)
    try {
      const blob = kind === 'txt' ? textBlob(output) : kind === 'docx' ? await docxBlob(output, toLang) : await pdfBlob(output, toLang)
      const name = `${baseName}.${kind}`
      downloadBlob(blob, name)
      history.saveResult(blob, name)
    } catch (e) {
      console.error(e)
      setError(`Could not create the ${kind.toUpperCase()} file.`)
      setStatus('error')
    } finally {
      setExporting(null)
    }
  }

  const langSelect = (value: string, onChange: (v: string) => void, withAuto: boolean, label: string) => (
    <label className="block min-w-0 flex-1">
      <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="field h-11 cursor-pointer py-0">
        {withAuto && <option value={AUTO}>Detect language</option>}
        {LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.native} — {l.name}</option>)}
      </select>
    </label>
  )

  return (
    <ToolShell wide icon={Languages} title="Translate" description="Hindi ⇄ English and 9 more Indian languages — type, paste, or upload a PDF, Word or TXT file.">
      <div className="flex flex-wrap items-end gap-3">
        {langSelect(from, (v) => { setFrom(v); reset() }, true, 'From')}
        <button onClick={swap} className="btn-ghost mb-0.5 grid h-11 w-11 shrink-0 place-items-center rounded-xl" aria-label="Swap languages" title="Swap languages"><ArrowLeftRight size={17} /></button>
        {langSelect(to, (v) => { setTo(v); reset() }, false, 'To')}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <button key={p.label} onClick={() => { setFrom(p.from); setTo(p.to); reset() }} className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${from === p.from && to === p.to ? 'border-primary/60 bg-primary/15 text-primary' : 'border-border bg-surface text-muted-foreground hover:text-foreground'}`}>
            {p.label}
          </button>
        ))}
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <section className="flex flex-col">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-foreground/85">
              {from === AUTO ? (detected || input.trim() ? `Detected: ${srcLang?.name ?? '—'}` : 'Original text') : `${srcLang?.name} text`}
            </h3>
            <div className="flex items-center gap-1">
              <button onClick={paste} className="btn-ghost flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs" title="Paste from clipboard"><Clipboard size={13} /> Paste</button>
              <button onClick={() => fileRef.current?.click()} className="btn-ghost flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs" disabled={busy}><Upload size={13} /> Upload file</button>
              <input ref={fileRef} type="file" accept={TEXT_ACCEPT} className="hidden" data-testid="translate-file" onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = '' }} />
            </div>
          </div>
          {fileName && (
            <div className="mb-2 flex items-center gap-2 rounded-lg border border-primary/25 bg-primary/10 px-3 py-1.5 text-xs text-primary">
              <FileText size={14} /><span className="min-w-0 flex-1 truncate">{fileName}</span>
              <button onClick={() => { setFileName(''); setInput(''); reset() }} aria-label="Remove file"><X size={14} /></button>
            </div>
          )}
          <textarea
            value={input}
            onChange={(e) => { setInput(e.target.value); if (status === 'done' || status === 'error') setStatus('idle') }}
            onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') run() }}
            dir={srcLang?.rtl ? 'rtl' : 'ltr'}
            lang={srcCode}
            placeholder="Type, paste or upload text to translate…  (Ctrl+Enter to translate)"
            className="field min-h-72 flex-1 resize-y text-[15px] leading-relaxed"
            aria-label="Text to translate"
          />
          <div className="mt-1.5 flex justify-between text-xs text-muted-foreground">
            <span className={tooLong ? 'text-destructive' : input.length > WARN_CHARS ? 'text-warning' : ''}>
              {input.length.toLocaleString()} / {MAX_CHARS.toLocaleString()} characters
              {input.length > WARN_CHARS && !tooLong && ' — large text, this may take a while'}
              {tooLong && ' — too long, please shorten or split it'}
            </span>
            {input && <button onClick={() => { setInput(''); setFileName(''); reset() }} className="hover:text-foreground">Clear</button>}
          </div>
        </section>

        <section className="flex flex-col">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-foreground/85">{toLang.native} — {toLang.name}</h3>
            <button onClick={copy} disabled={!output} className="btn-ghost flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs">
              {copied ? <Check size={13} className="text-success" /> : <Copy size={13} />} {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <textarea readOnly value={output} dir={toLang.rtl ? 'rtl' : 'ltr'} lang={to} placeholder="Translation will appear here" className="field min-h-72 flex-1 resize-y text-[15px] leading-relaxed" aria-label="Translated text" data-testid="translate-output" />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">Download as</span>
            {([['txt', 'TXT', FileText], ['docx', 'Word', FileType2], ['pdf', 'PDF', FileDown]] as const).map(([kind, label, Icon]) => (
              <button key={kind} onClick={() => exportAs(kind)} disabled={!output || !!exporting} className="btn-ghost flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold">
                {exporting === kind ? <Loader2 size={13} className="animate-spin" /> : <Icon size={13} />} {label}
              </button>
            ))}
          </div>
        </section>
      </div>

      <div className="mt-6 flex flex-col items-center gap-4">
        <div className="flex w-full gap-3">
          <PrimaryButton onClick={run} disabled={!input.trim() || busy || tooLong}>
            {status === 'processing' ? 'Translating…' : status === 'reading' ? 'Reading file…' : `Translate to ${toLang.name}`}
          </PrimaryButton>
          {status === 'processing' && (
            <button onClick={() => abortRef.current?.abort()} className="btn-ghost flex shrink-0 items-center gap-2 rounded-xl px-5 text-sm font-semibold" aria-label="Stop translating"><Square size={13} /> Stop</button>
          )}
        </div>
        {busy && progress > 0 && <ProgressBar value={progress} label={`${progress}%`} />}
        <StatusBanner status={status === 'reading' ? 'processing' : status} processingText={status === 'reading' ? 'Reading your document…' : 'Translating your text…'} errorText={error} />
        {status === 'done' && <p className="text-xs text-muted-foreground">Translation complete. Machine translation can be imperfect — review important documents.</p>}
      </div>

      <p className="mt-5 rounded-xl border border-border bg-surface px-4 py-3 text-xs text-muted-foreground">
        Translation needs an internet connection and sends the text (not your file) to an online translation service. PDF export draws the translated text as page images; use Word or TXT when you need editable text.
      </p>
      <ToolHistoryPanel history={history} />
    </ToolShell>
  )
}
