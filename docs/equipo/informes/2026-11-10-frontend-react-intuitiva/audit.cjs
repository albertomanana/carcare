// Auditoría de intuitividad: capturas por cuenta y ancho. Uso: node audit.cjs <prefijo> <cuenta|nuevo|nuevotaller> [anchos]
const { createRequire } = require('module')
const req = createRequire('C:/Users/Alberto/Desktop/CarCare/frontend/package.json')
const { chromium } = req('playwright')
const fs = require('fs')
const path = require('path')

const BASE = 'http://localhost:5197'
const OUT = 'C:/Users/Alberto/Desktop/CarCare/docs/equipo/informes/2026-11-10-frontend-react-intuitiva'
fs.mkdirSync(OUT, { recursive: true })
const prefix = process.argv[2] || 'antes'
const who = process.argv[3] || 'demo'
const widths = (process.argv[4] || '1280,360').split(',').map(Number)
const theme = process.env.THEME || 'light'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const ACCOUNTS = { demo: 'demo@carcare.test', taller: 'taller@carcare.test', mecanico: 'mecanico@carcare.test' }

async function login(page, email) {
  await page.goto(BASE + '/entrar')
  await page.locator('input[type=email]').fill(email)
  await page.locator('input[autocomplete=current-password]').fill('password')
  await page.getByRole('button', { name: /entrar/i }).click()
  await page.waitForURL(/\/app\/\d+/, { timeout: 30000 })
}

async function registerNew(page, type) {
  const stamp = Date.now()
  await page.goto(BASE + '/registro' + (type === 'workshop' ? '?tipo=taller' : ''))
  await page.getByLabel(/tu nombre/i).fill(type === 'workshop' ? 'Laura Taller' : 'Marta Nueva')
  await page.locator('input[type=email]').fill(`${type}-${stamp}@ejemplo.test`)
  if (type === 'workshop') await page.getByLabel(/nombre del taller/i).fill('Taller Prueba')
  await page.locator('input[autocomplete=new-password]').first().fill('password123')
  await page.locator('input[autocomplete=new-password]').nth(1).fill('password123')
  await page.getByRole('button', { name: /crear/i }).click()
  await page.waitForURL(/\/app\/\d+/, { timeout: 30000 })
}

async function shot(page, name) {
  await page.waitForFunction(() => !document.querySelector('main .skeleton'), null, { timeout: 25000 }).catch(() => console.log('sigue cargando', name))
  await sleep(900)
  const file = path.join(OUT, `${prefix}-${name}.png`)
  await page.screenshot({ path: file, fullPage: false })
  console.log('captura', file)
}

;(async () => {
  const browser = await chromium.launch()
  for (const width of widths) {
    const ctx = await browser.newContext({ viewport: { width, height: width < 500 ? 780 : 860 }, colorScheme: theme, reducedMotion: 'reduce' })
    const page = await ctx.newPage()
    page.on('pageerror', (e) => console.log('ERROR página', e.message))
    if (who === 'nuevo') await registerNew(page, 'personal')
    else if (who === 'nuevotaller') await registerNew(page, 'workshop')
    else await login(page, ACCOUNTS[who])
    const base = new URL(page.url()).pathname.match(/\/app\/\d+/)[0]
    const tag = `${who}-${width}`
    const visit = async (route, name) => {
      await page.goto(BASE + base + route)
      await page.waitForLoadState('networkidle').catch(() => {})
      await shot(page, `${tag}-${name}`)
    }
    await visit('', 'inicio')
    if (who === 'demo') {
      await visit('/garaje', 'garaje')
      const href = await page.locator('main a[href*="/vehiculos/"]:not([href$="/nuevo"])').first().getAttribute('href')
      await page.goto(BASE + href + '/gastos')
      await page.waitForLoadState('networkidle').catch(() => {})
      await shot(page, `${tag}-ficha-gastos`)
      await page.goto(BASE + href + '/intervenciones/nueva')
      await shot(page, `${tag}-intervencion`)
      await visit('/vehiculos/nuevo', 'vehiculo-nuevo')
    }
    if (who === 'taller' || who === 'mecanico') {
      await visit('/ordenes', 'ordenes')
      await visit('/ordenes/nueva', 'orden-nueva')
    }
    if (who === 'nuevo') {
      await visit('/garaje', 'garaje')
      await visit('/vehiculos/nuevo', 'vehiculo-nuevo')
    }
    if (width < 500) {
      await page.goto(BASE + base)
      await page.getByRole('button', { name: /más secciones/i }).click()
      await shot(page, `${tag}-mas`)
      await page.keyboard.press('Escape')
    } else {
      await page.goto(BASE + base)
      await page.getByRole('button', { name: /cambiar de espacio/i }).click()
      await shot(page, `${tag}-espacios`)
      await page.keyboard.press('Escape')
    }
    await ctx.close()
  }
  await browser.close()
})().catch((e) => {
  console.error(e)
  process.exit(1)
})
