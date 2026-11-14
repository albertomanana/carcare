/**
 * Componentes comunes de las maquetas isométricas (taller y garaje): luz de estudio con sombras, cámara ortográfica
 * fija con paneo y zoom, y el coche de arcilla.
 */
import { OrbitControls } from '@react-three/drei'
import { useThree, type ThreeEvent } from '@react-three/fiber'
import gsap from 'gsap'
import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import type { BodyType } from '@/api/types'
import { clayPaint, clayRest } from './clayCar'
import { getClayModel } from './clayReal'
import type { DioramaPalette } from './diorama'
import { boxPoints, CAM_DIST, ISO_DIR, SUN_DIR, type Bounds, type CamFocus } from './iso'
import type { CarHandle } from './traffic'

// ───────────────────────── Luz de estudio ─────────────────────────

/**
 * `HemisphereLight` (sin negros) + un `DirectionalLight` con sombras cuya cámara se ajusta a la caja de la maqueta
 * (`box`: x, z y altura máxima). Mapa de sombras de 2048 (1024 en pantallas pequeñas).
 */
export function StudioLights({ box, pal, small }: { box: { x0: number; x1: number; z0: number; z1: number; y0: number; y1: number }; pal: DioramaPalette; small: boolean }) {
  const light = useRef<THREE.DirectionalLight>(null)
  const target = useMemo(() => new THREE.Object3D(), [])
  const center = useMemo(() => new THREE.Vector3((box.x0 + box.x1) / 2, 0, (box.z0 + box.z1) / 2), [box])
  const invalidate = useThree((s) => s.invalidate)
  const get = useThree((s) => s.get)

  useLayoutEffect(() => {
    const l = light.current
    if (!l) return
    l.position.copy(center).addScaledVector(SUN_DIR, 40)
    target.position.copy(center)
    target.updateMatrixWorld()
    l.target = target
    // Cámara de sombra ajustada a la maqueta, proyectando las esquinas de su caja
    const cam = new THREE.OrthographicCamera()
    cam.position.copy(l.position)
    cam.lookAt(center)
    cam.updateMatrixWorld()
    const inv = cam.matrixWorldInverse
    let x0 = Infinity
    let x1 = -Infinity
    let y0 = Infinity
    let y1 = -Infinity
    let z0 = Infinity
    let z1 = -Infinity
    for (const p of boxPoints(box.x0, box.x1, box.y0, box.y1, box.z0, box.z1)) {
      p.applyMatrix4(inv)
      x0 = Math.min(x0, p.x)
      x1 = Math.max(x1, p.x)
      y0 = Math.min(y0, p.y)
      y1 = Math.max(y1, p.y)
      z0 = Math.min(z0, p.z)
      z1 = Math.max(z1, p.z)
    }
    const sc = l.shadow.camera
    sc.left = x0
    sc.right = x1
    sc.bottom = y0
    sc.top = y1
    sc.near = Math.max(0.5, -z1 - 1)
    sc.far = -z0 + 1
    sc.updateProjectionMatrix()
    l.shadow.needsUpdate = true
    get().gl.shadowMap.needsUpdate = true
    invalidate()
  }, [center, box, target, get, invalidate])

  const map = small ? 1024 : 2048
  return (
    <>
      <hemisphereLight args={[pal.hemiSky, pal.hemiGround, pal.hemi]} />
      <directionalLight
        ref={light}
        color={pal.sunColor ?? '#fff5e8'}
        intensity={pal.sun}
        castShadow
        shadow-mapSize={[map, map]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.03}
        shadow-radius={3}
      />
      <primitive object={target} />
    </>
  )
}

// ───────────────────────── Cámara ─────────────────────────

/**
 * Cámara ortográfica de ángulo fijo: el giro está bloqueado; se puede desplazar (acotado a `bounds`) y acercar entre
 * 0,7× y 5× el encuadre general (`interactive`). Al cambiar `selKey` (selección nueva o «volver al general») vuela al
 * nuevo encuadre con GSAP (0,8 s, power3.out; instantáneo con movimiento reducido). Si el encuadre cambia por otro
 * motivo (tamaño del lienzo, margen de un panel) y no hay vuelo en curso, se aplica directamente.
 */
export function IsoRig({
  focus,
  overview,
  selKey,
  reduced,
  bounds,
  interactive = true,
  onUserMove,
}: {
  focus: CamFocus
  overview: CamFocus
  selKey: string
  reduced: boolean
  bounds: Bounds
  interactive?: boolean
  onUserMove?: () => void
}) {
  const controls = useRef<OrbitControlsImpl>(null)
  const get = useThree((s) => s.get)
  const invalidate = useThree((s) => s.invalidate)
  const lastSel = useRef<string | null>(null)
  const tween = useRef<gsap.core.Tween | null>(null)

  const fx = Math.round(focus.x * 100) / 100
  const fz = Math.round(focus.z * 100) / 100
  const fzoom = Math.round(focus.zoom * 100) / 100

  useLayoutEffect(() => {
    const c = controls.current
    if (!c) return
    const camera = get().camera as THREE.OrthographicCamera
    const apply = (x: number, z: number, zoom: number) => {
      c.target.set(x, 0, z)
      camera.position.set(x + ISO_DIR.x * CAM_DIST, ISO_DIR.y * CAM_DIST, z + ISO_DIR.z * CAM_DIST)
      camera.zoom = zoom
      camera.updateProjectionMatrix()
      c.update()
      invalidate()
    }
    // Vuela si cambia la selección o si ya había un vuelo en marcha (p. ej. el panel de la página cambia el margen
    // justo después de elegir): se reencamina sin saltos. Un cambio de tamaño en reposo se aplica directamente.
    const flying = !!tween.current?.isActive()
    tween.current?.kill()
    const animate = !reduced && lastSel.current !== null && (lastSel.current !== selKey || flying)
    lastSel.current = selKey
    if (!animate) {
      apply(fx, fz, fzoom)
      return
    }
    const s = { x: c.target.x, z: c.target.z, zoom: camera.zoom }
    tween.current = gsap.to(s, { x: fx, z: fz, zoom: fzoom, duration: 0.8, ease: 'power3.out', onUpdate: () => apply(s.x, s.z, s.zoom) })
    return () => {
      tween.current?.kill()
    }
  }, [fx, fz, fzoom, selKey, reduced, get, invalidate])

  const onChange = () => {
    const c = controls.current
    if (!c) return
    const t = c.target
    const nx = Math.min(bounds.x1, Math.max(bounds.x0, t.x))
    const nz = Math.min(bounds.z1, Math.max(bounds.z0, t.z))
    if (nx !== t.x || nz !== t.z) {
      const camera = get().camera
      camera.position.x += nx - t.x
      camera.position.z += nz - t.z
      t.x = nx
      t.z = nz
    }
  }

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enableRotate={false}
      enablePan={interactive}
      screenSpacePanning={false}
      enableZoom={interactive}
      enableDamping
      dampingFactor={0.14}
      zoomSpeed={0.9}
      minZoom={overview.zoom * 0.7}
      maxZoom={overview.zoom * 5}
      mouseButtons={{ LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN }}
      touches={{ ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_PAN }}
      onStart={() => {
        tween.current?.kill()
        onUserMove?.()
      }}
      onChange={onChange}
    />
  )
}

// ───────────────────────── Coche de arcilla ─────────────────────────

let blobTex: THREE.Texture | null = null
function blobTexture(): THREE.Texture | null {
  if (blobTex || typeof document === 'undefined') return blobTex
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const g = c.getContext('2d')
  if (!g) return null
  const grad = g.createRadialGradient(32, 32, 4, 32, 32, 32)
  grad.addColorStop(0, 'rgba(0,0,0,0.6)')
  grad.addColorStop(0.55, 'rgba(0,0,0,0.3)')
  grad.addColorStop(1, 'rgba(0,0,0,0)')
  g.fillStyle = grad
  g.fillRect(0, 0, 64, 64)
  blobTex = new THREE.CanvasTexture(c)
  return blobTex
}
let blobMat: THREE.MeshBasicMaterial | null = null
function blobMaterial() {
  blobMat ??= new THREE.MeshBasicMaterial({ map: blobTexture(), transparent: true, depthWrite: false, toneMapped: false, opacity: 0.55 })
  return blobMat
}
const blobGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2)
const PROXY_MAT = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false })
const unitBox = new THREE.BoxGeometry(1, 1, 1)

/**
 * Un coche de arcilla: carrocería real mate (2 mallas compartidas por carrocería: pintura y resto), mancha de sombra
 * en el suelo y una caja invisible para el clic. `register` entrega los objetos que mueve el controlador de tráfico:
 * `root` (planta, rumbo, escala) y `lift` (altura). Los hijos extra (plataforma giratoria…) van dentro de `lift`.
 */
export function CarMesh({
  id,
  body,
  color,
  register,
  registerSpin,
  onSelect,
  onHover,
  children,
}: {
  id: number
  body: BodyType
  color: string
  register: (id: number, h: CarHandle | null) => void
  /** Grupo interior que envuelve las mallas del coche (giro y altura de la plataforma del garaje). */
  registerSpin?: (id: number, g: THREE.Object3D | null) => void
  onSelect: () => void
  onHover: (on: boolean) => void
  children?: React.ReactNode
}) {
  const geo = getClayModel(body)
  const { length, width, height } = geo.size
  const root = useRef<THREE.Group>(null)
  const lift = useRef<THREE.Group>(null)
  const spin = useRef<THREE.Group>(null)
  useLayoutEffect(() => {
    if (root.current && lift.current) register(id, { root: root.current, lift: lift.current })
    return () => register(id, null)
  }, [id, register])
  useLayoutEffect(() => {
    if (spin.current) registerSpin?.(id, spin.current)
    return () => registerSpin?.(id, null)
  }, [id, registerSpin])
  return (
    <group ref={root} name={`coche-${id}`} visible={false}>
      <mesh geometry={blobGeo} material={blobMaterial()} scale={[width * 1.5, 1, length * 1.22]} position={[0, 0.012, 0]} renderOrder={-1} />
      <group ref={lift}>
        <group ref={spin}>
          <mesh geometry={geo.paint} material={clayPaint(color)} castShadow receiveShadow />
          <mesh geometry={geo.rest} material={clayRest()} castShadow receiveShadow />
          {children}
        </group>
      </group>
      {/* Zona de clic (invisible) */}
      <mesh
        geometry={unitBox}
        material={PROXY_MAT}
        visible={false}
        position={[0, height / 2, 0]}
        scale={[width + 0.2, height + 0.2, length + 0.2]}
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
