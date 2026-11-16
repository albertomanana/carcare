// Fase 4 · el formulario de gasto envía lo que dice el contrato. El POST se intercepta: NO se escribe en la base de datos.
import { chromium } from 'file:///C:/Users/Alberto/Desktop/CarCare/frontend/node_modules/playwright/index.mjs'
const BASE = 'http://localhost:5191'
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' })
const page = await ctx.newPage()
const errs = []
page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message))
await page.goto(BASE + '/entrar', { waitUntil: 'domcontentloaded', timeout: 90000 })
await page.getByRole('textbox', { name: /email/i }).fill('demo@carcare.test')
await page.locator('input[autocomplete="current-password"]').fill('password')
await page.getByRole('button', { name: 'Entrar', exact: true }).click()
await page.waitForURL(/\/app\/\d+/, { timeout: 90000 })
const base = page.url().match(/\/app\/\d+/)[0]

const sent = []
await page.route('**/api/v1/vehicles/1/expenses', async (route) => {
  const req = route.request()
  if (req.method() !== 'POST') return route.continue()
  const body = req.postDataJSON()
  sent.push(body)
  // respuesta de mentira con la forma del contrato: nada llega al servidor
  await route.fulfill({
    status: 201,
    contentType: 'application/json',
    body: JSON.stringify({ data: { id: 999999, vehicle_id: 1, category: body.category, description: body.description, amount: body.amount, currency: 'EUR', expense_date: body.expense_date, mileage: null, fuel_quantity: null, fuel_unit: null, full_tank: null, maintenance_record_id: null, is_linked: false, recurrence_months: body.recurrence_months ?? null, renewal: null, origin: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() } }),
  })
})

const open = async () => {
  await page.goto(BASE + base + '/vehiculos/1/gastos', { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Añadir gasto' }).first().click({ timeout: 60000 })
  await page.getByRole('dialog').waitFor({ timeout: 15000 })
  return page.getByRole('dialog')
}

// 1 · seguro anual con renovación propuesta
let d = await open()
await d.getByText('Seguro', { exact: true }).click()
await d.getByLabel('Importe').fill('389,40')
await d.getByText('Anual', { exact: true }).click()
await d.getByRole('button', { name: 'Guardar gasto' }).click()
await page.waitForTimeout(1500)

// 2 · reparación creando la intervención; primero sin nombre (debe avisar y no enviar)
d = await open()
await d.getByText('Reparación', { exact: true }).click()
await d.getByLabel('Importe').fill('180')
await d.getByText('Crear la intervención', { exact: true }).click()
await d.getByRole('button', { name: 'Guardar gasto e intervención' }).click()
await page.waitForTimeout(600)
const warned = await d.getByText('Ponle un nombre a la intervención').isVisible().catch(() => false)
const before = sent.length
await d.getByLabel('Qué se hizo').fill('Cambio de discos')
await d.getByLabel('Taller').fill('Taller Sur')
await d.getByLabel('Zona del coche').selectOption('brakes')
await d.getByRole('button', { name: 'Guardar gasto e intervención' }).click()
await page.waitForTimeout(1500)

// 3 · combustible: sin periodicidad ni intervención
d = await open()
await d.getByLabel('Importe').fill('50')
const noExtras = !(await d.getByText('¿Se repite?').isVisible().catch(() => false)) && !(await d.getByText('Crear la intervención').isVisible().catch(() => false))
await d.getByRole('button', { name: 'Guardar repostaje' }).click()
await page.waitForTimeout(1500)

console.log('aviso sin nombre:', warned, '| enviado antes de corregir:', before === 1 ? 'no' : 'SÍ')
console.log('combustible sin apartados extra:', noExtras)
for (const b of sent) console.log(JSON.stringify(b))
console.log('errores:', errs.length ? errs : 'ninguno')
await browser.close()
