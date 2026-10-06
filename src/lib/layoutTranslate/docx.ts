// DOCX: translate the ORIGINAL document in place. Only the text inside existing runs (<w:t>)
// changes — paragraphs, headings, styles, numbering, tables, images, headers/footers, section
// and page setup are left byte-for-byte as they were.
import JSZip from 'jszip'
import type { Language } from '../translate'
import type { TextElement } from './types'
import { needsTranslation } from './segments'
import { NS, parseXml, serializeXml, kid, ensureChild, prependChild } from './xml'

const W = NS.w
const PARTS = /^word\/(document|header\d*|footer\d*|footnotes|endnotes)\.xml$/

// CT_RPr / CT_PPr child order (ECMA-376) — new elements must be inserted in sequence.
const RPR_ORDER = ['rStyle', 'rFonts', 'b', 'bCs', 'i', 'iCs', 'caps', 'smallCaps', 'strike', 'dstrike', 'outline', 'shadow', 'emboss', 'imprint', 'noProof', 'snapToGrid', 'vanish', 'webHidden', 'color', 'spacing', 'w', 'kern', 'position', 'sz', 'szCs', 'highlight', 'u', 'effect', 'bdr', 'shd', 'fitText', 'vertAlign', 'rtl', 'cs', 'em', 'lang', 'eastAsianLayout', 'specVanish', 'oMath', 'rPrChange']
const PPR_ORDER = ['pStyle', 'keepNext', 'keepLines', 'pageBreakBefore', 'framePr', 'widowControl', 'numPr', 'suppressLineNumbers', 'pBdr', 'shd', 'tabs', 'suppressAutoHyphens', 'kinsoku', 'wordWrap', 'overflowPunct', 'topLinePunct', 'autoSpaceDE', 'autoSpaceDN', 'bidi', 'adjustRightInd', 'snapToGrid', 'spacing', 'ind', 'contextualSpacing', 'mirrorIndents', 'suppressOverlap', 'jc', 'textDirection', 'textAlignment', 'textboxTightWrap', 'outlineLvl', 'divId', 'cnfStyle', 'rPr', 'sectPr', 'pPrChange']
const SKIP = new Set(['p', 'pPr', 'rPr', 'del', 'moveFrom', 'instrText', 'delText', 'delInstrText'])
const BREAKS = new Set(['tab', 'br', 'cr', 'ptab'])

/** A run of consecutive <w:t> nodes inside one paragraph, between tabs/line breaks. */
interface Group { p: Element; ts: Element[]; text: string }

function collectGroups(p: Element): Group[] {
  const groups: Group[] = []
  let cur: Element[] = []
  const flush = () => {
    if (cur.length) groups.push({ p, ts: cur, text: cur.map((t) => t.textContent ?? '').join('') })
    cur = []
  }
  const visit = (el: Element) => {
    for (let c = el.firstElementChild; c; c = c.nextElementSibling) {
      if (c.namespaceURI === W) {
        if (c.localName === 't') { cur.push(c); continue }
        if (BREAKS.has(c.localName)) { flush(); continue }
        if (SKIP.has(c.localName)) continue // nested paragraphs (text boxes) are handled on their own
      }
      visit(c)
    }
  }
  visit(p)
  flush()
  return groups
}

function boldItalic(run: Element | null) {
  const rPr = run ? kid(run, W, 'rPr') : undefined
  const on = (name: string) => {
    const el = rPr && kid(rPr, W, name)
    return !!el && !['0', 'false'].includes(el.getAttributeNS(W, 'val') ?? '')
  }
  const sz = rPr && kid(rPr, W, 'sz')?.getAttributeNS(W, 'val')
  return { bold: on('b'), italic: on('i'), fontSize: sz ? Number(sz) / 2 : undefined }
}

/** Make the run render the target script properly (complex-script font/size/bold, RTL). */
function prepareRun(run: Element, p: Element, lang: Language) {
  if (lang.code === 'en') return
  const rPr = kid(run, W, 'rPr') ?? prependChild(run, W, 'w', 'rPr')
  const fonts = ensureChild(rPr, W, 'w', 'rFonts', RPR_ORDER)
  if (!fonts.hasAttributeNS(W, 'cs')) fonts.setAttributeNS(W, 'w:cs', lang.docxFont)
  // Complex-script text uses the *Cs variants of size/bold/italic — mirror the Latin values.
  for (const [latin, cs] of [['sz', 'szCs'], ['b', 'bCs'], ['i', 'iCs']] as const) {
    const src = kid(rPr, W, latin)
    if (src && !kid(rPr, W, cs)) {
      const el = ensureChild(rPr, W, 'w', cs, RPR_ORDER)
      const v = src.getAttributeNS(W, 'val')
      if (v !== null) el.setAttributeNS(W, 'w:val', v)
    }
  }
  if (lang.rtl) {
    ensureChild(rPr, W, 'w', 'rtl', RPR_ORDER)
    const pPr = kid(p, W, 'pPr') ?? prependChild(p, W, 'w', 'pPr')
    ensureChild(pPr, W, 'w', 'bidi', PPR_ORDER)
  }
}

export async function analyzeDocx(bytes: ArrayBuffer, lang: Language) {
  const zip = await JSZip.loadAsync(bytes)
  const partNames = Object.keys(zip.files).filter((n) => PARTS.test(n)).sort((a, b) => (a === 'word/document.xml' ? -1 : b === 'word/document.xml' ? 1 : a.localeCompare(b)))
  if (!partNames.includes('word/document.xml')) throw new Error('This file is not a valid Word (.docx) document.')

  const docs = new Map<string, Document>()
  const elements: TextElement[] = []
  const groups: Group[] = []
  for (const name of partNames) {
    const doc = parseXml(await zip.file(name)!.async('string'))
    docs.set(name, doc)
    const paras = Array.from(doc.getElementsByTagNameNS(W, 'p'))
    paras.forEach((p, pi) => {
      collectGroups(p).forEach((g, gi) => {
        if (!needsTranslation(g.text)) return
        const run = g.ts[0].parentElement
        const style = kid(p, W, 'pPr') && kid(kid(p, W, 'pPr')!, W, 'pStyle')?.getAttributeNS(W, 'val')
        const jc = kid(p, W, 'pPr') && kid(kid(p, W, 'pPr')!, W, 'jc')?.getAttributeNS(W, 'val')
        elements.push({
          id: `${name}#p${pi}.${gi}`,
          page: 0,
          part: name,
          originalText: g.text,
          font: style || undefined,
          alignment: jc === 'center' ? 'center' : jc === 'right' || jc === 'end' ? 'right' : jc === 'both' ? 'justify' : 'left',
          ...boldItalic(run),
        })
        groups.push(g)
      })
    })
  }

  const rebuild = async (translations: string[]): Promise<Blob> => {
    const dirty = new Set<Document>()
    groups.forEach((g, i) => {
      const tr = translations[i]
      if (!tr) return
      dirty.add(g.p.ownerDocument)
      const lead = g.text.match(/^\s*/)![0]
      const trail = g.text.match(/\s*$/)![0]
      // Put the whole translation in the run that carried most of the text (keeps its formatting);
      // empty the other pieces — word order changes in translation, so text can't be split per run.
      let main = g.ts[0]
      for (const t of g.ts) if ((t.textContent ?? '').length > (main.textContent ?? '').length) main = t
      for (const t of g.ts) if (t !== main) t.textContent = ''
      main.textContent = lead + tr + trail
      main.setAttributeNS(NS.xml, 'xml:space', 'preserve')
      if (main.parentElement) prepareRun(main.parentElement, g.p, lang)
    })
    // Only parts whose text actually changed are rewritten; everything else stays byte-identical.
    for (const [name, doc] of docs) if (dirty.has(doc)) zip.file(name, serializeXml(doc))
    return zip.generateAsync({ type: 'blob', compression: 'DEFLATE', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })
  }

  return { elements, pages: 0, rebuild, shrunk: () => 0, overflow: () => 0 }
}
