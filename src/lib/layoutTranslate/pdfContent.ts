// Removes the original text from a PDF page while keeping EVERYTHING else (images, vector
// graphics, table rules, backgrounds, annotations). Only text-showing operators (Tj, TJ, ', ")
// are dropped from the page's content streams and from the Form XObjects it uses — so the
// translated text can be drawn back in exactly the same places.
import { PDFArray, PDFDict, PDFName, PDFRawStream, PDFRef, PDFStream, decodePDFRawStream } from 'pdf-lib'
import type { PDFDocument, PDFPage } from 'pdf-lib'

const WS = new Set([0, 9, 10, 12, 13, 32])
const DELIM = new Set([...'()<>[]{}/%'].map((c) => c.charCodeAt(0)))
const ch = (s: string) => s.charCodeAt(0)
const enc = new TextEncoder()

/** Returns a copy of `src` with all text-showing operations removed (operands included). */
export function stripTextOperators(src: Uint8Array): { out: Uint8Array; removed: number } {
  const n = src.length
  const keep: Uint8Array[] = []
  let i = 0
  let opStart = 0 // where the current operation's operands begin
  let copied = 0 // bytes of src already pushed to `keep`
  let removed = 0

  const skipString = () => { // at '('
    let depth = 0
    for (; i < n; i++) {
      const c = src[i]
      if (c === 0x5c) { i++; continue } // backslash escape
      if (c === 0x28) depth++
      else if (c === 0x29 && --depth === 0) { i++; return }
    }
  }
  const replaceOp = (end: number, replacement: string) => {
    keep.push(src.subarray(copied, opStart))
    keep.push(enc.encode(replacement))
    copied = end
    removed++
  }

  while (i < n) {
    const c = src[i]
    if (WS.has(c)) { i++; continue }
    if (c === ch('%')) { while (i < n && src[i] !== 10 && src[i] !== 13) i++; continue }
    if (c === ch('(')) { skipString(); continue }
    if (c === ch('<')) {
      if (src[i + 1] === ch('<')) { i += 2; continue }
      while (i < n && src[i] !== ch('>')) i++
      i++
      continue
    }
    if (c === ch('>') && src[i + 1] === ch('>')) { i += 2; continue }
    if (c === ch('[') || c === ch(']') || c === ch('{') || c === ch('}')) { i++; continue }
    if (c === ch('/')) { i++; while (i < n && !WS.has(src[i]) && !DELIM.has(src[i])) i++; continue }

    // regular token: number or operator
    const start = i
    while (i < n && !WS.has(src[i]) && !DELIM.has(src[i])) i++
    if (i === start) { i++; continue } // stray delimiter byte (malformed stream) — skip it
    const tok = String.fromCharCode(...src.subarray(start, i))
    if (/^[+-]?(\d+\.?\d*|\.\d+)$/.test(tok) || tok === 'true' || tok === 'false' || tok === 'null') continue

    // operator
    if (tok === 'Tj' || tok === 'TJ') replaceOp(i, ' ')
    else if (tok === "'" || tok === '"') replaceOp(i, ' T* ') // keep the move to the next line
    else if (tok === 'BI') {
      // inline image: skip dictionary, then binary data up to whitespace + "EI" + whitespace/EOF
      while (i < n && !(src[i] === ch('I') && src[i - 1] === ch('D') && WS.has(src[i - 2]) && (i + 1 >= n || WS.has(src[i + 1])))) i++
      i += 2
      while (i < n && !(WS.has(src[i - 1]) && src[i] === ch('E') && src[i + 1] === ch('I') && (i + 2 >= n || WS.has(src[i + 2]) || DELIM.has(src[i + 2])))) i++
      i += 2
    }
    opStart = i
  }
  if (removed === 0) return { out: src, removed: 0 }
  keep.push(src.subarray(copied))
  const total = keep.reduce((s, b) => s + b.length, 0)
  const out = new Uint8Array(total)
  let o = 0
  for (const b of keep) { out.set(b, o); o += b.length }
  return { out, removed }
}

function streamBytes(obj: unknown): Uint8Array | null {
  if (obj instanceof PDFRawStream) return decodePDFRawStream(obj).decode()
  if (obj instanceof PDFStream) return (obj as PDFStream & { getUnencodedContents(): Uint8Array }).getUnencodedContents()
  return null
}

/** Strips text from every Form XObject reachable from `resources` (recursively, once per object). */
function stripForms(doc: PDFDocument, resources: PDFDict | undefined, seen: Set<string>): number {
  if (!resources) return 0
  const xobjects = resources.lookup(PDFName.of('XObject'))
  if (!(xobjects instanceof PDFDict)) return 0
  let removed = 0
  for (const [, ref] of xobjects.entries()) {
    if (!(ref instanceof PDFRef) || seen.has(ref.toString())) continue
    seen.add(ref.toString())
    const stream = doc.context.lookup(ref)
    if (!(stream instanceof PDFRawStream)) continue
    if (stream.dict.lookup(PDFName.of('Subtype')) !== PDFName.of('Form')) continue
    const bytes = streamBytes(stream)
    if (!bytes) continue
    const res = stripTextOperators(bytes)
    if (res.removed) {
      const dict = stream.dict.clone(doc.context)
      dict.delete(PDFName.of('Filter'))
      dict.delete(PDFName.of('DecodeParms'))
      dict.delete(PDFName.of('Length'))
      const fresh = doc.context.flateStream(res.out, Object.fromEntries(Array.from(dict.entries()).map(([k, v]) => [k.asString().slice(1), v])))
      doc.context.assign(ref, fresh)
      removed += res.removed
    }
    const inner = stream.dict.lookup(PDFName.of('Resources'))
    removed += stripForms(doc, inner instanceof PDFDict ? inner : undefined, seen)
  }
  return removed
}

/**
 * Removes the visible text of one page. Returns false if the page's streams can't be decoded
 * (then the caller covers the old text instead). Shared Form XObjects are tracked in `seen`.
 */
export function stripPageText(doc: PDFDocument, page: PDFPage, seen: Set<string>): boolean {
  try {
    const node = page.node
    const contents = node.Contents()
    const parts: Uint8Array[] = []
    const items = contents instanceof PDFArray ? contents.asArray().map((r) => doc.context.lookup(r)) : contents ? [contents] : []
    for (const s of items) {
      const b = streamBytes(s)
      if (!b) return false
      parts.push(b, enc.encode('\n'))
    }
    const joined = new Uint8Array(parts.reduce((s, b) => s + b.length, 0))
    let o = 0
    for (const b of parts) { joined.set(b, o); o += b.length }
    const { out, removed } = stripTextOperators(joined)
    // Wrap in q … Q so content we add afterwards starts from a clean graphics state.
    const wrapped = new Uint8Array(out.length + 6)
    wrapped.set(enc.encode('q\n'), 0)
    wrapped.set(out, 2)
    wrapped.set(enc.encode('\nQ\n'), out.length + 2)
    node.set(PDFName.of('Contents'), doc.context.register(doc.context.flateStream(wrapped)))
    stripForms(doc, node.Resources(), seen)
    return removed >= 0
  } catch (e) {
    console.warn('Could not edit page content, falling back to covering text', e)
    return false
  }
}
