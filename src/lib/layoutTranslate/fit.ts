// Text measuring / wrapping / fitting with the browser's own text shaping (so Devanagari,
// Tamil, Urdu… are measured exactly as they will be drawn).

let ctx: CanvasRenderingContext2D | null = null
export function measureContext(): CanvasRenderingContext2D {
  if (!ctx) {
    const c = document.createElement('canvas')
    ctx = c.getContext('2d')
    if (!ctx) throw new Error('Canvas is not available in this browser')
  }
  return ctx
}

export function cssFont(sizePx: number, family: string, bold = false, italic = false) {
  return `${italic ? 'italic ' : ''}${bold ? '600 ' : ''}${Math.max(1, sizePx).toFixed(2)}px ${family}`
}

/** Word-wraps `text` to `maxW` using the context's current font. Over-long words are split by character. */
export function wrapLines(c: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const out: string[] = []
  for (const para of text.split('\n')) {
    const words = para.split(/\s+/).filter(Boolean)
    if (words.length === 0) { out.push(''); continue }
    let cur = ''
    for (const word of words) {
      const cand = cur ? `${cur} ${word}` : word
      if (c.measureText(cand).width <= maxW) { cur = cand; continue }
      if (cur) out.push(cur)
      if (c.measureText(word).width <= maxW) { cur = word; continue }
      let part = ''
      for (const ch of Array.from(word)) {
        if (part && c.measureText(part + ch).width > maxW) { out.push(part); part = ch } else part += ch
      }
      cur = part
    }
    out.push(cur)
  }
  return out
}

export interface FitInput {
  text: string
  family: string
  bold?: boolean
  italic?: boolean
  /** Original font size and line pitch (same units as maxW/maxH). */
  fontSize: number
  lineHeight: number
  maxW: number
  maxH: number
  /** Smallest font scale allowed (default 0.62). */
  minScale?: number
}
export interface FitResult { lines: string[]; fontSize: number; lineHeight: number; scale: number; overflow: boolean }

/**
 * Fits translated text into the original box: 1) re-wrap at the original size, 2) tighten line
 * spacing, 3) shrink the font step by step. The box is never moved.
 */
export function fitText(f: FitInput): FitResult {
  const c = measureContext()
  const minScale = f.minScale ?? 0.62
  const pitchRatio = Math.max(1.05, f.lineHeight / f.fontSize)
  const heightOf = (n: number, size: number, pitch: number) => (n - 1) * pitch + size * 1.18
  let last: FitResult | null = null
  for (let s = 1; s >= minScale - 1e-6; s -= 0.04) {
    const size = f.fontSize * s
    c.font = cssFont(size, f.family, f.bold, f.italic)
    const lines = wrapLines(c, f.text, f.maxW)
    for (const ratio of s === 1 ? [pitchRatio, Math.min(pitchRatio, 1.12)] : [Math.min(pitchRatio, 1.12)]) {
      const pitch = size * ratio
      last = { lines, fontSize: size, lineHeight: pitch, scale: s, overflow: heightOf(lines.length, size, pitch) > f.maxH + 0.5 }
      if (!last.overflow) return last
    }
  }
  return last!
}
