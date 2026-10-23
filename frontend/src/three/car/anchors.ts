/**
 * Posición de cada zona sobre el coche (por carrocería) y punto de vista de la cámara al seleccionarla.
 * Matemática pura: la usan el visor 3D (marcadores y vuelos) y el respaldo 2D (marcadores sobre la silueta).
 * Ejes: x = morro, y = arriba, z = lado derecho del coche (el que se ve en la vista por defecto).
 */
import type { BodyType, Zone } from '@/api/types'
import { getBodyShape } from './shape'

export type Vec3 = [number, number, number]

export interface ZoneAnchor {
  zone: Zone
  /** Punto donde va el marcador. */
  position: Vec3
  /** Hacia dónde mira la cámara al seleccionar la zona. */
  target: Vec3
  /** Dirección (desde el objetivo) en la que se coloca la cámara, y distancia. */
  direction: Vec3
  distance: number
}

export interface CarFraming {
  target: Vec3
  direction: Vec3
  /** Distancia para encuadrar el coche entero con fov vertical de 24° en 16:9. */
  distance: number
  length: number
  height: number
}

const cache = new Map<BodyType, { anchors: Record<Zone, ZoneAnchor>; framing: CarFraming }>()

function norm(v: Vec3): Vec3 {
  const l = Math.hypot(v[0], v[1], v[2]) || 1
  return [v[0] / l, v[1] / l, v[2] / l]
}

export function getCarLayout(type: BodyType) {
  const hit = cache.get(type)
  if (hit) return hit
  const s = getBodyShape(type)
  const spec = s.spec
  const length = s.front - s.rear
  let height = 0
  for (const [, y] of s.top.samples) height = Math.max(height, y)
  if (s.roof) for (const [, y] of s.roof.samples) height = Math.max(height, y)
  const k = Math.max(0.85, length / 4.4) * 1.25
  const hw = s.halfWidth
  const tireOut = s.wheelZ + spec.tireWidth / 2

  // Reparto pensado para que, en la vista 3/4 por defecto, ningún par de zonas quede a menos de ~0,55 m:
  // frenos en la rueda delantera, suspensión en el paso de rueda trasero, neumáticos en la parte baja de la rueda
  // trasera, transmisión en el estribo y carrocería en la parte alta de la puerta delantera.
  const ex = s.axleFront + 0.14
  const roofX = s.ghRange ? (s.ghRange[0] + s.ghRange[1]) / 2 : spec.seats.frontX
  const roofY = s.roof ? s.roof.at(roofX) : s.top.at(roofX)
  const doorA = [...spec.doors].sort((a, b) => b - a)
  const doorX = doorA.length > 1 ? (doorA[0] + doorA[1]) / 2 - 0.12 : 0
  const doorSec = s.lower(doorX)
  const doorY = doorSec.ys - 0.06
  const doorZ = (s.outerZ(doorSec, doorY) ?? hw) + 0.02
  const transX = s.axleFront - s.archR - 0.42
  const transSec = s.lower(transX)
  const transY = transSec.yB + 0.06
  const transZ = (s.outerZ(transSec, transY) ?? hw * 0.9) + 0.02
  const exhX = s.rear + 0.1
  const beltFront = s.top.at(spec.seats.frontX)

  const a = (zone: Zone, position: Vec3, direction: Vec3, distance: number, target?: Vec3): ZoneAnchor => ({
    zone,
    position,
    target: target ?? position,
    direction: norm(direction),
    distance: distance * k,
  })

  const anchors: Record<Zone, ZoneAnchor> = {
    engine: a('engine', [ex, s.top.at(ex) + 0.05, 0], [1, 1.05, 0.55], 3.1),
    transmission: a('transmission', [transX, transY, transZ], [0.35, 0.18, 1], 3.2, [s.axleFront - 0.5, 0.35, 0]),
    brakes: a('brakes', [s.axleFront, s.wheelR + 0.02, tireOut + 0.03], [0.55, 0.18, 1], 2.0),
    tyres: a('tyres', [s.axleRear + s.wheelR * 0.25, s.wheelR * 0.4, tireOut + 0.02], [-0.55, 0.16, 1], 2.0),
    suspension: a('suspension', [s.axleRear - 0.04, s.wheelR + s.archR + 0.05, hw + 0.02], [-0.6, 0.5, 1], 2.4, [s.axleRear, s.wheelR + 0.15, hw * 0.6]),
    electrical: a('electrical', [s.front - 0.12, spec.headlightY + 0.02, hw * 0.62], [1, 0.32, 0.62], 2.5),
    body: a('body', [doorX, doorY, doorZ], [0.22, 0.25, 1], 4.4, [doorX - 0.2, doorY, 0]),
    interior: a('interior', [spec.seats.frontX + 0.05, beltFront + 0.24, hw * 0.4], [0.18, 0.95, 1], 3.0),
    exhaust: a('exhaust', [exhX, s.bottom.at(exhX + 0.1) - 0.02, hw * 0.36], [-1, 0.28, 0.62], 2.5),
    general: a('general', [roofX, roofY + 0.22, 0], [1, 0.42, 1.1], 7.6, [0, height * 0.42, 0]),
  }

  const framing: CarFraming = {
    target: [0, height * 0.42, 0],
    direction: norm([1, 0.42, 1.12]),
    distance: Math.max(8, length * 1.8),
    length,
    height,
  }
  const out = { anchors, framing }
  cache.set(type, out)
  return out
}
