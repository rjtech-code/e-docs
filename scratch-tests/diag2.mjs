import { chromium } from 'playwright'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const dir = path.dirname(fileURLToPath(import.meta.url))
const log = (...a) => console.log(new Date().toISOString(), ...a)

const browser = await chromium.launch({ args: ['--no-sandbox'] })
const context = await browser.newContext({ acceptDownloads: true })
const page = await context.newPage()
page.on('console', (m) => log('  [console]', m.type(), m.text()))
page.on('pageerror', (e) => log('  [pageerror]', e.message))
page.on('requestfailed', (r) => log('  [requestfailed]', r.url(), r.failure()?.errorText))

log('goto merge-pdf')
await page.goto('http://localhost:5173/merge-pdf', { waitUntil: 'networkidle', timeout: 20000 })
log('goto done')

const pdfA = path.join(dir, 'sample-a.pdf')
const pdfB = path.join(dir, 'sample-b.pdf')
log('setInputFiles')
await page.setInputFiles('input[type=file]', [pdfA, pdfB])
log('setInputFiles done')

await page.waitForTimeout(500)
const btnText = await page.getByRole('button', { name: /Merge/ }).textContent()
log('button text:', btnText)
const disabled = await page.getByRole('button', { name: /Merge/ }).isDisabled()
log('button disabled:', disabled)

log('clicking + waiting for download')
const [download] = await Promise.all([
  page.waitForEvent('download', { timeout: 20000 }),
  page.getByRole('button', { name: /Merge/ }).click(),
])
log('download event fired:', download.suggestedFilename())
const p = path.join(dir, 'downloads', 'merged-diag.pdf')
await download.saveAs(p)
log('saved to', p)

await browser.close()
log('done')
