// Comprobación final de la portada (tarea 36, 04/11) contra la build de producción. Uso:
//   node comprobar-final.cjs <url> <carpeta-capturas> <fichero-informe> [bloques separados por comas]
// Parte de ../comprobar.cjs (03/11) y añade: tema claro a 360/768/1280 con las mismas comprobaciones, recorrido con
// Shift+Tab (hacia atrás, donde la cabecera fija puede tapar el foco), foco "sin tapar" comprobado en 5 puntos del
// elemento (centro y esquinas) y no solo en el centro, "Saltar al contenido" (oculto sin foco, con su relleno al
// recibirlo y Enter lleva el foco al <main>), "Ver capturas" y el cambio de tema con el teclado, y el contraste del
// pie "Modelo genérico, sin marca." calculado a mano (axe lo deja "por revisar" cuando queda encima de otra capa).
// Cada línea del informe se escribe en disco en cuanto se produce.
const fs = require('node:fs')
const path = require('node:path')
const FE = 'C:/Users/Alberto/Desktop/CarCare/frontend/node_modules'
const { chromium } = require(FE + '/playwright')
const AxeBuilder = require(FE + '/@axe-core/playwright').default

const [BASE, OUT, LOG, ONLY] = process.argv.slice(2)
const only = ONLY ? ONLY.split(',') : null
const want = (k) => !only || only.includes(k)
const ARGS = ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist']
const THREE_RE = /\/assets\/(three|HeroCanvas|Stage)-[^/]*\.js/
let failures = 0
fs.mkdirSync(OUT, { recursive: true })
fs.writeFileSync(LOG, `Comprobación final · ${new Date().toISOString()} · ${BASE}\n`)
const out = (line) => {
  fs.appendFileSync(LOG, line + '\n')
  console.log(line)
}
const ok = (cond, msg, extra) => {
  if (!cond) failures++
  out(`${cond ? 'OK  ' : 'FALLO'} ${msg}${extra !== undefined ? ' · ' + (typeof extra === 'string' ? extra : JSON.stringify(extra)) : ''}`)
}
const note = (msg) => out(`     ${msg}`)

async function open(browser, { width, height, reduced = false, theme = null, block3d = false, storage = null, query = '' }) {
  const ctx = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 1,
    reducedMotion: reduced ? 'reduce' : 'no-preference',
    colorScheme: theme === 'light' ? 'light' : 'dark',
    hasTouch: width < 1024,
    isMobile: width < 768,
  })
  await ctx.addInitScript(
    ({ theme, storage }) => {
      if (sessionStorage.getItem('__init')) return
      sessionStorage.setItem('__init', '1')
      if (theme) localStorage.setItem('carcare.theme', theme)
      if (storage) for (const [k, v] of Object.entries(storage)) localStorage.setItem(k, v)
    },
    { theme, storage },
  )
  if (block3d) await ctx.route(THREE_RE, (r) => r.abort())
  const page = await ctx.newPage()
  const s = { ctx, page, errors: [], three: [], t0: Date.now() }
  page.on('console', (m) => {
    if (m.type() !== 'error') return
    const t = m.text()
    // El navegador anota el 401 de /api/v1/me de un visitante sin sesión: no es un error de la app
    if (/Failed to load resource: the server responded with a status of 401/.test(t)) return
    s.errors.push(t.slice(0, 200))
  })
  page.on('pageerror', (e) => s.errors.push('pageerror: ' + e.message.slice(0, 200)))
  page.on('request', (r) => THREE_RE.test(r.url()) && s.three.push({ url: r.url().replace(/^.*\/assets\//, ''), t: Date.now() - s.t0 }))
  await page.goto(BASE + query, { waitUntil: 'load' })
  await page.locator('h1').waitFor()
  return s
}

const controls = (page) =>
  page.evaluate(() => {
    const btn = document.querySelector('button[aria-controls="portada-visual"]')
    return {
      canvas: document.querySelectorAll('#portada-visual canvas').length,
      button: btn && btn.offsetParent ? btn.textContent.trim() : null,
      storage: localStorage.getItem('carcare.landing3d'),
      caption: [...document.querySelectorAll('[aria-live="polite"]')].map((p) => p.textContent.trim()).filter(Boolean).join(' | '),
    }
  })

async function overflow(page) {
  return page.evaluate(() => {
    const vw = document.documentElement.clientWidth
    const outEls = [...document.querySelectorAll('body *')]
      .filter((e) => {
        if (e.closest('#portada-visual')) return false // el coche es más ancho a propósito y su caja lo recorta
        // "Saltar al contenido" vive fuera de la pantalla (arriba) hasta recibir el foco
        if (e.matches('a[href="#contenido"]')) return false
        const r = e.getBoundingClientRect()
        return r.width > 0 && r.height > 0 && (r.right > vw + 1 || r.left < -1)
      })
      .slice(0, 5)
      .map((e) => e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + '.' + String(e.className).slice(0, 50))
    return { scrollW: document.documentElement.scrollWidth, clientW: vw, out: outEls }
  })
}

/** Texto de la portada: todo visible desde el principio (sin opacidad 0 ni "aparece al hacer scroll"). */
async function contentVisible(page) {
  return page.evaluate(() => {
    const els = [...document.querySelectorAll('main h1, main h2, main h3, main p, main dt, main dd, main li, main figcaption')].filter((e) => !e.closest('#portada-visual'))
    const hidden = els.filter((e) => {
      let n = e
      while (n && n !== document.body) {
        const cs = getComputedStyle(n)
        if (cs.opacity === '0' || cs.visibility === 'hidden' || cs.display === 'none') return true
        n = n.parentElement
      }
      return false
    })
    return { total: els.length, hidden: hidden.slice(0, 5).map((e) => e.textContent.trim().slice(0, 40)), h2: [...document.querySelectorAll('main h2')].map((h) => h.textContent.trim()) }
  })
}

// Baja hasta cada captura con element.scrollIntoView (como un ancla o la rueda) y espera a que cargue (5 s como
// mucho). No usa locator.scrollIntoViewIfNeeded de Playwright: con el lienzo 3D pintando, tras ese desplazamiento
// (CDP) Chromium tardaba 6-10 s en pedir las imágenes diferidas, y con la rueda, PageDown o scrollIntoView las pide en
// menos de 200 ms (lazy.cjs y lazy2.cjs, 04/11).
async function screenshotsLoad(page) {
  const n = await page.locator('main figure img').count()
  for (let i = 0; i < n; i++) {
    await page.evaluate((i) => document.querySelectorAll('main figure img')[i].scrollIntoView({ block: 'center' }), i)
    await page.waitForFunction((i) => { const img = document.querySelectorAll('main figure img')[i]; return img.complete && img.naturalWidth > 0 }, i, { timeout: 5000 }).catch(() => {})
  }
  await page.waitForTimeout(300)
  const r = await page.evaluate(() => [...document.querySelectorAll('main figure img')].map((i) => ({ src: i.currentSrc.replace(/^.*\/portada\//, ''), ok: i.complete && i.naturalWidth > 0, alt: i.alt.length })))
  await page.evaluate(() => window.scrollTo(0, 0))
  return r
}

/** Datos del elemento con el foco: contorno, :focus-visible, dentro de la ventana y qué hay encima en 5 puntos. */
const focusInfo = () => {
  const e = document.activeElement
  if (!e || e === document.body) return null
  const r = e.getBoundingClientRect()
  const cs = getComputedStyle(e)
  const pts = [
    [r.left + r.width / 2, r.top + r.height / 2],
    [r.left + 3, r.top + 3],
    [r.right - 3, r.top + 3],
    [r.left + 3, r.bottom - 3],
    [r.right - 3, r.bottom - 3],
  ]
  const covered = []
  for (const [x, y] of pts) {
    if (x < 0 || y < 0 || x >= window.innerWidth || y >= window.innerHeight) {
      covered.push('fuera')
      continue
    }
    const top = document.elementFromPoint(x, y)
    if (!(top && (top === e || e.contains(top)))) covered.push(top ? top.tagName.toLowerCase() + '.' + String(top.className).slice(0, 30) : 'null')
  }
  return {
    name: (e.getAttribute('aria-label') || e.textContent || e.tagName).trim().replace(/\s+/g, ' ').slice(0, 40),
    tag: e.tagName.toLowerCase(),
    outline: cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) >= 2,
    focusVisible: e.matches(':focus-visible'),
    inView: r.bottom > 0 && r.top < window.innerHeight && r.width > 0,
    // Tapado del todo (WCAG 2.4.11, AA): los 5 puntos tapados. Tapado en parte (2.4.12, AAA): alguno.
    hidden: covered.length === pts.length,
    partly: covered.length > 0 ? covered : undefined,
  }
}

/** Recorre la página con Tab (o Shift+Tab desde el final) hasta dar la vuelta. */
async function tabWalk(page, back = false, max = 60) {
  await page.evaluate((back) => {
    window.scrollTo(0, back ? document.documentElement.scrollHeight : 0)
    document.activeElement && document.activeElement.blur()
  }, back)
  await page.waitForTimeout(300)
  const stops = []
  for (let i = 0; i < max; i++) {
    await page.keyboard.press(back ? 'Shift+Tab' : 'Tab')
    await page.waitForTimeout(220) // el enlace de saltar baja en 150 ms
    const f = await page.evaluate(focusInfo)
    if (!f) break
    if (stops.length && stops[0].name === f.name && stops[0].tag === f.tag) break
    stops.push(f)
  }
  return stops
}

async function keyboard(page, label) {
  const fwd = await tabWalk(page)
  const bad = fwd.filter((x) => !x.outline || !x.focusVisible || !x.inView || x.partly)
  ok(fwd.length >= 8 && bad.length === 0, `${label}: Tab, ${fwd.length} paradas, todas con foco visible, en pantalla y sin tapar (ni en parte)`, bad.length ? bad : fwd.map((x) => x.name).join(' → '))
  ok(fwd[0] && /Saltar al contenido/.test(fwd[0].name), `${label}: la primera parada es "Saltar al contenido"`, fwd[0] && fwd[0].name)
  const back = await tabWalk(page, true)
  const badB = back.filter((x) => !x.outline || !x.focusVisible || !x.inView || x.partly)
  ok(back.length === fwd.length && badB.length === 0, `${label}: Shift+Tab desde el final, ${back.length} paradas, todas visibles y sin tapar por la cabecera fija`, badB.length ? badB : undefined)

  // "Saltar al contenido": fuera de la pantalla sin foco; con foco, visible con su relleno; Enter ⇒ foco en <main>
  await page.evaluate(() => {
    window.scrollTo(0, 0)
    document.activeElement && document.activeElement.blur()
  })
  const hiddenRect = await page.evaluate(() => {
    const r = document.querySelector('a[href="#contenido"]').getBoundingClientRect()
    return { bottom: Math.round(r.bottom) }
  })
  await page.keyboard.press('Tab')
  await page.waitForTimeout(250)
  const skip = await page.evaluate(() => {
    const a = document.activeElement
    const r = a.getBoundingClientRect()
    const cs = getComputedStyle(a)
    return { text: a.textContent.trim(), top: Math.round(r.top), height: Math.round(r.height), padding: cs.paddingLeft + ' ' + cs.paddingTop }
  })
  ok(hiddenRect.bottom <= 0 && skip.text === 'Saltar al contenido' && skip.top >= 0 && skip.height >= 32 && skip.padding === '16px 8px', `${label}: "Saltar al contenido" no se ve sin foco y con foco sale entero, con su relleno`, { sinFoco: hiddenRect, conFoco: skip })
  await page.keyboard.press('Enter')
  await page.waitForTimeout(200)
  const afterSkip = await page.evaluate(() => ({ active: document.activeElement.id, hash: location.hash }))
  ok(afterSkip.active === 'contenido', `${label}: Enter en "Saltar al contenido" lleva el foco al contenido principal`, afterSkip)

  // "Ver capturas" con el teclado: baja a #particulares y el título no queda debajo de la cabecera fija
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.locator('a[href="#particulares"]', { hasText: 'Ver capturas' }).focus()
  await page.keyboard.press('Enter')
  await page.waitForTimeout(900)
  const sec = await page.evaluate(() => {
    const h = document.getElementById('particulares-title').getBoundingClientRect()
    const header = document.querySelector('header').getBoundingClientRect()
    return { hash: location.hash, tituloTop: Math.round(h.top), cabeceraBottom: Math.round(header.bottom) }
  })
  ok(sec.hash === '#particulares' && sec.tituloTop >= sec.cabeceraBottom, `${label}: "Ver capturas" (Enter) baja a Particulares y el título queda bajo la cabecera, no tapado`, sec)
  await page.evaluate(() => {
    history.replaceState(null, '', location.pathname)
    window.scrollTo(0, 0)
  })
}

async function axe(page, label) {
  const res = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze()
  const v = res.violations.map((x) => `${x.id} (${x.impact}, ${x.nodes.length}): ${x.nodes[0].target.join(' ')}`)
  ok(v.length === 0, `axe ${label}: ${res.passes.length} reglas pasan, ${res.violations.length} incumplidas`, v.length ? v : undefined)
  for (const x of res.incomplete) note(`axe ${label}: por revisar a mano: ${x.id}: ${x.nodes.map((n) => n.target.join(' ') + ' → ' + ((n.any[0] && n.any[0].message) || '')).join(' | ').slice(0, 300)}`)
  return res.incomplete.map((x) => x.id)
}

/** Contraste de un texto con su propio fondo (o el primero opaco de sus antepasados), calculado a mano. */
async function contrast(page, selector) {
  return page.evaluate((selector) => {
    const el = document.querySelector(selector)
    if (!el) return null
    const rgb = (c) => {
      const m = c.match(/[\d.]+/g).map(Number)
      return { r: m[0], g: m[1], b: m[2], a: m.length > 3 ? m[3] : 1 }
    }
    let n = el
    let bg = null
    while (n) {
      const c = rgb(getComputedStyle(n).backgroundColor)
      if (c.a === 1) {
        bg = c
        break
      }
      n = n.parentElement
    }
    const fg = rgb(getComputedStyle(el).color)
    const lum = ({ r, g, b }) =>
      [r, g, b].map((v) => {
        v /= 255
        return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
      }).reduce((acc, v, i) => acc + v * [0.2126, 0.7152, 0.0722][i], 0)
    const [l1, l2] = [lum(fg), lum(bg)].sort((a, b) => b - a)
    const cs = getComputedStyle(el)
    return { texto: el.textContent.trim().slice(0, 40), color: cs.color, fondo: getComputedStyle(n).backgroundColor, fondoDe: n === el ? 'el propio texto' : n.tagName.toLowerCase(), ratio: Math.round(((l1 + 0.05) / (l2 + 0.05)) * 100) / 100, size: cs.fontSize }
  }, selector)
}

/** Captura de la ventana en WebP (calidad 0,8) codificada con el propio Chromium. */
async function shot(browser, page, file, opts = {}) {
  const png = await page.screenshot({ timeout: 120000, ...opts })
  const ctx = await browser.newContext()
  const enc = await ctx.newPage()
  const data = await enc.evaluate(async (b64) => {
    const img = new Image()
    img.src = 'data:image/png;base64,' + b64
    await img.decode()
    const c = document.createElement('canvas')
    c.width = img.naturalWidth
    c.height = img.naturalHeight
    c.getContext('2d').drawImage(img, 0, 0)
    return c.toDataURL('image/webp', 0.8).split(',')[1]
  }, png.toString('base64'))
  await ctx.close()
  fs.writeFileSync(path.join(OUT, file), Buffer.from(data, 'base64'))
  note(`captura ${file} (${Math.round(fs.statSync(path.join(OUT, file)).size / 1024)} KB)`)
}

;(async () => {
  const browser = await chromium.launch({ args: ARGS })
  const sizes = [
    [1280, 800],
    [768, 1024],
    [360, 780],
  ]

  for (const theme of ['dark', 'light']) {
    for (const [w, h] of sizes) {
      if (!want(`${theme}-${w}`)) continue
      out(`\n── ${w}×${h} · tema ${theme === 'dark' ? 'oscuro' : 'claro'}`)
      const s = await open(browser, { width: w, height: h, theme })
      const { page } = s
      const of = await overflow(page)
      ok(of.scrollW <= of.clientW && of.out.length === 0, 'sin desbordes horizontales', of)
      const cv = await contentVisible(page)
      ok(cv.hidden.length === 0, `contenido visible desde el principio (${cv.total} bloques de texto)`, cv.hidden.length ? cv.hidden : cv.h2.join(' / '))
      await page.waitForTimeout(8000)
      let c = await controls(page)
      if (w >= 1024) {
        ok(c.canvas === 1 && c.button === 'Detener animación', 'escritorio: el coche 3D se monta solo, en reposo, con "Detener animación"', { ...c, three: s.three.slice(0, 2) })
        await shot(browser, page, theme === 'dark' ? `portada-${w}-3d.webp` : `portada-${w}-claro.webp`)
      } else {
        ok(c.canvas === 0 && s.three.length === 0 && c.button === 'Ver en 3D', 'sin 3D al cargar (ni descarga de three.js) y con "Ver en 3D"', c)
        await shot(browser, page, theme === 'dark' ? `portada-${w}-arriba.webp` : `portada-${w}-claro.webp`)
      }
      const shots = await screenshotsLoad(page)
      ok(shots.length === 7 && shots.every((x) => x.ok && x.alt > 20), 'las 7 capturas de la app cargan y tienen texto alternativo', shots.map((x) => x.src).join(', '))

      await keyboard(page, `teclado ${w}`)

      // Contraste del pie del coche (axe lo deja "por revisar" cuando no sabe qué fondo tiene debajo)
      const k = await contrast(page, '#portada-visual + * + div p[aria-live], [aria-live="polite"]')
      ok(k && k.ratio >= 4.5, `contraste del pie "${k && k.texto}" calculado a mano: ${k && k.ratio}:1 (AA pide 4,5:1 a ${k && k.size})`, k)

      // "Ver en 3D" / "Detener animación" con el teclado
      await page.evaluate(() => window.scrollTo(0, 0))
      const btn = page.locator('button[aria-controls="portada-visual"]')
      if (w < 1024 && theme === 'dark') {
        const before = s.three.length
        await btn.focus()
        await page.keyboard.press('Enter')
        await page.waitForTimeout(250)
        const during = await controls(page)
        await page.waitForFunction(() => document.querySelector('#portada-visual canvas'), null, { timeout: 60000 })
        await page.waitForFunction(() => document.querySelector('button[aria-controls="portada-visual"]').textContent.includes('Detener'), null, { timeout: 20000 })
        c = await controls(page)
        const focused = await page.evaluate(() => document.activeElement && document.activeElement.textContent.trim())
        ok(s.three.length > before && c.canvas === 1 && c.button === 'Detener animación' && focused === 'Detener animación', '"Ver en 3D" (Enter) descarga la escena a petición y el foco sigue en el botón', { durante: during.button, despues: c.button, foco: focused, three: s.three.slice(before, before + 2) })
        if (w === 360) await shot(browser, page, `portada-${w}-ver-en-3d.webp`)
      }
      if (w >= 1024 || theme === 'dark') {
        await btn.focus()
        await page.keyboard.press('Enter')
        await page.waitForTimeout(500)
        c = await controls(page)
        const focused = await page.evaluate(() => document.activeElement && document.activeElement.textContent.trim())
        ok(c.canvas === 0 && c.button === 'Ver en 3D' && c.storage === 'off' && focused === 'Ver en 3D', '"Detener animación" (Enter) quita la escena, guarda la preferencia y el foco sigue en el botón', { ...c, foco: focused })
      }

      const incomplete = await axe(page, `${w} ${theme === 'dark' ? 'oscuro' : 'claro'}`)
      if (incomplete.includes('color-contrast')) {
        const k2 = await contrast(page, '[aria-live="polite"]')
        note(`el "por revisar" de color-contrast es el pie del coche: ${k2.ratio}:1 con su propio fondo (${k2.fondo})`)
      }

      // Cambiar de tema con el teclado: el foco se queda en el botón y el tema cambia
      if (w === 1280) {
        const toggle = page.locator('header button').filter({ hasNot: page.locator('[aria-controls]') }).first()
        const before = await page.evaluate(() => document.documentElement.dataset.theme || document.documentElement.className)
        await toggle.focus()
        const name = await page.evaluate(() => document.activeElement.getAttribute('aria-label') || document.activeElement.textContent.trim())
        await page.keyboard.press('Enter')
        await page.waitForTimeout(300)
        const after = await page.evaluate(() => ({ theme: document.documentElement.dataset.theme || document.documentElement.className, foco: document.activeElement.getAttribute('aria-label') || document.activeElement.textContent.trim() }))
        ok(after.theme !== before, `cambio de tema con el teclado ("${name}")`, { antes: before, ...after })
      }

      ok(s.errors.length === 0, 'sin errores en la consola', s.errors)
      await s.ctx.close()
    }
  }

  if (want('guardado')) {
    out('\n── 1280×800 con "Detener animación" guardado')
    const s = await open(browser, { width: 1280, height: 800, storage: { 'carcare.landing3d': 'off' } })
    await s.page.waitForTimeout(8000)
    let c = await controls(s.page)
    ok(c.canvas === 0 && s.three.length === 0 && c.button === 'Ver en 3D', 'al volver, el 3D no se monta solo ni se descarga three.js', c)
    await s.page.locator('button[aria-controls="portada-visual"]').click()
    await s.page.waitForFunction(() => document.querySelector('button[aria-controls="portada-visual"]').textContent.includes('Detener'), null, { timeout: 60000 })
    c = await controls(s.page)
    ok(c.canvas === 1 && c.storage === null, '"Ver en 3D" vuelve a montarlo y borra la preferencia', c)
    ok(s.errors.length === 0, 'sin errores en la consola', s.errors)
    await s.ctx.close()
  }

  for (const theme of ['dark', 'light']) {
    if (!want(`reducido-${theme}`)) continue
    out(`\n── 1280×800 con prefers-reduced-motion: reduce · tema ${theme === 'dark' ? 'oscuro' : 'claro'}`)
    const s = await open(browser, { width: 1280, height: 800, reduced: true, theme })
    await s.page.waitForTimeout(8000)
    let c = await controls(s.page)
    ok(c.canvas === 0 && s.three.length === 0 && c.button === 'Ver en 3D', 'movimiento reducido: a los 8 s sigue la imagen fija, sin three.js, con "Ver en 3D"', c)
    if (theme === 'dark') {
      await keyboard(s.page, 'teclado 1280 reducido')
      await s.page.locator('button[aria-controls="portada-visual"]').focus()
      await s.page.keyboard.press('Enter')
      await s.page.waitForFunction(() => document.querySelector('button[aria-controls="portada-visual"]').textContent.includes('Detener'), null, { timeout: 60000 })
      c = await controls(s.page)
      ok(c.canvas === 1, 'a petición (Enter) sí se monta; con movimiento reducido la escena no gira sola', c)
    } else {
      await axe(s.page, '1280 claro reducido')
    }
    ok(s.errors.length === 0, 'sin errores en la consola', s.errors)
    await s.ctx.close()
  }

  if (want('sin-js-3d')) {
    out('\n── 1280×800 sin el JS del 3D (three/HeroCanvas/Stage bloqueados)')
    const s = await open(browser, { width: 1280, height: 800, block3d: true })
    await s.page.waitForTimeout(3000)
    const cv = await contentVisible(s.page)
    const img = await s.page.evaluate(() => {
      const i = document.querySelector('#portada-visual img')
      return { ok: i.complete && i.naturalWidth > 0, opacity: getComputedStyle(i.parentElement).opacity }
    })
    ok(cv.hidden.length === 0 && img.ok && img.opacity === '1', 'todo el texto y la imagen del coche siguen visibles', { ...img, textos: cv.total })
    await s.page.waitForTimeout(19000)
    const c = await controls(s.page)
    ok(c.canvas === 0 && /No se ha podido cargar el 3D/.test(c.caption) && c.button === null, 'a los 20 s avisa de que se queda la imagen y quita el botón', c)
    note(`errores de consola esperables (chunk bloqueado a propósito): ${s.errors.length ? s.errors.join(' | ') : 'ninguno'}`)
    await s.ctx.close()
  }

  if (want('sin-webgl')) {
    out('\n── 1280×800 sin WebGL (?sin3d)')
    const s = await open(browser, { width: 1280, height: 800, query: '?sin3d' })
    await s.page.waitForTimeout(5000)
    const c = await controls(s.page)
    ok(c.canvas === 0 && c.button === null && s.three.length === 0, 'solo la imagen, sin botón y sin three.js', c)
    ok(s.errors.length === 0, 'sin errores en la consola', s.errors)
    await s.ctx.close()
  }

  if (want('capturas')) {
    out('\n── capturas')
    const s = await open(browser, { width: 1280, height: 800 })
    await s.page.waitForFunction(() => document.querySelector('button[aria-controls="portada-visual"]')?.textContent.includes('Detener'), null, { timeout: 60000 })
    await s.page.evaluate(() => document.getElementById('zonas').scrollIntoView())
    await s.page.waitForTimeout(4500)
    await shot(browser, s.page, 'portada-1280-zonas.webp')
    await s.page.evaluate(() => document.getElementById('solicitudes').scrollIntoView())
    await s.page.waitForTimeout(1500)
    await shot(browser, s.page, 'portada-1280-solicitudes.webp')
    await s.page.evaluate(() => {
      window.scrollTo(0, 0)
      document.activeElement && document.activeElement.blur()
    })
    await s.page.keyboard.press('Tab')
    await s.page.waitForTimeout(300)
    await shot(browser, s.page, 'portada-1280-saltar.webp', { clip: { x: 0, y: 0, width: 640, height: 120 } })
    await s.ctx.close()
    const m = await open(browser, { width: 360, height: 780 })
    await screenshotsLoad(m.page)
    await shot(browser, m.page, 'portada-360-completa.webp', { fullPage: true })
    await m.ctx.close()
  }

  await browser.close()
  out(`\n${failures === 0 ? 'TODO OK' : failures + ' FALLOS'}`)
  process.exit(failures === 0 ? 0 : 1)
})().catch((e) => {
  out('EXCEPCIÓN: ' + (e && e.stack ? e.stack : e))
  process.exit(2)
})
