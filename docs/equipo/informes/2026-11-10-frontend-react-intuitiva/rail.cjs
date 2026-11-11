// 768 px (barra de iconos): tooltip con nombre y descripción al llegar con el teclado; hoja "Más" a 360 con "Estás aquí".
const { createRequire } = require('module')
const req = createRequire('C:/Users/Alberto/Desktop/CarCare/frontend/package.json')
const { chromium } = req('playwright')
const path = require('path')
const BASE = 'http://localhost:5197'
const OUT = 'C:/Users/Alberto/Desktop/CarCare/docs/equipo/informes/2026-11-10-frontend-react-intuitiva'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let fail = 0
const check = (c, w) => {
  if (!c) fail++
  console.log(c ? 'OK  ' : 'FALLO', w)
}

async function login(page, email) {
  await page.goto(BASE + '/entrar')
  await page.locator('input[type=email]').fill(email)
  await page.locator('input[autocomplete=current-password]').fill('password')
  await page.getByRole('button', { name: /entrar/i }).click()
  await page.waitForURL(/\/app\/\d+/, { timeout: 30000 })
  return new URL(page.url()).pathname.match(/\/app\/\d+/)[0]
}

;(async () => {
  const browser = await chromium.launch()
  const ctx = await browser.newContext({ viewport: { width: 768, height: 900 }, reducedMotion: 'reduce' })
  const page = await ctx.newPage()
  const base = await login(page, 'taller@carcare.test')
  await page.waitForLoadState('networkidle').catch(() => {})
  // Foco en el enlace "Órdenes" de la barra estrecha
  const link = page.locator('aside nav a', { hasText: 'Órdenes' })
  await link.focus()
  await sleep(600)
  const tip = page.getByRole('tooltip')
  const text = (await tip.innerText().catch(() => '')).replace(/\s+/g, ' ')
  check(text.includes('Órdenes') && text.includes('tablero'), `Tooltip al enfocar con teclado: «${text}»`)
  await page.screenshot({ path: path.join(OUT, 'despues-taller-768-tooltip.png') })
  // Ficha de un vehículo: "Vehículos" activo
  await page.goto(BASE + base + '/garaje')
  await page.waitForLoadState('networkidle').catch(() => {})
  const href = await page.locator('main a[href*="/vehiculos/"]:not([href$="/nuevo"])').first().getAttribute('href')
  await page.goto(BASE + href)
  await page.waitForLoadState('networkidle').catch(() => {})
  await sleep(800)
  const active = await page.locator('aside a[aria-current=page]').first().getAttribute('href')
  check(active?.endsWith('/garaje'), `En la ficha, la sección activa es Vehículos (${active})`)
  await ctx.close()

  const m = await browser.newContext({ viewport: { width: 360, height: 780 }, reducedMotion: 'reduce' })
  const mp = await m.newPage()
  const mbase = await login(mp, 'taller@carcare.test')
  await mp.goto(BASE + mbase + '/equipo')
  await mp.waitForLoadState('networkidle').catch(() => {})
  const more = mp.getByRole('button', { name: /más secciones/i })
  check((await more.getAttribute('aria-label'))?.includes('estás en una de ellas'), 'En «Equipo», «Más» de la barra inferior se marca como activo')
  await more.click()
  await sleep(500)
  check(await mp.getByRole('dialog').getByText('Estás aquí').isVisible(), 'La hoja «Más» marca «Estás aquí» en Equipo')
  await mp.screenshot({ path: path.join(OUT, 'despues-taller-360-mas-equipo.png') })
  await browser.close()
  console.log(fail ? `${fail} fallos` : 'todo bien')
  process.exit(fail ? 1 : 0)
})().catch((e) => {
  console.error(e)
  process.exit(1)
})
