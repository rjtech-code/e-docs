import { Router } from 'express'

// Server-side translation proxy for E-Docs (no API key needed). The browser calls
// POST /api/translate so it never runs into CORS limits of the public endpoints.

const LANGS = new Set(['auto', 'en', 'hi', 'mr', 'gu', 'bn', 'ta', 'te', 'kn', 'ml', 'pa', 'ur'])
const MAX_CHARS = 5000

// tiny per-IP rate limit (60 requests / minute) so this can't be abused as an open relay
const hits = new Map()
function rateLimited(ip) {
  const now = Date.now()
  const rec = hits.get(ip)
  if (!rec || now - rec.start > 60_000) {
    hits.set(ip, { start: now, count: 1 })
    return false
  }
  return ++rec.count > 60
}
setInterval(() => {
  const now = Date.now()
  for (const [ip, rec] of hits) if (now - rec.start > 60_000) hits.delete(ip)
}, 60_000).unref?.()

async function viaGoogle(q, from, to) {
  const res = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=${from}&tl=${to}&dt=t`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
    body: `q=${encodeURIComponent(q)}`,
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) throw new Error(`google ${res.status}`)
  const data = await res.json()
  if (!Array.isArray(data) || !Array.isArray(data[0])) throw new Error('google: bad response')
  const text = data[0].map((seg) => (Array.isArray(seg) && typeof seg[0] === 'string' ? seg[0] : '')).join('')
  return { text, detected: typeof data[2] === 'string' ? data[2] : undefined }
}

async function viaMyMemory(q, from, to) {
  if (from === 'auto' || Buffer.byteLength(q, 'utf8') > 480) throw new Error('mymemory: unsupported request')
  const res = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(q)}&langpair=${from}|${to}`, { signal: AbortSignal.timeout(15_000) })
  if (!res.ok) throw new Error(`mymemory ${res.status}`)
  const data = await res.json()
  const text = data?.responseData?.translatedText
  if (Number(data?.responseStatus) !== 200 || typeof text !== 'string' || /MYMEMORY WARNING/i.test(text)) throw new Error('mymemory: quota reached')
  return { text, detected: from }
}

export default function translateRoutes() {
  const router = Router()
  router.post('/', async (req, res) => {
    const { q, from = 'auto', to } = req.body ?? {}
    if (typeof q !== 'string' || !q.trim()) return res.status(400).json({ error: 'Nothing to translate' })
    if (q.length > MAX_CHARS) return res.status(413).json({ error: `Text too long (max ${MAX_CHARS} characters per request)` })
    if (!LANGS.has(from) || !LANGS.has(to) || to === 'auto') return res.status(400).json({ error: 'Unsupported language' })
    if (rateLimited(req.ip)) return res.status(429).json({ error: 'Too many translation requests — slow down a little' })
    try {
      return res.json(await viaGoogle(q, from, to))
    } catch (googleErr) {
      try {
        return res.json(await viaMyMemory(q, from, to))
      } catch (mmErr) {
        console.error('translate failed:', googleErr.message, '|', mmErr.message)
        return res.status(502).json({ error: 'Translation service unavailable' })
      }
    }
  })
  return router
}
