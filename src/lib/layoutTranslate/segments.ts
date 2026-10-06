import { translateText } from '../translate'

/** Collapses whitespace so every segment is exactly one line for the batch request. */
export const normalizeSegment = (s: string) => s.replace(/\s+/g, ' ').trim()

/** Only text with letters is worth sending (skips page numbers, prices, bullets, URLs, e-mails). */
export function needsTranslation(s: string): boolean {
  const t = s.trim()
  if (!/\p{L}/u.test(t)) return false
  if (/^(https?:\/\/|www\.)\S+$/i.test(t)) return false
  if (/^\S+@\S+\.\S+$/.test(t)) return false
  return true
}

/**
 * Translates many short segments with the existing engine in as few requests as possible.
 * Each segment becomes one line of a single request; `translateText` guarantees the line count
 * is preserved, so result line i always belongs to segment i. Duplicates are sent once.
 * Returns translations aligned with `texts` (untranslatable segments come back unchanged).
 */
export async function translateSegments(
  texts: string[],
  from: string,
  to: string,
  opts: { signal?: AbortSignal; onProgress?: (percent: number) => void } = {},
): Promise<{ translations: string[]; detected?: string }> {
  const normalized = texts.map(normalizeSegment)
  const unique: string[] = []
  const indexOf = new Map<string, number>()
  for (const s of normalized) {
    if (!needsTranslation(s) || indexOf.has(s)) continue
    indexOf.set(s, unique.length)
    unique.push(s)
  }
  if (unique.length === 0) {
    opts.onProgress?.(100)
    return { translations: normalized }
  }

  const res = await translateText(unique.join('\n'), from, to, { signal: opts.signal, onProgress: opts.onProgress })
  let lines = res.text.split('\n')
  if (lines.length !== unique.length) {
    // Should not happen (the engine keeps line counts), but never mis-map: translate one by one.
    lines = []
    for (let i = 0; i < unique.length; i++) {
      lines.push(normalizeSegment((await translateText(unique[i], from, to, { signal: opts.signal })).text))
      opts.onProgress?.(Math.round(((i + 1) / unique.length) * 100))
    }
  }
  const translations = normalized.map((s) => {
    const i = indexOf.get(s)
    const t = i === undefined ? s : normalizeSegment(lines[i] ?? '')
    return t || s // never let text disappear
  })
  return { translations, detected: res.detected }
}
