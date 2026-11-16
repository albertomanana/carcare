// Capturas de la portada (features/landing/shots.ts): 16:10, tema oscuro, 1280 px a 1,5x → WebP de 1200 y 640 px.
// Contra una BD sembrada aparte (demo limpia). Uso: node portada.mjs <dirSalida> [solo=nombre]
import { chromium } from 'file:///C:/Users/Alberto/Desktop/CarCare/frontend/node_modules/playwright/index.mjs'
import fs from 'node:fs'
const BASE = process.env.BASE ?? 'http://localhost:5192'
const [, , outDir, only = ''] = process.argv
fs.mkdirSync(outDir, { recursive: true })
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const errs = []

async function session(email) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1.5, colorScheme: 'dark', reducedMotion: 'reduce' })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message))
  await page.addInitScript(() => { try { localStorage.setItem('carcare.themeMode', 'dark') } catch {} })
  await page.goto(BASE + '/entrar', { waitUntil: 'domcontentloaded', timeout: 90000 })
  await page.getByRole('textbox', { name: /email/i }).fill(email)
  await page.locator('input[autocomplete="current-password"]').fill('password')
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await page.waitForURL(/\/app\/\d+/, { timeout: 90000 })
  const base = page.url().match(/\/app\/\d+/)[0]
  const api = (path) => page.evaluate(async (p) => (await fetch('/api/v1' + p, { headers: { Accept: 'application/json' }, credentials: 'include' })).json(), path)
  return { ctx, page, base, ws: base.split('/').pop(), api }
}

/** PNG de la ventana → WebP de 1200 y 640 px de ancho, codificado por el propio Chromium. */
async function save(page, name) {
  const png = (await page.screenshot({ type: 'png' })).toString('base64')
  for (const width of [1200, 640]) {
    const b64 = await page.evaluate(
      async ({ png, width }) => {
        const img = new Image()
        img.src = 'data:image/png;base64,' + png
        await img.decode()
        const c = document.createElement('canvas')
        c.width = width
        c.height = Math.round((width * img.height) / img.width)
        const g = c.getContext('2d')
        g.imageSmoothingQuality = 'high'
        g.drawImage(img, 0, 0, c.width, c.height)
        return c.toDataURL('image/webp', 0.82).split(',')[1]
      },
      { png, width },
    )
    fs.writeFileSync(`${outDir}/${name}-${width}.webp`, Buffer.from(b64, 'base64'))
  }
  fs.writeFileSync(`${outDir}/${name}.png`, Buffer.from(png, 'base64'))
  console.log('ok', name)
}
const want = (n) => !only || only === n

// ── Particular (demo@)
{
  const s = await session('demo@carcare.test')
  const { page, base, ws, api } = s
  const vehicles = (await api(`/workspaces/${ws}/vehicles`)).data
  const sportage = vehicles.find((v) => v.plate === '7310LFW')
  const ibiza = vehicles.find((v) => v.plate === '4821KTB')
  if (want('particular-zonas')) {
    await page.goto(`${BASE}${base}/vehiculos/${sportage.id}`, { waitUntil: 'domcontentloaded' })
    await page.getByRole('heading', { name: 'Zonas', exact: true }).waitFor({ timeout: 90000 })
    await page.waitForSelector('canvas', { timeout: 120000 }).catch(() => errs.push('zonas sin canvas'))
    await page.getByRole('heading', { name: 'Zonas', exact: true }).evaluate((el) => window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 150 }))
    await page.waitForTimeout(25000)
    await save(page, 'particular-zonas')
  }
  if (want('particular-gastos')) {
    await page.goto(`${BASE}${base}/vehiculos/${ibiza.id}/gastos`, { waitUntil: 'domcontentloaded' })
    await page.getByRole('heading', { name: 'Movimientos', exact: true }).waitFor({ timeout: 90000 })
    await page.getByRole('heading', { name: 'Por mes', exact: true }).evaluate((el) => window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 330 }))
    await page.waitForTimeout(3000)
    await save(page, 'particular-gastos')
  }
  if (want('solicitudes-directorio')) {
    await page.goto(`${BASE}${base}/talleres`, { waitUntil: 'domcontentloaded' })
    await page.getByText('Solicitar reparación').first().waitFor({ timeout: 90000 })
    await page.waitForTimeout(2000)
    await save(page, 'solicitudes-directorio')
  }
  if (want('solicitudes-presupuesto')) {
    const reqs = (await api(`/workspaces/${ws}/repair-requests?status=quoted`)).data
    await page.goto(`${BASE}${base}/solicitudes/${reqs[0].id}`, { waitUntil: 'domcontentloaded' })
    await page.getByText('no es una factura').first().waitFor({ timeout: 90000 })
    await page.getByText('no es una factura').first().evaluate((el) => window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 120 }))
    await page.waitForTimeout(2000)
    await save(page, 'solicitudes-presupuesto')
  }
  await s.ctx.close()
}

// ── Taller (taller@)
{
  const s = await session('taller@carcare.test')
  const { page, base, ws, api } = s
  if (want('taller-3d')) {
    await page.waitForSelector('canvas', { timeout: 120000 }).catch(() => errs.push('taller sin canvas'))
    await page.waitForTimeout(50000)
    await save(page, 'taller-3d')
  }
  if (want('taller-tablero')) {
    await page.goto(`${BASE}${base}/ordenes`, { waitUntil: 'domcontentloaded' })
    await page.getByText('Recibido').first().waitFor({ timeout: 90000 })
    await page.waitForTimeout(3000)
    await save(page, 'taller-tablero')
  }
  if (want('solicitudes-recibida')) {
    const reqs = (await api(`/workspaces/${ws}/repair-requests?status=pending`)).data
    await page.goto(`${BASE}${base}/solicitudes/${reqs[0].id}`, { waitUntil: 'domcontentloaded' })
    await page.getByText('Golpe seco').first().waitFor({ timeout: 90000 })
    await page.waitForTimeout(2500)
    await save(page, 'solicitudes-recibida')
  }
  await s.ctx.close()
}
console.log('errores:', errs.length ? errs : 'ninguno')
await browser.close()
