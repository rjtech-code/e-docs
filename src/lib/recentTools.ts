// Remembers which tools the visitor opened last (per browser) for the Home "Recent" panel.
const KEY = 'edocs_recent_tools'
const MAX = 6

export function getRecentToolIds(): string[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) || '[]')
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string').slice(0, MAX) : []
  } catch {
    return []
  }
}
export function pushRecentTool(id: string) {
  try {
    localStorage.setItem(KEY, JSON.stringify([id, ...getRecentToolIds().filter((x) => x !== id)].slice(0, MAX)))
  } catch { /* storage unavailable */ }
}
export function clearRecentTools() {
  try { localStorage.removeItem(KEY) } catch { /* ignore */ }
}
