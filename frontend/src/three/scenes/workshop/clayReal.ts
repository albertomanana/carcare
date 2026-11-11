/**
 * Coches de la maqueta con las carrocerías reales de `getCarBuild` (nivel de detalle 'clay': malla gruesa, ruedas
 * cilíndricas, sin interior) llevadas a acabado de arcilla: dos mallas por coche, compartidas por todos los coches de la
 * misma carrocería.
 *  - `paint`: la pintura (y el plástico de los bajos que sale de la carrocería); su color lo pone el material
 *    (`clayPaint`), el del vehículo en tono mate.
 *  - `rest`: lunas, neumáticos, llantas, parachoques, faros y pilotos, con el color en los vértices (mate, sin reflejos).
 * Morro hacia +z, centrado en x/z, ruedas en y = 0 (la geometría original tiene el morro en +x y no está centrada).
 */
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { BodyType } from '@/api/types'
import { getCarBuild } from '../../car/build'
import type { MatKey } from '../../car/geometry'
import { getClayCar, type ClayCarGeometry } from './clayCar'

const COLORS: Partial<Record<MatKey, string>> = {
  glass: '#3f4c5a',
  rubber: '#2a2e34',
  rim: '#aab1b9',
  rimDark: '#7c848d',
  trim: '#4a525b',
  cladding: '#454c54',
  chrome: '#8f979f',
  lens: '#f3e8c8',
  lightFront: '#fff1cc',
  lightRear: '#c9483d',
  grille: '#2e343a',
  interior: '#343a41',
  seat: '#343a41',
  bedliner: '#30363d',
}

/** Piezas que no se ven desde arriba y se descartan (los bajos y el interior de las carrocerías cerradas). */
const SKIP = new Set<MatKey>(['underbody', 'disc', 'caliper', 'engine', 'engineDark', 'battery', 'exhaust', 'spring'])

function prep(src: THREE.BufferGeometry, color?: THREE.Color): THREE.BufferGeometry {
  const g = src.index ? src.toNonIndexed() : src.clone()
  g.deleteAttribute('uv')
  if (!g.getAttribute('normal')) g.computeVertexNormals()
  if (color) {
    const n = g.getAttribute('position').count
    const c = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) {
      c[i * 3] = color.r
      c[i * 3 + 1] = color.g
      c[i * 3 + 2] = color.b
    }
    g.setAttribute('color', new THREE.BufferAttribute(c, 3))
  }
  return g
}

function finish(parts: THREE.BufferGeometry[], dx: number): THREE.BufferGeometry {
  const g = mergeGeometries(parts, false)
  for (const p of parts) p.dispose()
  g.translate(dx, 0, 0)
  g.rotateY(-Math.PI / 2)
  g.computeBoundingSphere()
  g.computeBoundingBox()
  return g
}

const cache = new Map<BodyType, ClayCarGeometry>()

export function getClayReal(body: BodyType): ClayCarGeometry {
  let c = cache.get(body)
  if (c) return c
  const build = getCarBuild(body, 'clay')
  const dx = -(build.shape.front + build.shape.rear) / 2
  const paint: THREE.BufferGeometry[] = []
  const rest: THREE.BufferGeometry[] = []
  for (const p of build.parts) {
    if (SKIP.has(p.mat)) continue
    // el interior solo se ve en el descapotable (habitáculo abierto)
    if ((p.mat === 'interior' || p.mat === 'seat') && body !== 'convertible') continue
    if (p.mat === 'paint') paint.push(prep(p.geometry))
    else rest.push(prep(p.geometry, new THREE.Color(COLORS[p.mat] ?? '#454c54')))
  }
  c = { paint: finish(paint, dx), rest: finish(rest, dx), size: { ...build.size } }
  cache.set(body, c)
  return c
}

/**
 * Estilo de los coches de la maqueta: carrocerías reales de arcilla (por defecto) o los bloques redondeados
 * simplificados (solo en desarrollo, con `?coches=bloques`, para comparar las dos versiones).
 */
export function getClayModel(body: BodyType): ClayCarGeometry {
  if (import.meta.env.DEV && typeof location !== 'undefined' && new URLSearchParams(location.search).get('coches') === 'bloques') return getClayCar(body)
  return getClayReal(body)
}

/** Largo y ancho (m) de la carrocería, para las cajas de colisión del tráfico. */
export function carDims(body: BodyType): { length: number; width: number } {
  const s = getCarBuild(body, 'clay').size
  return { length: s.length, width: s.width }
}
