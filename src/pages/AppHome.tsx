import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { LucideIcon } from 'lucide-react'
import {
  FileStack, HardDrive, Clock, ArrowRight, Download, Search, X, LayoutGrid, Languages, LogIn, UserPlus,
  Combine, FileText, PenTool, Lock, Sparkles, Wrench, ShieldCheck,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { api, type HistoryItem } from '../lib/api'
import { downloadBlob, formatBytes } from '../lib/pdfCore'
import { tools, getToolById, categoryLabels, type ToolCategory, type ToolDef } from '../data/tools'
import { getRecentToolIds } from '../lib/recentTools'
import { fileBadge, greeting, timeAgo, perDay } from '../lib/ui'
import { LANGUAGES } from '../lib/translate'
import BarChart from '../components/BarChart'

const QUICK: { id: string; tint: string }[] = [
  { id: 'merge-pdf', tint: 'bg-blue-50 text-blue-700' },
  { id: 'split-pdf', tint: 'bg-emerald-50 text-emerald-700' },
  { id: 'compress-pdf', tint: 'bg-violet-50 text-violet-700' },
  { id: 'pdf-to-word', tint: 'bg-sky-50 text-sky-700' },
  { id: 'jpg-to-pdf', tint: 'bg-amber-50 text-amber-700' },
  { id: 'sign-pdf', tint: 'bg-rose-50 text-rose-700' },
]
const POPULAR = ['merge-pdf', 'compress-pdf', 'pdf-to-word', 'split-pdf', 'jpg-to-pdf']
const RECOMMENDED = ['ocr-pdf', 'edit-pdf', 'protect-pdf', 'watermark-pdf', 'pdf-to-excel', 'organize-pdf', 'page-numbers', 'pdf-to-jpg']
const CATEGORY_ICONS: Record<ToolCategory, LucideIcon> = { organize: Combine, convert: FileText, edit: PenTool, security: Lock, translate: Languages }

function toolList(ids: string[]): ToolDef[] {
  return ids.map(getToolById).filter((t): t is ToolDef => !!t)
}

function Panel({ title, action, children, className = '' }: { title: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`glass rounded-3xl p-5 sm:p-6 ${className}`}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="font-display text-lg font-bold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  )
}

function ToolRow({ tool, meta }: { tool: ToolDef; meta?: string }) {
  return (
    <Link to={tool.path} className="group flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-surface">
      <span className="icon-tile h-10 w-10 rounded-xl"><tool.icon size={18} /></span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold">{tool.name}</span>
        <span className="block truncate text-xs text-muted-foreground">{meta ?? tool.short}</span>
      </span>
      <ArrowRight size={15} className="shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
    </Link>
  )
}

export default function AppHome() {
  const { user, loading: authLoading } = useAuth()
  const [items, setItems] = useState<HistoryItem[]>([])
  const [loading, setLoading] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [query, setQuery] = useState('')

  useEffect(() => {
    if (!user) { setItems([]); return }
    setLoading(true)
    api.listHistory().then(({ items }) => setItems(items)).catch(() => {}).finally(() => setLoading(false))
  }, [user])

  const totalSize = useMemo(() => items.reduce((sum, i) => sum + i.size, 0), [items])
  const byTool = useMemo(() => {
    const map = new Map<string, { toolName: string; count: number }>()
    items.forEach((i) => {
      const e = map.get(i.toolId) ?? { toolName: i.toolName, count: 0 }
      e.count++
      map.set(i.toolId, e)
    })
    return Array.from(map.entries()).map(([toolId, v]) => ({ toolId, ...v })).sort((a, b) => b.count - a.count)
  }, [items])
  const activity = useMemo(() => perDay(items.map((i) => i.createdAt), 7), [items])
  const weekTotal = activity.reduce((s, d) => s + d.value, 0)

  const recentTools = toolList(getRecentToolIds())
  const usedIds = new Set([...recentTools.map((t) => t.id), ...byTool.map((t) => t.toolId)])
  const recommended = toolList(RECOMMENDED).filter((t) => !usedIds.has(t.id)).slice(0, 4)
  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? tools.filter((t) => `${t.name} ${t.short} ${t.description}`.toLowerCase().includes(q)).slice(0, 6) : []
  }, [query])

  const download = async (item: HistoryItem) => {
    setBusyId(item.id)
    try { downloadBlob(await api.downloadHistoryBlob(item), item.outputName) } finally { setBusyId(null) }
  }

  const firstName = user?.name?.trim().split(' ')[0]
  const stats: { icon: LucideIcon; label: string; value: string; note: string }[] = user
    ? [
        { icon: FileStack, label: 'Files saved', value: String(items.length), note: `${weekTotal} in the last 7 days` },
        { icon: HardDrive, label: 'Storage used', value: formatBytes(totalSize), note: 'Across all your files' },
        { icon: Sparkles, label: 'Tools used', value: String(byTool.length), note: `of ${tools.length} available` },
        { icon: Clock, label: 'Last activity', value: items[0] ? timeAgo(items[0].createdAt) : '—', note: items[0]?.toolName ?? 'No files yet' },
      ]
    : [
        { icon: LayoutGrid, label: 'Tools available', value: String(tools.length), note: 'All free to use' },
        { icon: Clock, label: 'Recently opened', value: String(recentTools.length), note: 'Tools on this device' },
        { icon: Languages, label: 'Languages', value: String(LANGUAGES.length), note: 'For translation' },
        { icon: ShieldCheck, label: 'Files saved', value: '—', note: 'Sign in to save files' },
      ]

  return (
    <div className="mx-auto max-w-7xl animate-fade-in">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-primary">{greeting()}{firstName ? `, ${firstName}` : ''} 👋</p>
          <h1 className="mt-1 font-display text-2xl font-bold sm:text-3xl">Welcome to E-Docs</h1>
          <p className="mt-1 text-sm text-muted-foreground">Pick a quick action below, search for a tool, or browse everything in All Tools.</p>
        </div>
        <Link to="/all-tools" className="btn-primary flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm">
          <LayoutGrid size={17} /> All Tools
        </Link>
      </div>

      {/* Search */}
      <div className="relative mt-5 max-w-2xl">
        <div className="flex h-12 items-center gap-3 rounded-xl border border-border bg-white px-4 shadow-sm focus-within:border-primary focus-within:ring-3 focus-within:ring-primary/15">
          <Search size={18} className="text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Escape') setQuery('') }}
            placeholder="What do you want to do? e.g. “merge”, “word”, “password”"
            aria-label="Search tools"
            className="h-full w-full !bg-transparent text-[15px] outline-none"
          />
          {query && <button onClick={() => setQuery('')} className="rounded-md p-1 text-muted-foreground hover:text-foreground" aria-label="Clear search"><X size={16} /></button>}
        </div>
        {query.trim() && (
          <div className="glass absolute inset-x-0 top-full z-20 mt-2 rounded-2xl p-2">
            {searchResults.length === 0 ? (
              <p className="px-3 py-4 text-sm text-muted-foreground">No tools match “{query}”. <Link to="/all-tools" className="font-semibold text-primary hover:underline">Browse all tools</Link></p>
            ) : (
              searchResults.map((t) => <ToolRow key={t.id} tool={t} />)
            )}
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="glass rounded-2xl p-4 sm:p-5">
            <span className="icon-tile h-10 w-10 rounded-xl"><s.icon size={19} /></span>
            <p className="mt-3 text-sm font-medium text-muted-foreground">{s.label}</p>
            <p className="truncate font-display text-2xl font-bold tabular-nums">{s.value}</p>
            <p className="truncate text-xs text-muted-foreground">{s.note}</p>
          </div>
        ))}
      </div>

      {/* Quick actions */}
      <Panel title="Quick actions" className="mt-5" action={<Link to="/all-tools" className="flex items-center gap-1 text-sm font-semibold text-primary hover:underline">All {tools.length} tools <ArrowRight size={14} /></Link>}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {QUICK.map(({ id, tint }) => {
            const t = getToolById(id)!
            return (
              <Link key={id} to={t.path} className="tile group flex flex-col items-center gap-2.5 rounded-2xl px-3 py-5 text-center">
                <span className={`grid h-12 w-12 place-items-center rounded-2xl ${tint}`}><t.icon size={22} /></span>
                <span className="text-sm font-semibold">{t.name}</span>
              </Link>
            )
          })}
        </div>
      </Panel>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1.55fr_1fr]">
        <div className="space-y-5">
          {/* Recent files */}
          <Panel title="Recent files" action={user && <Link to="/history" className="flex items-center gap-1 text-sm font-semibold text-primary hover:underline">View all <ArrowRight size={14} /></Link>}>
            {!user ? (
              <div className="rounded-2xl border border-dashed border-border bg-surface px-4 py-8 text-center">
                <span className="icon-tile mx-auto h-12 w-12 rounded-2xl"><FileStack size={22} /></span>
                <p className="mt-3 font-semibold">Keep your finished files in one place</p>
                <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">You can use every tool without an account. Sign in and your results are saved here so you can download them again anytime.</p>
                {!authLoading && (
                  <div className="mt-4 flex flex-col justify-center gap-2 sm:flex-row">
                    <Link to="/login" className="btn-ghost inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold"><LogIn size={16} /> Sign in</Link>
                    <Link to="/signup" className="btn-primary inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm"><UserPlus size={16} /> Create free account</Link>
                  </div>
                )}
              </div>
            ) : loading ? (
              <p className="py-6 text-sm text-muted-foreground">Loading…</p>
            ) : items.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border bg-surface px-4 py-10 text-center">
                <p className="font-semibold">No recent files yet.</p>
                <p className="mt-1 text-sm text-muted-foreground">Use any tool and your result is saved here automatically.</p>
                <Link to="/all-tools" className="btn-primary mt-4 inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm">Try a PDF Tool <ArrowRight size={15} /></Link>
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {items.slice(0, 5).map((item) => {
                  const b = fileBadge(item.outputName)
                  return (
                    <li key={item.id} className="flex items-center gap-3 py-2.5">
                      <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg text-[10px] font-bold ${b.cls}`}>{b.label}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{item.outputName}</span>
                        <span className="block text-xs text-muted-foreground">{item.toolName} · {formatBytes(item.size)} · {timeAgo(item.createdAt)}</span>
                      </span>
                      <button onClick={() => download(item)} disabled={busyId === item.id} className="flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary-soft disabled:opacity-50" aria-label={`Download ${item.outputName}`}>
                        <Download size={16} /> <span className="hidden sm:inline">Download</span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </Panel>

          {/* Activity (signed-in, real data from your saved files) */}
          {user && items.length > 0 && (
            <Panel title="Your activity" action={<span className="text-xs text-muted-foreground">Files saved · last 7 days</span>}>
              <BarChart data={activity} unit="files" height={160} />
            </Panel>
          )}

          {/* Browse by category */}
          <Panel title="Browse by category">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {(Object.keys(categoryLabels) as ToolCategory[]).map((c) => {
                const Icon = CATEGORY_ICONS[c]
                const count = tools.filter((t) => t.category === c).length
                return (
                  <Link key={c} to={`/all-tools?category=${c}`} className="tile flex flex-col gap-2 rounded-2xl p-4">
                    <span className="icon-tile h-10 w-10 rounded-xl"><Icon size={18} /></span>
                    <span className="text-sm font-semibold leading-tight">{categoryLabels[c]}</span>
                    <span className="text-xs text-muted-foreground">{count} tool{count === 1 ? '' : 's'}</span>
                  </Link>
                )
              })}
            </div>
          </Panel>
        </div>

        <div className="space-y-5">
          {/* Frequently used */}
          <Panel title={user && byTool.length ? 'Frequently used' : 'Recently opened'}>
            {user && byTool.length > 0 ? (
              <ol className="space-y-1">
                {byTool.slice(0, 4).map((b) => {
                  const t = getToolById(b.toolId)
                  return t ? <li key={b.toolId}><ToolRow tool={t} meta={`${b.count} file${b.count === 1 ? '' : 's'} created`} /></li> : null
                })}
              </ol>
            ) : recentTools.length > 0 ? (
              <ul className="space-y-1">{recentTools.slice(0, 4).map((t) => <li key={t.id}><ToolRow tool={t} /></li>)}</ul>
            ) : (
              <p className="rounded-xl bg-surface px-4 py-5 text-center text-sm text-muted-foreground">Tools you open will appear here for one-click access.</p>
            )}
          </Panel>

          {/* Popular */}
          <Panel title="Popular tools">
            <ul className="space-y-1">{toolList(POPULAR).map((t) => <li key={t.id}><ToolRow tool={t} /></li>)}</ul>
          </Panel>

          {/* Recommended */}
          <Panel title="Recommended for you">
            <ul className="grid grid-cols-2 gap-2">
              {recommended.map((t) => (
                <li key={t.id}>
                  <Link to={t.path} className="tile flex h-full flex-col gap-2 rounded-xl p-3">
                    <span className="icon-tile h-9 w-9 rounded-lg"><t.icon size={17} /></span>
                    <span className="text-sm font-semibold leading-tight">{t.name}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </Panel>

          <Link to="/translate" className="tile tile-hero flex items-center gap-3 rounded-2xl p-4">
            <span className="icon-tile h-11 w-11 rounded-xl"><Languages size={20} /></span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">Translate documents</span>
              <span className="block text-xs text-muted-foreground">Hindi ⇄ English and {LANGUAGES.length - 2} more languages</span>
            </span>
            <ArrowRight size={16} className="text-primary" />
          </Link>

          <Link to="/repair-pdf" className="flex items-center gap-2 rounded-2xl border border-border bg-white px-4 py-3 text-xs font-medium text-muted-foreground hover:border-primary/40">
            <Wrench size={15} className="shrink-0 text-primary" /> File won't open? Try <span className="font-semibold text-primary">Repair PDF</span>
          </Link>
        </div>
      </div>
    </div>
  )
}
