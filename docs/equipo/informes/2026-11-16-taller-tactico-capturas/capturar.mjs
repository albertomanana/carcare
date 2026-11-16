// Taller 3D «táctico» · comprobaciones y capturas (instancia aislada: web :5181 → API :8020, BD carcare_pruebas)
// Uso: node capturar.mjs <carpeta> [dark|light] [ancho] [alto] [reduce|no-preference] [taller|mecanico]
import { chromium } from 'file:///C:/Users/Alberto/Desktop/CarCare/frontend/node_modules/playwright/index.mjs'
const BASE = 'http://localhost:5181'
const [, , outDir, theme = 'dark', w = '1280', h = '860', motion = 'no-preference', who = 'taller'] = process.argv
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const ctx = await browser.newContext({ viewport: { width: +w, height: +h }, colorScheme: theme, reducedMotion: motion })
const page = await ctx.newPage()
const errs = []
page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message))
page.on('console', (m) => {
  if (m.type() === 'error') errs.push('CONSOLE ' + m.text().slice(0, 300))
})
page.on('response', (r) => {
  if (r.status() >= 500) errs.push(r.status() + ' ' + r.url())
})
await page.addInitScript((t) => {
  try {
    localStorage.setItem('carcare.themeMode', t)
  } catch {}
}, theme)
await page.goto(BASE + '/entrar', { waitUntil: 'domcontentloaded', timeout: 120000 })
await page.getByRole('textbox', { name: /email/i }).fill(who === 'mecanico' ? 'mecanico@carcare.test' : 'taller@carcare.test')
await page.locator('input[autocomplete="current-password"]').fill('password')
await page.getByRole('button', { name: 'Entrar', exact: true }).click()
await page.waitForURL(/\/app\/\d+/, { timeout: 120000 })
// Espacio del taller (id 3 en la demo)
await page.goto(BASE + '/app/3', { waitUntil: 'domcontentloaded' })
const tag = `${who}-${theme}-${w}${motion === 'reduce' ? '-reduce' : ''}`
const shot = (name) => page.screenshot({ path: `${outDir}/${name}-${tag}.png` })
const log = (...a) => console.log(...a)

const has3d = +w >= 1024
if (has3d) {
  await page.locator('canvas').first().waitFor({ timeout: 120000 })
  await page.waitForFunction(() => !!window.__workshop3d, null, { timeout: 120000 }).catch(() => errs.push('sin __workshop3d'))
  await page.waitForTimeout(6000)
  const crew = await page.evaluate(() => window.__workshop3d?.crew?.() ?? null)
  log('figuras en escena:', JSON.stringify(crew))
  if (crew) {
    const ids = crew.map((c) => c.id)
    log('figuras únicas:', new Set(ids).size === ids.length ? 'sí' : 'NO (repetidas)')
  }
}
const text = async (re) => (await page.getByText(re).count()) > 0
log('baliza «En espera de técnico»:', await page.locator('[aria-label*="En espera de técnico"]').count())
log('baliza «está en el elevador 3»:', await page.locator('[aria-label*="está en el elevador 3"]').count())
log('almacén:', await page.getByText(/órdenes? esperan? piezas/).first().textContent().catch(() => 'no'))
log('KPI días en taller:', await page.getByText('Días en taller').count())
log('KPI listo para cobrar:', await page.getByText('Listo para cobrar').count())
await shot('general')

if (has3d) {
  await page.getByRole('button', { name: /Almacén y equipo/ }).click()
  await page.waitForTimeout(2500)
  await shot('vista-lateral')
  await page.keyboard.press('2')
  await page.waitForTimeout(2500)
  log('tecla 2 → elevadores pulsado:', await page.getByRole('button', { name: /^Elevadores/ }).getAttribute('aria-pressed'))
  await shot('vista-elevadores')
  await page.keyboard.press('1')
  await page.waitForTimeout(1500)

  // Persona sin orden en curso → su ficha
  await page.getByRole('button', { name: /^Sin orden en curso/ }).click()
  await page.waitForTimeout(2500)
  await shot('sin-orden-en-curso')
  const first = page.locator('section[aria-labelledby="floor-crew-title"]').getByRole('button').first()
  if (await first.count()) {
    await first.click()
    await page.waitForTimeout(2500)
    log('url ficha persona:', page.url().replace(BASE, ''))
    await shot('ficha-persona')
  } else {
    // sin región etiquetada: la lista es una <section aria-labelledby>
    const btn = page.locator('#floor-crew-title').locator('xpath=..').getByRole('button').first()
    if (await btn.count()) {
      await btn.click()
      await page.waitForTimeout(2500)
      log('url ficha persona:', page.url().replace(BASE, ''))
      await shot('ficha-persona')
    } else errs.push('sin lista de equipo')
  }
  await page.keyboard.press('Escape')
  await page.waitForTimeout(1500)
}

// Filtro «Atascadas»
await page.getByRole('button', { name: /Atascadas/ }).first().click()
await page.waitForTimeout(2500)
await shot('atascadas')
await page.getByRole('button', { name: /Atascadas/ }).first().click()

// Ficha de una orden en elevador (OT-2026-0026, elevador 1)
await page.goto(BASE + '/app/3?orden=27', { waitUntil: 'domcontentloaded' })
await page.getByRole('heading', { name: /Diagnóstico/ }).first().waitFor({ timeout: 90000 }).catch(() => errs.push('sin ficha de orden'))
await page.waitForTimeout(has3d ? 5000 : 1500)
log('ficha: diagnóstico:', await page.getByRole('heading', { name: /Diagnóstico/ }).count(), '| esperar piezas:', await page.getByRole('button', { name: 'Esperar piezas' }).count())
await shot('ficha-orden')

console.log(errs.length ? 'ERRORES:\n' + errs.join('\n') : 'sin errores en consola')
await browser.close()
