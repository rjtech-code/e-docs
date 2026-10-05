export function greeting(date = new Date()): string {
  const h = date.getHours()
  if (h < 5) return 'Good night'
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

export function timeAgo(iso: string, now = Date.now()): string {
  const m = Math.floor(Math.max(0, now - new Date(iso).getTime()) / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  return d < 30 ? `${d}d ago` : new Date(iso).toLocaleDateString()
}

/** Small file-type badge classes keyed off the extension. */
export function fileBadge(name: string): { label: string; cls: string } {
  const ext = (name.split('.').pop() || '').toLowerCase()
  switch (ext) {
    case 'pdf': return { label: 'PDF', cls: 'bg-red-50 text-red-700' }
    case 'docx': case 'doc': return { label: 'DOC', cls: 'bg-blue-50 text-blue-700' }
    case 'xlsx': case 'xls': return { label: 'XLS', cls: 'bg-emerald-50 text-emerald-700' }
    case 'pptx': case 'ppt': return { label: 'PPT', cls: 'bg-orange-50 text-orange-700' }
    case 'jpg': case 'jpeg': case 'png': case 'zip': return { label: ext.toUpperCase().slice(0, 3), cls: 'bg-sky-50 text-sky-700' }
    default: return { label: (ext || 'FILE').toUpperCase().slice(0, 3), cls: 'bg-slate-100 text-slate-600' }
  }
}

/** Local-time YYYY-MM-DD key for a date. */
export function dayKey(d: Date): string {
  return d.toLocaleDateString('en-CA')
}

/** Count ISO timestamps per local day over the last `days` days (oldest → newest), for BarChart. */
export function perDay(dates: string[], days: number): { key: string; label: string; value: number }[] {
  const counts = new Map<string, number>()
  dates.forEach((iso) => {
    const k = dayKey(new Date(iso))
    counts.set(k, (counts.get(k) ?? 0) + 1)
  })
  const out: { key: string; label: string; value: number }[] = []
  const today = new Date()
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i)
    const k = dayKey(d)
    out.push({ key: k, label: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }), value: counts.get(k) ?? 0 })
  }
  return out
}
