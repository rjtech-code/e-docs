import { chromium } from 'playwright'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { FRONTEND_URL } from '../backend/urls.config.js'

const dir = path.dirname(fileURLToPath(import.meta.url))
const BASE = FRONTEND_URL
const results = []
const email = `hist-${Date.now()}@example.com`
const password = 'password123'

function record(name, ok, detail) {
  results.push({ name, ok, detail })
  console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ' — ' + detail : ''}`)
}

const pdfA = path.join(dir, 'sample-a.pdf') // 3 pages
const pdfB = path.join(dir, 'sample-b.pdf') // 2 pages

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const context = await browser.newContext({ acceptDownloads: true })
const page = await context.newPage()
page.on('pageerror', (err) => console.log('  [pageerror]', err.message))

// Sign up a fresh user for this run.
await page.goto(`${BASE}/signup`, { waitUntil: 'networkidle' })
await page.locator('input:not([type])').first().fill('History Tester')
await page.locator('input[type=email]').fill(email)
await page.locator('#password').fill(password)
await page.locator('#confirm').fill(password)
await Promise.all([page.waitForURL('**/home'), page.getByRole('button', { name: 'Create account' }).click()])

async function expectHistoryAfter(toolPath, action, expectedSubstring, label) {
  try {
    await page.goto(`${BASE}${toolPath}`, { waitUntil: 'networkidle' })
    await action()
    await page.waitForTimeout(1000)
    await page.reload({ waitUntil: 'networkidle' })
    await page.waitForSelector('text=Your recent files with this tool', { timeout: 10000 })
    const text = await page.locator('body').textContent()
    record(label, text.includes(expectedSubstring), `looked for "${expectedSubstring}"`)
  } catch (e) {
    record(label, false, e.message)
  }
}

// Compress PDF — "low" branch
await expectHistoryAfter(
  '/compress-pdf',
  async () => {
    await page.setInputFiles('input[type=file]', pdfA)
    await page.getByText('Low compression').click()
    await page.getByRole('button', { name: 'Compress PDF' }).click()
    await page.getByRole('button', { name: 'Download', exact: true }).first().waitFor({ timeout: 20000 })
  },
  'sample-a-compressed.pdf',
  'Compress PDF (low branch) saves history',
)

// Compress PDF — "extreme" (rasterize) branch
await expectHistoryAfter(
  '/compress-pdf',
  async () => {
    await page.setInputFiles('input[type=file]', pdfA)
    await page.getByText('Extreme compression').click()
    await page.getByRole('button', { name: 'Compress PDF' }).click()
    await page.getByRole('button', { name: 'Download', exact: true }).first().waitFor({ timeout: 30000 })
  },
  'sample-a-compressed.pdf',
  'Compress PDF (extreme branch) saves history',
)

// Split PDF — single-range branch (produces one .pdf, not a zip)
await expectHistoryAfter(
  '/split-pdf',
  async () => {
    await page.setInputFiles('input[type=file]', pdfA)
    await page.getByRole('button', { name: 'Split PDF' }).click()
    await page.getByRole('button', { name: 'Download', exact: true }).first().waitFor({ timeout: 20000 })
  },
  'sample-a-split.pdf',
  'Split PDF (single range) saves history',
)

// Split PDF — "extract every page" branch (produces a .zip)
await expectHistoryAfter(
  '/split-pdf',
  async () => {
    await page.setInputFiles('input[type=file]', pdfA)
    await page.getByText('Extract every page').click()
    await page.getByRole('button', { name: 'Split PDF' }).click()
    await page.getByRole('button', { name: 'Download', exact: true }).first().waitFor({ timeout: 20000 })
  },
  'sample-a-split.zip',
  'Split PDF (extract every page / zip) saves history',
)

// PDF to JPG — multi-page zip branch
await expectHistoryAfter(
  '/pdf-to-jpg',
  async () => {
    await page.setInputFiles('input[type=file]', pdfA)
    await page.getByRole('button', { name: 'Convert to JPG' }).click()
    await page.getByRole('button', { name: 'Download', exact: true }).first().waitFor({ timeout: 30000 })
  },
  'sample-a-images.zip',
  'PDF to JPG (multi-page zip) saves history',
)

// PDF to JPG — single-page branch
await expectHistoryAfter(
  '/pdf-to-jpg',
  async () => {
    await page.setInputFiles('input[type=file]', path.join(dir, 'sample-single.pdf'))
    await page.getByRole('button', { name: 'Convert to JPG' }).click()
    await page.getByRole('button', { name: 'Download', exact: true }).first().waitFor({ timeout: 30000 })
  },
  'sample-single.jpg',
  'PDF to JPG (single page) saves history',
)

// Protect PDF
await expectHistoryAfter(
  '/protect-pdf',
  async () => {
    await page.setInputFiles('input[type=file]', pdfA)
    await page.locator('input[type=password]').first().fill('secret123')
    await page.locator('input[type=password]').nth(1).fill('secret123')
    await page.getByRole('button', { name: 'Protect PDF' }).click()
    await page.getByRole('button', { name: 'Download', exact: true }).first().waitFor({ timeout: 20000 })
  },
  'sample-a-protected.pdf',
  'Protect PDF saves history',
)

// Organize PDF (multi-stage UI)
await expectHistoryAfter(
  '/organize-pdf',
  async () => {
    await page.setInputFiles('input[type=file]', pdfA)
    await page.waitForSelector('img[alt^="Page"]', { timeout: 20000 })
    await page.getByRole('button', { name: 'Save PDF' }).click()
    await page.getByRole('button', { name: 'Download', exact: true }).first().waitFor({ timeout: 20000 })
  },
  'sample-a-organized.pdf',
  'Organize PDF saves history',
)

// Edit PDF (multi-stage UI + window.prompt)
page.on('dialog', (d) => d.accept('Automated test text'))
await expectHistoryAfter(
  '/edit-pdf',
  async () => {
    await page.setInputFiles('input[type=file]', pdfA)
    const img = page.locator('img[alt^="Page"]')
    await img.waitFor({ timeout: 20000 })
    await img.click({ position: { x: 50, y: 50 } })
    await page.getByRole('button', { name: 'Save PDF' }).click()
    await page.getByRole('button', { name: 'Download', exact: true }).first().waitFor({ timeout: 20000 })
  },
  'sample-a-edited.pdf',
  'Edit PDF saves history',
)

// Scan to PDF
await expectHistoryAfter(
  '/scan-to-pdf',
  async () => {
    const inputs = await page.locator('input[type=file]').all()
    await inputs[1].setInputFiles(path.join(dir, 'sample.png'))
    await page.getByRole('button', { name: /Create PDF/ }).click()
    await page.getByRole('button', { name: 'Download', exact: true }).first().waitFor({ timeout: 20000 })
  },
  'e-docs-scan.pdf',
  'Scan to PDF saves history',
)

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
