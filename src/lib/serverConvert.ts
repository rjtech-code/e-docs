// Server-side conversion (LibreOffice / Python on the backend) — keeps the original layout,
// fonts, images and tables, unlike the in-browser converters which rebuild documents from
// extracted text. Every tool tries this first and silently falls back to its in-browser
// converter if the backend can't do it (offline, engines not installed, e.g. on Vercel).
import { API_BASE } from './api'

export type ServerConvertKind =
  | 'word-to-pdf'
  | 'powerpoint-to-pdf'
  | 'excel-to-pdf'
  | 'pdf-to-word'
  | 'pdf-to-powerpoint'
  | 'pdf-to-excel'

interface Status {
  kinds: string[]
}

let statusCache: { at: number; value: Promise<Status | null> } | null = null

function getStatus(): Promise<Status | null> {
  if (statusCache && Date.now() - statusCache.at < 60_000) return statusCache.value
  const value = fetch(`${API_BASE}/api/convert/status`)
    .then((r) => (r.ok ? (r.json() as Promise<Status>) : null))
    .catch(() => null)
  statusCache = { at: Date.now(), value }
  return value
}

function filenameFrom(res: Response, fallback: string): string {
  const header = res.headers.get('Content-Disposition') ?? ''
  const match = /filename\*=UTF-8''([^;]+)/i.exec(header)
  if (match) {
    try {
      return decodeURIComponent(match[1])
    } catch {
      /* fall through to the fallback name */
    }
  }
  return fallback
}

/**
 * Convert `file` on the server. Resolves to `null` (never throws) when server conversion
 * isn't available or fails, so callers can run their in-browser converter instead.
 */
export async function convertOnServer(
  kind: ServerConvertKind,
  file: File,
  fallbackName: string,
): Promise<{ blob: Blob; name: string } | null> {
  try {
    const status = await getStatus()
    if (!status?.kinds.includes(kind)) return null

    const form = new FormData()
    form.append('file', file, file.name)
    const res = await fetch(`${API_BASE}/api/convert/${kind}`, { method: 'POST', body: form })
    if (!res.ok) {
      console.warn(`Server conversion (${kind}) failed with HTTP ${res.status}; using in-browser converter`)
      return null
    }
    const blob = await res.blob()
    if (blob.size === 0) return null
    return { blob, name: filenameFrom(res, fallbackName) }
  } catch (err) {
    console.warn(`Server conversion (${kind}) unavailable; using in-browser converter`, err)
    return null
  }
}
