/**
 * Portada (chunk diferido). Escena cinematográfica DECORATIVA (aria-hidden: el texto de la portada ya lo cuenta todo).
 *
 *  - Ciclo de carrocerías y colores: cada ~4 s un "escáner" (marco de luz con el color de acento) recorre el coche de
 *    morro a cola y deja detrás la siguiente carrocería. Es un recorte con dos planos sobre los mismos materiales:
 *    sin geometría extra ni texturas.
 *  - `progress` (0..1, scroll) coreografía la cámara (3/4 delantero → lateral → 3/4 trasero alto) y, a partir de
 *    0,42, un segundo barrido (color info) convierte el coche en la vista de rayos X ilustrativa; al final se encienden
 *    puntos de zona con los colores de estado del sistema de diseño (decorativos: no representan datos).
 *  - Movimiento reducido: sin ciclo, cámara fija y sin barridos; el scroll solo cambia de estado de golpe.
 *  - Un solo <Canvas>, sin eventos de puntero (no roba el scroll); frameloop "demand" si está quieta o fuera de vista.
 */
import { Environment, Lightformer } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import type { BodyType, Zone } from '@/api/types'
import type { HeroSceneProps } from '../types'
import { getCarLayout } from '../car/anchors'
import { getCarBuild } from '../car/build'
import { CarModel } from '../car/CarModel'
import { getBodyShape } from '../car/shape'
import { mixHex } from '../color'
import { useInView, usePrefersReducedMotion, useThemeTokens, type ThemeTokens } from '../env'
import { boxCorners, fitView, type FitBounds } from './fit'
import { CarShadow, StudioFloor } from './Stage'
import { useCanvasLabel } from './useCanvasLabel'

// ───────────────────────── Guion ─────────────────────────

/** Carrocerías y colores del ciclo (genéricos, sin marcas). El primero coincide con el respaldo SVG. */
export const HERO_CYCLE: { body: BodyType; color: string }[] = [
  { body: 'coupe', color: '#b3202a' },
  { body: 'suv', color: '#e8e6e1' },
  { body: 'hatchback', color: '#1f4e79' },
  { body: 'pickup', color: '#3a4248' },
  { body: 'sedan', color: '#14171a' },
  { body: 'convertible', color: '#c9a227' },
  { body: 'wagon', color: '#7c8a96' },
  { body: 'van', color: '#d9d9d6' },
  { body: 'minivan', color: '#2e5e4e' },
]

/** Segundos con cada coche y duración del barrido. */
const HOLD = 4.2
const WIPE = 1.45
/** Tramos de `progress`. */
const CYCLE_UNTIL = 0.32
const XRAY_FROM = 0.42
const XRAY_TO = 0.76
const DOTS_FROM = 0.8
const DOTS_TO = 0.92
/** Con movimiento reducido: a partir de aquí, rayos X (y puntos) sin animación. */
const RM_XRAY_AT = 0.55

/** Planos de cámara por tramo: azimut desde el morro hacia el lado derecho y elevación, en grados. */
const SHOTS = [
  { p: 0, az: 34, el: 7 },
  { p: 0.36, az: 54, el: 10 },
  { p: 0.62, az: 88, el: 14 },
  { p: 1, az: 132, el: 24 },
]
const STATIC_SHOT = { az: 40, el: 9 }
const FOV = 26

/** Puntos de zona decorativos (al final del recorrido). */
const DOTS: [Zone, 'ok' | 'warning' | 'danger'][] = [
  ['engine', 'warning'],
  ['brakes', 'danger'],
  ['tyres', 'ok'],
  ['electrical', 'ok'],
  ['suspension', 'ok'],
  ['exhaust', 'warning'],
  ['interior', 'ok'],
]

/** Capa de los efectos (escáner, puntos): la ve la cámara principal, no la de la sombra de contacto. */
const FX_LAYER = 1
/** Sombra con tamaño fijo (el del coche más grande): así no se recrean sus render targets en cada cambio. */
const SHADOW_LEN = 5.4
const SHADOW_W = 2.05

const smooth = (a: number, b: number, x: number) => THREE.MathUtils.smoothstep(x, a, b)
const easeInOut = (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2)

function shotAt(p: number) {
  for (let i = 1; i < SHOTS.length; i++) {
    const a = SHOTS[i - 1]
    const b = SHOTS[i]
    if (p <= b.p) {
      const k = smooth(a.p, b.p, p)
      return { az: a.az + (b.az - a.az) * k, el: a.el + (b.el - a.el) * k }
    }
  }
  const last = SHOTS[SHOTS.length - 1]
  return { az: last.az, el: last.el }
}

function dirFrom(azDeg: number, elDeg: number): [number, number, number] {
  const az = THREE.MathUtils.degToRad(azDeg)
  const el = THREE.MathUtils.degToRad(elDeg)
  return [Math.cos(el) * Math.cos(az), Math.sin(el), Math.cos(el) * Math.sin(az)]
}

/** Margen del encuadre según la forma del lienzo: en vertical (móvil) el coche va abajo, bajo el titular. */
function boundsFor(aspect: number): FitBounds {
  if (aspect < 0.8) return { x: [-0.94, 0.94], y: [-0.94, -0.3] }
  if (aspect < 1.15) return { x: [-0.9, 0.9], y: [-0.62, 0.42] }
  return { x: [-0.84, 0.84], y: [-0.66, 0.5] }
}

const extents = new Map<BodyType, { front: number; rear: number; corners: THREE.Vector3[] }>()
function bodyExtents(body: BodyType) {
  let e = extents.get(body)
  if (!e) {
    const s = getBodyShape(body)
    const size = getCarBuild(body, 'high').size
    const hw = size.width / 2
    e = { front: s.front, rear: s.rear, corners: boxCorners([s.rear, 0, -hw], [s.front, size.height, hw]) }
    extents.set(body, e)
  }
  return e
}

/** Construye la geometría de una carrocería en un momento libre (evita tirones al empezar el barrido). */
function prebuild(body: BodyType) {
  const run = () => {
    getCarBuild(body, 'high')
    bodyExtents(body)
  }
  if (typeof window !== 'undefined' && 'requestIdleCallback' in window) window.requestIdleCallback(run, { timeout: 1500 })
  else setTimeout(run, 60)
}

// ───────────────────────── Componente público ─────────────────────────

export default function HeroCanvas({ progress = 0, className }: HeroSceneProps) {
  const tokens = useThemeTokens()
  const reduced = usePrefersReducedMotion()
  const wrap = useRef<HTMLDivElement>(null)
  const inView = useInView(wrap, '0px')
  const animate = !reduced && inView
  const p = Math.min(1, Math.max(0, Number.isFinite(progress) ? progress : 0))
  // Suelo con reflejo (un render extra por fotograma) solo en pantallas con puntero fino y anchas
  const reflect = useMemo(() => typeof window !== 'undefined' && !!window.matchMedia?.('(min-width: 768px) and (pointer: fine)').matches, [])

  return (
    <div ref={wrap} className={['relative', className].filter(Boolean).join(' ')} aria-hidden>
      <Canvas
        frameloop={animate ? 'always' : 'demand'}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        camera={{ fov: FOV, near: 0.1, far: 90, position: [8, 1.6, 5] }}
        onCreated={({ gl, camera }) => {
          gl.localClippingEnabled = true
          gl.toneMappingExposure = 1.06
          camera.layers.enable(FX_LAYER)
        }}
        style={{ pointerEvents: 'none' }}
      >
        <HeroWorld p={p} tokens={tokens} reduced={reduced} animate={animate} reflect={reflect} />
      </Canvas>
    </div>
  )
}

// ───────────────────────── Escena ─────────────────────────

type SlotId = 'a' | 'b'
interface Cycle {
  a: number | null
  b: number | null
  cur: SlotId
  wiping: boolean
}

interface WorldProps {
  p: number
  tokens: ThemeTokens
  reduced: boolean
  animate: boolean
  reflect: boolean
}

function HeroWorld({ p, tokens, reduced, animate, reflect }: WorldProps) {
  useCanvasLabel('', true)
  const invalidate = useThree((s) => s.invalidate)
  const aspect = useThree((s) => s.size.width / Math.max(1, s.size.height))

  // Ciclo: dos "huecos" (a/b) que se alternan; el actual se revela sobre el anterior con el barrido.
  const [cycle, setCycle] = useState<Cycle>(() => ({ a: 0, b: null, cur: 'a', wiping: !reduced }))
  const curIndex = (cycle.cur === 'a' ? cycle.a : cycle.b) ?? 0
  const prevIndex = cycle.cur === 'a' ? cycle.b : cycle.a
  const cur = HERO_CYCLE[curIndex]
  const prev = prevIndex === null ? null : HERO_CYCLE[prevIndex]

  // Estado vivo para useFrame
  const live = useRef({ p, cycle, reduced, animate, aspect })
  live.current = { p, cycle, reduced, animate, aspect }
  const timeline = useRef({ start: -1, pending: false })

  // Con movimiento reducido no hay barridos ni ciclo: se fija el primer coche
  useEffect(() => {
    if (reduced) {
      setCycle((c) => (c.wiping || c.cur !== 'a' || c.b !== null ? { a: c.cur === 'a' ? c.a : c.b, b: null, cur: 'a', wiping: false } : c))
    }
  }, [reduced])

  useEffect(() => {
    invalidate()
  }, [p, cycle, aspect, invalidate])

  // Prepara la siguiente carrocería mientras se ve la actual
  useEffect(() => {
    if (!reduced) prebuild(HERO_CYCLE[(curIndex + 1) % HERO_CYCLE.length].body)
  }, [curIndex, reduced])

  // Planos de recorte por hueco (estables: CarModel clona sus materiales una sola vez por plano)
  const planes = useMemo(
    () => ({
      a: { solid: new THREE.Plane(new THREE.Vector3(-1, 0, 0), 1000), ghost: new THREE.Plane(new THREE.Vector3(1, 0, 0), -1000) },
      b: { solid: new THREE.Plane(new THREE.Vector3(-1, 0, 0), 1000), ghost: new THREE.Plane(new THREE.Vector3(1, 0, 0), -1000) },
    }),
    [],
  )
  const xrayOn = reduced ? p >= RM_XRAY_AT : p > XRAY_FROM - 0.02
  const clips = useMemo(
    () => ({
      a: { solidOnly: { solid: planes.a.solid, ghost: null }, mixed: { solid: planes.a.solid, ghost: planes.a.ghost } },
      b: { solidOnly: { solid: planes.b.solid, ghost: null }, mixed: { solid: planes.b.solid, ghost: planes.b.ghost } },
    }),
    [planes],
  )

  const scanner = useRef<THREE.Group>(null)
  const scanMat = useRef<{ frame: THREE.MeshBasicMaterial; sheet: THREE.MeshBasicMaterial; floor: THREE.MeshBasicMaterial } | null>(null)
  const dots = useRef<DotsHandle | null>(null)
  const cam = useRef<{ az: number; el: number; dist: number; target: THREE.Vector3 } | null>(null)
  const xs = useRef(0) // avance del barrido de rayos X (0..1), amortiguado

  useFrame((state, delta) => {
    const L = live.current
    const t = state.clock.elapsedTime
    const dt = Math.min(delta, 0.05)
    const tl = timeline.current
    if (tl.start < 0) tl.start = t
    const c = L.cycle
    const curId = c.cur
    const prevId: SlotId = curId === 'a' ? 'b' : 'a'
    const curBody = HERO_CYCLE[(curId === 'a' ? c.a : c.b) ?? 0].body
    const prevIdx = curId === 'a' ? c.b : c.a
    const prevBody = prevIdx === null ? null : HERO_CYCLE[prevIdx].body
    const ec = bodyExtents(curBody)
    const ep = prevBody ? bodyExtents(prevBody) : null
    const front = Math.max(ec.front, ep?.front ?? -Infinity) + 0.3
    const rear = Math.min(ec.rear, ep?.rear ?? Infinity) - 0.3

    // ── Línea de tiempo del ciclo
    let wipeX: number | null = null
    if (c.wiping && !L.reduced) {
      const k = Math.min(1, (t - tl.start) / WIPE)
      wipeX = front + (rear - front) * easeInOut(k)
      if (k >= 1 && !tl.pending) {
        tl.pending = true
        tl.start = t
        setCycle((s) => ({ ...s, [prevId]: null, wiping: false }))
      }
    } else {
      tl.pending = false
      const paused = L.reduced || L.p > CYCLE_UNTIL
      if (paused) tl.start = Math.max(tl.start, t - HOLD * 0.45) // al volver arriba, espera un poco antes de cambiar
      else if (t - tl.start > HOLD) {
        tl.start = t
        tl.pending = true
        const next = ((curId === 'a' ? c.a : c.b) ?? 0) + 1
        setCycle((s) => ({ ...s, [prevId]: next % HERO_CYCLE.length, cur: prevId, wiping: true }))
      }
    }

    // ── Barrido de rayos X (amortiguado; con movimiento reducido, instantáneo)
    const xTarget = L.reduced ? (L.p >= RM_XRAY_AT ? 1 : 0) : smooth(XRAY_FROM, XRAY_TO, L.p)
    if (c.wiping) xs.current = 0
    else xs.current = L.reduced ? xTarget : THREE.MathUtils.damp(xs.current, xTarget, 5, dt)
    const xk = xs.current
    const xrayX = ec.front + 0.3 + (ec.rear - 0.3 - (ec.front + 0.3)) * xk

    // ── Planos
    const pc = planes[curId]
    const pp = planes[prevId]
    if (wipeX !== null) {
      pc.solid.normal.set(1, 0, 0)
      pc.solid.constant = -wipeX // conserva x ≥ barrido: el coche nuevo aparece por el morro
      pc.ghost.normal.set(1, 0, 0)
      pc.ghost.constant = -1000 // nada en rayos X durante el cambio
      pp.solid.normal.set(-1, 0, 0)
      pp.solid.constant = wipeX // el anterior conserva lo que queda por barrer
    } else {
      pc.solid.normal.set(-1, 0, 0)
      pc.solid.constant = xrayX // sólido detrás del escáner
      pc.ghost.normal.set(1, 0, 0)
      pc.ghost.constant = -xrayX // rayos X delante
    }

    // ── Escáner
    const g = scanner.current
    const sm = scanMat.current
    if (g && sm) {
      const scanning = wipeX !== null || (xk > 0.002 && xk < 0.998)
      g.visible = scanning
      if (scanning) {
        const x = wipeX ?? xrayX
        const span = front - rear
        const edge = Math.min(1, Math.min(front - x, x - rear) / (span * 0.12)) // aparece y se apaga en los extremos
        g.position.x = x
        const col = wipeX !== null ? tokens.accent : tokens.info
        sm.frame.color.set(col)
        sm.sheet.color.set(col)
        sm.floor.color.set(col)
        sm.frame.opacity = 0.95 * edge
        sm.sheet.opacity = 0.55 * edge
        sm.floor.opacity = 0.8 * edge
        const size = getCarBuild(curBody, 'high').size
        const h = Math.max(size.height, ep ? getCarBuild(prevBody!, 'high').size.height : 0) + 0.16
        const w = Math.max(size.width, ep ? getCarBuild(prevBody!, 'high').size.width : 0) + 0.42
        g.scale.set(1, h, w)
      }
    }

    // ── Puntos de zona
    const dk = L.reduced ? (L.p >= RM_XRAY_AT ? 1 : 0) : smooth(DOTS_FROM, DOTS_TO, L.p) * (xk > 0.95 ? 1 : 0)
    dots.current?.update(dk, L.reduced ? 0 : t)

    // ── Cámara
    const shot = L.reduced ? STATIC_SHOT : shotAt(L.p)
    let az = shot.az
    let el = shot.el
    if (L.animate) {
      az += 2.2 * Math.sin(t * 0.31)
      el += 0.7 * Math.sin(t * 0.23)
    }
    const camera = state.camera as THREE.PerspectiveCamera
    let cs = cam.current
    const first = !cs
    if (!cs) cs = cam.current = { az, el, dist: 10, target: new THREE.Vector3() }
    const k = first || L.reduced ? 1 : 1 - Math.exp(-dt * 3)
    cs.az += (az - cs.az) * k
    cs.el += (el - cs.el) * k
    const dir = dirFrom(cs.az, cs.el)
    const pts = ep && c.wiping ? [...ec.corners, ...ep.corners] : ec.corners
    const f = fitView(pts, dir, FOV, L.aspect, boundsFor(L.aspect))
    const kf = first || L.reduced ? 1 : 1 - Math.exp(-dt * 2.4)
    cs.dist += (f.distance - cs.dist) * kf
    cs.target.lerp(_t.set(f.target[0], f.target[1], f.target[2]), kf)
    camera.position.set(cs.target.x + dir[0] * cs.dist, cs.target.y + dir[1] * cs.dist, cs.target.z + dir[2] * cs.dist)
    camera.lookAt(cs.target)
    if (camera.fov !== FOV) {
      camera.fov = FOV
      camera.updateProjectionMatrix()
    }
    // En "demand" (movimiento reducido o fuera de vista) se pide otro fotograma hasta que la cámara se asienta
    if (!L.animate && !first && Math.abs(f.distance - cs.dist) > 0.002) invalidate()
  })

  const floorColor = tokens.light ? mixHex(tokens.surface3, tokens.base, 0.35) : mixHex(tokens.surface2, tokens.base, 0.25)

  return (
    <>
      <HeroEnvironment key={`${tokens.light}|${tokens.accent}`} tokens={tokens} />
      {(['a', 'b'] as SlotId[]).map((id) => {
        const idx = cycle[id]
        if (idx === null) return null
        const item = HERO_CYCLE[idx]
        const isCur = cycle.cur === id
        return (
          <CarModel
            key={`${id}-${idx}`}
            body={item.body}
            color={item.color}
            accent={tokens.accent}
            ghostColor={tokens.info}
            clip={isCur && xrayOn ? clips[id].mixed : clips[id].solidOnly}
          />
        )
      })}
      <StudioFloor color={floorColor} reflect={reflect} strength={tokens.light ? 0.5 : 0.85} />
      <CarShadow length={SHADOW_LEN} width={SHADOW_W} opacity={tokens.light ? 0.5 : 0.8} />
      <Scanner groupRef={scanner} matsRef={scanMat} />
      <ZoneDots body={cur.body} tokens={tokens} handle={dots} />
      {prev && null}
    </>
  )
}

const _t = new THREE.Vector3()

// ───────────────────────── Entorno ─────────────────────────

/** Estudio con tiras de luz de acento e info: reflejos "tecnológicos" en la pintura sin descargar HDRIs. */
function HeroEnvironment({ tokens }: { tokens: ThemeTokens }) {
  return (
    <Environment resolution={256} frames={1} background={false}>
      <color attach="background" args={[tokens.light ? '#3a4045' : '#1b2024']} />
      <Lightformer form="rect" intensity={2.8} scale={[12, 5]} position={[0, 8, 0]} rotation-x={Math.PI / 2} />
      <Lightformer form="rect" intensity={1.9} scale={[18, 1.8]} position={[0, 2.3, 9]} />
      <Lightformer form="rect" intensity={1.1} scale={[18, 1.8]} position={[0, 2.3, -9]} />
      <Lightformer form="rect" intensity={1.3} scale={[18, 0.3]} position={[0, 4.6, 7]} />
      <Lightformer form="rect" intensity={2.2} scale={[5, 3]} position={[10, 3, 4]} />
      <Lightformer form="ring" intensity={2.2} scale={2.6} position={[7, 5, 7]} />
      <Lightformer form="rect" intensity={0.45} scale={[24, 24]} position={[0, -2, 0]} rotation-x={-Math.PI / 2} />
      <Lightformer form="rect" intensity={0.7} scale={[16, 3.5]} position={[0, 6.5, 6.5]} target={[0, 0, 0]} />
      <Lightformer form="rect" intensity={0.6} scale={[16, 3.5]} position={[0, 6.5, -6.5]} target={[0, 0, 0]} />
      {/* Tiras de color: acento bajo y largo por detrás, info vertical de contraluz */}
      <Lightformer form="rect" color={tokens.accent} intensity={1.5} scale={[16, 0.22]} position={[-2, 0.9, -8]} />
      <Lightformer form="rect" color={tokens.accent} intensity={0.9} scale={[0.25, 5]} position={[-9, 2.4, 5]} />
      <Lightformer form="rect" color={tokens.info} intensity={1.4} scale={[0.35, 6]} position={[-8, 2.6, -5]} />
    </Environment>
  )
}

// ───────────────────────── Escáner ─────────────────────────

/** Marco de luz + lámina translúcida + línea en el suelo. Escala 1 × alto × ancho (se ajusta en cada fotograma). */
function Scanner({
  groupRef,
  matsRef,
}: {
  groupRef: React.RefObject<THREE.Group | null>
  matsRef: React.RefObject<{ frame: THREE.MeshBasicMaterial; sheet: THREE.MeshBasicMaterial; floor: THREE.MeshBasicMaterial } | null>
}) {
  const res = useMemo(() => {
    const additive = (o: THREE.MeshBasicMaterialParameters) =>
      new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, ...o })
    const sheetTex = gradientTexture('sheet')
    const floorTex = gradientTexture('floor')
    const frame = additive({ color: '#ffffff' })
    const sheet = additive({ color: '#ffffff', map: sheetTex ?? undefined })
    const floor = additive({ color: '#ffffff', map: floorTex ?? undefined })
    // Marco en el plano YZ (unidad: 1 de alto × 1 de ancho, base en el suelo), con barras finas
    const bar = 0.012
    const parts: THREE.BufferGeometry[] = []
    const box = (sy: number, sz: number, y: number, z: number) => {
      const b = new THREE.BoxGeometry(0.012, sy, sz)
      b.translate(0, y, z)
      parts.push(b)
    }
    box(bar, 1, 1, 0) // arriba
    box(1, bar, 0.5, 0.5) // lados
    box(1, bar, 0.5, -0.5)
    const sheetGeo = new THREE.PlaneGeometry(1, 1)
    sheetGeo.rotateY(Math.PI / 2)
    sheetGeo.translate(0, 0.5, 0)
    const floorGeo = new THREE.PlaneGeometry(0.9, 1.5)
    floorGeo.rotateX(-Math.PI / 2)
    floorGeo.translate(0, 0.004, 0)
    return { frame, sheet, floor, parts, sheetGeo, floorGeo, sheetTex, floorTex }
  }, [])

  useEffect(() => {
    matsRef.current = { frame: res.frame, sheet: res.sheet, floor: res.floor }
    const g = groupRef.current
    g?.traverse((o) => o.layers.set(FX_LAYER))
    return () => {
      matsRef.current = null
      res.frame.dispose()
      res.sheet.dispose()
      res.floor.dispose()
      res.parts.forEach((p) => p.dispose())
      res.sheetGeo.dispose()
      res.floorGeo.dispose()
      res.sheetTex?.dispose()
      res.floorTex?.dispose()
    }
  }, [res, groupRef, matsRef])

  return (
    <group ref={groupRef} visible={false} renderOrder={20}>
      {res.parts.map((geo, i) => (
        <mesh key={i} geometry={geo} material={res.frame} renderOrder={21} />
      ))}
      <mesh geometry={res.sheetGeo} material={res.sheet} renderOrder={20} />
      <mesh geometry={res.floorGeo} material={res.floor} renderOrder={19} />
    </group>
  )
}

/** Degradados procedurales: lámina (más intensa abajo, con líneas de barrido) y halo del suelo. */
function gradientTexture(kind: 'sheet' | 'floor' | 'halo'): THREE.Texture | null {
  if (typeof document === 'undefined') return null
  const c = document.createElement('canvas')
  const g = c.getContext('2d')
  if (!g) return null
  if (kind === 'sheet') {
    c.width = 8
    c.height = 256
    const grad = g.createLinearGradient(0, 0, 0, 256)
    grad.addColorStop(0, 'rgba(255,255,255,0.05)')
    grad.addColorStop(0.7, 'rgba(255,255,255,0.18)')
    grad.addColorStop(1, 'rgba(255,255,255,0.42)')
    g.fillStyle = grad
    g.fillRect(0, 0, 8, 256)
    g.fillStyle = 'rgba(255,255,255,0.12)'
    for (let y = 0; y < 256; y += 6) g.fillRect(0, y, 8, 1)
  } else if (kind === 'floor') {
    c.width = 128
    c.height = 8
    const grad = g.createLinearGradient(0, 0, 128, 0)
    grad.addColorStop(0, 'rgba(255,255,255,0)')
    grad.addColorStop(0.47, 'rgba(255,255,255,0.35)')
    grad.addColorStop(0.5, 'rgba(255,255,255,1)')
    grad.addColorStop(0.53, 'rgba(255,255,255,0.35)')
    grad.addColorStop(1, 'rgba(255,255,255,0)')
    g.fillStyle = grad
    g.fillRect(0, 0, 128, 8)
  } else {
    c.width = c.height = 64
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32)
    grad.addColorStop(0, 'rgba(255,255,255,1)')
    grad.addColorStop(0.25, 'rgba(255,255,255,0.55)')
    grad.addColorStop(1, 'rgba(255,255,255,0)')
    g.fillStyle = grad
    g.fillRect(0, 0, 64, 64)
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

// ───────────────────────── Puntos de zona ─────────────────────────

interface DotsHandle {
  update(amount: number, time: number): void
}

function ZoneDots({ body, tokens, handle }: { body: BodyType; tokens: ThemeTokens; handle: React.RefObject<DotsHandle | null> }) {
  const group = useRef<THREE.Group>(null)
  const anchors = getCarLayout(body).anchors
  const res = useMemo(() => {
    const halo = gradientTexture('halo')
    const color = { ok: tokens.ok, warning: tokens.warning, danger: tokens.danger }
    const items = DOTS.map(([zone, tone], i) => {
      const core = new THREE.MeshBasicMaterial({ color: color[tone], toneMapped: false, transparent: true, depthTest: false })
      const glow = new THREE.SpriteMaterial({ color: color[tone], map: halo ?? undefined, transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false })
      const ring = new THREE.MeshBasicMaterial({ color: color[tone], toneMapped: false, transparent: true, depthTest: false, side: THREE.DoubleSide })
      return { zone, core, glow, ring, phase: i * 0.7 }
    })
    const sphere = new THREE.SphereGeometry(0.045, 16, 12)
    const ringGeo = new THREE.RingGeometry(0.09, 0.105, 40)
    return { items, sphere, ringGeo, halo }
  }, [tokens.ok, tokens.warning, tokens.danger])

  useEffect(() => {
    group.current?.traverse((o) => o.layers.set(FX_LAYER))
  })

  useEffect(() => {
    const g = group.current
    handle.current = {
      update(amount, time) {
        if (!g) return
        g.visible = amount > 0.01
        if (!g.visible) return
        res.items.forEach((it, i) => {
          const pulse = time ? 0.5 + 0.5 * Math.sin(time * 2.4 + it.phase) : 0.6
          const a = THREE.MathUtils.clamp(amount * 1.4 - i * 0.06, 0, 1) // se encienden uno tras otro
          it.core.opacity = a
          it.glow.opacity = a * (0.55 + 0.35 * pulse)
          it.ring.opacity = a * (time ? 0.7 * (1 - pulse) : 0.5)
          const sprite = g.children[i]?.children[1]
          if (sprite) sprite.scale.setScalar(0.32 + 0.1 * pulse)
          const ringMesh = g.children[i]?.children[2]
          if (ringMesh) ringMesh.scale.setScalar(1 + (time ? 1.2 * (1 - pulse) : 0.4))
        })
      },
    }
    return () => {
      handle.current = null
    }
  }, [res, handle])

  useEffect(
    () => () => {
      res.items.forEach((it) => {
        it.core.dispose()
        it.glow.dispose()
        it.ring.dispose()
      })
      res.sphere.dispose()
      res.ringGeo.dispose()
      res.halo?.dispose()
    },
    [res],
  )

  return (
    <group ref={group} visible={false}>
      {res.items.map((it) => (
        <group key={it.zone} position={anchors[it.zone].position}>
          <mesh geometry={res.sphere} material={it.core} renderOrder={31} />
          <sprite material={it.glow} renderOrder={30} />
          <Billboard>
            <mesh geometry={res.ringGeo} material={it.ring} renderOrder={30} />
          </Billboard>
        </group>
      ))}
    </group>
  )
}

/** Mantiene su contenido de cara a la cámara (anillos de los puntos). */
function Billboard({ children }: { children: React.ReactNode }) {
  const ref = useRef<THREE.Group>(null)
  useFrame(({ camera }) => {
    ref.current?.quaternion.copy(camera.quaternion)
  })
  return <group ref={ref}>{children}</group>
}
