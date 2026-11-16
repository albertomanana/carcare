// Fase 4 · capturas: analítica con mes pulsable, lista de gastos con origen y renovación, formulario de gasto
import { chromium } from 'file:///C:/Users/Alberto/Desktop/CarCare/frontend/node_modules/playwright/index.mjs'
const BASE = 'http://localhost:5191'
const [, , outDir, theme = 'dark', w = '1280', h = '900', who = 'demo'] = process.argv
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const ctx = await browser.newContext({ viewport: { width: +w, height: +h }, colorScheme: theme, reducedMotion: 'reduce' })
const page = await ctx.newPage()
const errs = []
page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message))
page.on('console', (m) => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text().slice(0, 300)) })
page.on('response', (r) => { if (r.status() >= 500) errs.push(r.status() + ' ' + r.url()) })
await page.addInitScript((t) => { try { localStorage.setItem('carcare.themeMode', t) } catch {} }, theme)
await page.goto(BASE + '/entrar', { waitUntil: 'domcontentloaded', timeout: 90000 })
await page.getByRole('textbox', { name: /email/i }).fill(who === 'taller' ? 'taller@carcare.test' : 'demo@carcare.test')
await page.locator('input[autocomplete="current-password"]').fill('password')
await page.getByRole('button', { name: 'Entrar', exact: true }).click()
await page.waitForURL(/\/app\/\d+/, { timeout: 90000 })
const base = page.url().match(/\/app\/\d+/)[0]
const tag = `${who}-${theme}-${w}`
const full = (name) => page.screenshot({ path: `${outDir}/${name}-${tag}.png`, fullPage: true })

// Analítica: elegir un mes pulsando su barra
await page.goto(BASE + base + '/analitica', { waitUntil: 'domcontentloaded' })
const bars = page.getByRole('group', { name: /por mes/i }).getByRole('button')
await bars.first().waitFor({ timeout: 60000 }).catch(() => errs.push('sin barras'))
await page.waitForTimeout(1500)
await full('analitica')
const names = await bars.evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')))
console.log('meses:', names.length, '| último:', names[names.length - 1])
// el penúltimo mes (el anterior al actual) suele tener más movimiento
const target = bars.nth(Math.max(0, names.length - (process.env.BACK ? +process.env.BACK : 2)))
await target.click()
await page.getByText('Detalle del mes').waitFor({ timeout: 30000 }).catch(() => errs.push('sin detalle'))
await page.waitForTimeout(2500)
console.log('url:', page.url().replace(BASE, ''), '| pulsado:', await target.getAttribute('aria-pressed'))
await full('analitica-mes')
// teclado: el siguiente mes con Tab + Enter
await target.focus()
await page.keyboard.press('Tab')
await page.keyboard.press('Enter')
await page.waitForTimeout(2500)
console.log('tras teclado:', page.url().replace(BASE, ''))

if (who === 'demo') {
  await page.goto(BASE + base + '/vehiculos/1/gastos?periodo=last_12', { waitUntil: 'domcontentloaded' })
  await page.getByRole('heading', { name: 'Movimientos' }).waitFor({ timeout: 60000 }).catch(() => errs.push('sin movimientos'))
  await page.waitForTimeout(2500)
  await full('gastos')
  await page.getByRole('button', { name: 'Añadir gasto' }).first().click()
  await page.getByRole('dialog').waitFor({ timeout: 15000 })
  await page.getByRole('dialog').getByText('Seguro', { exact: true }).click()
  await page.getByRole('dialog').getByText('Anual', { exact: true }).click()
  await page.waitForTimeout(600)
  console.log('renovación propuesta:', await page.getByLabel('Próxima renovación').inputValue())
  await page.screenshot({ path: `${outDir}/form-periodico-${tag}.png` })
  await page.getByRole('dialog').getByText('Reparación', { exact: true }).click()
  await page.getByRole('dialog').getByText('Crear la intervención', { exact: true }).click()
  await page.waitForTimeout(600)
  await page.screenshot({ path: `${outDir}/form-intervencion-${tag}.png` })
}
console.log('errores:', errs.length ? errs.slice(0, 8) : 'ninguno')
await browser.close()
