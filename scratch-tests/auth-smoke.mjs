import { chromium } from 'playwright'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

const dir = path.dirname(fileURLToPath(import.meta.url))
const out = path.join(dir, 'downloads')
fs.mkdirSync(out, { recursive: true })

const BASE = 'http://localhost:5173'
const results = []
const uniqueEmail = `test-${Date.now()}@example.com`
const password = 'password123'

function record(name, ok, detail) {
  results.push({ name, ok, detail })
  console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ' — ' + detail : ''}`)
}

async function withPage(browser, fn) {
  const context = await browser.newContext({ acceptDownloads: true })
  const page = await context.newPage()
  page.on('pageerror', (err) => console.log('  [pageerror]', err.message))
  try {
    await fn(page, context)
  } finally {
    await context.close()
  }
}

function assertPdfHeader(filePath) {
  return fs.readFileSync(filePath).subarray(0, 5).toString('latin1') === '%PDF-'
}

const pdfA = path.join(dir, 'sample-a.pdf')
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })

// ---------- Signup ----------
await withPage(browser, async (page) => {
  try {
    await page.goto(`${BASE}/signup`, { waitUntil: 'networkidle' })
    await page.locator('input[type=text], input:not([type])').first().fill('Test User')
    await page.locator('input[type=email]').fill(uniqueEmail)
    await page.locator('#password').fill(password)
    await page.locator('#confirm').fill(password)
    await Promise.all([page.waitForURL('**/home'), page.getByRole('button', { name: 'Create account' }).click()])
    record('Signup redirects to app Home', page.url().includes('/home'))
  } catch (e) {
    record('Signup', false, e.message)
  }
})

// ---------- Login with wrong password rejected ----------
await withPage(browser, async (page) => {
  try {
    await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
    await page.locator('input[type=email]').fill(uniqueEmail)
    await page.locator('input[type=password]').fill('wrongpassword')
    await page.getByRole('button', { name: 'Login' }).click()
    await page.waitForSelector('text=Invalid email or password', { timeout: 10000 })
    record('Login rejects wrong password', true)
  } catch (e) {
    record('Login rejects wrong password', false, e.message)
  }
})

// ---------- Login + use a tool + see history on that tool page + Dashboard + History page ----------
let sharedStorageState = null
await withPage(browser, async (page, context) => {
  try {
    await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
    await page.locator('input[type=email]').fill(uniqueEmail)
    await page.locator('input[type=password]').fill(password)
    await Promise.all([page.waitForURL('**/home'), page.getByRole('button', { name: 'Login' }).click()])
    record('Login succeeds', page.url().includes('/home'))

    // Header shows user menu, not Log in/Sign up
    const loggedOutLink = await page.getByRole('link', { name: 'Log in' }).count()
    record('Header hides Log in link when signed in', loggedOutLink === 0)

    // Use Merge PDF while signed in
    await page.goto(`${BASE}/merge-pdf`, { waitUntil: 'networkidle' })
    await page.setInputFiles('input[type=file]', [pdfA, pdfA])
    await page.getByRole('button', { name: /Merge \d+ PDFs/ }).click()
    await page.getByRole('button', { name: 'Download', exact: true }).waitFor({ timeout: 30000 })

    // Wait a moment for the fire-and-forget history upload to land, then reload to see the panel update
    await page.waitForTimeout(1200)
    await page.reload({ waitUntil: 'networkidle' })
    await page.waitForSelector('text=Your recent files with this tool', { timeout: 10000 })
    const historyText = await page.locator('body').textContent()
    record('Merge PDF page shows saved history after reload', historyText.includes('e-docs-merged.pdf'))

    // App Home shows the file
    await page.goto(`${BASE}/home`, { waitUntil: 'networkidle' })
    await page.waitForSelector('text=e-docs-merged.pdf', { timeout: 10000 })
    record('App Home lists recent file', true)

    // History page shows + can delete it
    await page.goto(`${BASE}/history`, { waitUntil: 'networkidle' })
    await page.waitForSelector('text=e-docs-merged.pdf', { timeout: 10000 })
    record('History page lists file', true)

    const countBefore = await page.locator('tr:has-text("e-docs-merged.pdf")').count()
    await page.locator('tr:has-text("e-docs-merged.pdf")').first().locator('button[title="Delete"]').click()
    await page.waitForTimeout(800)
    const countAfter = await page.locator('tr:has-text("e-docs-merged.pdf")').count()
    record('Deleting from History page removes it', countAfter < countBefore, `before=${countBefore} after=${countAfter}`)

    sharedStorageState = await context.storageState()
  } catch (e) {
    record('Logged-in tool history flow', false, e.message)
  }
})

// ---------- Guest (logged out) still works, with no history save prompt shown as blocking ----------
await withPage(browser, async (page) => {
  try {
    await page.goto(`${BASE}/merge-pdf`, { waitUntil: 'networkidle' })
    await page.setInputFiles('input[type=file]', [pdfA, pdfA])
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 30000 }),
      (async () => {
        await page.getByRole('button', { name: /Merge \d+ PDFs/ }).click()
        await page.getByRole('button', { name: 'Download', exact: true }).waitFor({ timeout: 30000 })
        await page.getByRole('button', { name: 'Download', exact: true }).click()
      })(),
    ])
    const p = path.join(out, 'guest-merge.pdf')
    await download.saveAs(p)
    record('Guest can still use tools without login', assertPdfHeader(p))
    const signInPromptCount = await page.getByText('Sign in').count()
    record('Guest sees a sign-in prompt for history (non-blocking)', signInPromptCount > 0)
  } catch (e) {
    record('Guest tool flow', false, e.message)
  }
})

// ---------- Admin login + Admin Panel ----------
await withPage(browser, async (page) => {
  try {
    await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
    await page.locator('input[type=email]').fill('admin@sikshapaper.local')
    await page.locator('input[type=password]').fill('admin123')
    await Promise.all([page.waitForURL('**/home'), page.getByRole('button', { name: 'Login' }).click()])

    await page.goto(`${BASE}/admin`, { waitUntil: 'networkidle' })
    await page.waitForSelector('text=Admin Panel', { timeout: 10000 })
    record('Admin can access Admin Panel', true)

    await page.getByRole('tab', { name: /^Users/ }).click()
    await page.waitForSelector(`text=${uniqueEmail}`, { timeout: 10000 })
    record('Admin Panel lists the new user', true)

    await page.getByRole('tab', { name: /^All Files/ }).click()
    await page.waitForTimeout(500)
    record('Admin Panel Files tab renders', (await page.getByText('Admin Panel').count()) > 0)
  } catch (e) {
    record('Admin panel flow', false, e.message)
  }
})

// ---------- A regular (non-admin) user is redirected away from /admin ----------
await withPage(browser, async (page) => {
  try {
    await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
    await page.locator('input[type=email]').fill(uniqueEmail)
    await page.locator('input[type=password]').fill(password)
    await Promise.all([page.waitForURL('**/home'), page.getByRole('button', { name: 'Login' }).click()])
    await page.goto(`${BASE}/admin`, { waitUntil: 'networkidle' })
    await page.waitForURL('**/home', { timeout: 5000 })
    record('Non-admin redirected away from /admin', page.url().includes('/home'))
  } catch (e) {
    record('Non-admin blocked from /admin', false, e.message)
  }
})

// ---------- Logged-out user redirected from /history to /login ----------
await withPage(browser, async (page) => {
  try {
    await page.goto(`${BASE}/history`, { waitUntil: 'networkidle' })
    await page.waitForURL('**/login', { timeout: 5000 })
    record('Guest redirected from /history to /login', page.url().includes('/login'))
  } catch (e) {
    record('Guest redirected from /history', false, e.message)
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
