/**
 * Mecánico de la maqueta: una figura de arcilla junto al coche del elevador, solo cuando la orden tiene de verdad una
 * persona asignada (`assigned_to`) y está en diagnóstico o en reparación. No es un dato inventado: es la orden
 * dibujada. El color del mono identifica a cada persona (sale de su id) y se repite en su rótulo.
 *  - En reparación: brazos al frente con una llave, cuerpo que acompaña y un destello de trabajo en la herramienta.
 *  - En diagnóstico: una tableta encendida entre las manos y la cabeza que sube y baja de la tableta al coche.
 *  - Con movimiento reducido: pose fija, sin fotogramas continuos.
 * La figura aparece cuando su coche ya está colocado en el elevador (nunca mientras maniobra) y es clicable.
 */
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
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

export type MechanicTask = 'repair' | 'diagnose'

export function Mechanic({
  x,
  z,
  heading,
  color,
  task,
  reduced,
  hovered,
  ready,
  onSelect,
  onHover,
}: {
  x: number
  z: number
  /** Giro en y: la figura mira a +z con 0. */
  heading: number
  color: string
  task: MechanicTask
  reduced: boolean
  hovered: boolean
  /** true cuando su coche ya está colocado en el elevador (se consulta en cada fotograma). */
  ready: () => boolean
  onSelect: () => void
  onHover: (on: boolean) => void
}) {
  const fig = useMemo(() => figure(color), [color])
  const root = useRef<THREE.Group>(null)
  const torso = useRef<THREE.Group>(null)
  const armL = useRef<THREE.Group>(null)
  const armR = useRef<THREE.Group>(null)
  const spark = useRef<THREE.Sprite>(null)
  // desfase propio para que dos mecánicos no se muevan al unísono
  const phase = useMemo(() => (Math.abs(Math.round(x * 13 + z * 7)) % 10) * 0.63, [x, z])

  useFrame((state) => {
    const g = root.current
    if (!g) return
    const show = ready()
    if (g.visible !== show) g.visible = show
    if (!show) return
    const t = reduced ? 1.2 : state.clock.elapsedTime + phase
    const tr = torso.current
    const l = armL.current
    const r = armR.current
    if (tr && l && r) {
      if (task === 'repair') {
        const turn = Math.sin(t * 5.2)
        tr.rotation.x = 0.16 + Math.sin(t * 1.3) * 0.035
        tr.position.y = Math.sin(t * 2.6) * 0.012
        l.rotation.x = -1.32 + Math.sin(t * 1.3) * 0.05
        r.rotation.x = -1.45 + turn * 0.2
        r.rotation.z = -0.1 + turn * 0.06
        if (spark.current) {
          const k = 0.5 + 0.5 * Math.sin(t * 10.4) * Math.sin(t * 3.1)
          spark.current.scale.setScalar(0.16 + k * 0.3)
          spark.current.visible = !reduced
        }
      } else {
        const look = Math.max(0, Math.sin(t * 0.7))
        tr.rotation.x = 0.1 - look * 0.12
        tr.position.y = 0
        l.rotation.x = -0.95
        l.rotation.z = 0.32
        r.rotation.x = -0.95 + Math.sin(t * 3.4) * 0.05
        r.rotation.z = -0.32
        if (spark.current) spark.current.visible = false
      }
    }
    if (!reduced) state.invalidate()
  })

  const mat = hovered ? clayFigureHover() : clayFigure()
  return (
    <group ref={root} position={[x, 0, z]} rotation-y={heading} visible={false} name="mecanico">
      <mesh geometry={flatGeo} material={blobShadow()} scale={[0.95, 1, 0.95]} position={[0, 0.013, 0.02]} renderOrder={-1} />
      <group ref={torso}>
        <mesh geometry={fig.body} material={mat} />
        <group ref={armL} position={[-0.26, 1.33, 0]}>
          <mesh geometry={fig.arm} material={mat} />
        </group>
        <group ref={armR} position={[0.26, 1.33, 0]}>
          <mesh geometry={fig.arm} material={mat} />
          {task === 'repair' && <mesh geometry={wrench()} material={mat} />}
        </group>
        {task === 'diagnose' && <mesh geometry={tabletGeo} material={tabletMat} position={[0, 1.02, 0.47]} rotation-x={-0.6} />}
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
