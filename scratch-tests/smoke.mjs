import { chromium } from 'playwright'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

const dir = path.dirname(fileURLToPath(import.meta.url))
const out = path.join(dir, 'downloads')
fs.mkdirSync(out, { recursive: true })

const BASE = 'http://localhost:5173'
const results = []

function record(name, ok, detail) {
  results.push({ name, ok, detail })
  console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ' — ' + detail : ''}`)
}

async function withPage(browser, fn) {
  const context = await browser.newContext({ acceptDownloads: true })
  const page = await context.newPage()
  page.on('console', (msg) => {
    if (msg.type() === 'error') console.log('  [console.error]', msg.text())
  })
  page.on('pageerror', (err) => console.log('  [pageerror]', err.message))
  try {
    await fn(page)
  } finally {
    await context.close()
  }
}

// Every tool is a two-step flow: click the action button, wait for processing to finish
// (the "Download" card appears), then click Download and capture the actual file.
async function clickThenDownload(page, actionButtonName, downloadName, processTimeout = 60000) {
  await page.getByRole('button', { name: actionButtonName }).click()
  const downloadBtn = page.getByRole('button', { name: 'Download', exact: true })
  await downloadBtn.waitFor({ timeout: processTimeout })
  const [download] = await Promise.all([page.waitForEvent('download', { timeout: 15000 }), downloadBtn.click()])
  const savePath = path.join(out, downloadName)
  await download.saveAs(savePath)
  return savePath
}

async function uploadAndClick(page, url, fileInputSelector, files, buttonText, downloadName, processTimeout = 60000) {
  await page.goto(`${BASE}${url}`, { waitUntil: 'networkidle' })
  await page.setInputFiles(fileInputSelector, files)
  return clickThenDownload(page, buttonText, downloadName, processTimeout)
}

function assertPdfHeader(filePath) {
  const buf = fs.readFileSync(filePath)
  return buf.subarray(0, 5).toString('latin1') === '%PDF-'
}
function assertZipHeader(filePath) {
  const buf = fs.readFileSync(filePath)
  return buf[0] === 0x50 && buf[1] === 0x4b
}
function fileSize(filePath) {
  return fs.statSync(filePath).size
}

const pdfA = path.join(dir, 'sample-a.pdf')
const pdfB = path.join(dir, 'sample-b.pdf')
const docx = path.join(dir, 'sample.docx')
const xlsx = path.join(dir, 'sample.xlsx')
const pptx = path.join(dir, 'sample.pptx')
const png = path.join(dir, 'sample.png')

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })

// ---------- Home & navigation ----------
await withPage(browser, async (page) => {
  await page.goto(BASE, { waitUntil: 'networkidle' })
  const title = await page.title()
  const heading = await page.getByRole('heading', { level: 1 }).first().textContent()
  record('Home page loads', title.includes('E-Docs') && !!heading, `title="${title}"`)

  await page.goto(`${BASE}/all-tools`, { waitUntil: 'networkidle' })
  const cardCount = await page.locator('a[href^="/"]').count()
  record('All Tools page lists tools', cardCount > 20, `found ${cardCount} links`)
})

// ---------- Merge PDF ----------
await withPage(browser, async (page) => {
  try {
    const p = await uploadAndClick(page, '/merge-pdf', 'input[type=file]', [pdfA, pdfB], /Merge \d+ PDFs/, 'merged.pdf')
    record('Merge PDF', assertPdfHeader(p), `size=${fileSize(p)}`)
  } catch (e) {
    record('Merge PDF', false, e.message)
  }
})

// ---------- Split PDF ----------
await withPage(browser, async (page) => {
  try {
    await page.goto(`${BASE}/split-pdf`, { waitUntil: 'networkidle' })
    await page.setInputFiles('input[type=file]', pdfA)
    await page.getByText('Extract every page').click()
    const p = await clickThenDownload(page, 'Split PDF', 'split.zip')
    record('Split PDF (extract every page)', assertZipHeader(p), `size=${fileSize(p)}`)
  } catch (e) {
    record('Split PDF', false, e.message)
  }
})

// ---------- Compress PDF ----------
await withPage(browser, async (page) => {
  try {
    const p = await uploadAndClick(page, '/compress-pdf', 'input[type=file]', pdfA, 'Compress PDF', 'compressed.pdf')
    record('Compress PDF', assertPdfHeader(p), `size=${fileSize(p)}`)
  } catch (e) {
    record('Compress PDF', false, e.message)
  }
})

// ---------- Rotate PDF ----------
await withPage(browser, async (page) => {
  try {
    const p = await uploadAndClick(page, '/rotate-pdf', 'input[type=file]', pdfA, 'Rotate PDF', 'rotated.pdf')
    record('Rotate PDF', assertPdfHeader(p), `size=${fileSize(p)}`)
  } catch (e) {
    record('Rotate PDF', false, e.message)
  }
})

// ---------- Watermark PDF ----------
await withPage(browser, async (page) => {
  try {
    const p = await uploadAndClick(page, '/watermark-pdf', 'input[type=file]', pdfA, 'Add Watermark', 'watermarked.pdf')
    record('Watermark PDF', assertPdfHeader(p), `size=${fileSize(p)}`)
  } catch (e) {
    record('Watermark PDF', false, e.message)
  }
})

// ---------- Page Numbers ----------
await withPage(browser, async (page) => {
  try {
    const p = await uploadAndClick(page, '/page-numbers', 'input[type=file]', pdfA, 'Add Page Numbers', 'numbered.pdf')
    record('Page Numbers', assertPdfHeader(p), `size=${fileSize(p)}`)
  } catch (e) {
    record('Page Numbers', false, e.message)
  }
})

// ---------- Crop PDF ----------
await withPage(browser, async (page) => {
  try {
    const p = await uploadAndClick(page, '/crop-pdf', 'input[type=file]', pdfA, 'Crop PDF', 'cropped.pdf')
    record('Crop PDF', assertPdfHeader(p), `size=${fileSize(p)}`)
  } catch (e) {
    record('Crop PDF', false, e.message)
  }
})

// ---------- Repair PDF ----------
await withPage(browser, async (page) => {
  try {
    const p = await uploadAndClick(page, '/repair-pdf', 'input[type=file]', pdfA, 'Repair PDF', 'repaired.pdf')
    record('Repair PDF', assertPdfHeader(p), `size=${fileSize(p)}`)
  } catch (e) {
    record('Repair PDF', false, e.message)
  }
})

// ---------- PDF to PDF/A ----------
await withPage(browser, async (page) => {
  try {
    const p = await uploadAndClick(page, '/pdf-to-pdfa', 'input[type=file]', pdfA, 'Convert to PDF/A', 'pdfa.pdf')
    record('PDF to PDF/A', assertPdfHeader(p), `size=${fileSize(p)}`)
  } catch (e) {
    record('PDF to PDF/A', false, e.message)
  }
})

// ---------- PDF to JPG ----------
await withPage(browser, async (page) => {
  try {
    const p = await uploadAndClick(page, '/pdf-to-jpg', 'input[type=file]', pdfA, 'Convert to JPG', 'topng.zip')
    record('PDF to JPG', assertZipHeader(p), `size=${fileSize(p)}`)
  } catch (e) {
    record('PDF to JPG', false, e.message)
  }
})

// ---------- JPG to PDF ----------
await withPage(browser, async (page) => {
  try {
    const p = await uploadAndClick(page, '/jpg-to-pdf', 'input[type=file]', png, 'Convert to PDF', 'fromimg.pdf')
    record('JPG to PDF', assertPdfHeader(p), `size=${fileSize(p)}`)
  } catch (e) {
    record('JPG to PDF', false, e.message)
  }
})

// ---------- Scan to PDF ----------
await withPage(browser, async (page) => {
  try {
    await page.goto(`${BASE}/scan-to-pdf`, { waitUntil: 'networkidle' })
    const inputs = await page.locator('input[type=file]').all()
    await inputs[1].setInputFiles(png) // gallery input
    const p = await clickThenDownload(page, /Create PDF/, 'scan.pdf')
    record('Scan to PDF', assertPdfHeader(p), `size=${fileSize(p)}`)
  } catch (e) {
    record('Scan to PDF', false, e.message)
  }
})

// ---------- PDF to Word ----------
await withPage(browser, async (page) => {
  try {
    const p = await uploadAndClick(page, '/pdf-to-word', 'input[type=file]', pdfA, 'Convert to Word', 'out.docx')
    record('PDF to Word', assertZipHeader(p), `size=${fileSize(p)}`) // docx is a zip container
  } catch (e) {
    record('PDF to Word', false, e.message)
  }
})

// ---------- Word to PDF ----------
await withPage(browser, async (page) => {
  try {
    const p = await uploadAndClick(page, '/word-to-pdf', 'input[type=file]', docx, 'Convert to PDF', 'fromword.pdf')
    record('Word to PDF', assertPdfHeader(p), `size=${fileSize(p)}`)
  } catch (e) {
    record('Word to PDF', false, e.message)
  }
})

// ---------- PDF to Excel ----------
await withPage(browser, async (page) => {
  try {
    const p = await uploadAndClick(page, '/pdf-to-excel', 'input[type=file]', pdfA, 'Convert to Excel', 'out.xlsx')
    record('PDF to Excel', assertZipHeader(p), `size=${fileSize(p)}`)
  } catch (e) {
    record('PDF to Excel', false, e.message)
  }
})

// ---------- Excel to PDF ----------
await withPage(browser, async (page) => {
  try {
    const p = await uploadAndClick(page, '/excel-to-pdf', 'input[type=file]', xlsx, 'Convert to PDF', 'fromexcel.pdf')
    record('Excel to PDF', assertPdfHeader(p), `size=${fileSize(p)}`)
  } catch (e) {
    record('Excel to PDF', false, e.message)
  }
})

// ---------- PDF to PowerPoint ----------
await withPage(browser, async (page) => {
  try {
    const p = await uploadAndClick(page, '/pdf-to-powerpoint', 'input[type=file]', pdfA, 'Convert to PowerPoint', 'out.pptx')
    record('PDF to PowerPoint', assertZipHeader(p), `size=${fileSize(p)}`)
  } catch (e) {
    record('PDF to PowerPoint', false, e.message)
  }
})

// ---------- PowerPoint to PDF ----------
await withPage(browser, async (page) => {
  try {
    const p = await uploadAndClick(page, '/powerpoint-to-pdf', 'input[type=file]', pptx, 'Convert to PDF', 'fromppt.pdf')
    record('PowerPoint to PDF', assertPdfHeader(p), `size=${fileSize(p)}`)
  } catch (e) {
    record('PowerPoint to PDF', false, e.message)
  }
})

// ---------- HTML to PDF ----------
await withPage(browser, async (page) => {
  try {
    await page.goto(`${BASE}/html-to-pdf`, { waitUntil: 'networkidle' })
    const p = await clickThenDownload(page, 'Convert to PDF', 'html.pdf')
    record('HTML to PDF', assertPdfHeader(p), `size=${fileSize(p)}`)
  } catch (e) {
    record('HTML to PDF', false, e.message)
  }
})

// ---------- Organize PDF ----------
await withPage(browser, async (page) => {
  try {
    await page.goto(`${BASE}/organize-pdf`, { waitUntil: 'networkidle' })
    await page.setInputFiles('input[type=file]', pdfA)
    await page.waitForSelector('img[alt^="Page"]', { timeout: 30000 })
    const p = await clickThenDownload(page, 'Save PDF', 'organized.pdf')
    record('Organize PDF', assertPdfHeader(p), `size=${fileSize(p)}`)
  } catch (e) {
    record('Organize PDF', false, e.message)
  }
})

// ---------- Edit PDF ----------
await withPage(browser, async (page) => {
  try {
    page.on('dialog', (d) => d.accept('Hello E-Docs'))
    await page.goto(`${BASE}/edit-pdf`, { waitUntil: 'networkidle' })
    await page.setInputFiles('input[type=file]', pdfA)
    const img = page.locator('img[alt^="Page"]')
    await img.waitFor({ timeout: 30000 })
    await img.click({ position: { x: 50, y: 50 } })
    const p = await clickThenDownload(page, 'Save PDF', 'edited.pdf')
    record('Edit PDF', assertPdfHeader(p), `size=${fileSize(p)}`)
  } catch (e) {
    record('Edit PDF', false, e.message)
  }
})

// ---------- Sign PDF ----------
await withPage(browser, async (page) => {
  try {
    await page.goto(`${BASE}/sign-pdf`, { waitUntil: 'networkidle' })
    await page.setInputFiles('input[type=file]', pdfA)
    const canvas = page.locator('canvas')
    await canvas.waitFor({ timeout: 30000 })
    const box = await canvas.boundingBox()
    await page.mouse.move(box.x + 20, box.y + 20)
    await page.mouse.down()
    await page.mouse.move(box.x + 150, box.y + 80, { steps: 10 })
    await page.mouse.up()
    await page.getByRole('button', { name: 'Use signature' }).click()
    const img = page.locator('img[alt^="Page"]')
    await img.waitFor()
    await img.click({ position: { x: 100, y: 300 } })
    const p = await clickThenDownload(page, 'Sign PDF', 'signed.pdf')
    record('Sign PDF', assertPdfHeader(p), `size=${fileSize(p)}`)
  } catch (e) {
    record('Sign PDF', false, e.message)
  }
})

// ---------- Redact PDF ----------
await withPage(browser, async (page) => {
  try {
    await page.goto(`${BASE}/redact-pdf`, { waitUntil: 'networkidle' })
    await page.setInputFiles('input[type=file]', pdfA)
    const img = page.locator('img[alt^="Page"]')
    await img.waitFor({ timeout: 30000 })
    const box = await img.boundingBox()
    await page.mouse.move(box.x + 30, box.y + 30)
    await page.mouse.down()
    await page.mouse.move(box.x + 200, box.y + 80, { steps: 10 })
    await page.mouse.up()
    const p = await clickThenDownload(page, 'Apply Redactions', 'redacted.pdf')
    record('Redact PDF', assertPdfHeader(p), `size=${fileSize(p)}`)
  } catch (e) {
    record('Redact PDF', false, e.message)
  }
})

// ---------- Compare PDF ----------
await withPage(browser, async (page) => {
  try {
    await page.goto(`${BASE}/compare-pdf`, { waitUntil: 'networkidle' })
    const inputs = await page.locator('input[type=file]').all()
    await inputs[0].setInputFiles(pdfA)
    await inputs[1].setInputFiles(pdfB)
    await page.getByRole('button', { name: 'Compare PDFs' }).click()
    await page.waitForSelector('text=added', { timeout: 30000 })
    const text = await page.locator('body').textContent()
    record('Compare PDF', text.includes('added') && text.includes('removed'), 'diff rendered')
  } catch (e) {
    record('Compare PDF', false, e.message)
  }
})

// ---------- Protect PDF -> Unlock PDF round trip ----------
let protectedPdfPath = null
await withPage(browser, async (page) => {
  try {
    await page.goto(`${BASE}/protect-pdf`, { waitUntil: 'networkidle' })
    await page.setInputFiles('input[type=file]', pdfA)
    await page.locator('input[type=password]').first().fill('test1234')
    await page.locator('input[type=password]').nth(1).fill('test1234')
    const p = await clickThenDownload(page, 'Protect PDF', 'protected.pdf')
    protectedPdfPath = p
    record('Protect PDF', assertPdfHeader(p), `size=${fileSize(p)}`)
  } catch (e) {
    record('Protect PDF', false, e.message)
  }
})

await withPage(browser, async (page) => {
  try {
    if (!protectedPdfPath) throw new Error('no protected pdf from previous step')
    await page.goto(`${BASE}/unlock-pdf`, { waitUntil: 'networkidle' })
    await page.setInputFiles('input[type=file]', protectedPdfPath)
    await page.locator('input[type=password]').fill('test1234')
    const p = await clickThenDownload(page, 'Unlock PDF', 'unlocked.pdf')
    record('Unlock PDF (correct password)', assertPdfHeader(p), `size=${fileSize(p)}`)
  } catch (e) {
    record('Unlock PDF (correct password)', false, e.message)
  }
})

// ---------- Unlock PDF with WRONG password should show error, not download ----------
await withPage(browser, async (page) => {
  try {
    if (!protectedPdfPath) throw new Error('no protected pdf from previous step')
    await page.goto(`${BASE}/unlock-pdf`, { waitUntil: 'networkidle' })
    await page.setInputFiles('input[type=file]', protectedPdfPath)
    await page.locator('input[type=password]').fill('wrongpassword')
    await page.getByRole('button', { name: 'Unlock PDF' }).click()
    await page.waitForSelector('text=Incorrect password', { timeout: 15000 })
    record('Unlock PDF (wrong password rejected)', true)
  } catch (e) {
    record('Unlock PDF (wrong password rejected)', false, e.message)
  }
})

// ---------- OCR PDF (network-dependent, generous timeout) ----------
await withPage(browser, async (page) => {
  try {
    await page.goto(`${BASE}/ocr-pdf`, { waitUntil: 'networkidle' })
    await page.setInputFiles('input[type=file]', pdfA)
    const p = await clickThenDownload(page, 'Run OCR', 'ocr.pdf', 180000)
    record('OCR PDF', assertPdfHeader(p), `size=${fileSize(p)}`)
  } catch (e) {
    record('OCR PDF', false, e.message)
  }
})

await browser.close()

console.log('\n--- SUMMARY ---')
const passed = results.filter((r) => r.ok).length
console.log(`${passed}/${results.length} checks passed`)
const failed = results.filter((r) => !r.ok)
if (failed.length) {
  console.log('FAILED:')
  failed.forEach((f) => console.log(' -', f.name, f.detail))
  process.exitCode = 1
}
