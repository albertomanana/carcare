// Fase 3 · capturas del particular: Inicio (vista general y coche elegido con telemetría), Garaje, ficha y solicitud
import { chromium } from 'file:///C:/Users/Alberto/Desktop/CarCare/frontend/node_modules/playwright/index.mjs'
const BASE = 'http://localhost:5191'
const [, , outDir, theme = 'dark', w = '1440', h = '900', what = 'inicio'] = process.argv
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const ctx = await browser.newContext({ viewport: { width: +w, height: +h }, colorScheme: theme, reducedMotion: 'no-preference' })
const page = await ctx.newPage()
const errs = []
page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message))
page.on('console', (m) => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text().slice(0, 300)) })
page.on('response', (r) => { if (r.status() >= 500) errs.push(r.status() + ' ' + r.url()) })
await page.addInitScript((t) => { try { localStorage.setItem('carcare.themeMode', t) } catch {} }, theme)
await page.goto(BASE + '/entrar', { waitUntil: 'domcontentloaded', timeout: 90000 })
await page.getByRole('textbox', { name: /email/i }).fill(process.env.MAIL ?? 'demo@carcare.test')
await page.locator('input[autocomplete="current-password"]').fill('password')
await page.getByRole('button', { name: 'Entrar', exact: true }).click()
await page.waitForURL(/\/app\/\d+/, { timeout: 90000 })
const base = page.url().match(/\/app\/\d+/)[0]
const tag = `${theme}-${w}`
const shot = (name) => page.screenshot({ path: `${outDir}/${name}-${tag}.png` })

if (what === 'inicio') {
  await page.waitForSelector('canvas', { timeout: 120000 }).catch(() => errs.push('sin canvas'))
  await page.waitForTimeout(+(process.env.WAIT ?? 45000))
  await shot('inicio')
  // elegir el coche con el selector HTML (alternativa de teclado a pulsar el coche)
  await page.getByRole('group', { name: 'Elegir vehículo' }).getByRole('button', { name: process.env.CAR ?? 'El rojo' }).click({ timeout: 15000 }).catch((e) => errs.push('click ' + e.message.slice(0, 160)))
  await page.waitForTimeout(14000)
  await shot('inicio-elegido')
  // geometría real del anillo: ninguna tarjeta visible debe pisar a otra
  const rects = await page.evaluate(() =>
    [...document.querySelectorAll('[role=group][aria-label^="Datos de"] > div')]
      .filter((el) => getComputedStyle(el).visibility === 'visible')
      .map((el) => { const r = el.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), t: el.textContent.slice(0, 40) } }),
  )
  let overlaps = 0
  for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) { const a = rects[i], b = rects[j]; if (a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h) overlaps++ }
  console.log('tarjetas visibles:', rects.length, 'solapes:', overlaps)
  console.log(JSON.stringify(rects))
  await page.waitForTimeout(6000)
  await shot('inicio-elegido-giro')
} else if (what === 'paginas') {
  await page.goto(BASE + base + '/garaje', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(9000)
  await shot('garaje')
  await page.goto(BASE + base + '/vehiculos/' + (process.env.VEH ?? '1'), { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(+(process.env.WAIT ?? 30000))
  await shot('ficha')
  await page.goto(BASE + base + '/solicitudes/' + (process.env.REQ ?? '3'), { waitUntil: 'domcontentloaded' })
  await page.getByText('Seguimiento de la orden').waitFor({ timeout: 60000 }).catch(() => errs.push('sin seguimiento'))
  await page.waitForTimeout(2500)
  await page.screenshot({ path: `${outDir}/solicitud-${tag}.png`, fullPage: true })
  await page.goto(BASE + base, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(8000)
  await page.screenshot({ path: `${outDir}/inicio-${tag}.png`, fullPage: true })
}
console.log('errores:', errs.length ? errs.slice(0, 8) : 'ninguno')
await browser.close()
