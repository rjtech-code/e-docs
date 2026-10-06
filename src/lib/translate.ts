// Text translation for E-Docs — Hindi ⇄ English plus other major Indian languages.
// No API key needed. Engines are tried in order, first success wins (failed ones are skipped
// for the rest of the session):
//   1. E-Docs backend proxy  (POST /api/translate)   — avoids browser CORS limits
//   2. Google's public translate endpoint from the browser
//   3. MyMemory free API (500-byte requests, daily quota) — last resort
// Long text is chunked to each engine's limit while preserving line breaks.

import { API_BASE } from './api'

export interface Language {
  code: string
  name: string
  native: string
  rtl?: boolean
  /** CSS font stack for canvas drawing (PDF export). */
  font: string
  /** Word complex-script font. */
  docxFont: string
}

const NIRMALA = 'Nirmala UI'
export const LANGUAGES: Language[] = [
  { code: 'en', name: 'English', native: 'English', font: '"Inter", "Helvetica Neue", Arial, sans-serif', docxFont: 'Calibri' },
  { code: 'hi', name: 'Hindi', native: 'हिन्दी', font: '"Noto Sans Devanagari", "Mangal", sans-serif', docxFont: NIRMALA },
  { code: 'mr', name: 'Marathi', native: 'मराठी', font: '"Noto Sans Devanagari", "Mangal", sans-serif', docxFont: NIRMALA },
  { code: 'gu', name: 'Gujarati', native: 'ગુજરાતી', font: '"Noto Sans Gujarati", "Shruti", sans-serif', docxFont: NIRMALA },
  { code: 'bn', name: 'Bengali', native: 'বাংলা', font: '"Noto Sans Bengali", "Vrinda", sans-serif', docxFont: NIRMALA },
  { code: 'ta', name: 'Tamil', native: 'தமிழ்', font: '"Noto Sans Tamil", "Latha", sans-serif', docxFont: NIRMALA },
  { code: 'te', name: 'Telugu', native: 'తెలుగు', font: '"Noto Sans Telugu", "Gautami", sans-serif', docxFont: NIRMALA },
  { code: 'kn', name: 'Kannada', native: 'ಕನ್ನಡ', font: '"Noto Sans Kannada", "Tunga", sans-serif', docxFont: NIRMALA },
  { code: 'ml', name: 'Malayalam', native: 'മലയാളം', font: '"Noto Sans Malayalam", "Kartika", sans-serif', docxFont: NIRMALA },
  { code: 'pa', name: 'Punjabi', native: 'ਪੰਜਾਬੀ', font: '"Noto Sans Gurmukhi", "Raavi", sans-serif', docxFont: NIRMALA },
  { code: 'ur', name: 'Urdu', native: 'اردو', rtl: true, font: '"Noto Naskh Arabic", "Arial", sans-serif', docxFont: 'Arial' },
]

export const AUTO = 'auto'
export const getLanguage = (code: string) => LANGUAGES.find((l) => l.code === code)

export class TranslateError extends Error {}

/* ───────────── language guessing (by script) ───────────── */
const SCRIPTS: [string, RegExp][] = [
  ['hi', /[ऀ-ॿ]/g], ['bn', /[ঀ-৿]/g], ['pa', /[਀-੿]/g], ['gu', /[઀-૿]/g],
  ['ta', /[஀-௿]/g], ['te', /[ఀ-౿]/g], ['kn', /[ಀ-೿]/g], ['ml', /[ഀ-ൿ]/g],
  ['ur', /[؀-ۿ]/g], ['en', /[A-Za-z]/g],
]
/** Best-effort guess (Marathi is reported as Hindi — same script). */
export function guessLanguage(text: string): string {
  let best = 'en'
  let bestCount = 0
  for (const [code, re] of SCRIPTS) {
    const n = text.match(re)?.length ?? 0
    if (n > bestCount) { best = code; bestCount = n }
  }
  return best
}

/* ───────────── chunking ───────────── */
export interface Piece { text: string; sep: string }

/**
 * Splits text into pieces ≤ `limit` (per `measure`), preferring line, then sentence, then word
 * boundaries. Joining `sep + text` of all pieces reproduces the original text (modulo the
 * whitespace at points where a single over-long line had to be broken).
 */
export function splitText(text: string, limit: number, measure: (s: string) => number = (s) => s.length): Piece[] {
  const pieces: Piece[] = []
  let cur = ''
  let has = false
  const flush = () => {
    if (has) pieces.push({ text: cur, sep: pieces.length === 0 ? '' : '\n' })
    cur = ''
    has = false
  }
  const breakLong = (line: string): string[] => {
    const out: string[] = []
    let buf = ''
    const push = (s: string) => {
      if (buf && measure(buf + ' ' + s) > limit) { out.push(buf); buf = s } else buf = buf ? buf + ' ' + s : s
    }
    for (const sentence of line.split(/(?<=[.!?।॥؟])\s+/u)) {
      if (measure(sentence) <= limit) { push(sentence); continue }
      for (const word of sentence.split(/\s+/u)) {
        if (measure(word) <= limit) { push(word); continue }
        if (buf) { out.push(buf); buf = '' }
        let part = ''
        for (const ch of Array.from(word)) {
          if (measure(part + ch) > limit) { out.push(part); part = ch } else part += ch
        }
        buf = part
      }
    }
    if (buf) out.push(buf)
    return out
  }
  for (const line of text.split('\n')) {
    if (measure(line) > limit) {
      flush()
      breakLong(line).forEach((p, i) => pieces.push({ text: p, sep: pieces.length === 0 ? '' : i === 0 ? '\n' : ' ' }))
      continue
    }
    const candidate = has ? cur + '\n' + line : line
    if (has && measure(candidate) > limit) { flush(); cur = line } else cur = candidate
    has = true
  }
  flush()
  return pieces
}

export const joinPieces = (pieces: Piece[], translated: string[]) => translated.map((t, i) => (i === 0 ? '' : pieces[i].sep) + t).join('')

/* ───────────── engines ───────────── */
interface EngineResult { text: string; detected?: string }
interface Engine {
  name: string
  limit: number
  measure: (s: string) => number
  run: (q: string, from: string, to: string, signal?: AbortSignal) => Promise<EngineResult>
}

const utf8Bytes = (s: string) => new TextEncoder().encode(s).length

/** Parses Google's `translate_a/single` response. */
export function parseGoogleResponse(data: unknown): EngineResult {
  if (!Array.isArray(data) || !Array.isArray(data[0])) throw new TranslateError('Unexpected translation response')
  const text = (data[0] as unknown[]).map((seg) => (Array.isArray(seg) && typeof seg[0] === 'string' ? seg[0] : '')).join('')
  return { text, detected: typeof data[2] === 'string' ? data[2] : undefined }
}

const proxyEngine: Engine = {
  name: 'proxy', limit: 4000, measure: (s) => s.length,
  async run(q, from, to, signal) {
    const res = await fetch(`${API_BASE}/api/translate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ q, from, to }), signal })
    if (!res.ok) throw new TranslateError(`proxy ${res.status}`)
    const data = await res.json()
    if (typeof data?.text !== 'string') throw new TranslateError('proxy: bad response')
    return { text: data.text, detected: data.detected }
  },
}

const googleEngine: Engine = {
  name: 'google', limit: 3500, measure: (s) => s.length,
  async run(q, from, to, signal) {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${encodeURIComponent(from)}&tl=${encodeURIComponent(to)}&dt=t`
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' }, body: `q=${encodeURIComponent(q)}`, signal })
    if (!res.ok) throw new TranslateError(`google ${res.status}`)
    return parseGoogleResponse(await res.json())
  },
}

const myMemoryEngine: Engine = {
  name: 'mymemory', limit: 450, measure: utf8Bytes,
  async run(q, from, to, signal) {
    const src = from === AUTO ? guessLanguage(q) : from
    if (src === to) return { text: q, detected: src }
    const res = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(q)}&langpair=${encodeURIComponent(src)}|${encodeURIComponent(to)}`, { signal })
    if (!res.ok) throw new TranslateError(`mymemory ${res.status}`)
    const data = await res.json()
    const text: unknown = data?.responseData?.translatedText
    if (Number(data?.responseStatus) !== 200 || typeof text !== 'string' || /MYMEMORY WARNING|QUERY LENGTH LIMIT/i.test(text)) throw new TranslateError('mymemory: quota or limit reached')
    return { text, detected: src }
  },
}

const ENGINES: Engine[] = [proxyEngine, googleEngine, myMemoryEngine]
const dead = new Set<string>()
export const _resetEnginesForTests = () => dead.clear()

async function translatePiece(q: string, from: string, to: string, signal?: AbortSignal): Promise<EngineResult> {
  let lastErr: unknown
  for (const engine of ENGINES) {
    if (dead.has(engine.name)) continue
    try {
      if (engine.measure(q) > engine.limit) {
        const pieces = splitText(q, engine.limit, engine.measure)
        const outs: string[] = []
        let detected: string | undefined
        for (const p of pieces) {
          const r = await engine.run(p.text, from, to, signal)
          outs.push(r.text)
          detected ??= r.detected
        }
        return { text: joinPieces(pieces, outs), detected }
      }
      return await engine.run(q, from, to, signal)
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') throw err
      lastErr = err
      dead.add(engine.name)
    }
  }
  dead.clear() // give every engine another chance on the next call
  throw new TranslateError(`Could not reach a translation service (${(lastErr as Error)?.message ?? 'network error'}). Check your internet connection and try again.`)
}

/** Translates a multi-line chunk, guaranteeing the line count is unchanged. */
async function translateChunk(chunk: string, from: string, to: string, signal?: AbortSignal): Promise<EngineResult> {
  if (chunk.trim() === '') return { text: chunk }
  const lead = chunk.match(/^\s*/)![0]
  const trail = chunk.match(/\s*$/)![0]
  const core = chunk.trim()
  const res = await translatePiece(core, from, to, signal)
  if (res.text.split('\n').length === core.split('\n').length) return { text: lead + res.text + trail, detected: res.detected }

  const out: string[] = []
  let detected = res.detected
  for (const line of core.split('\n')) {
    if (line.trim() === '') { out.push(line); continue }
    const r = await translatePiece(line, from, to, signal)
    out.push(r.text.replace(/\n+/g, ' '))
    detected ??= r.detected
  }
  return { text: lead + out.join('\n') + trail, detected }
}

export interface TranslateOptions { onProgress?: (percent: number) => void; signal?: AbortSignal }

export async function translateText(text: string, from: string, to: string, opts: TranslateOptions = {}): Promise<{ text: string; detected?: string }> {
  const src = from === AUTO ? guessLanguage(text) : from
  if (!text.trim()) return { text: '' }
  if (src === to && from !== AUTO) return { text, detected: src }

  const first = ENGINES.find((e) => !dead.has(e.name)) ?? ENGINES[0]
  const pieces = splitText(text, first.limit, first.measure)
  const results: string[] = new Array(pieces.length)
  let detected: string | undefined
  let done = 0
  let next = 0
  const worker = async () => {
    while (next < pieces.length) {
      const i = next++
      const r = await translateChunk(pieces[i].text, from, to, opts.signal)
      results[i] = r.text
      detected ??= r.detected
      done++
      opts.onProgress?.(Math.round((done / pieces.length) * 100))
    }
  }
  await Promise.all(Array.from({ length: Math.min(3, pieces.length) }, worker))
  return { text: joinPieces(pieces, results), detected: detected ?? (from === AUTO ? src : from) }
}
