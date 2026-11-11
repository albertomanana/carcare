// Capturas del mundo (antes/después). Uso: node capturar.cjs <prefijo> [anchos] ; THEMES=light,dark
const { createRequire } = require('module')
const req = createRequire('C:/Users/Alberto/Desktop/CarCare/frontend/package.json')
const { chromium } = req('playwright')
const fs = require('fs')
const path = require('path')

const BASE = process.env.BASE || 'http://localhost:5198'
const OUT = __dirname
const prefix = process.argv[2] || 'antes'
const widths = (process.argv[3] || '1440,390').split(',').map(Number)
const themes = (process.env.THEMES || 'light,dark').split(',')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function login(page, email) {
  await page.goto(BASE + '/entrar', { waitUntil: 'domcontentloaded', timeout: 90000 })
  await page.locator('input[type=email]').fill(email)
  await page.locator('input[autocomplete=current-password]').fill('password')
  await page.getByRole('button', { name: /entrar/i }).click()
  await page.waitForURL(/\/app\/\d+/, { timeout: 40000 })
}

async function shot(page, name) {
  // La pantalla está lista cuando hay <main> con título, sin esqueletos ni indicadores de carga dentro
  await page
    .waitForFunction(
      () => {
        const m = document.querySelector('main#contenido')
        return !!m && !!m.querySelector('h1') && !m.querySelector('.skeleton') && !m.querySelector('[role=status]')
      },
      null,
      { timeout: 60000 },
    )
    .catch(() => console.log('sigue cargando', name))
  await page.waitForLoadState('networkidle').catch(() => {})
  await sleep(2500)
  const file = path.join(OUT, `${prefix}-${name}.png`)
  await page.screenshot({ path: file, fullPage: false })
  console.log('captura', file)
}

;(async () => {
  const browser = await chromium.launch()
  for (const theme of themes) {
    for (const width of widths) {
      const vp = { width, height: width < 500 ? 800 : 900 }
      // particular
      let ctx = await browser.newContext({ viewport: vp, colorScheme: theme, reducedMotion: 'reduce' })
      await ctx.addInitScript((t) => localStorage.setItem('carcare.theme', t), theme)
      let page = await ctx.newPage()
      await login(page, 'demo@carcare.test')
      const base = new URL(page.url()).pathname.replace(/\/$/, '')
      const tag = `${theme}-${width}`
      await shot(page, `inicio-${tag}`)
      await page.goto(BASE + base + '/garaje', { waitUntil: 'domcontentloaded', timeout: 90000 }); await shot(page, `garaje-${tag}`)
      const link = page.locator(`a[href^="${base}/vehiculos/"]`).first()
      const href = await link.getAttribute('href')
      await page.goto(BASE + href, { waitUntil: 'domcontentloaded', timeout: 90000 }); await shot(page, `ficha-${tag}`)
      await ctx.close()
      // taller
      ctx = await browser.newContext({ viewport: vp, colorScheme: theme, reducedMotion: 'reduce' })
      await ctx.addInitScript((t) => localStorage.setItem('carcare.theme', t), theme)
      page = await ctx.newPage()
      await login(page, 'taller@carcare.test')
      const tb = new URL(page.url()).pathname.replace(/\/$/, '')
      await page.goto(BASE + tb + '/ordenes', { waitUntil: 'domcontentloaded', timeout: 90000 }); await shot(page, `ordenes-${tag}`)
      await ctx.close()
    }
  }
  await browser.close()
})().catch((e) => { console.error(e); process.exit(1) })
