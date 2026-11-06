#!/usr/bin/env node
/**
 * Genera frontend/src/data/catalogo-vehiculos.json: marca → modelo → versiones.
 *
 * Fuentes (ver docs/arquitectura/catalogo-vehiculos.md):
 *  1. EPA / DOE «Fuel Economy Data» (https://www.fueleconomy.gov/feg/ws/index.shtml, dominio público de EE. UU.).
 *     Aporta modelos y motorizaciones (cilindrada, cilindros, sobrealimentación, combustible, cambio) desde 2005.
 *     Son versiones del mercado estadounidense: NO traen los acabados comerciales españoles (FR, Xcellence…).
 *  2. Lista editorial de modelos para marcas que la EPA no cubre (Seat, Cupra, Dacia, Peugeot, Renault, Citroën,
 *     Opel, Škoda, DS, Lancia, Abarth…). Solo nombres de modelo y, cuando es inequívoco, carrocería. Sin versiones.
 *
 * Uso (desde la raíz):  node scripts/generar-catalogo.mjs [ruta/a/vehicles.csv]
 * Sin argumento descarga https://www.fueleconomy.gov/feg/epadata/vehicles.csv.zip y lo descomprime con `unzip`/`tar`.
 */
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..')
const SALIDA = join(RAIZ, 'frontend', 'src', 'data', 'catalogo-vehiculos.json')
const DESDE = 2005
const URL_EPA = 'https://www.fueleconomy.gov/feg/epadata/vehicles.csv.zip'

/** Lee el CSV respetando comillas. */
function parseCsv(texto) {
  const filas = []
  let fila = []
  let campo = ''
  let entre = false
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i]
    if (entre) {
      if (c === '"' && texto[i + 1] === '"') { campo += '"'; i++ }
      else if (c === '"') entre = false
      else campo += c
    } else if (c === '"') entre = true
    else if (c === ',') { fila.push(campo); campo = '' }
    else if (c === '\n') { fila.push(campo); filas.push(fila); fila = []; campo = '' }
    else if (c !== '\r') campo += c
  }
  if (campo || fila.length) { fila.push(campo); filas.push(fila) }
  return filas
}

function obtenerCsv() {
  if (process.argv[2]) return readFileSync(process.argv[2], 'utf8')
  const dir = mkdtempSync(join(tmpdir(), 'epa-'))
  const zip = join(dir, 'vehicles.csv.zip')
  execFileSync('curl', ['-sSf', '-m', '180', '-o', zip, URL_EPA])
  execFileSync('tar', ['-xf', zip, '-C', dir]) // bsdtar (Windows 10+) y GNU tar con zip
  return readFileSync(join(dir, 'vehicles.csv'), 'utf8')
}

const MARCAS = { MINI: 'Mini', smart: 'Smart', 'Mercedes-Benz': 'Mercedes-Benz', 'Land Rover': 'Land Rover' }
const SIN_MARCA = /^[\d"]|^$/

/** carrocería solo cuando la clase de la EPA no deja dudas */
const CARROCERIA = [
  [/Station Wagon/i, 'wagon'],
  [/Sport Utility/i, 'suv'],
  [/Minivan/i, 'minivan'],
  [/^Vans/i, 'van'],
  [/Pickup/i, 'pickup'],
  [/Two Seaters/i, 'coupe'],
]

function combustible(atv, f1) {
  if (/^EV$/i.test(atv) || /Electricity/i.test(f1)) return 'electric'
  if (/Plug-in/i.test(atv)) return 'plugin_hybrid'
  if (/Hybrid/i.test(atv)) return 'hybrid'
  if (/Diesel/i.test(atv) || /Diesel/i.test(f1)) return 'diesel'
  if (/CNG|Natural Gas/i.test(atv) || /Natural Gas/i.test(f1)) return 'cng'
  if (/Gasoline|Premium|Regular|Midgrade/i.test(f1)) return 'gasoline'
  return null
}

function cambio(trany) {
  if (/^Manual/i.test(trany)) return 'manual'
  if (/^Auto/i.test(trany)) return 'automatic'
  return null
}

function sacarVersion(r, base) {
  const pre = r.model.startsWith(base) ? r.model.slice(base.length).trim() : ''
  const motor = []
  if (r.fuel === 'electric') motor.push('Eléctrico')
  else {
    if (r.displ > 0) motor.push(`${r.displ.toFixed(1)} L`)
    if (r.cil > 0) motor.push(`${r.cil} cil.`)
    if (r.turbo) motor.push('turbo')
    if (r.compresor) motor.push('compresor')
    if (r.fuel === 'diesel') motor.push('diésel')
    if (r.fuel === 'hybrid') motor.push('híbrido')
    if (r.fuel === 'plugin_hybrid') motor.push('híbrido enchufable')
    if (r.fuel === 'cng') motor.push('GNC')
  }
  const partes = [pre, motor.join(' ')].filter(Boolean)
  if (r.cambio) partes.push(r.cambio === 'manual' ? 'Manual' : 'Automático')
  return partes.join(' · ')
}

// ── Marcas fuera de la EPA: lista editorial (solo modelos; b = carrocería si es inequívoca) ──
const EDITORIAL = {
  Seat: [
    ['Ibiza', 'hatchback'], ['León', 'hatchback'], ['Arona', 'suv'], ['Ateca', 'suv'], ['Tarraco', 'suv'],
    ['Mii', 'hatchback'], ['Altea', 'minivan'], ['Alhambra', 'minivan'], ['Toledo', 'sedan'], ['Córdoba', 'sedan'],
    ['Cordoba'], ['Exeo', 'sedan'], ['Marbella'], ['Málaga'], ['Panda'], ['Ronda'], ['Inca', 'van'],
  ],
  Cupra: [['Formentor', 'suv'], ['Born', 'hatchback'], ['León', 'hatchback'], ['Ateca', 'suv'], ['Tavascan', 'suv'], ['Terramar', 'suv']],
  Dacia: [
    ['Sandero', 'hatchback'], ['Sandero Stepway', 'hatchback'], ['Duster', 'suv'], ['Jogger', 'wagon'], ['Spring', 'hatchback'],
    ['Logan', 'sedan'], ['Logan MCV', 'wagon'], ['Lodgy', 'minivan'], ['Dokker', 'van'], ['Bigster', 'suv'],
  ],
  Peugeot: [
    ['108', 'hatchback'], ['208', 'hatchback'], ['2008', 'suv'], ['308', 'hatchback'], ['3008', 'suv'], ['408'],
    ['508', 'sedan'], ['5008', 'suv'], ['Rifter'], ['Partner', 'van'], ['Expert', 'van'], ['Boxer', 'van'],
    ['107', 'hatchback'], ['206', 'hatchback'], ['207', 'hatchback'], ['307', 'hatchback'], ['407', 'sedan'], ['Traveller'],
  ],
  Renault: [
    ['Clio', 'hatchback'], ['Captur', 'suv'], ['Mégane', 'hatchback'], ['Kadjar', 'suv'], ['Arkana', 'suv'], ['Austral', 'suv'],
    ['Twingo', 'hatchback'], ['Zoe', 'hatchback'], ['Scénic', 'minivan'], ['Espace', 'minivan'], ['Talisman', 'sedan'],
    ['Kangoo', 'van'], ['Trafic', 'van'], ['Master', 'van'], ['Koleos', 'suv'], ['Laguna'], ['Fluence', 'sedan'], ['Symbioz', 'suv'],
  ],
  Citroën: [
    ['C1', 'hatchback'], ['C3', 'hatchback'], ['C3 Aircross', 'suv'], ['C4', 'hatchback'], ['C4 Cactus', 'suv'], ['C4 Picasso', 'minivan'],
    ['C5 Aircross', 'suv'], ['C5 X'], ['Berlingo', 'van'], ['Jumpy', 'van'], ['Jumper', 'van'], ['C-Elysée', 'sedan'],
    ['Saxo', 'hatchback'], ['Xsara', 'hatchback'], ['Xsara Picasso', 'minivan'], ['Ami'], ['ë-C3', 'hatchback'],
  ],
  Opel: [
    ['Corsa', 'hatchback'], ['Astra', 'hatchback'], ['Mokka', 'suv'], ['Crossland', 'suv'], ['Grandland', 'suv'], ['Insignia'],
    ['Zafira', 'minivan'], ['Meriva', 'minivan'], ['Adam', 'hatchback'], ['Vivaro', 'van'], ['Combo', 'van'], ['Movano', 'van'],
    ['Karl', 'hatchback'], ['Vectra'], ['Frontera', 'suv'],
  ],
  Skoda: [
    ['Fabia', 'hatchback'], ['Scala', 'hatchback'], ['Octavia'], ['Superb'], ['Kamiq', 'suv'], ['Karoq', 'suv'], ['Kodiaq', 'suv'],
    ['Enyaq', 'suv'], ['Citigo', 'hatchback'], ['Rapid'], ['Roomster', 'minivan'], ['Yeti', 'suv'], ['Elroq', 'suv'],
  ],
  DS: [['DS 3', 'hatchback'], ['DS 3 Crossback', 'suv'], ['DS 4'], ['DS 5'], ['DS 7', 'suv'], ['DS 9', 'sedan']],
  Lancia: [['Ypsilon', 'hatchback'], ['Delta'], ['Musa', 'minivan'], ['Thema', 'sedan']],
  Abarth: [['500', 'hatchback'], ['595', 'hatchback'], ['695', 'hatchback'], ['124 Spider', 'convertible'], ['Punto Evo', 'hatchback']],
  Alpine: [['A110', 'coupe'], ['A290', 'hatchback']],
  'Lynk & Co': [['01', 'suv'], ['02', 'suv'], ['03', 'sedan']],
  MG: [['MG3', 'hatchback'], ['MG4', 'hatchback'], ['MG5', 'wagon'], ['HS', 'suv'], ['ZS', 'suv'], ['Marvel R', 'suv'], ['Cyberster', 'convertible']],
  BYD: [['Atto 3', 'suv'], ['Dolphin', 'hatchback'], ['Seal', 'sedan'], ['Seal U', 'suv'], ['Tang', 'suv'], ['Han', 'sedan'], ['Sealion 7', 'suv']],
  Omoda: [['5', 'suv'], ['9', 'suv']],
  SsangYong: [['Tivoli', 'suv'], ['Korando', 'suv'], ['Rexton', 'suv'], ['Musso', 'pickup'], ['Torres', 'suv']],
  Iveco: [['Daily', 'van']],
}

// ── Construcción ──
const filas = parseCsv(obtenerCsv())
const cab = filas[0]
const col = (n) => cab.indexOf(n)
const C = Object.fromEntries(
  ['make', 'model', 'baseModel', 'year', 'displ', 'cylinders', 'trany', 'VClass', 'atvType', 'fuelType1', 'tCharger', 'sCharger'].map((n) => [n, col(n)]),
)

/** marca → modelo → { carrocerias:Set, versiones: Map(clave → {...}) } */
const marcas = new Map()
let leidas = 0
for (const f of filas.slice(1)) {
  if (f.length < cab.length - 5) continue
  const year = Number(f[C.year])
  let marca = f[C.make].trim()
  if (year < DESDE || SIN_MARCA.test(marca)) continue
  marca = MARCAS[marca] ?? marca
  const base = (f[C.baseModel] || f[C.model]).trim()
  if (!base) continue
  leidas++
  const r = {
    model: f[C.model].trim(),
    displ: Number(f[C.displ]) || 0,
    cil: Number(f[C.cylinders]) || 0,
    fuel: combustible(f[C.atvType], f[C.fuelType1]),
    cambio: cambio(f[C.trany]),
    turbo: f[C.tCharger] === 'T',
    compresor: f[C.sCharger] === 'S',
  }
  const mm = marcas.get(marca) ?? marcas.set(marca, new Map()).get(marca)
  const modelo = mm.get(base) ?? mm.set(base, { y: [year, year], cuerpos: new Map(), filas: 0, v: new Map() }).get(base)
  modelo.filas++
  modelo.y = [Math.min(modelo.y[0], year), Math.max(modelo.y[1], year)]
  const clase = CARROCERIA.find(([re]) => re.test(f[C.VClass]))?.[1]
  if (clase) modelo.cuerpos.set(clase, (modelo.cuerpos.get(clase) ?? 0) + 1)
  const etiqueta = sacarVersion(r, base)
  if (!etiqueta) continue
  const clave = `${etiqueta}|${r.fuel}|${r.cambio}`
  const v = modelo.v.get(clave)
  if (v) v.y = [Math.min(v.y[0], year), Math.max(v.y[1], year)]
  else modelo.v.set(clave, { n: etiqueta, f: r.fuel, t: r.cambio, y: [year, year], motor: r.displ > 0 ? `${r.displ.toFixed(1)} L${r.cil ? ` ${r.cil} cil.` : ''}${r.turbo ? ' turbo' : ''}` : r.fuel === 'electric' ? 'Eléctrico' : '' })
}

const salida = { marcas: [] }
const nombres = new Set([...marcas.keys(), ...Object.keys(EDITORIAL)])
for (const nombre of [...nombres].sort((a, b) => a.localeCompare(b, 'es'))) {
  const modelos = []
  const epa = marcas.get(nombre)
  if (epa) {
    for (const [m, d] of epa) {
      // solo si TODAS las filas del modelo comparten una clase inequívoca; si no, la elige el usuario
      const body = d.cuerpos.size === 1 && [...d.cuerpos.values()][0] === d.filas ? [...d.cuerpos.keys()][0] : undefined
      const versiones = [...d.v.values()]
        .sort((a, b) => a.n.localeCompare(b.n, 'es'))
        .map((v) => ({ n: v.n, ...(v.f && { f: v.f }), ...(v.t && { t: v.t }), y: v.y }))
      modelos.push({ n: m, y: d.y, ...(body && { b: body }), ...(versiones.length && { v: versiones }) })
    }
  }
  for (const [m, b] of EDITORIAL[nombre] ?? []) {
    if (!modelos.some((x) => x.n.toLowerCase() === m.toLowerCase())) modelos.push({ n: m, ...(b && { b }) })
  }
  // la EPA mezcla variantes del mismo modelo («3 Series», «328i»…): ordenado alfabético, sin filtrar
  modelos.sort((a, b) => a.n.localeCompare(b.n, 'es', { numeric: true }))
  if (modelos.length) salida.marcas.push({ n: nombre, fuente: epa ? 'epa' : 'editorial', m: modelos })
}

mkdirSync(dirname(SALIDA), { recursive: true })
writeFileSync(SALIDA, JSON.stringify({ generado: new Date().toISOString().slice(0, 10), desde: DESDE, ...salida }))
const kb = Math.round(readFileSync(SALIDA).length / 1024)
const nMod = salida.marcas.reduce((s, m) => s + m.m.length, 0)
const nVer = salida.marcas.reduce((s, m) => s + m.m.reduce((t, x) => t + (x.v?.length ?? 0), 0), 0)
console.log(`Catálogo: ${salida.marcas.length} marcas, ${nMod} modelos, ${nVer} versiones (${leidas} filas EPA ≥ ${DESDE}) → ${kb} KB`)
