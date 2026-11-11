// Capturas del taller. Uso: node capturar.cjs <prefijo> <pantallas|all> [anchos] ; THEMES=light,dark ; BASE=http://localhost:5202
const { createRequire } = require('module')
const req = createRequire('C:/Users/Alberto/Desktop/CarCare/frontend/package.json')
const { chromium } = req('playwright')
const path = require('path')

const BASE = process.env.BASE || 'http://localhost:5202'
const OUT = process.env.OUT || __dirname
const prefix = process.argv[2] || 'antes'
const wanted = (process.argv[3] || 'all').split(',')
const widths = (process.argv[4] || '1440,768,360').split(',').map(Number)
const themes = (process.env.THEMES || 'light,dark').split(',')
const EMAIL = process.env.EMAIL || 'taller@carcare.test'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// ruta relativa al espacio; 3d => espera más (WebGL por software)
const SCREENS = {
  inicio: { p: '', d3: true },
  taller: { p: '/taller', d3: true },
  ordenes: { p: '/ordenes' },
  lista: { p: '/ordenes?vista=lista' },
  orden: { p: '/ordenes/__ORDER__' },
  nueva: { p: '/ordenes/nueva' },
  clientes: { p: '/clientes' },
  cliente: { p: '/clientes/__CUSTOMER__' },
  vehiculos: { p: '/garaje' },
  equipo: { p: '/equipo' },
  analitica: { p: '/analitica' },
  agenda: { p: '/agenda' },
  solicitudes: { p: '/solicitudes' },
  ajustes: { abs: '/app/ajustes' },
}

async function login(page, email) {
  await page.goto(BASE + '/entrar', { waitUntil: 'domcontentloaded', timeout: 90000 })
  await page.locator('input[type=email]').fill(email)
  await page.locator('input[autocomplete=current-password]').fill('password')
  await page.getByRole('button', { name: /entrar/i }).click()
  await page.waitForURL(/\/app\/\d+/, { timeout: 60000 })
}

async function shot(page, name, d3) {
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
  await sleep(d3 ? 9000 : 1800)
  const file = path.join(OUT, `${prefix}-${name}.png`)
  await page.screenshot({ path: file, fullPage: false })
  console.log('captura', file)
}

;(async () => {
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
  for (const theme of themes) {
    for (const width of widths) {
      const vp = { width, height: width < 500 ? 800 : width < 1000 ? 1000 : 900 }
      const ctx = await browser.newContext({ viewport: vp, colorScheme: theme, reducedMotion: 'reduce' })
      await ctx.addInitScript((t) => localStorage.setItem('carcare.theme', t), theme)
      const page = await ctx.newPage()
      await login(page, EMAIL)
      const base = new URL(page.url()).pathname.replace(/\/$/, '')
      const wsId = base.split('/').pop()
      // ids reales
      const api = (u) => page.evaluate(async (u) => { const r = await fetch(u, { headers: { Accept: 'application/json' }, credentials: 'include' }); return r.json() }, u)
      const orders = await api(`/api/v1/workspaces/${wsId}/work-orders?per_page=5&status=open`).catch(() => null)
      const customers = await api(`/api/v1/workspaces/${wsId}/customers?per_page=5`).catch(() => null)
      const orderId = orders?.data?.[0]?.id ?? 1
      const customerId = customers?.data?.[0]?.id ?? 1
      for (const [key, s] of Object.entries(SCREENS)) {
        if (!(wanted.includes('all') || wanted.includes(key))) continue
        const url = s.abs ? s.abs : base + s.p.replace('__ORDER__', orderId).replace('__CUSTOMER__', customerId)
        try { await page.goto(BASE + url, { waitUntil: "domcontentloaded", timeout: 90000 }) } catch (e) { console.log("fallo goto", key) }
        await shot(page, `${key}-${theme}-${width}`, s.d3)
      }
      await ctx.close()
    }
  }
  await browser.close()
})().catch((e) => { console.error(e); process.exit(1) })
