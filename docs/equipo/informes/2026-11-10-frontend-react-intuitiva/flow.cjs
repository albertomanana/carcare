// Flujo real de una cuenta nueva: primeros pasos del particular y del taller, foco al primer error y migas de pan.
const { createRequire } = require('module')
const req = createRequire('C:/Users/Alberto/Desktop/CarCare/frontend/package.json')
const { chromium } = req('playwright')
const path = require('path')

const BASE = 'http://localhost:5197'
const OUT = 'C:/Users/Alberto/Desktop/CarCare/docs/equipo/informes/2026-11-10-frontend-react-intuitiva'
const width = Number(process.argv[2] || 1280)
const theme = process.env.THEME || 'light'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const log = (...a) => console.log('·', ...a)
let ok = 0
let fail = 0
const check = (cond, what) => {
  if (cond) ok++
  else fail++
  console.log(cond ? 'OK  ' : 'FALLO', what)
}

async function settle(page) {
  await page.waitForLoadState('networkidle').catch(() => {})
  await page.waitForFunction(() => !document.querySelector('main .skeleton'), null, { timeout: 25000 }).catch(() => {})
  await sleep(600)
}
const shot = async (page, name) => {
  await settle(page)
  await page.screenshot({ path: path.join(OUT, `despues-flujo-${width}-${theme}-${name}.png`) })
}

async function register(page, type) {
  await page.goto(BASE + '/registro' + (type === 'workshop' ? '?tipo=taller' : ''))
  await page.getByLabel(/tu nombre/i).fill(type === 'workshop' ? 'Laura Taller' : 'Marta Nueva')
  await page.locator('input[type=email]').fill(`${type}-${Date.now()}@ejemplo.test`)
  if (type === 'workshop') await page.getByLabel(/nombre del taller/i).fill('Taller Prueba')
  await page.locator('input[autocomplete=new-password]').first().fill('password123')
  await page.locator('input[autocomplete=new-password]').nth(1).fill('password123')
  await page.getByRole('button', { name: /crear/i }).click()
  await page.waitForURL(/\/app\/\d+/, { timeout: 30000 })
  return new URL(page.url()).pathname.match(/\/app\/\d+/)[0]
}

;(async () => {
  const browser = await chromium.launch()
  const mobile = width < 500
  const ctx = await browser.newContext({ viewport: { width, height: mobile ? 780 : 860 }, colorScheme: theme, reducedMotion: 'reduce' })
  if (theme === 'dark') await ctx.addInitScript(() => localStorage.setItem('carcare.theme', 'dark'))
  const page = await ctx.newPage()
  page.on('pageerror', (e) => console.log('ERROR página', e.message))

  // ── Particular nuevo ──
  const base = await register(page, 'personal')
  await settle(page)
  await shot(page, 'p1-inicio-vacio')
  check(await page.getByText('Paso 1 de 3').isVisible(), 'Inicio vacío dice «Paso 1 de 3»')
  check((await page.locator('main a.bg-accent, main button.bg-accent, main [class*="bg-accent"]:is(a,button)').count()) <= 1, 'Una sola acción principal en Inicio vacío')
  await page.getByRole('link', { name: 'Añadir mi coche' }).click()
  await page.waitForURL(/vehiculos\/nuevo/)
  await settle(page)
  check(await page.getByText(/Paso 1 de 4/).isVisible(), 'El alta dice «Paso 1 de 4»')
  if (!mobile) check(await page.getByRole('navigation', { name: 'Ruta de navegación' }).locator('ol').getByText('Garaje').isVisible(), 'Migas «Garaje › Añadir vehículo»')
  // Siguiente sin marca: foco al primer error
  await page.getByRole('button', { name: 'Siguiente' }).click()
  await sleep(400)
  const focused = await page.evaluate(() => document.activeElement?.getAttribute('name'))
  check(focused === 'make', `Foco al primer error (marca): ${focused}`)
  check(await page.getByText('Indica la marca.').isVisible(), 'Error «Indica la marca.» junto al campo')
  await shot(page, 'p2-alta-error')
  await page.locator('input[name=make]').fill('Seat')
  await page.locator('input[name=model]').fill('Ibiza')
  await page.locator('input[name=year]').fill('2019')
  for (let i = 0; i < 3; i++) {
    await page.getByRole('button', { name: i === 0 ? 'Siguiente' : /Siguiente|Saltar este paso/ }).first().click()
    await sleep(300)
  }
  check(await page.getByText(/Paso 4 de 4/).isVisible(), 'Llega al paso de kilómetros')
  await page.locator('input[name=current_mileage]').fill('45230')
  await shot(page, 'p3-alta-km')
  const save = page.getByRole('button', { name: 'Guardar coche' })
  check(await save.isVisible(), 'El botón final dice «Guardar coche»')
  await save.click()
  await page.waitForURL(/vehiculos\/\d+$/, { timeout: 30000 })
  await settle(page)
  await shot(page, 'p4-ficha-nueva')
  if (!mobile) check((await page.getByRole('navigation', { name: 'Ruta de navegación' }).locator('ol [aria-current=page]').innerText()) === 'Seat Ibiza', 'Migas «Garaje › Seat Ibiza» en el Resumen')
  else check((await page.getByRole('navigation', { name: 'Ruta de navegación' }).getByRole('link').innerText()).includes('Garaje'), 'En el móvil, «← Garaje» desde el Resumen')
  if (!mobile) check((await page.locator('aside a[aria-current=page]').first().innerText()).includes('Garaje'), 'En la ficha, «Garaje» marcado en la barra')
  await page.goto(BASE + base)
  await settle(page)
  check(await page.getByText('Paso 3 de 3').isVisible(), 'Con coche y km, Inicio dice «Paso 3 de 3»')
  check(!(await page.getByRole('button', { name: /^Registrar/ }).first().isVisible().catch(() => false)) || mobile, 'Sin «Registrar ▾» mientras se ve la guía')
  await shot(page, 'p5-inicio-paso3')
  await page.getByRole('button', { name: 'Ocultar guía' }).click()
  await settle(page)
  check(await page.getByRole('heading', { name: 'Pendiente' }).isVisible(), 'Al ocultar la guía sale «Pendiente»')
  await shot(page, 'p6-inicio-sin-guia')

  // ── Taller nuevo ──
  await ctx.clearCookies()
  const ctx2 = await browser.newContext({ viewport: { width, height: mobile ? 780 : 860 }, colorScheme: theme, reducedMotion: 'reduce' })
  if (theme === 'dark') await ctx2.addInitScript(() => localStorage.setItem('carcare.theme', 'dark'))
  const p2 = await ctx2.newPage()
  p2.on('pageerror', (e) => console.log('ERROR página', e.message))
  const wbase = await register(p2, 'workshop')
  await settle(p2)
  await shot(p2, 't1-inicio-taller')
  check(await p2.getByText('Paso 1 de 3').isVisible(), 'Taller nuevo: «Paso 1 de 3» (elevadores)')
  check(await p2.getByRole('heading', { level: 1, name: 'Inicio' }).isVisible(), 'El título del taller es «Inicio»')
  await p2.getByRole('button', { name: /está bien/ }).click()
  await sleep(400)
  check(await p2.getByText('Paso 2 de 3').isVisible(), 'Tras confirmar elevadores: «Paso 2 de 3»')
  await shot(p2, 't2-inicio-cliente')
  await p2.getByRole('link', { name: 'Cambiar los elevadores' }).count().then((n) => check(n === 0, 'El paso hecho ya no enseña su botón'))
  // Ajustes con el diálogo abierto
  await p2.goto(BASE + `/app/ajustes?ajustar=${wbase.split('/').pop()}#espacios`)
  await settle(p2)
  check(await p2.getByRole('dialog', { name: 'Ajustes del taller' }).isVisible(), '?ajustar abre «Ajustes del taller»')
  await shot(p2, 't3-ajustes-elevadores')
  await p2.keyboard.press('Escape')
  if (!mobile) {
    // Barra lateral: grupos
    await p2.goto(BASE + wbase)
    await settle(p2)
    for (const g of ['Día a día', 'Clientes y vehículos', 'Gestión']) check(await p2.locator('aside').getByText(g, { exact: true }).isVisible(), `Grupo «${g}» en la barra`)
  }
  console.log(`\n${ok} bien, ${fail} fallos`)
  await browser.close()
  process.exit(fail ? 1 : 0)
})().catch((e) => {
  console.error(e)
  process.exit(1)
})
