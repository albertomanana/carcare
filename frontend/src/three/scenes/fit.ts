/**
 * Encuadre automático: distancia y punto de mira para que un conjunto de puntos quepa en pantalla
 * desde una dirección dada (proyección real con la cámara en perspectiva; iterativo, converge en 4–6 pasos).
 */
import * as THREE from 'three'

export interface FitBounds {
  /** Rango NDC horizontal permitido (−1..1). */
  x: [number, number]
  /** Rango NDC vertical permitido (−1 abajo .. 1 arriba): deja sitio a rótulos y leyendas. */
  y: [number, number]
}

const _cam = new THREE.PerspectiveCamera()
const _v = new THREE.Vector3()
const _r = new THREE.Vector3()
const _u = new THREE.Vector3()

export function boxCorners(min: [number, number, number], max: [number, number, number]): THREE.Vector3[] {
  const out: THREE.Vector3[] = []
  for (const x of [min[0], max[0]]) for (const y of [min[1], max[1]]) for (const z of [min[2], max[2]]) out.push(new THREE.Vector3(x, y, z))
  return out
}

export function fitView(
  points: THREE.Vector3[],
  direction: [number, number, number],
  fovDeg: number,
  aspect: number,
  bounds: FitBounds = { x: [-0.92, 0.92], y: [-0.88, 0.88] },
): { target: [number, number, number]; distance: number } {
  const dir = new THREE.Vector3(...direction).normalize()
  const target = new THREE.Box3().setFromPoints(points).getCenter(new THREE.Vector3())
  _cam.fov = fovDeg
  _cam.aspect = Math.max(0.2, aspect)
  _cam.near = 0.1
  _cam.far = 2000
  _cam.updateProjectionMatrix()
  let dist = Math.max(5, target.distanceTo(points[0]) * 2.5)
  const cxT = (bounds.x[0] + bounds.x[1]) / 2
  const cyT = (bounds.y[0] + bounds.y[1]) / 2
  for (let it = 0; it < 6; it++) {
    _cam.position.copy(target).addScaledVector(dir, dist)
    _cam.lookAt(target)
    _cam.updateMatrixWorld()
    let minX = Infinity
    let maxX = -Infinity
    let minY = Infinity
    let maxY = -Infinity
    for (const p of points) {
      _v.copy(p).project(_cam)
      minX = Math.min(minX, _v.x)
      maxX = Math.max(maxX, _v.x)
      minY = Math.min(minY, _v.y)
      maxY = Math.max(maxY, _v.y)
    }
    const halfH = dist * Math.tan(THREE.MathUtils.degToRad(fovDeg) / 2)
    const halfW = halfH * _cam.aspect
    _r.set(1, 0, 0).transformDirection(_cam.matrixWorld)
    _u.set(0, 1, 0).transformDirection(_cam.matrixWorld)
    target.addScaledVector(_r, ((minX + maxX) / 2 - cxT) * halfW).addScaledVector(_u, ((minY + maxY) / 2 - cyT) * halfH)
    dist *= Math.max((maxX - minX) / (bounds.x[1] - bounds.x[0]), (maxY - minY) / (bounds.y[1] - bounds.y[0]))
  }
  return { target: [target.x, target.y, target.z], distance: dist }
}
