import { chromium } from 'playwright'
import { FRONTEND_URL } from '../backend/urls.config.js'
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
await page.setViewportSize({ width: 1280, height: 900 })
await page.goto(`${FRONTEND_URL}/`, { waitUntil: 'networkidle' })
await page.screenshot({ path: 'scratch-tests/home.png' })
await page.goto(`${FRONTEND_URL}/merge-pdf`, { waitUntil: 'networkidle' })
await page.screenshot({ path: 'scratch-tests/merge.png' })
await page.goto(`${FRONTEND_URL}/all-tools`, { waitUntil: 'networkidle' })
await page.screenshot({ path: 'scratch-tests/all-tools.png' })
await browser.close()
console.log('done')
