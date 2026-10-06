// PPTX: translate the ORIGINAL presentation in place. Slides, sizes, backgrounds, shapes,
// images, tables, charts and every text box's position stay exactly as they were; only the
// text inside existing runs (<a:t>) changes. If a translation no longer fits its text box, the
// text is shrunk (never moved) so neighbouring elements aren't disturbed.
import JSZip from 'jszip'
import type { Language } from '../translate'
import type { TextElement } from './types'
import { needsTranslation } from './segments'
import { NS, parseXml, serializeXml, kid, kids, ensureChild, prependChild } from './xml'
import { measureContext, cssFont, wrapLines } from './fit'

const A = NS.a
const P = NS.p
const SLIDE = /^ppt\/slides\/slide(\d+)\.xml$/
const PARTS = /^ppt\/(slides\/slide\d+|charts\/chart\d+|diagrams\/(data|drawing)\d+)\.xml$/
const RPR_ORDER = ['ln', 'noFill', 'solidFill', 'gradFill', 'blipFill', 'pattFill', 'grpFill', 'effectLst', 'effectDag', 'highlight', 'uLnTx', 'uLn', 'uFillTx', 'uFill', 'latin', 'ea', 'cs', 'sym', 'hlinkClick', 'hlinkMouseOver', 'rtl', 'extLst']
const BODYPR_ORDER = ['prstTxWarp', 'noAutofit', 'normAutofit', 'spAutoFit', 'scene3d', 'sp3d', 'flatTx', 'extLst']
const EMU_PER_PT = 12700
const LATIN_FAMILY = 'Calibri, Carlito, Arial, sans-serif'
const LANG_TAG: Record<string, string> = { en: 'en-US', hi: 'hi-IN', mr: 'mr-IN', gu: 'gu-IN', bn: 'bn-IN', ta: 'ta-IN', te: 'te-IN', kn: 'kn-IN', ml: 'ml-IN', pa: 'pa-IN', ur: 'ur-PK' }

interface Group { p: Element; ts: Element[]; text: string }

function collectGroups(p: Element): Group[] {
  const groups: Group[] = []
  let cur: Element[] = []
  const flush = () => {
    if (cur.length) groups.push({ p, ts: cur, text: cur.map((t) => t.textContent ?? '').join('') })
    cur = []
  }
  for (let c = p.firstElementChild; c; c = c.nextElementSibling) {
    if (c.namespaceURI !== A) continue
    if (c.localName === 'r') { const t = kid(c, A, 't'); if (t) cur.push(t) }
    else if (c.localName === 'br' || c.localName === 'fld') flush() // keep line breaks / slide-number fields
  }
  flush()
  return groups
}

/** Visible text of a paragraph with line breaks, as drawn. */
function paragraphText(p: Element): string {
  let s = ''
  for (let c = p.firstElementChild; c; c = c.nextElementSibling) {
    if (c.namespaceURI !== A) continue
    if (c.localName === 'r' || c.localName === 'fld') s += kid(c, A, 't')?.textContent ?? ''
    else if (c.localName === 'br') s += '\n'
  }
  return s
}

function runSize(p: Element, fallback: number): number {
  for (const r of kids(p, A, 'r')) {
    const sz = kid(r, A, 'rPr')?.getAttribute('sz')
    if (sz) return Number(sz) / 100
  }
  const end = kid(p, A, 'endParaRPr')?.getAttribute('sz')
  return end ? Number(end) / 100 : fallback
}

/** Default size when the run doesn't say (inherited from the layout/master). */
function defaultSize(sp: Element): number {
  const ph = sp.getElementsByTagNameNS(P, 'ph')[0]
  if (!ph) return 18
  const type = ph.getAttribute('type') ?? 'body'
  return type === 'title' || type === 'ctrTitle' ? 44 : type === 'subTitle' ? 24 : type === 'body' || type === 'obj' ? 28 : 18
}

interface ShapeBox { sp: Element; body: Element; widthPt?: number; heightPt?: number; wrap: boolean; defSize: number; before: string[] }

function shapeBoxes(doc: Document): ShapeBox[] {
  const out: ShapeBox[] = []
  for (const sp of Array.from(doc.getElementsByTagNameNS(P, 'sp'))) {
    const body = kid(sp, P, 'txBody')
    if (!body) continue
    const bodyPr = kid(body, A, 'bodyPr')
    const ext = kid(sp, P, 'spPr') && kid(kid(sp, P, 'spPr')!, A, 'xfrm') && kid(kid(kid(sp, P, 'spPr')!, A, 'xfrm')!, A, 'ext')
    const ins = (name: string, def: number) => Number(bodyPr?.getAttribute(name) ?? def)
    const cx = ext ? Number(ext.getAttribute('cx')) : NaN
    const cy = ext ? Number(ext.getAttribute('cy')) : NaN
    out.push({
      sp,
      body,
      widthPt: Number.isFinite(cx) ? (cx - ins('lIns', 91440) - ins('rIns', 91440)) / EMU_PER_PT : undefined,
      heightPt: Number.isFinite(cy) ? (cy - ins('tIns', 45720) - ins('bIns', 45720)) / EMU_PER_PT : undefined,
      wrap: bodyPr?.getAttribute('wrap') !== 'none',
      defSize: defaultSize(sp),
      before: kids(body, A, 'p').map(paragraphText),
    })
  }
  return out
}

/** Height (pt) and widest line of a text body at `scale`, laid out like PowerPoint (≈1.2 line pitch). */
function measureBody(paras: { text: string; size: number }[], family: string, widthPt: number | undefined, wrap: boolean, scale: number) {
  const c = measureContext()
  let height = 0
  let widest = 0
  for (const { text, size } of paras) {
    const px = size * scale
    c.font = cssFont(px, family)
    const lines = wrap && widthPt ? wrapLines(c, text, widthPt) : text.split('\n')
    for (const l of lines) widest = Math.max(widest, c.measureText(l).width)
    height += Math.max(1, lines.length) * px * 1.2
  }
  return { height, widest }
}

export async function analyzePptx(bytes: ArrayBuffer, lang: Language) {
  const zip = await JSZip.loadAsync(bytes)
  const names = Object.keys(zip.files).filter((n) => PARTS.test(n))
  const slideNo = (n: string) => Number(SLIDE.exec(n)?.[1] ?? 0)
  names.sort((a, b) => (slideNo(a) || 1e6) - (slideNo(b) || 1e6) || a.localeCompare(b))
  const slideCount = names.filter((n) => SLIDE.test(n)).length
  if (slideCount === 0) throw new Error('This file is not a valid PowerPoint (.pptx) presentation.')

  const docs = new Map<string, Document>()
  const boxes = new Map<string, ShapeBox[]>()
  const elements: TextElement[] = []
  const groups: Group[] = []
  for (const name of names) {
    const doc = parseXml(await zip.file(name)!.async('string'))
    docs.set(name, doc)
    if (SLIDE.test(name)) boxes.set(name, shapeBoxes(doc))
    Array.from(doc.getElementsByTagNameNS(A, 'p')).forEach((p, pi) => {
      collectGroups(p).forEach((g, gi) => {
        if (!needsTranslation(g.text)) return
        const rPr = kid(g.ts[0].parentElement!, A, 'rPr')
        const algn = kid(p, A, 'pPr')?.getAttribute('algn')
        elements.push({
          id: `${name}#p${pi}.${gi}`,
          page: slideNo(name),
          part: name,
          originalText: g.text,
          fontSize: rPr?.getAttribute('sz') ? Number(rPr.getAttribute('sz')) / 100 : undefined,
          bold: rPr?.getAttribute('b') === '1',
          italic: rPr?.getAttribute('i') === '1',
          font: rPr && kid(rPr, A, 'latin')?.getAttribute('typeface') || undefined,
          alignment: algn === 'ctr' ? 'center' : algn === 'r' ? 'right' : algn === 'just' ? 'justify' : 'left',
        })
        groups.push(g)
      })
    })
  }

  let shrunk = 0
  let overflow = 0
  const family = lang.code === 'en' ? LATIN_FAMILY : `${lang.font}, ${LATIN_FAMILY}`

  const rebuild = async (translations: string[]): Promise<Blob> => {
    const dirty = new Set<Document>()
    groups.forEach((g, i) => {
      const tr = translations[i]
      if (!tr) return
      dirty.add(g.p.ownerDocument)
      const lead = g.text.match(/^\s*/)![0]
      const trail = g.text.match(/\s*$/)![0]
      let main = g.ts[0]
      for (const t of g.ts) if ((t.textContent ?? '').length > (main.textContent ?? '').length) main = t
      for (const t of g.ts) if (t !== main) t.textContent = ''
      main.textContent = lead + tr + trail
      const run = main.parentElement!
      const rPr = kid(run, A, 'rPr') ?? prependChild(run, A, 'a', 'rPr')
      if (LANG_TAG[lang.code]) rPr.setAttribute('lang', LANG_TAG[lang.code])
      if (lang.code !== 'en') ensureChild(rPr, A, 'a', 'cs', RPR_ORDER).setAttribute('typeface', lang.docxFont)
      if (lang.rtl) {
        const pPr = kid(g.p, A, 'pPr') ?? prependChild(g.p, A, 'a', 'pPr')
        pPr.setAttribute('rtl', '1')
      }
    })

    // Layout validation: keep every translated text inside its original text box.
    for (const list of boxes.values()) {
      for (const box of list) {
        const paras = kids(box.body, A, 'p')
        const after = paras.map(paragraphText)
        if (after.join('\n') === box.before.join('\n')) continue
        const bodyPr = kid(box.body, A, 'bodyPr')
        if (bodyPr && kid(bodyPr, A, 'spAutoFit')) continue // shape grows with its text by design
        const sizes = paras.map((p) => runSize(p, box.defSize))
        const orig = measureBody(box.before.map((text, i) => ({ text, size: sizes[i] })), LATIN_FAMILY, box.widthPt, box.wrap, 1)
        const fits = (s: number) => {
          const m = measureBody(after.map((text, i) => ({ text, size: sizes[i] })), family, box.widthPt, box.wrap, s)
          if (box.heightPt !== undefined && box.widthPt !== undefined) {
            return box.wrap ? m.height <= Math.max(box.heightPt, orig.height) + 0.5 : m.widest <= Math.max(box.widthPt, orig.widest) + 0.5
          }
          // Size inherited from the layout: compare with how much room the original text used.
          return m.widest * Math.max(1, m.height / Math.max(1, orig.height)) <= orig.widest * 1.15 + 1
        }
        if (fits(1)) continue
        let scale = 1
        while (scale > 0.62 && !fits(scale)) scale -= 0.04
        scale = Math.max(0.6, Math.round(scale * 100) / 100)
        shrunk++
        if (!fits(scale)) overflow++

        const runs = paras.flatMap((p) => kids(p, A, 'r'))
        const allSized = runs.length > 0 && runs.every((r) => kid(r, A, 'rPr')?.hasAttribute('sz'))
        if (allSized) {
          // Explicit sizes → scale them directly (honoured by every app).
          for (const el of Array.from(box.body.getElementsByTagNameNS(A, '*')).filter((e) => (e.localName === 'rPr' || e.localName === 'endParaRPr') && e.hasAttribute('sz'))) {
            el.setAttribute('sz', String(Math.max(100, Math.round((Number(el.getAttribute('sz')) * scale) / 50) * 50)))
          }
        } else if (bodyPr) {
          // Inherited sizes → PowerPoint's own "shrink text on overflow" with the computed scale.
          for (const name of ['noAutofit', 'normAutofit']) kid(bodyPr, A, name)?.remove()
          const fit = ensureChild(bodyPr, A, 'a', 'normAutofit', BODYPR_ORDER)
          fit.setAttribute('fontScale', String(Math.round(scale * 100000)))
          if (scale < 0.85) fit.setAttribute('lnSpcReduction', '10000')
        }
      }
    }

    // Only parts whose text actually changed are rewritten; everything else stays byte-identical.
    for (const [name, doc] of docs) if (dirty.has(doc)) zip.file(name, serializeXml(doc))
    return zip.generateAsync({ type: 'blob', compression: 'DEFLATE', mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' })
  }

  return { elements, pages: slideCount, rebuild, shrunk: () => shrunk, overflow: () => overflow }
}
