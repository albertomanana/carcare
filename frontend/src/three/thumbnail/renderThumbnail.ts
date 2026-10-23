/**
 * Renderizador COMPARTIDO de miniaturas (chunk diferido, three.js sin React):
 * un único WebGLRenderer fuera de pantalla que pinta cada (carrocería, color) una vez, lo convierte en imagen
 * (blob → object URL) y lo cachea. Los encargos se encolan; tras un rato sin uso se libera el contexto WebGL.
 */
import * as THREE from 'three'
import type { BodyType } from '@/api/types'
import { getCarBuild } from '../car/build'
import { getCarMaterials } from '../car/materials'
import { BODY_SPECS } from '../car/specs'

const W = 640
const H = 360
const IDLE_MS = 15000
const THUMB_AZIMUTH = 60
const THUMB_ELEVATION = 11

let renderer: THREE.WebGLRenderer | null = null
let envRT: THREE.WebGLRenderTarget | null = null
let shadowTex: THREE.Texture | null = null
let idleTimer: ReturnType<typeof setTimeout> | null = null
let queue: Promise<unknown> = Promise.resolve()
const cache = new Map<string, Promise<string>>()

function makeRenderer() {
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const r = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true, powerPreference: 'low-power' })
  r.setPixelRatio(1)
  r.setSize(W, H, false)
  r.toneMapping = THREE.ACESFilmicToneMapping
  r.toneMappingExposure = 1
  r.outputColorSpace = THREE.SRGBColorSpace
  r.setClearColor(0x000000, 0)
  canvas.addEventListener('webglcontextlost', () => releaseRenderer())
  return r
}

/** Entorno de estudio equivalente a los Lightformers del visor, horneado con PMREM. */
function makeEnvironment(r: THREE.WebGLRenderer) {
  const env = new THREE.Scene()
  env.background = new THREE.Color('#2a2f33')
  const plane = (w: number, h: number, intensity: number, pos: [number, number, number], color = '#ffffff') => {
    const m = new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide })
    m.color.multiplyScalar(intensity)
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m)
    mesh.position.set(...pos)
    mesh.lookAt(0, 0, 0)
    env.add(mesh)
  }
  // Mismo estudio que StudioEnvironment (scenes/Stage.tsx)
  plane(12, 6, 3, [0, 8, 0.001])
  plane(18, 2.2, 1.9, [0, 2.4, 9])
  plane(18, 2.2, 1.6, [0, 2.4, -9])
  plane(18, 0.35, 1.4, [0, 5, 7])
  plane(6, 3, 2.2, [10, 3, 3])
  plane(0.8, 8, 2, [-10, 3, 0])
  plane(3, 3, 2.6, [8, 4, 6])
  plane(24, 24, 0.5, [0, -2, 0.001])
  plane(16, 3.5, 0.75, [0, 6.5, -6.5])
  plane(16, 3.5, 0.7, [0, 6.5, 6.5])
  plane(3.5, 12, 0.55, [6.5, 6.5, 0])
  plane(3.5, 12, 0.55, [-6.5, 6.5, 0])
  const pm = new THREE.PMREMGenerator(r)
  const rt = pm.fromScene(env, 0.02)
  pm.dispose()
  env.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      o.geometry.dispose()
      ;(o.material as THREE.Material).dispose()
    }
  })
  return rt
}

/** Sombra difusa (degradado radial) bajo el coche. */
function makeShadowTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const g = c.getContext('2d')!
  const grad = g.createRadialGradient(64, 64, 4, 64, 64, 64)
  grad.addColorStop(0, 'rgba(0,0,0,0.75)')
  grad.addColorStop(0.55, 'rgba(0,0,0,0.35)')
  grad.addColorStop(1, 'rgba(0,0,0,0)')
  g.fillStyle = grad
  g.fillRect(0, 0, 128, 128)
  return new THREE.CanvasTexture(c)
}

function releaseRenderer() {
  envRT?.dispose()
  envRT = null
  if (renderer) {
    renderer.dispose()
    renderer.forceContextLoss()
  }
  renderer = null
}

function scheduleIdle() {
  if (idleTimer) clearTimeout(idleTimer)
  idleTimer = setTimeout(releaseRenderer, IDLE_MS)
}

function fitCamera(camera: THREE.PerspectiveCamera, box: THREE.Box3, dir: THREE.Vector3, target: THREE.Vector3) {
  const corners: THREE.Vector3[] = []
  for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) corners.push(new THREE.Vector3(x, y, z))
  let dist = 8
  const v = new THREE.Vector3()
  for (let it = 0; it < 4; it++) {
    camera.position.copy(target).addScaledVector(dir, dist)
    camera.lookAt(target)
    camera.updateMatrixWorld()
    let minX = Infinity
    let maxX = -Infinity
    let minY = Infinity
    let maxY = -Infinity
    for (const c of corners) {
      v.copy(c).project(camera)
      minX = Math.min(minX, v.x)
      maxX = Math.max(maxX, v.x)
      minY = Math.min(minY, v.y)
      maxY = Math.max(maxY, v.y)
    }
    // recentrar en pantalla (desplazando el objetivo en el plano de la cámara) y ajustar la distancia
    const halfH = dist * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)
    const halfW = halfH * camera.aspect
    const right = new THREE.Vector3(1, 0, 0).transformDirection(camera.matrixWorld)
    const up = new THREE.Vector3(0, 1, 0).transformDirection(camera.matrixWorld)
    target.addScaledVector(right, ((minX + maxX) / 2) * halfW).addScaledVector(up, ((minY + maxY) / 2) * halfH)
    dist *= Math.max((maxX - minX) / 1.84, (maxY - minY) / 1.7)
  }
  camera.position.copy(target).addScaledVector(dir, dist)
  camera.lookAt(target)
}

function renderNow(body: BodyType, color: string, accent: string): Promise<string> {
  if (!renderer) {
    renderer = makeRenderer()
    envRT = makeEnvironment(renderer)
  }
  if (!shadowTex) shadowTex = makeShadowTexture()
  const r = renderer
  const scene = new THREE.Scene()
  scene.environment = envRT!.texture
  const build = getCarBuild(body, 'low')
  const mats = getCarMaterials(color, { accent, rim: BODY_SPECS[body].rim })
  const group = new THREE.Group()
  for (const p of build.parts) group.add(new THREE.Mesh(p.geometry, mats[p.mat]))
  scene.add(group)

  const { length, width } = build.size
  const shadowMat = new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, toneMapped: false })
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(length * 1.25, width * 1.5), shadowMat)
  shadow.rotation.x = -Math.PI / 2
  shadow.position.y = 0.002
  scene.add(shadow)

  const camera = new THREE.PerspectiveCamera(24, W / H, 0.1, 60)
  // 3/4 delantero más lateral que el del visor (≈60° desde el morro, 11° de elevación): en miniatura, el tipo de
  // carrocería se reconoce por el perfil (portón, maletero, tercera ventanilla…), no por el frontal.
  const az = THREE.MathUtils.degToRad(THUMB_AZIMUTH)
  const el = THREE.MathUtils.degToRad(THUMB_ELEVATION)
  const dir = new THREE.Vector3(Math.cos(el) * Math.cos(az), Math.sin(el), Math.cos(el) * Math.sin(az))
  const box = new THREE.Box3().setFromObject(group)
  box.min.y = 0
  const target = box.getCenter(new THREE.Vector3())
  fitCamera(camera, box, dir, target)

  r.render(scene, camera)
  const canvas = r.domElement
  shadow.geometry.dispose()
  shadowMat.dispose()
  scheduleIdle()
  return new Promise<string>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) return reject(new Error('toBlob vacío'))
        resolve(URL.createObjectURL(blob))
      },
      'image/webp',
      0.92,
    )
  })
}

/** Imagen (object URL) del coche en 3/4 frontal sobre fondo transparente. */
export function renderCarThumbnail(body: BodyType, color: string, accent: string): Promise<string> {
  const key = `${body}|${color}|${accent}`
  const hit = cache.get(key)
  if (hit) return hit
  const job = queue.then(
    () =>
      new Promise<string>((resolve, reject) => {
        // cede el hilo entre encargos para no bloquear el scroll
        const run = () => renderNow(body, color, accent).then(resolve, reject)
        if ('requestIdleCallback' in window) window.requestIdleCallback(run, { timeout: 400 })
        else setTimeout(run, 16)
      }),
  )
  queue = job.catch(() => undefined)
  cache.set(key, job)
  job.catch(() => cache.delete(key))
  return job
}
