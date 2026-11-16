/**
 * Persona del equipo en la maqueta: una figura de arcilla por persona (nunca dos: ver `crew.ts`). Junto al coche del
 * elevador cuando tiene una orden en diagnóstico o en reparación asignada de verdad (`assigned_to`); si no, de pie en
 * la zona del equipo. El color del mono identifica a cada persona (sale de su id) y se repite en su rótulo.
 *  - En reparación: brazos al frente con una llave, cuerpo que acompaña y un destello de trabajo en la herramienta.
 *  - En diagnóstico: una tableta encendida entre las manos y la cabeza que sube y baja de la tableta al coche.
 *  - Sin orden en curso: de pie, con un leve vaivén.
 *  - Al cambiar de sitio (empieza o termina una orden) camina por el pasillo entre los elevadores y la calzada.
 *  - Con movimiento reducido: pose fija y cambio de sitio directo, sin fotogramas continuos.
 * La primera vez que aparece junto a un elevador espera a que su coche esté colocado (nunca mientras maniobra).
 */
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { colored, mergeAndDispose, rbox } from './diorama'
import { poolTexture } from './kit'

const CLAY_SKIN = '#d7dce6'
const BOOT = '#1b1f2a'
const STEEL = '#aeb7c8'

interface Figure {
  body: THREE.BufferGeometry
  arm: THREE.BufferGeometry
}
const figures = new Map<string, Figure>()

/** Cuerpo (piernas, tronco, cabeza y gorra; y = 0 en el suelo, mira a +z) y un brazo con el hombro en el origen. */
function figure(color: string): Figure {
  let f = figures.get(color)
  if (f) return f
  const dark = new THREE.Color(color).multiplyScalar(0.62).getHexString()
  const body: THREE.BufferGeometry[] = []
  for (const sx of [-1, 1]) {
    body.push(colored(rbox(0.15, 0.78, 0.17, 0.05, sx * 0.1, 0.45, 0), `#${dark}`))
    body.push(colored(rbox(0.16, 0.1, 0.26, 0.04, sx * 0.1, 0.05, 0.04, 1), BOOT))
  }
  body.push(colored(rbox(0.4, 0.56, 0.24, 0.09, 0, 1.1, 0), color))
  // banda reflectante y cinturón
  body.push(colored(rbox(0.41, 0.06, 0.25, 0.02, 0, 1.16, 0, 1), '#f3f5fa'))
  body.push(colored(rbox(0.41, 0.07, 0.25, 0.02, 0, 0.85, 0, 1), BOOT))
  const head = new THREE.SphereGeometry(0.14, 16, 12)
  head.translate(0, 1.55, 0.01)
  body.push(colored(head, CLAY_SKIN))
  const cap = new THREE.SphereGeometry(0.148, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2.1)
  cap.translate(0, 1.57, 0.01)
  body.push(colored(cap, color))
  body.push(colored(rbox(0.2, 0.025, 0.14, 0.01, 0, 1.6, 0.16, 1), color))

  const arm: THREE.BufferGeometry[] = []
  arm.push(colored(rbox(0.11, 0.56, 0.12, 0.045, 0, -0.24, 0), color))
  const hand = new THREE.SphereGeometry(0.065, 10, 8)
  hand.translate(0, -0.55, 0)
  arm.push(colored(hand, CLAY_SKIN))

  f = { body: mergeAndDispose(body), arm: mergeAndDispose(arm) }
  figures.set(color, f)
  return f
}

let wrenchGeo: THREE.BufferGeometry | null = null
function wrench() {
  // mango desde la mano y boca de la llave en la punta (el brazo apunta a −y en reposo)
  wrenchGeo ??= mergeAndDispose([colored(rbox(0.035, 0.32, 0.022, 0.008, 0, -0.72, 0, 1), STEEL), colored(rbox(0.09, 0.07, 0.024, 0.01, 0, -0.9, 0, 1), STEEL)])
  return wrenchGeo
}
const tabletGeo = new THREE.BoxGeometry(0.3, 0.2, 0.018)

let figureMat: THREE.MeshStandardMaterial | null = null
function clayFigure() {
  figureMat ??= new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.62, metalness: 0.05 })
  return figureMat
}
let hoverMat: THREE.MeshStandardMaterial | null = null
function clayFigureHover() {
  hoverMat ??= new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.62, metalness: 0.05, emissive: '#ffffff', emissiveIntensity: 0.22 })
  return hoverMat
}
let dimMat: THREE.MeshStandardMaterial | null = null
/** Atenuada: la figura no coincide con el filtro de la página. */
function clayFigureDim() {
  dimMat ??= new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.62, metalness: 0.05, color: '#4d525e' })
  return dimMat
}
const ringGeo = new THREE.RingGeometry(0.36, 0.46, 32).rotateX(-Math.PI / 2)
const ringMats = new Map<string, THREE.MeshBasicMaterial>()
function ringMaterial(color: string) {
  let m = ringMats.get(color)
  if (!m) {
    m = new THREE.MeshBasicMaterial({ color, toneMapped: false, transparent: true, opacity: 0.95, depthWrite: false })
    ringMats.set(color, m)
  }
  return m
}
const tabletMat = new THREE.MeshStandardMaterial({ color: '#0f1724', emissive: '#38bdf8', emissiveIntensity: 1.1, roughness: 0.4 })
const PROXY_MAT = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false })
const proxyGeo = new THREE.BoxGeometry(0.7, 1.8, 0.7)
const flatGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2)

let shadowMat: THREE.MeshBasicMaterial | null = null
let sparkMat: THREE.SpriteMaterial | null = null
function blobShadow() {
  shadowMat ??= new THREE.MeshBasicMaterial({ map: poolTexture(), color: '#000000', transparent: true, opacity: 0.42, depthWrite: false, toneMapped: false })
  return shadowMat
}
function sparkMaterial() {
  sparkMat ??= new THREE.SpriteMaterial({ map: poolTexture(), color: '#ffc27a', transparent: true, opacity: 0.9, depthWrite: false, depthTest: false, toneMapped: false, blending: THREE.AdditiveBlending })
  return sparkMat
}

export type MechanicTask = 'repair' | 'diagnose' | 'idle'

/** Velocidad al caminar (m/s). */
const WALK_SPEED = 1.8

export function Mechanic({
  x,
  z,
  heading,
  color,
  task,
  reduced,
  hovered,
  selected = false,
  selectColor = '#ffffff',
  dim = false,
  aisleZ,
  phaseSeed = 0,
  register,
  ready,
  onSelect,
  onHover,
}: {
  /** Sitio donde debe estar (si cambia, camina hasta él). */
  x: number
  z: number
  /** Giro en y: la figura mira a +z con 0. */
  heading: number
  color: string
  task: MechanicTask
  reduced: boolean
  hovered: boolean
  selected?: boolean
  selectColor?: string
  /** Atenuada: no coincide con el filtro de la página. */
  dim?: boolean
  /** z del pasillo por el que camina al cambiar de sitio (entre la boca de los elevadores y la calzada). */
  aisleZ: number
  /** Desfase de la animación (id de la persona): dos figuras no se mueven al unísono. */
  phaseSeed?: number
  /** Entrega el grupo de la figura (para que su rótulo la siga mientras camina). */
  register?: (o: THREE.Object3D | null) => void
  /** true cuando su coche ya está colocado en el elevador (se consulta en cada fotograma). Sin él, siempre lista. */
  ready?: () => boolean
  onSelect: () => void
  onHover: (on: boolean) => void
}) {
  const fig = useMemo(() => figure(color), [color])
  const root = useRef<THREE.Group>(null)
  const torso = useRef<THREE.Group>(null)
  const armL = useRef<THREE.Group>(null)
  const armR = useRef<THREE.Group>(null)
  const spark = useRef<THREE.Sprite>(null)
  const phase = (Math.abs(phaseSeed * 7919) % 10) * 0.63
  // Posición real (va por detrás del destino mientras camina), lo que queda del camino y si ya se ha visto alguna vez
  const pos = useRef<{ x: number; z: number; heading: number } | null>(null)
  const path = useRef<{ x: number; z: number }[]>([])
  const seen = useRef(false)
  const invalidate = useThree((s) => s.invalidate)

  useLayoutEffect(() => {
    register?.(root.current)
    return () => register?.(null)
  }, [register])

  useLayoutEffect(() => {
    const cur = pos.current
    if (!cur || reduced || !seen.current) {
      pos.current = { x, z, heading }
      path.current = []
    } else if (Math.hypot(cur.x - x, cur.z - z) > 0.05) {
      // Por el pasillo: sale hacia delante, va de lado y entra (en línea recta si es un paso corto)
      path.current = Math.abs(cur.x - x) < 0.6 ? [{ x, z }] : [{ x: cur.x, z: aisleZ }, { x, z: aisleZ }, { x, z }]
    } else {
      cur.heading = heading
    }
    const g = root.current
    const p = pos.current
    if (g && p) {
      g.position.set(p.x, 0, p.z)
      g.rotation.y = p.heading
    }
    invalidate()
  }, [x, z, heading, reduced, aisleZ, invalidate])

  useFrame((state, delta) => {
    const g = root.current
    const cur = pos.current
    if (!g || !cur) return
    const walking = path.current.length > 0
    const atWork = !ready || ready()
    const show = seen.current || walking || atWork
    if (g.visible !== show) g.visible = show
    if (!show) return
    seen.current = true

    if (walking) {
      let step = WALK_SPEED * Math.min(delta, 0.1)
      while (step > 0 && path.current.length) {
        const to = path.current[0]
        const dx = to.x - cur.x
        const dz = to.z - cur.z
        const d = Math.hypot(dx, dz)
        if (d > 1e-4) cur.heading = Math.atan2(dx, dz)
        if (d <= step) {
          cur.x = to.x
          cur.z = to.z
          step -= d
          path.current.shift()
        } else {
          cur.x += (dx / d) * step
          cur.z += (dz / d) * step
          step = 0
        }
      }
      if (!path.current.length) cur.heading = heading
      g.position.set(cur.x, 0, cur.z)
      g.rotation.y = cur.heading
    }

    const t = reduced ? 1.2 : state.clock.elapsedTime + phase
    const tr = torso.current
    const l = armL.current
    const r = armR.current
    const pose: MechanicTask | 'walk' = walking ? 'walk' : atWork ? task : 'idle'
    if (tr && l && r) {
      if (spark.current) spark.current.visible = pose === 'repair' && !reduced
      if (pose === 'walk') {
        const s = Math.sin(state.clock.elapsedTime * 9)
        tr.rotation.x = 0.06
        tr.position.y = Math.abs(s) * 0.03
        l.rotation.set(s * 0.55, 0, 0.06)
        r.rotation.set(-s * 0.55, 0, -0.06)
      } else if (pose === 'idle') {
        tr.rotation.x = 0
        tr.position.y = Math.sin(t * 1.4) * 0.008
        l.rotation.set(Math.sin(t * 0.9) * 0.04, 0, 0.1)
        r.rotation.set(-Math.sin(t * 0.9) * 0.04, 0, -0.1)
      } else if (pose === 'repair') {
        const turn = Math.sin(t * 5.2)
        tr.rotation.x = 0.16 + Math.sin(t * 1.3) * 0.035
        tr.position.y = Math.sin(t * 2.6) * 0.012
        l.rotation.set(-1.32 + Math.sin(t * 1.3) * 0.05, 0, 0)
        r.rotation.set(-1.45 + turn * 0.2, 0, -0.1 + turn * 0.06)
        if (spark.current) {
          const k = 0.5 + 0.5 * Math.sin(t * 10.4) * Math.sin(t * 3.1)
          spark.current.scale.setScalar(0.16 + k * 0.3)
        }
      } else {
        const look = Math.max(0, Math.sin(t * 0.7))
        tr.rotation.x = 0.1 - look * 0.12
        tr.position.y = 0
        l.rotation.set(-0.95, 0, 0.32)
        r.rotation.set(-0.95 + Math.sin(t * 3.4) * 0.05, 0, -0.32)
      }
    }
    if (!reduced || walking) state.invalidate()
  })

  const plain = dim && !selected ? clayFigureDim() : clayFigure()
  const mat = hovered ? clayFigureHover() : plain
  return (
    <group ref={root} visible={false} name="mecanico">
      <mesh geometry={flatGeo} material={blobShadow()} scale={[0.95, 1, 0.95]} position={[0, 0.013, 0.02]} renderOrder={-1} />
      {(selected || hovered) && <mesh geometry={ringGeo} material={ringMaterial(selected ? selectColor : '#ffffff')} position={[0, 0.016, 0]} renderOrder={3} />}
      <group ref={torso}>
        <mesh geometry={fig.body} material={mat} />
        <group ref={armL} position={[-0.26, 1.33, 0]}>
          <mesh geometry={fig.arm} material={mat} />
        </group>
        <group ref={armR} position={[0.26, 1.33, 0]}>
          <mesh geometry={fig.arm} material={mat} />
          {task === 'repair' && <mesh geometry={wrench()} material={mat} />}
        </group>
        {task === 'diagnose' && <mesh geometry={tabletGeo} material={dim && !selected ? plain : tabletMat} position={[0, 1.02, 0.47]} rotation-x={-0.6} />}
        {task === 'repair' && <sprite ref={spark} material={sparkMaterial()} position={[0.26, 1.24, 0.9]} scale={0.3} renderOrder={5} />}
      </group>
      <mesh
        geometry={proxyGeo}
        material={PROXY_MAT}
        visible={false}
        position={[0, 0.9, 0.1]}
        onClick={(e: ThreeEvent<MouseEvent>) => {
          if (!root.current?.visible) return
          e.stopPropagation()
          if (e.delta > 6) return
          onSelect()
        }}
        onPointerOver={(e) => {
          if (!root.current?.visible) return
          e.stopPropagation()
          onHover(true)
        }}
        onPointerOut={() => onHover(false)}
      />
    </group>
  )
}
