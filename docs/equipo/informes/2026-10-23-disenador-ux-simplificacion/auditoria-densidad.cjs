// Auditoría UX de CarCare: capturas + métricas de densidad por pantalla (1280 y 360 px).
// Uso: node audit.cjs [personal|workshop|mechanic|guest] [filtro]
const { createRequire } = require('module')
const req = createRequire('C:/Users/Alberto/Desktop/CarCare/frontend/package.json')
const { chromium } = req('playwright')
const fs = require('fs')
const path = require('path')

const OUT = path.join(__dirname, 'shots')
const BASE = process.env.UX_BASE || 'http://localhost:5173'
const which = process.argv[2] || 'personal'
const filter = process.argv[3] || ''

const ACCOUNTS = {
  personal: 'demo@carcare.test',
  workshop: 'taller@carcare.test',
  mechanic: 'mecanico@carcare.test',
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function metrics(page) {
  return page.evaluate(() => {
    const root = document.querySelector('main') || document.body
    const vis = (el) => {
      const r = el.getBoundingClientRect()
      const cs = getComputedStyle(el)
      return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none'
    }
    const all = [...root.querySelectorAll('*')].filter(vis)
    const cls = (el) => (typeof el.className === 'string' ? el.className : el.className?.baseVal || '')
    const isCard = (el) => /rounded-(card|hero)/.test(cls(el)) && /\bborder\b/.test(cls(el)) && !/skeleton/.test(cls(el))
    const cards = all.filter(isCard)
    const nested = cards.filter((c) => {
      let p = c.parentElement
      while (p && p !== root) {
        if (isCard(p)) return true
        p = p.parentElement
      }
      return false
    })
    const pills = all.filter((el) => {
      const c = cls(el)
      if (!/rounded-full/.test(c)) return false
      const r = el.getBoundingClientRect()
      return r.height <= 28 && r.height >= 14 && (el.innerText || '').trim().length > 0 && r.width > 24
    })
    const upper = all.filter((el) => {
      const cs = getComputedStyle(el)
      if (cs.textTransform !== 'uppercase') return false
      const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())
      return own && parseFloat(cs.letterSpacing || '0') > 0
    })
    const icons = root.querySelectorAll('svg.lucide').length
    const svgVisible = [...root.querySelectorAll('svg.lucide')].filter(vis).length
    const buttons = all.filter((el) => el.tagName === 'BUTTON' || (el.tagName === 'A' && el.getAttribute('href')))
    const primary = all.filter((el) => (el.tagName === 'BUTTON' || el.tagName === 'A') && /(^|\s)bg-accent(\s|$)/.test(cls(el)))
    const headings = all.filter((el) => /^H[1-4]$/.test(el.tagName)).map((h) => h.tagName + ':' + h.innerText.trim().slice(0, 50))
    const bigNums = all.filter((el) => {
      const cs = getComputedStyle(el)
      return parseFloat(cs.fontSize) >= 22 && /\d/.test(el.innerText || '') && [...el.childNodes].some((n) => n.nodeType === 3 && /\d/.test(n.textContent))
    }).map((e) => e.innerText.trim().replace(/\s+/g, ' ').slice(0, 30))
    const gradients = all.filter((el) => /gradient/.test(getComputedStyle(el).backgroundImage) && !/skeleton/.test(cls(el))).length
    const blurs = all.filter((el) => {
      const cs = getComputedStyle(el)
      return (cs.backdropFilter && cs.backdropFilter !== 'none') || /blur/.test(cs.filter)
    }).length
    const text = (root.innerText || '').trim()
    const words = text.split(/\s+/).filter(Boolean).length
    const canvases = document.querySelectorAll('canvas').length
    const imgs = document.querySelectorAll('main img').length
    return {
      cards: cards.length,
      nestedCards: nested.length,
      pills: pills.length,
      pillTexts: pills.slice(0, 40).map((p) => p.innerText.trim().replace(/\s+/g, ' ').slice(0, 28)),
      upperLabels: upper.length,
      upperTexts: upper.slice(0, 30).map((u) => u.innerText.trim().slice(0, 30)),
      iconsInMain: svgVisible,
      interactive: buttons.length,
      primaryButtons: primary.map((p) => p.innerText.trim().slice(0, 30)),
      headings,
      bigNumbers: bigNums,
      gradients,
      blurs,
      words,
      domNodes: root.querySelectorAll('*').length,
      canvases,
      imgs,
      pageHeight: document.documentElement.scrollHeight,
      viewportH: window.innerHeight,
    }
  })
}

async function waitReady(page, t0) {
  let firstCanvas = null
  let ready = null
  let stableSince = null
  for (let i = 0; i < 200; i++) {
    const s = await page.evaluate(() => {
      const visible = (el) => {
        const r = el.getBoundingClientRect()
        return r.width > 0 && r.height > 0
      }
      return {
        skel: [...document.querySelectorAll('.skeleton')].filter(visible).length,
        spin: [...document.querySelectorAll('.animate-spin')].filter(visible).length,
        busy: [...document.querySelectorAll('[aria-busy="true"]')].filter(visible).length,
        canvas: document.querySelectorAll('canvas').length,
        text: (document.querySelector('main')?.innerText || document.body.innerText || '').length,
      }
    })
    const now = Date.now() - t0
    if (s.canvas && firstCanvas === null) firstCanvas = now
    const ok = s.skel === 0 && s.spin === 0 && s.busy === 0 && s.text > 40
    if (ok) {
      if (stableSince === null) stableSince = now
      if (now - stableSince > 600) {
        ready = stableSince
        break
      }
    } else stableSince = null
    await sleep(100)
  }
  return { ready, firstCanvas }
}

async function login(context, email) {
  const page = await context.newPage()
  await page.goto(BASE + '/entrar', { waitUntil: 'load' })
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Contraseña').fill('password')
  await page.getByRole('button', { name: 'Entrar' }).click()
  await page.waitForURL(/\/app\/[^/]+/, { timeout: 20000 })
  await sleep(800)
  const url = new URL(page.url())
  const ws = url.pathname.split('/')[2]
  return { page, ws }
}

async function apiGet(page, p) {
  return page.evaluate(async (p) => {
    const r = await fetch('/api/v1' + p, { headers: { Accept: 'application/json' }, credentials: 'include' })
    return r.json()
  }, p)
}

async function audit(context, name, url, width, opts = {}) {
  const page = await context.newPage()
  await page.setViewportSize({ width, height: width === 360 ? 780 : 860 })
  const api = []
  const three = new Set()
  const aborted = []
  const short = (r) => r.method() + ' ' + r.url().replace(/^https?:\/\/[^/]+/, '').replace(/\?.*$/, (q) => (q.length > 40 ? q.slice(0, 40) + '…' : q))
  page.on('requestfinished', (r) => {
    if (r.url().includes('/api/v1/')) api.push(short(r))
  })
  page.on('requestfailed', (r) => {
    if (r.url().includes('/api/v1/')) aborted.push(short(r))
  })
  page.on('request', (r) => {
    const u = r.url()
    if (/three|@react-three|drei/.test(u) && u.includes('.vite/deps')) three.add(u.split('/').pop().split('?')[0])
  })
  const t0 = Date.now()
  await page.goto(BASE + url, { waitUntil: 'load', timeout: 60000 }).catch((e) => console.error('goto lento', name, e.message.split(String.fromCharCode(10))[0]))
  const { ready, firstCanvas } = await waitReady(page, t0)
  await sleep(opts.extraWait ?? 1500)
  const m = await metrics(page)
  const file = `${which}-${name}-${width}.png`
  await page.screenshot({ path: path.join(OUT, file), fullPage: true, timeout: 60000 }).catch((e) => console.error('captura', e.message.split(String.fromCharCode(10))[0]))
  // Captura solo de la primera pantalla (lo que se ve sin desplazarse)
  await page.screenshot({ path: path.join(OUT, `${which}-${name}-${width}-fold.png`), fullPage: false, timeout: 60000 }).catch(() => {})
  await page.close()
  return { name, url, width, readyMs: ready, firstCanvasMs: firstCanvas, apiCount: api.length, api, aborted, threeChunks: [...three], ...m, file }
}

;(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
  const context = await browser.newContext({ locale: 'es-ES', viewport: { width: 1280, height: 860 } })
  let screens = []
  if (which === 'guest') {
    screens = [
      ['portada', '/'],
      ['login', '/entrar'],
      ['registro', '/registro'],
    ]
  } else {
    const { page, ws } = await login(context, ACCOUNTS[which])
    const b = `/app/${ws}`
    const vehicles = (await apiGet(page, `/workspaces/${ws}/vehicles?per_page=50`)).data || []
    console.error('ws', ws, 'vehicles', vehicles.map((v) => v.id + ':' + v.display_name).join(', '))
    const v = vehicles[0]?.id
    if (which === 'personal') {
      screens = [
        ['cabina', b],
        ['garaje', `${b}/garaje`],
        ['ficha-resumen', `${b}/vehiculos/${v}`],
        ['ficha-diario', `${b}/vehiculos/${v}/diario`],
        ['ficha-historial', `${b}/vehiculos/${v}/historial`],
        ['ficha-gastos', `${b}/vehiculos/${v}/gastos`],
        ['ficha-recordatorios', `${b}/vehiculos/${v}/recordatorios`],
        ['ficha-documentos', `${b}/vehiculos/${v}/documentos`],
        ['ficha-datos', `${b}/vehiculos/${v}/datos`],
        ['form-vehiculo', `${b}/vehiculos/nuevo`],
        ['form-intervencion', `${b}/vehiculos/${v}/intervenciones/nueva`],
        ['agenda', `${b}/agenda`],
        ['analitica', `${b}/analitica`],
        ['ajustes', `/app/ajustes`],
        ['informe', `${b}/vehiculos/${v}/informe`],
      ]
    } else {
      const orders = (await apiGet(page, `/workspaces/${ws}/work-orders?per_page=50`)).data || []
      const customers = (await apiGet(page, `/workspaces/${ws}/customers?per_page=5`)).data || []
      const o = (orders.find((x) => x.status === 'in_progress') || orders[0])?.id
      const c = customers[0]?.id
      console.error('orders', orders.length, 'customers', customers.length)
      screens =
        which === 'workshop'
          ? [
              ['centro', b],
              ['ordenes', `${b}/ordenes`],
              ['orden-detalle', `${b}/ordenes/${o}`],
              ['orden-nueva', `${b}/ordenes/nueva`],
              ['clientes', `${b}/clientes`],
              ['cliente-detalle', `${b}/clientes/${c}`],
              ['equipo', `${b}/equipo`],
              ['taller3d', `${b}/taller`],
              ['vehiculos', `${b}/garaje`],
              ['ficha-taller', `${b}/vehiculos/${v}`],
              ['ficha-ordenes', `${b}/vehiculos/${v}/ordenes`],
              ['agenda-flota', `${b}/agenda`],
              ['facturacion', `${b}/analitica`],
            ]
          : [
              ['centro', b],
              ['ordenes', `${b}/ordenes`],
              ['orden-detalle', `${b}/ordenes/${o}`],
            ]
    }
    await page.close()
  }
  if (filter) screens = screens.filter(([n]) => n.includes(filter))
  const state = await context.storageState()
  await browser.close()
  const results = []
  for (const [name, url] of screens) {
    for (const width of [1280, 360]) {
      const b2 = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
      const c2 = await b2.newContext({ locale: 'es-ES', viewport: { width, height: 860 }, storageState: state })
      try {
        const r = await audit(c2, name, url, width)
        results.push(r)
        console.error(`${name} ${width}: listo ${r.readyMs} ms, canvas ${r.canvases}, api ${r.apiCount}, tarjetas ${r.cards} (anidadas ${r.nestedCards}), píldoras ${r.pills}, MAYÚS ${r.upperLabels}, alto ${r.pageHeight}`)
      } catch (e) {
        console.error('ERROR', name, width, e.message.split(String.fromCharCode(10))[0])
      }
      await b2.close()
    }
  }
  fs.writeFileSync(path.join(__dirname, `metrics-${which}${filter ? '-' + filter : ''}.json`), JSON.stringify(results, null, 2))
})()
