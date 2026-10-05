import { Link } from 'react-router-dom'
import { History as HistoryIcon, Download, Trash2, LogIn } from 'lucide-react'
import type { useToolHistory } from '../hooks/useToolHistory'
import { formatBytes } from '../lib/pdfCore'

/** Drop into any tool page (usually just before </ToolShell>) to show that tool's saved history. */
export default function ToolHistoryPanel({ history }: { history: ReturnType<typeof useToolHistory> }) {
  const { items, loading, signedIn, download, remove } = history

  if (!signedIn) {
    return (
      <div className="mt-6 flex items-center gap-3 rounded-2xl border border-border bg-surface px-5 py-3.5">
        <LogIn size={18} className="shrink-0 text-primary" />
        <p className="text-sm text-muted-foreground">
          <Link to="/login" className="font-semibold text-primary hover:underline">Sign in</Link> to save the files you create here and find them again anytime.
        </p>
      </div>
    )
  }

  return (
    <div className="mt-8 border-t border-border pt-6">
      <div className="mb-3 flex items-center gap-2">
        <HistoryIcon size={16} className="text-primary" />
        <h3 className="text-sm font-bold text-foreground">Your recent files with this tool</h3>
      </div>
      {loading && items.length === 0 && <p className="text-sm text-muted-foreground">Loading…</p>}
      {!loading && items.length === 0 && <p className="rounded-xl bg-surface px-4 py-3 text-sm text-muted-foreground">Nothing here yet — files you create will show up for quick re-download.</p>}
      {items.length > 0 && (
        <ul className="space-y-2">
          {items.map((item) => (
            <li key={item.id} className="flex items-center gap-3 rounded-xl border border-border bg-white px-4 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{item.outputName}</p>
                <p className="text-xs text-muted-foreground">{formatBytes(item.size)} · {new Date(item.createdAt).toLocaleString()}</p>
              </div>
              <button onClick={() => download(item)} className="shrink-0 rounded-lg p-2 text-primary transition-colors hover:bg-primary-soft" aria-label={`Download ${item.outputName}`} title="Download again"><Download size={16} /></button>
              <button onClick={() => remove(item.id)} className="shrink-0 rounded-lg p-2 text-muted-foreground transition-colors hover:bg-red-50 hover:text-destructive" aria-label={`Delete ${item.outputName}`} title="Delete"><Trash2 size={16} /></button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
