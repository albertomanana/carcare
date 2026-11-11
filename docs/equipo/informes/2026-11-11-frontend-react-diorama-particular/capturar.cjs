// Capturas del particular (antes/después). Uso: node capturar.cjs <prefijo> [anchos]  ; THEMES=light,dark ; ONLY=inicio,garaje
const { createRequire } = require('module')
const req = createRequire('C:/Users/Alberto/Desktop/CarCare/frontend/package.json')
const { chromium } = req('playwright')
const path = require('path')

const BASE = process.env.BASE || 'http://localhost:5201'
const OUT = __dirname
const prefix = process.argv[2] || 'antes'
const widths = (process.argv[3] || '1440,768,360').split(',').map(Number)
const themes = (process.env.THEMES || 'light,dark').split(',')
const only = process.env.ONLY ? process.env.ONLY.split(',') : null
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function login(page, email) {
  await page.goto(BASE + '/entrar', { waitUntil: 'domcontentloaded', timeout: 90000 })
  await page.locator('input[type=email]').fill(email)
  await page.locator('input[autocomplete=current-password]').fill('password')
  await page.getByRole('button', { name: /entrar/i }).click()
  await page.waitForURL(/\/app\/\d+/, { timeout: 60000 })
}

async function ready(page, name) {
  await page
    .waitForFunction(
      () => {
        const m = document.querySelector('main#contenido') || document.querySelector('main')
        return !!m && !!m.querySelector('h1,h2') && !m.querySelector('.skeleton') && !m.querySelector('[role=status]')
      },
      null,
      { timeout: 60000 },
    )
    .catch(() => console.log('sigue cargando', name))
  await page.waitForLoadState('networkidle').catch(() => {})
  await sleep(1800)
}

async function shot(page, name, tag, full = false) {
  if (only && !only.includes(name)) return
  await ready(page, name)
  const file = path.join(OUT, `${prefix}-${name}-${tag}.png`)
  await page.screenshot({ path: file, fullPage: full, timeout: 120000 })
  console.log('captura', file)
}

;(async () => {
  const browser = await chromium.launch({ args: process.env.GL ? ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] : ['--disable-gpu', '--disable-3d-apis', '--disable-webgl'] })
  for (const theme of themes) {
    for (const width of widths) {
      const vp = { width, height: width < 500 ? 800 : 900 }
      const tag = `${theme}-${width}`
      // sin sesión: login y registro
      let ctx = await browser.newContext({ viewport: vp, colorScheme: theme, reducedMotion: 'reduce' })
      await ctx.addInitScript((t) => localStorage.setItem('carcare.theme', t), theme)
      let page = await ctx.newPage()
      for (const [name, url] of [['entrar', '/entrar'], ['registro', '/registro']]) {
        if (only && !only.includes(name)) continue
        await page.goto(BASE + url, { waitUntil: 'domcontentloaded', timeout: 90000 })
        await shot(page, name, tag)
      }
      await ctx.close()
      ctx = await browser.newContext({ viewport: vp, colorScheme: theme, reducedMotion: 'reduce' })
      await ctx.addInitScript((t) => localStorage.setItem('carcare.theme', t), theme)
      page = await ctx.newPage()
      await login(page, 'demo@carcare.test')
      const base = new URL(page.url()).pathname.replace(/\/$/, '')
      await shot(page, 'inicio', tag)
      const go = async (name, p, full) => {
        if (only && !only.includes(name)) return
        await page.goto(BASE + p, { waitUntil: 'domcontentloaded', timeout: 90000 })
        await shot(page, name, tag, full)
      }
      await go('garaje', base + '/garaje')
      const link = page.locator(`a[href^="${base}/vehiculos/"]`).first()
      const href = (await link.count()) ? await link.getAttribute('href') : null
      if (!href) { await go('garaje2', base + '/garaje'); } else {
        const v = href.replace(/\/(informe|editar|recordatorios|historial|gastos|datos|ordenes)$/, '')
        await go('ficha', v)
        await go('ficha-historial', v + '/historial')
        await go('ficha-gastos', v + '/gastos')
        await go('ficha-recordatorios', v + '/recordatorios')
        await go('ficha-datos', v + '/datos')
        
        
        
        
        
        
      }
      await go('nuevo-vehiculo', base + '/vehiculos/nuevo')
      await go('agenda', base + '/agenda')
      await go('analitica', base + '/analitica')
      
      
      await go('ajustes', '/app/ajustes')
      await ctx.close()
    }
  }
  await browser.close()
})().catch((e) => { console.error(e); process.exit(1) })
