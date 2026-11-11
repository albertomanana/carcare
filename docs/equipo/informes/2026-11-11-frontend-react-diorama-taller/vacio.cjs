// Taller recién registrado (sin órdenes): capturas y axe. Uso: node vacio.cjs
const { createRequire } = require('module')
const req = createRequire('C:/Users/Alberto/Desktop/CarCare/frontend/package.json')
const { chromium } = req('playwright')
const AxeBuilder = req('@axe-core/playwright').default || req('@axe-core/playwright')
const path = require('path')
const BASE = process.env.BASE || 'http://localhost:5202'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
;(async () => {
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
  const email = `vacio${Date.now()}@carcare.test`
  for (const [theme, width] of [['light', 1440], ['dark', 1440], ['light', 768], ['light', 360], ['dark', 360]]) {
    const ctx = await browser.newContext({ viewport: { width, height: width < 500 ? 800 : width < 1000 ? 1000 : 900 }, colorScheme: theme, reducedMotion: 'reduce' })
    await ctx.addInitScript((t) => localStorage.setItem('carcare.theme', t), theme)
    const page = await ctx.newPage()
    await page.goto(BASE + '/entrar', { waitUntil: 'domcontentloaded', timeout: 90000 })
    const reg = await page.evaluate(async ({ email, first }) => {
      await fetch('/sanctum/csrf-cookie', { credentials: 'include' })
      const xsrf = decodeURIComponent((document.cookie.match(/XSRF-TOKEN=([^;]+)/) || [])[1] || '')
      const h = { 'Content-Type': 'application/json', Accept: 'application/json', 'X-XSRF-TOKEN': xsrf }
      const body = first
        ? { name: 'Taller Vacío', email, password: 'password-1234', password_confirmation: 'password-1234', account_type: 'workshop', workshop_name: 'Taller Nuevo' }
        : null
      const r = await fetch(first ? '/api/v1/auth/register' : '/api/v1/auth/login', { method: 'POST', credentials: 'include', headers: h, body: JSON.stringify(first ? body : { email, password: 'password-1234' }) })
      return r.status
    }, { email, first: theme === 'light' && width === 1440 })
    console.log('auth', reg)
    await page.goto(BASE + '/app', { waitUntil: 'domcontentloaded', timeout: 90000 })
    await page.waitForURL(/\/app\/\d+/, { timeout: 60000 })
    await page.waitForFunction(() => !!document.querySelector('main#contenido h1') && !document.querySelector('main#contenido .skeleton'), null, { timeout: 60000 }).catch(() => console.log('sigue cargando'))
    await page.waitForLoadState('networkidle').catch(() => {})
    await sleep(9000)
    const file = path.join(__dirname, `despues-vacio-${theme}-${width}.png`)
    await page.screenshot({ path: file })
    console.log('captura', file, page.url())
    if (width === 1440 && theme === 'light') {
      const res = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
      console.log('axe vacío:', res.violations.map((v) => `${v.id} (${v.nodes.length}): ${v.help}`))
    }
    await ctx.close()
  }
  await browser.close()
})().catch((e) => { console.error(e); process.exit(1) })
