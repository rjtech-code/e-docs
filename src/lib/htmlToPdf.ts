import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

// Renders HTML to a PDF by walking the parsed DOM and drawing real text/table content with
// jsPDF directly — deliberately avoiding jsPDF's html()/html2canvas path, which re-parents
// content into the live document and chokes on modern CSS color functions (oklch(),
// color-mix()) that Tailwind v4 uses throughout this app's stylesheet.

const PAGE_WIDTH = 595.28 // A4 pt
const PAGE_HEIGHT = 841.89
const MARGIN = 50
const MAX_WIDTH = PAGE_WIDTH - MARGIN * 2

export interface HtmlToPdfOpts {
  title?: string
}

export function renderHtmlToPdfBlob(html: string, _opts: HtmlToPdfOpts = {}): Blob {
  const dom = new DOMParser().parseFromString(html, 'text/html')
  const pdf = new jsPDF({ unit: 'pt', format: 'a4' })
  let y = MARGIN

  const ensureSpace = (needed: number) => {
    if (y + needed > PAGE_HEIGHT - MARGIN) {
      pdf.addPage()
      y = MARGIN
    }
  }

  const addText = (text: string, size: number, bold: boolean, gapAfter = 6) => {
    const clean = text.replace(/\s+/g, ' ').trim()
    if (!clean) return
    pdf.setFont('helvetica', bold ? 'bold' : 'normal')
    pdf.setFontSize(size)
    pdf.setTextColor(26, 26, 26)
    const lines: string[] = pdf.splitTextToSize(clean, MAX_WIDTH)
    for (const line of lines) {
      ensureSpace(size * 1.4)
      pdf.text(line, MARGIN, y)
      y += size * 1.3
    }
    y += gapAfter
  }

  const renderTable = (table: HTMLTableElement) => {
    const rows = Array.from(table.rows).map((r) => Array.from(r.cells).map((c) => c.textContent?.trim() ?? ''))
    if (rows.length === 0) return
    autoTable(pdf, {
      startY: y,
      head: [rows[0]],
      body: rows.slice(1),
      margin: { left: MARGIN, right: MARGIN },
      styles: { fontSize: 9, textColor: [26, 26, 26] },
      headStyles: { fillColor: [224, 17, 109], textColor: [255, 255, 255] },
      didDrawPage: () => {
        y = MARGIN
      },
    })
    // @ts-expect-error - lastAutoTable is attached to the jsPDF instance by the plugin
    y = (pdf.lastAutoTable?.finalY ?? y) + 14
  }

  const walk = (node: Node) => {
    if (!(node instanceof HTMLElement)) return
    switch (node.tagName.toLowerCase()) {
      case 'h1':
        addText(node.textContent || '', 22, true, 10)
        break
      case 'h2':
        addText(node.textContent || '', 18, true, 9)
        break
      case 'h3':
        addText(node.textContent || '', 15, true, 8)
        break
      case 'h4':
      case 'h5':
      case 'h6':
        addText(node.textContent || '', 13, true, 7)
        break
      case 'li':
        addText(`•  ${node.textContent || ''}`, 11, false, 4)
        break
      case 'table':
        renderTable(node as HTMLTableElement)
        break
      case 'br':
        y += 10
        break
      case 'hr':
        ensureSpace(14)
        pdf.setDrawColor(220, 220, 220)
        pdf.line(MARGIN, y, PAGE_WIDTH - MARGIN, y)
        y += 14
        break
      case 'p':
      case 'div':
        if (node.querySelector('table, ul, ol, h1, h2, h3, h4, h5, h6, p, div')) {
          Array.from(node.childNodes).forEach(walk)
        } else {
          addText(node.textContent || '', 11, false, 8)
        }
        break
      default:
        Array.from(node.childNodes).forEach(walk)
    }
  }

  Array.from(dom.body.childNodes).forEach(walk)
  if (y === MARGIN) addText(' ', 11, false, 0) // never return a fully blank PDF
  return pdf.output('blob')
}
