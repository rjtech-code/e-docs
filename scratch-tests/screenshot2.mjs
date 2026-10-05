import { chromium } from 'playwright'
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
const page = await context.newPage()

await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle' })
await page.screenshot({ path: 'scratch-tests/login.png' })

await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle' })
await page.locator('input[type=email]').fill('admin@sikshapaper.local')
await page.locator('input[type=password]').fill('admin123')
await Promise.all([page.waitForURL('**/home'), page.getByRole('button', { name: 'Login' }).click()])
await page.screenshot({ path: 'scratch-tests/dashboard.png' })

await page.goto('http://localhost:5173/history', { waitUntil: 'networkidle' })
await page.screenshot({ path: 'scratch-tests/history.png' })

await page.goto('http://localhost:5173/admin', { waitUntil: 'networkidle' })
await page.waitForTimeout(500)
await page.screenshot({ path: 'scratch-tests/admin.png' })
await page.getByRole('tab', { name: /^Users/ }).click()
await page.waitForTimeout(300)
await page.screenshot({ path: 'scratch-tests/admin-users.png' })

await page.goto('http://localhost:5173/merge-pdf', { waitUntil: 'networkidle' })
await page.screenshot({ path: 'scratch-tests/merge-loggedin.png' })

await browser.close()
console.log('done')
