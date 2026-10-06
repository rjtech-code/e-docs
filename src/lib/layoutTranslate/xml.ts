// Small DOM helpers for editing OOXML (DOCX/PPTX) in place without breaking schema order.

export const NS = {
  w: 'http://schemas.openxmlformats.org/wordprocessingml/2006/main',
  a: 'http://schemas.openxmlformats.org/drawingml/2006/main',
  p: 'http://schemas.openxmlformats.org/presentationml/2006/main',
  xml: 'http://www.w3.org/XML/1998/namespace',
}

export function parseXml(text: string): Document {
  const doc = new DOMParser().parseFromString(text, 'application/xml')
  if (doc.getElementsByTagName('parsererror').length) throw new Error('Could not read the document structure (invalid XML).')
  return doc
}

export const serializeXml = (doc: Document) => {
  const out = new XMLSerializer().serializeToString(doc)
  return out.startsWith('<?xml') ? out : `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n${out}`
}

/** Direct children with the given namespace + local name. */
export function kids(el: Element, ns: string, local: string): Element[] {
  const out: Element[] = []
  for (let c = el.firstElementChild; c; c = c.nextElementSibling) if (c.namespaceURI === ns && c.localName === local) out.push(c)
  return out
}
export const kid = (el: Element, ns: string, local: string) => kids(el, ns, local)[0] as Element | undefined

/**
 * Returns the child `local`, creating it if needed and inserting it at the position the schema
 * requires (`order` lists the sequence's local names). Office apps reject out-of-order children.
 */
export function ensureChild(parent: Element, ns: string, prefix: string, local: string, order: string[]): Element {
  const existing = kid(parent, ns, local)
  if (existing) return existing
  const el = parent.ownerDocument.createElementNS(ns, `${prefix}:${local}`)
  const rank = order.indexOf(local)
  let before: Element | null = null
  for (let c = parent.firstElementChild; c; c = c.nextElementSibling) {
    const r = c.namespaceURI === ns ? order.indexOf(c.localName) : -1
    if ((r !== -1 && r > rank) || c.localName === 'extLst') { before = c; break }
  }
  parent.insertBefore(el, before)
  return el
}

/** Creates `prefix:local` as the FIRST child (e.g. rPr inside a run). */
export function prependChild(parent: Element, ns: string, prefix: string, local: string): Element {
  const el = parent.ownerDocument.createElementNS(ns, `${prefix}:${local}`)
  parent.insertBefore(el, parent.firstElementChild)
  return el
}
