import type { LucideIcon } from 'lucide-react'
import { CheckCircle2, Loader2, AlertTriangle, Download, ChevronRight, UploadCloud, SlidersHorizontal } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { tools, categoryLabels } from '../data/tools'

export function Spinner({ size = 40 }: { size?: number }) {
  return <div style={{ width: size, height: size }} className="animate-spin rounded-full border-4 border-primary/15 border-t-primary" role="status" aria-label="Loading" />
}

const STEPS = [
  { icon: UploadCloud, label: 'Add your file' },
  { icon: SlidersHorizontal, label: 'Choose options' },
  { icon: Download, label: 'Download result' },
]

export function ToolShell({ icon: Icon, title, description, children, wide = false }: { icon: LucideIcon; title: string; description: string; children: ReactNode; wide?: boolean }) {
  const { pathname } = useLocation()
  const tool = tools.find((t) => t.path === pathname)
  return (
    <div className={`mx-auto animate-fade-in ${wide ? 'max-w-5xl' : 'max-w-3xl'}`}>
      <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-xs text-muted-foreground">
        <Link to="/home" className="font-medium hover:text-primary">Home</Link>
        <ChevronRight size={13} aria-hidden="true" />
        <Link to="/all-tools" className="font-medium hover:text-primary">All Tools</Link>
        {tool && categoryLabels[tool.category] !== title && (
          <>
            <ChevronRight size={13} aria-hidden="true" />
            <span>{categoryLabels[tool.category]}</span>
          </>
        )}
        <ChevronRight size={13} aria-hidden="true" />
        <span className="font-medium text-foreground" aria-current="page">{title}</span>
      </nav>
      <div className="mt-3 flex items-start gap-4">
        <div className="icon-tile h-14 w-14 rounded-2xl"><Icon size={26} /></div>
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-bold sm:text-3xl">{title}</h1>
          <p className="mt-0.5 text-sm text-muted-foreground sm:text-base">{description}</p>
        </div>
      </div>
      <ol className="mt-5 hidden items-center gap-2 sm:flex" aria-label="How this tool works">
        {STEPS.map((s, i) => (
          <li key={s.label} className="flex items-center gap-2">
            <span className="flex items-center gap-2 rounded-full border border-border bg-white px-3 py-1.5 text-xs font-medium text-foreground/80">
              <span className="grid h-5 w-5 place-items-center rounded-full bg-primary-soft text-[11px] font-bold text-primary">{i + 1}</span>
              {s.label}
            </span>
            {i < STEPS.length - 1 && <ChevronRight size={14} className="text-muted-foreground/60" aria-hidden="true" />}
          </li>
        ))}
      </ol>
      <div className="glass mt-4 rounded-3xl p-5 sm:p-7">{children}</div>
    </div>
  )
}

export function PrimaryButton({ children, onClick, disabled, type = 'button' }: { children: ReactNode; onClick?: () => void; disabled?: boolean; type?: 'button' | 'submit' }) {
  return (
    <button type={type} onClick={onClick} disabled={disabled} className="btn-primary w-full rounded-xl px-8 py-3.5 text-base">
      {children}
    </button>
  )
}

export function SecondaryButton({ children, onClick, disabled }: { children: ReactNode; onClick?: () => void; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className="btn-ghost rounded-xl px-6 py-2.5 text-sm font-semibold">
      {children}
    </button>
  )
}

export function ProgressBar({ value, label }: { value: number; label?: string }) {
  const v = Math.min(100, Math.max(0, value))
  return (
    <div className="w-full">
      {label && <p className="mb-1.5 text-sm font-medium text-muted-foreground">{label}</p>}
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuenow={Math.round(v)} aria-valuemin={0} aria-valuemax={100}>
        <div className="brand-gradient h-full rounded-full transition-all duration-300" style={{ width: `${v}%` }} />
      </div>
    </div>
  )
}

export function StatusBanner({ status, processingText = 'Processing…', errorText }: { status: 'idle' | 'processing' | 'done' | 'error'; processingText?: string; errorText?: string }) {
  if (status === 'processing')
    return (
      <div role="status" className="flex w-full animate-fade-in items-center gap-2.5 rounded-xl border border-primary/25 bg-primary-soft px-4 py-3 text-primary-strong">
        <Loader2 className="shrink-0 animate-spin" size={18} /><span className="text-sm font-medium">{processingText}</span>
      </div>
    )
  if (status === 'done')
    return (
      <div role="status" className="flex w-full animate-fade-in items-center gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-success">
        <CheckCircle2 className="shrink-0" size={18} /><span className="text-sm font-medium">Done! Your file is ready to download.</span>
      </div>
    )
  if (status === 'error')
    return (
      <div role="alert" className="flex w-full animate-fade-in items-center gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-700">
        <AlertTriangle className="shrink-0" size={18} /><span className="text-sm font-medium">{errorText ?? 'Something went wrong. Please try again.'}</span>
      </div>
    )
  return null
}

export function DownloadCard({ onDownload, filename }: { onDownload: () => void; filename: string }) {
  return (
    <div className="flex w-full animate-fade-in flex-col items-stretch gap-4 rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-primary-soft px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white text-success shadow-sm"><CheckCircle2 size={22} /></span>
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-success">Your file is ready</p>
          <p className="truncate font-semibold">{filename}</p>
        </div>
      </div>
      <button onClick={onDownload} className="btn-primary flex shrink-0 items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm">
        <Download size={17} /> Download
      </button>
    </div>
  )
}
