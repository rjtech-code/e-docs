import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { History as HistoryIcon, Download, Trash2, Search, ArrowRight, CheckCircle2 } from 'lucide-react'
import { api, type HistoryItem } from '../lib/api'
import { downloadBlob, formatBytes } from '../lib/pdfCore'
import { tools } from '../data/tools'
import { fileBadge } from '../lib/ui'

export default function History() {
  const [items, setItems] = useState<HistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [toolFilter, setToolFilter] = useState('all')
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = () => {
    setLoading(true)
    api
      .listHistory()
      .then(({ items }) => setItems(items))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  const usedTools = useMemo(() => {
    const ids = new Set(items.map((i) => i.toolId))
    return tools.filter((t) => ids.has(t.id))
  }, [items])

  const filtered = useMemo(
    () =>
      items.filter((i) => {
        const matchesTool = toolFilter === 'all' || i.toolId === toolFilter
        const matchesQuery = i.outputName.toLowerCase().includes(query.toLowerCase())
        return matchesTool && matchesQuery
      }),
    [items, toolFilter, query],
  )

  const remove = async (id: string) => {
    setBusyId(id)
    setItems((prev) => prev.filter((i) => i.id !== id))
    try {
      await api.deleteHistory(id)
    } catch {
      load()
    } finally {
      setBusyId(null)
    }
  }

  const download = async (item: HistoryItem) => {
    setBusyId(item.id)
    try {
      const blob = await api.downloadHistoryBlob(item)
      downloadBlob(blob, item.outputName)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="mx-auto max-w-5xl animate-fade-in">
      <div className="flex items-center gap-4">
        <div className="icon-tile h-12 w-12 rounded-2xl">
          <HistoryIcon size={22} />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold sm:text-3xl">Recent Files & History</h1>
          <p className="text-sm text-muted-foreground">Every file you've created with E-Docs while signed in.</p>
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search files…"
            aria-label="Search files"
            className="field pl-11"
          />
        </div>
        <select
          value={toolFilter}
          onChange={(e) => setToolFilter(e.target.value)}
          aria-label="Filter by tool"
          className="field sm:w-56"
        >
          <option value="all">All tools</option>
          {usedTools.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <p className="py-16 text-center text-muted-foreground">Loading…</p>
      ) : filtered.length === 0 ? (
        <div className="mt-5 rounded-3xl border border-dashed border-border bg-white px-6 py-16 text-center">
          <span className="icon-tile mx-auto h-14 w-14 rounded-2xl"><HistoryIcon size={24} /></span>
          <p className="mt-4 font-display text-lg font-bold">{items.length === 0 ? 'No recent files yet.' : 'No files found.'}</p>
          <p className="mt-1 text-sm text-muted-foreground">{items.length === 0 ? 'Files you create with any tool will appear here.' : 'Try a different search or tool filter.'}</p>
          {items.length === 0 && (
            <Link to="/all-tools" className="btn-primary mt-5 inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm">Try a PDF Tool <ArrowRight size={15} /></Link>
          )}
        </div>
      ) : (
        <div className="glass mt-5 overflow-hidden rounded-3xl">
          <table className="w-full text-sm">
            <thead className="hidden bg-surface text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground md:table-header-group">
              <tr>
                <th className="px-5 py-3">File name</th>
                <th className="px-4 py-3">Tool used</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((item) => {
                const b = fileBadge(item.outputName)
                return (
                  <tr key={item.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 md:table-row md:px-0 md:py-0">
                    <td className="flex min-w-0 flex-1 basis-full items-center gap-3 md:table-cell md:px-5 md:py-3">
                      <span className="flex min-w-0 items-center gap-3">
                        <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg text-[10px] font-bold ${b.cls}`}>{b.label}</span>
                        <span className="min-w-0">
                          <span className="block truncate font-medium">{item.outputName}</span>
                          <span className="block text-xs text-muted-foreground">{formatBytes(item.size)}</span>
                        </span>
                      </span>
                    </td>
                    <td className="text-xs text-muted-foreground md:px-4 md:py-3 md:text-sm md:text-foreground/80">{item.toolName}</td>
                    <td className="text-xs text-muted-foreground md:px-4 md:py-3 md:text-sm">{new Date(item.createdAt).toLocaleString()}</td>
                    <td className="md:px-4 md:py-3">
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800"><CheckCircle2 size={12} /> Saved</span>
                    </td>
                    <td className="ml-auto md:px-5 md:py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => download(item)}
                          disabled={busyId === item.id}
                          className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary-soft disabled:opacity-40"
                          aria-label={`Download ${item.outputName}`}
                        >
                          <Download size={16} /> <span className="hidden lg:inline">Download</span>
                        </button>
                        <button
                          onClick={() => remove(item.id)}
                          disabled={busyId === item.id}
                          className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-red-50 hover:text-destructive disabled:opacity-40"
                          aria-label={`Delete ${item.outputName}`}
                          title="Delete"
                        >
                          <Trash2 size={17} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
