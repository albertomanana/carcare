// Pasada de axe-core (WCAG 2.1 A/AA) sobre las pantallas clave del particular. Uso: node axe.cjs  ; THEMES=light,dark
const { createRequire } = require('module')
const req = createRequire('C:/Users/Alberto/Desktop/CarCare/frontend/package.json')
const { chromium } = req('playwright')
const fs = require('fs')
const axeSource = fs.readFileSync(req.resolve('axe-core/axe.min.js'), 'utf8')

const BASE = process.env.BASE || 'http://localhost:5201'
const themes = (process.env.THEMES || 'light,dark').split(',')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function ready(page) {
  await page
    .waitForFunction(() => {
      const m = document.querySelector('main#contenido') || document.querySelector('main')
      return !!m && !!m.querySelector('h1,h2') && !m.querySelector('.skeleton') && !m.querySelector('[role=status]')
    }, null, { timeout: 60000 })
    .catch(() => console.log('  (sigue cargando)'))
  await page.waitForLoadState('networkidle').catch(() => {})
  await sleep(1500)
}

async function audit(page, name) {
  await ready(page)
  await page.evaluate(axeSource)
  const res = await page.evaluate(async () => {
    const r = await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] } })
    return r.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length, help: v.help, sample: v.nodes.slice(0, 2).map((n) => n.target.join(' ') + ' <' + n.html.slice(0,140) + '> :: ' + (n.failureSummary || '').split('\n').slice(1, 3).join(' | ')) }))
  })
  console.log(`${name}: ${res.length} violaciones`)
  for (const v of res) console.log(`  - [${v.impact}] ${v.id} x${v.nodes}: ${v.help}\n      ${v.sample.join('\n      ')}`)
}

;(async () => {
  const browser = await chromium.launch({ args: ['--disable-gpu', '--disable-3d-apis', '--disable-webgl'] })
  for (const theme of themes) {
    console.log(`\n=== tema ${theme} ===`)
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: theme, reducedMotion: 'reduce' })
    await ctx.addInitScript((t) => localStorage.setItem('carcare.theme', t), theme)
    const page = await ctx.newPage()
    await page.goto(BASE + '/entrar', { waitUntil: 'domcontentloaded', timeout: 90000 })
    await audit(page, 'entrar')
    await page.locator('input[type=email]').fill('demo@carcare.test')
    await page.locator('input[autocomplete=current-password]').fill('password')
    await page.getByRole('button', { name: /entrar/i }).click()
    await page.waitForURL(/\/app\/\d+/, { timeout: 60000 })
    const base = new URL(page.url()).pathname.replace(/\/$/, '')
    await audit(page, 'inicio')
    await page.goto(BASE + base + '/garaje', { waitUntil: 'domcontentloaded' })
    await audit(page, 'garaje')
    const href = await page.locator(`a[href^="${base}/vehiculos/"]`).first().getAttribute('href')
    const v = href.replace(/\/(informe|editar|recordatorios|historial|gastos|datos|ordenes)$/, '')
    await page.goto(BASE + v, { waitUntil: 'domcontentloaded' })
    await audit(page, 'ficha (resumen)')
    await page.goto(BASE + v + '/recordatorios', { waitUntil: 'domcontentloaded' })
    await audit(page, 'ficha (recordatorios)')
    await page.goto(BASE + base + '/agenda', { waitUntil: 'domcontentloaded' })
    await audit(page, 'agenda')
    await ctx.close()
  }
  await browser.close()
})().catch((e) => { console.error(e); process.exit(1) })
