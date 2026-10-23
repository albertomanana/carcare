/**
 * Controles de órbita + "vuelos" de cámara suaves entre encuadres (interpolación esférica alrededor del objetivo,
 * para no atravesar el coche). Con movimiento reducido, los cambios de encuadre son instantáneos.
 */
import { OrbitControls } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'

export interface Focus {
  target: [number, number, number]
  direction: [number, number, number]
  distance: number
}

export interface CameraRigProps {
  focus: Focus
  reducedMotion: boolean
  autoRotate?: boolean
  autoRotateSpeed?: number
  enableRotate?: boolean
  enableZoom?: boolean
  minDistance?: number
  maxDistance?: number
  /** Ajusta la distancia para que el encuadre quepa también en contenedores estrechos. */
  fitWidth?: number
}

const _sph = new THREE.Spherical()
const _sph2 = new THREE.Spherical()
const _v = new THREE.Vector3()

function shortestAngle(a: number, b: number) {
  let d = b - a
  while (d > Math.PI) d -= Math.PI * 2
  while (d < -Math.PI) d += Math.PI * 2
  return d
}

export function CameraRig({
  focus,
  reducedMotion,
  autoRotate = false,
  autoRotateSpeed = 0.55,
  enableRotate = true,
  enableZoom = false,
  minDistance = 2,
  maxDistance = 16,
  fitWidth,
}: CameraRigProps) {
  const controls = useRef<OrbitControlsImpl>(null)
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera
  const invalidate = useThree((s) => s.invalidate)
  const aspect = useThree((s) => s.size.width / Math.max(1, s.size.height))
  const goal = useRef<{ target: THREE.Vector3; sph: THREE.Spherical } | null>(null)
  const first = useRef(true)

  const tx = focus.target[0]
  const ty = focus.target[1]
  const tz = focus.target[2]
  const dx = focus.direction[0]
  const dy = focus.direction[1]
  const dz = focus.direction[2]

  useEffect(() => {
    const c = controls.current
    if (!c) return
    let dist = focus.distance
    if (fitWidth) {
      // distancia mínima para que `fitWidth` metros quepan en horizontal
      const vf = THREE.MathUtils.degToRad(camera.fov)
      const hf = 2 * Math.atan(Math.tan(vf / 2) * aspect)
      dist = Math.max(dist, fitWidth / 2 / Math.tan(hf / 2))
    }
    const target = new THREE.Vector3(tx, ty, tz)
    const dir = new THREE.Vector3(dx, dy, dz).normalize()
    const sph = new THREE.Spherical().setFromVector3(dir.multiplyScalar(dist))
    if (reducedMotion || first.current) {
      first.current = false
      c.target.copy(target)
      camera.position.copy(target).add(_v.setFromSpherical(sph))
      c.update()
      goal.current = null
    } else {
      goal.current = { target, sph }
    }
    invalidate()
  }, [tx, ty, tz, dx, dy, dz, focus.distance, fitWidth, aspect, reducedMotion, camera, invalidate])

  useFrame((_, delta) => {
    const g = goal.current
    const c = controls.current
    if (!g || !c) return
    const k = 1 - Math.exp(-Math.min(delta, 0.05) * 3.6)
    c.target.lerp(g.target, k)
    _sph.setFromVector3(_v.copy(camera.position).sub(c.target))
    _sph2.copy(_sph)
    _sph2.radius += (g.sph.radius - _sph.radius) * k
    _sph2.phi += (g.sph.phi - _sph.phi) * k
    _sph2.theta += shortestAngle(_sph.theta, g.sph.theta) * k
    camera.position.copy(c.target).add(_v.setFromSpherical(_sph2))
    c.update()
    const done =
      c.target.distanceTo(g.target) < 0.004 &&
      Math.abs(g.sph.radius - _sph2.radius) < 0.004 &&
      Math.abs(shortestAngle(_sph2.theta, g.sph.theta)) < 0.002 &&
      Math.abs(g.sph.phi - _sph2.phi) < 0.002
    if (done) goal.current = null
    invalidate()
  })

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enableDamping
      dampingFactor={0.09}
      autoRotate={autoRotate && !reducedMotion}
      autoRotateSpeed={autoRotateSpeed}
      enablePan={false}
      enableRotate={enableRotate}
      enableZoom={enableZoom}
      zoomSpeed={0.6}
      rotateSpeed={0.6}
      minDistance={minDistance}
      maxDistance={maxDistance}
      minPolarAngle={0.25}
      maxPolarAngle={Math.PI / 2 - 0.04}
      onStart={() => {
        goal.current = null
      }}
    />
  )
}
