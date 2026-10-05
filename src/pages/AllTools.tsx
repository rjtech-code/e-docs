import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Search, X, ChevronRight } from 'lucide-react'
import { tools, categoryLabels, type ToolCategory } from '../data/tools'
import ToolCard from '../components/ToolCard'

const categories: (ToolCategory | 'all')[] = ['all', 'organize', 'convert', 'edit', 'security', 'translate']

export default function AllTools() {
  const [query, setQuery] = useState('')
  const [params] = useSearchParams()
  const initial = params.get('category')
  const [cat, setCat] = useState<ToolCategory | 'all'>(categories.includes(initial as ToolCategory) ? (initial as ToolCategory) : 'all')
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return tools.filter((t) => (cat === 'all' || t.category === cat) && (!q || `${t.name} ${t.short}`.toLowerCase().includes(q)))
  }, [query, cat])
  const grouped = cat === 'all' && !query.trim()

  return (
    <div className="mx-auto max-w-6xl animate-fade-in">
      <nav aria-label="Breadcrumb" className="mb-3 flex items-center gap-1 text-xs text-muted-foreground">
        <Link to="/home" className="font-medium hover:text-primary">Home</Link>
        <ChevronRight size={13} aria-hidden="true" />
        <span className="font-medium text-foreground" aria-current="page">All Tools</span>
      </nav>
      <div className="rounded-3xl border border-border bg-gradient-to-br from-[#eaf2ff] to-white px-5 py-7 sm:px-8 sm:py-9">
        <h1 className="font-display text-3xl font-bold sm:text-4xl">All <span className="gradient-text">PDF Tools</span></h1>
        <p className="mt-2 text-muted-foreground">Choose a tool below — each one opens a simple page where you add your file and download the result.</p>
        <div className="mt-6 flex h-12 max-w-xl items-center gap-3 rounded-xl border border-border bg-white px-4 shadow-sm focus-within:border-primary focus-within:ring-3 focus-within:ring-primary/15">
          <Search size={18} className="text-muted-foreground" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search for a tool, e.g. “compress”" className="h-full w-full !bg-transparent text-[15px] outline-none" aria-label="Search tools" />
          {query && <button onClick={() => setQuery('')} className="rounded-md p-1 text-muted-foreground hover:text-foreground" aria-label="Clear search"><X size={16} /></button>}
        </div>
      </div>
      <div className="mt-5 flex flex-wrap gap-2" role="group" aria-label="Filter by category">
        {categories.map((c) => (
          <button
            key={c}
            onClick={() => setCat(c)}
            aria-pressed={cat === c}
            className={`rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${cat === c ? 'border-primary bg-primary text-white' : 'border-border bg-white text-foreground/75 hover:border-primary/40 hover:text-primary-strong'}`}
          >
            {c === 'all' ? 'All' : categoryLabels[c]}
          </button>
        ))}
      </div>
      <p className="mt-4 text-sm text-muted-foreground" aria-live="polite">{filtered.length} tool{filtered.length === 1 ? '' : 's'}</p>
      {filtered.length === 0 ? (
        <div className="mt-4 rounded-3xl border border-dashed border-border bg-white py-16 text-center">
          <p className="font-semibold">No tools match “{query}”.</p>
          <button onClick={() => { setQuery(''); setCat('all') }} className="btn-ghost mt-4 rounded-xl px-5 py-2.5 text-sm font-semibold">Show all tools</button>
        </div>
      ) : grouped ? (
        <div className="mt-2 space-y-10">
          {categories.filter((c): c is ToolCategory => c !== 'all').map((c) => (
            <section key={c} aria-labelledby={`cat-${c}`}>
              <h2 id={`cat-${c}`} className="mb-4 font-display text-xl font-bold">{categoryLabels[c]}</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {tools.filter((t) => t.category === c).map((t) => <ToolCard key={t.id} tool={t} />)}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="mt-2 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{filtered.map((t) => <ToolCard key={t.id} tool={t} />)}</div>
      )}
    </div>
  )
}
