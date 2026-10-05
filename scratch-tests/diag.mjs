import { chromium } from 'playwright'

console.log('starting launch', new Date().toISOString())
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] })
console.log('launched', new Date().toISOString())
const page = await browser.newPage()
console.log('page created', new Date().toISOString())
await page.goto('http://localhost:5173/', { waitUntil: 'networkidle', timeout: 20000 })
console.log('navigated', new Date().toISOString())
const title = await page.title()
console.log('title:', title)
await browser.close()
console.log('done', new Date().toISOString())
