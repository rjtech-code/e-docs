import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { Document, Packer, Paragraph, TextRun } from 'docx'
import * as XLSX from 'xlsx'
import PptxGenJS from 'pptxgenjs'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const dir = path.dirname(fileURLToPath(import.meta.url))

async function makePdf(filename, pages) {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  for (const text of pages) {
    const page = doc.addPage([595, 842])
    page.drawText(text, { x: 50, y: 780, size: 18, font, color: rgb(0, 0, 0) })
    page.drawText('E-Docs automated test fixture. Lorem ipsum dolor sit amet.', { x: 50, y: 740, size: 12, font })
  }
  fs.writeFileSync(path.join(dir, filename), await doc.save())
  console.log('wrote', filename)
}

async function makeDocx(filename) {
  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({ children: [new TextRun({ text: 'E-Docs Word Fixture', bold: true, size: 32 })] }),
          new Paragraph('This is a test paragraph for Word to PDF conversion.'),
          new Paragraph('Second paragraph with more text to check layout.'),
        ],
      },
    ],
  })
  const buf = await Packer.toBuffer(doc)
  fs.writeFileSync(path.join(dir, filename), buf)
  console.log('wrote', filename)
}

function makeXlsx(filename) {
  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.aoa_to_sheet([
    ['Name', 'Score', 'Grade'],
    ['Asha', 91, 'A'],
    ['Ravi', 78, 'B'],
    ['Meera', 85, 'A'],
  ])
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1')
  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' })
  fs.writeFileSync(path.join(dir, filename), out)
  console.log('wrote', filename)
}

async function makePptx(filename) {
  const pptx = new PptxGenJS()
  const s1 = pptx.addSlide()
  s1.addText('E-Docs Slide Fixture', { x: 0.5, y: 0.5, fontSize: 28, bold: true })
  s1.addText('First bullet point', { x: 0.5, y: 1.5, fontSize: 16 })
  const s2 = pptx.addSlide()
  s2.addText('Second Slide', { x: 0.5, y: 0.5, fontSize: 24 })
  const buf = await pptx.write({ outputType: 'nodebuffer' })
  fs.writeFileSync(path.join(dir, filename), buf)
  console.log('wrote', filename)
}

function makePng(filename, w, h, colorHex) {
  // Minimal raw PNG encoder for a solid-color image (no external deps).
  const zlib = require('node:zlib')
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  function chunk(type, data) {
    const len = Buffer.alloc(4)
    len.writeUInt32BE(data.length)
    const typeData = Buffer.concat([Buffer.from(type), data])
    const crc = Buffer.alloc(4)
    crc.writeUInt32BE(crc32(typeData))
    return Buffer.concat([len, typeData, crc])
  }
  const crcTable = []
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    crcTable.push(c >>> 0)
  }
  function crc32(buf) {
    let c = 0xffffffff
    for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
    return (c ^ 0xffffffff) >>> 0
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0)
  ihdr.writeUInt32BE(h, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 2 // color type RGB
  const r = parseInt(colorHex.slice(0, 2), 16)
  const g = parseInt(colorHex.slice(2, 4), 16)
  const b = parseInt(colorHex.slice(4, 6), 16)
  const rowSize = 1 + w * 3
  const raw = Buffer.alloc(rowSize * h)
  for (let y = 0; y < h; y++) {
    raw[y * rowSize] = 0
    for (let x = 0; x < w; x++) {
      raw[y * rowSize + 1 + x * 3] = r
      raw[y * rowSize + 1 + x * 3 + 1] = g
      raw[y * rowSize + 1 + x * 3 + 2] = b
    }
  }
  const idat = zlib.deflateSync(raw)
  const png = Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))])
  fs.writeFileSync(path.join(dir, filename), png)
  console.log('wrote', filename)
}

const { createRequire } = await import('node:module')
globalThis.require = createRequire(import.meta.url)

await makePdf('sample-a.pdf', ['E-Docs Test PDF A - Page 1', 'E-Docs Test PDF A - Page 2', 'E-Docs Test PDF A - Page 3'])
await makePdf('sample-b.pdf', ['E-Docs Test PDF B - Different Content', 'Second page of PDF B'])
await makeDocx('sample.docx')
makeXlsx('sample.xlsx')
await makePptx('sample.pptx')
makePng('sample.png', 300, 200, 'e0116d')

console.log('All fixtures generated.')
