import { Router } from 'express'
import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'

const MAX_URL_LENGTH = 2048
const NAVIGATION_TIMEOUT_MS = Number(process.env.WEBPDF_TIMEOUT_MS || 45_000)
const MAX_PAGE_HEIGHT = 100_000
const MAX_SCROLL_STEPS = 160
const MAX_CONCURRENT = Number(process.env.WEBPDF_CONCURRENCY || 2)
let activeJobs = 0

class WebPdfError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

function isPublicIp(address) {
  const version = isIP(address)
  if (version === 4) {
    const p = address.split('.').map(Number)
    const [a, b, c] = p
    if (a === 0 || a === 10 || a === 127 || a >= 224) return false
    if (a === 100 && b >= 64 && b <= 127) return false
    if (a === 169 && b === 254) return false
    if (a === 172 && b >= 16 && b <= 31) return false
    if (a === 192 && b === 168) return false
    if (a === 192 && b === 0 && c === 0) return false
    if (a === 198 && (b === 18 || b === 19)) return false
    if (a === 198 && b === 51 && c === 100) return false
    if (a === 203 && b === 0 && c === 113) return false
    return true
  }
  // Permit only global-unicast IPv6 (2000::/3); reject loopback, link-local,
  // unique-local, IPv4-mapped and other special-purpose ranges.
  if (version === 6) {
    const first = Number.parseInt(address.split(':')[0] || '0', 16)
    return first >= 0x2000 && first <= 0x3fff
  }
  return false
}

async function assertPublicHttpUrl(raw) {
  let url
  try {
    url = new URL(raw)
  } catch {
    throw new WebPdfError(400, 'Enter a valid full URL, such as https://example.com')
  }
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new WebPdfError(400, 'Only public HTTP and HTTPS webpages can be converted')
  }
  if (url.username || url.password) {
    throw new WebPdfError(400, 'URLs containing usernames or passwords are not supported')
  }
  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, '')
  if (!hostname || hostname === 'localhost' || hostname.endsWith('.localhost') ||
      hostname.endsWith('.local') || hostname.endsWith('.internal') ||
      hostname === 'metadata.google.internal') {
    throw new WebPdfError(400, 'Private and local network addresses are not allowed')
  }

  const literalIp = isIP(hostname)
  const addresses = literalIp ? [{ address: hostname }] : await lookup(hostname, { all: true, verbatim: true }).catch(() => [])
  if (!addresses.length || addresses.some(({ address }) => !isPublicIp(address))) {
    throw new WebPdfError(400, 'The URL must resolve only to a public internet address')
  }
  return url
}

async function scrollToLoadContent(page) {
  let scrollY = 0
  let previousHeight = 0
  let stableAtBottom = 0
  for (let i = 0; i < MAX_SCROLL_STEPS; i++) {
    const { height, viewportHeight } = await page.evaluate(() => ({
      height: Math.max(document.documentElement.scrollHeight, document.body?.scrollHeight || 0),
      viewportHeight: window.innerHeight || 800,
    }))
    if (height > MAX_PAGE_HEIGHT) {
      throw new WebPdfError(413, 'This webpage is too long to safely convert to a PDF')
    }
    const maxScroll = Math.max(0, height - viewportHeight)
    if (scrollY >= maxScroll - 2 && height === previousHeight) stableAtBottom++
    else stableAtBottom = 0
    if (stableAtBottom >= 3) break

    scrollY = Math.min(scrollY + Math.max(600, Math.floor(viewportHeight * 0.8)), maxScroll)
    await page.evaluate((y) => window.scrollTo(0, y), scrollY)
    await page.waitForTimeout(120)
    previousHeight = height
  }
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.waitForTimeout(250)
  await page.evaluate(async () => {
    await Promise.all(Array.from(document.images).map((img) => {
      if (img.complete) return Promise.resolve()
      return new Promise((resolve) => {
        const done = () => resolve()
        img.addEventListener('load', done, { once: true })
        img.addEventListener('error', done, { once: true })
        setTimeout(done, 2500)
      })
    }))
    if (document.fonts?.ready) await Promise.race([
      document.fonts.ready,
      new Promise((resolve) => setTimeout(resolve, 3000)),
    ])
  })
}

export default function webpageToPdfRoutes() {
  const router = Router()

  router.post('/webpage-to-pdf', async (req, res, next) => {
    if (activeJobs >= MAX_CONCURRENT) {
      return res.status(503).json({ error: 'Webpage-to-PDF is busy right now. Please try again shortly.' })
    }
    activeJobs++
    let browser
    try {
      const { url: rawUrl, viewport = 'desktop' } = req.body || {}
      if (typeof rawUrl !== 'string' || !rawUrl.trim() || rawUrl.length > MAX_URL_LENGTH) {
        throw new WebPdfError(400, 'Enter a webpage URL (maximum 2048 characters)')
      }
      if (!['desktop', 'mobile'].includes(viewport)) {
        throw new WebPdfError(400, 'Choose either Mobile or Desktop layout')
      }

      const targetUrl = await assertPublicHttpUrl(rawUrl.trim())
      let playwright
      try {
        playwright = await import('playwright')
      } catch {
        throw new WebPdfError(503, 'Webpage rendering is not installed on this server. Deploy the Docker image with Chromium support.')
      }

      const launchOptions = {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
      }
      if (process.env.CHROMIUM_PATH) launchOptions.executablePath = process.env.CHROMIUM_PATH
      else if (process.env.NODE_ENV === 'production' && process.platform === 'linux') launchOptions.executablePath = '/usr/bin/chromium'

      try {
        browser = await playwright.chromium.launch(launchOptions)
      } catch (err) {
        console.error('[webpage-to-pdf] Chromium launch failed:', err.message)
        throw new WebPdfError(503, 'Chromium is unavailable on this server. Deploy the Docker image or configure CHROMIUM_PATH.')
      }

      const isMobile = viewport === 'mobile'
      const context = await browser.newContext({
        viewport: isMobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 },
        deviceScaleFactor: isMobile ? 2 : 1,
        isMobile,
        hasTouch: isMobile,
        ignoreHTTPSErrors: false,
      })
      const page = await context.newPage()
      page.setDefaultNavigationTimeout(NAVIGATION_TIMEOUT_MS)
      page.setDefaultTimeout(15_000)

      // Revalidate every navigation/resource request to reduce SSRF risk, including redirects.
      await page.route('**/*', async (route) => {
        try {
          const requestUrl = route.request().url()
          if (requestUrl.startsWith('data:') || requestUrl.startsWith('blob:') || requestUrl.startsWith('about:')) {
            return route.continue()
          }
          await assertPublicHttpUrl(requestUrl)
          return route.continue()
        } catch {
          return route.abort('blockedbyclient')
        }
      })

      try {
        await page.goto(targetUrl.href, { waitUntil: 'domcontentloaded', timeout: NAVIGATION_TIMEOUT_MS })
        await page.waitForLoadState('networkidle', { timeout: 8_000 }).catch(() => {})
        await scrollToLoadContent(page)
        await page.emulateMedia({ media: 'screen' })
        await page.addStyleTag({ content: `
          *, *::before, *::after { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          html, body { height: auto !important; min-height: 0 !important; overflow: visible !important; }
          body { max-height: none !important; }
          @page { size: A4; margin: 12mm 10mm; }
        ` })
        const pdf = await page.pdf({
          format: 'A4',
          printBackground: true,
          preferCSSPageSize: false,
          displayHeaderFooter: true,
          headerTemplate: '<div></div>',
          footerTemplate: '<div style="font-size:8px;color:#666;width:100%;text-align:center;padding:0 10mm;"><span class="pageNumber"></span> / <span class="totalPages"></span></div>',
          margin: { top: '12mm', right: '10mm', bottom: '16mm', left: '10mm' },
          timeout: NAVIGATION_TIMEOUT_MS,
        })
        const safeHost = targetUrl.hostname.replace(/[^a-z0-9.-]/gi, '-').slice(0, 80) || 'webpage'
        res.setHeader('Content-Type', 'application/pdf')
        res.setHeader('Content-Length', pdf.length)
        res.setHeader('Content-Disposition', `attachment; filename="e-docs-${safeHost}.pdf"`)
        res.setHeader('Cache-Control', 'no-store')
        res.send(pdf)
      } finally {
        await context.close().catch(() => {})
      }
    } catch (err) {
      if (err instanceof WebPdfError) return res.status(err.status).json({ error: err.message })
      console.error('[webpage-to-pdf] Conversion failed:', err?.message || err)
      const message = err?.name === 'TimeoutError'
        ? 'The webpage took too long to load. Try another URL or try again later.'
        : 'Could not render this webpage. It may block automated browsers, require a login, or contain unsupported content.'
      return res.status(422).json({ error: message })
    } finally {
      if (browser) await browser.close().catch(() => {})
      activeJobs--
    }
  })

  return router
}
