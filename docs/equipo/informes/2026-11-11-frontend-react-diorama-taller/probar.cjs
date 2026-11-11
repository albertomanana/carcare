// Interacción + axe de la portada y pantallas del taller. Uso: node probar.cjs
const { createRequire } = require('module')
const req = createRequire('C:/Users/Alberto/Desktop/CarCare/frontend/package.json')
const { chromium } = req('playwright')
const AxeBuilder = req('@axe-core/playwright').default || req('@axe-core/playwright')
const path = require('path')
const BASE = process.env.BASE || 'http://localhost:5202'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const out = []
const log = (...a) => { console.log(...a); out.push(a.join(' ')) }
async function login(page, email) {
  await page.goto(BASE + '/entrar', { waitUntil: 'domcontentloaded', timeout: 90000 })
  await page.locator('input[type=email]').fill(email)
  await page.locator('input[autocomplete=current-password]').fill('password')
  await page.getByRole('button', { name: /entrar/i }).click()
  await page.waitForURL(/\/app\/\d+/, { timeout: 60000 })
}
async function ready(page, extra = 6000) {
  await page.waitForFunction(() => !!document.querySelector('main#contenido h1') && !document.querySelector('main#contenido .skeleton') && !document.querySelector('main#contenido [role=status]'), null, { timeout: 60000 }).catch(() => log('sigue cargando'))
  await page.waitForLoadState('networkidle').catch(() => {})
  await sleep(extra)
}
async function axe(page, name) {
  const res = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
  log(`axe ${name}:`, res.violations.length === 0 ? 'sin violaciones' : JSON.stringify(res.violations.map((v) => `${v.id} x${v.nodes.length}: ${v.nodes[0].target.join(' ')}`)))
}
;(async () => {
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
  for (const theme of ['light', 'dark']) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: theme, reducedMotion: 'reduce' })
    await ctx.addInitScript((t) => localStorage.setItem('carcare.theme', t), theme)
    const page = await ctx.newPage()
    await login(page, 'taller@carcare.test')
    const base = new URL(page.url()).pathname.replace(/\/$/, '')
    await ready(page)
    if (theme === 'light') await axe(page, 'portada')
    // elegir una fila
    const row = page.locator('[id^=floor-row-]').first()
    await row.click()
    await sleep(4000)
    log(theme, 'URL tras elegir fila:', page.url().replace(BASE, ''))
    await page.screenshot({ path: path.join(__dirname, `despues-ficha-${theme}-1440.png`) })
    if (theme === 'light') {
      await axe(page, 'portada con ficha')
      log('importe visible (propietario):', await page.getByText('Total (con IVA)').count())
    }
    await page.keyboard.press('Escape')
    await sleep(1500)
    log(theme, 'URL tras Escape:', page.url().replace(BASE, ''))
    if (theme === 'light') {
      // misión: pulsar la primera de órdenes
      const mission = page.locator('.mission').first()
      if (await mission.count()) { await mission.click(); await sleep(1500); log('URL tras pulsar misión:', page.url().replace(BASE, '')); await page.keyboard.press('Escape'); await sleep(800) }
      // redirección /taller
      await page.goto(BASE + base + '/taller?orden=27', { waitUntil: 'domcontentloaded' })
      await page.waitForURL(/\/app\/\d+\?orden=27/, { timeout: 20000 }).catch(() => {})
      log('/taller?orden=27 →', page.url().replace(BASE, ''))
      for (const [name, p] of [['ordenes', '/ordenes'], ['lista', '/ordenes?vista=lista'], ['clientes', '/clientes'], ['equipo', '/equipo'], ['nueva', '/ordenes/nueva'], ['solicitudes', '/solicitudes']]) {
        await page.goto(BASE + base + p, { waitUntil: 'domcontentloaded' })
        await ready(page, 1500)
        await axe(page, name)
      }
    }
    await ctx.close()
  }
  // mecánico: sin importes
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' })
  const page = await ctx.newPage()
  await login(page, 'mecanico@carcare.test')
  await ready(page)
  await page.locator('[id^=floor-row-]').first().click()
  await sleep(3000)
  log('mecánico: importe visible:', await page.getByText('Total (con IVA)').count(), '· misiones:', await page.locator('.mission').count())
  await page.screenshot({ path: path.join(__dirname, 'despues-mecanico-light-1440.png') })
  await ctx.close()
  await browser.close()
  require('fs').writeFileSync(path.join(__dirname, 'probar-resultado.txt'), out.join('\n'))
})().catch((e) => { console.error(e); process.exit(1) })
