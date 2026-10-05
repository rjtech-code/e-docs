import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, CornerDownLeft } from 'lucide-react'
import { tools } from '../data/tools'

/** Global ⌘K / Ctrl+K tool search. Open state is owned by AppShell. */
export default function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  return open ? <Palette onClose={onClose} /> : null
}

function Palette({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return tools.slice(0, 8)
    return tools.filter((t) => `${t.name} ${t.short} ${t.description}`.toLowerCase().includes(q)).slice(0, 8)
  }, [query])

  const go = (path: string) => {
    onClose()
    navigate(path)
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center bg-slate-900/40 px-4 pt-[14vh] backdrop-blur-[2px]" onMouseDown={onClose} role="dialog" aria-modal="true" aria-label="Search tools">
      <div className="glass w-full max-w-xl animate-fade-in overflow-hidden rounded-2xl" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 border-b border-border px-4">
          <Search size={18} className="text-muted-foreground" />
          <input
            autoFocus
            value={query}
            onChange={(e) => { setQuery(e.target.value); setActive(0) }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') onClose()
              else if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, results.length - 1)) }
              else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)) }
              else if (e.key === 'Enter' && results[active]) go(results[active].path)
            }}
            placeholder="Search tools… (merge, translate, ocr)"
            className="h-14 w-full !bg-transparent text-base text-sm outline-none"
          />
          <kbd className="rounded-md border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground">ESC</kbd>
        </div>
        <ul className="max-h-80 overflow-y-auto p-2">
          {results.length === 0 && <li className="px-3 py-6 text-center text-sm text-muted-foreground">No tools match “{query}”.</li>}
          {results.map((t, i) => (
            <li key={t.id}>
              <button
                onMouseEnter={() => setActive(i)}
                onClick={() => go(t.path)}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${i === active ? 'bg-primary-soft' : 'hover:bg-surface'}`}
              >
                <span className="icon-tile h-9 w-9 rounded-lg"><t.icon size={17} /></span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{t.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">{t.short}</span>
                </span>
                {i === active && <CornerDownLeft size={14} className="text-muted-foreground" />}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
