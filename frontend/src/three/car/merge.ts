/** Fusión de geometrías heterogéneas (indexadas o no) en una sola por material: menos draw calls. */
import * as THREE from 'three'

export function ensureIndexed(g: THREE.BufferGeometry): THREE.BufferGeometry {
  if (g.getIndex()) return g
  const n = g.getAttribute('position').count
  const idx = new Uint32Array(n)
  for (let i = 0; i < n; i++) idx[i] = i
  g.setIndex(new THREE.BufferAttribute(idx, 1))
  return g
}

/**
 * Une geometrías con position + normal (+ uv si TODAS lo tienen y keepUv).
 * No modifica las de entrada (salvo añadir índice si no lo tenían).
 */
export function mergeAll(geos: THREE.BufferGeometry[], keepUv = false): THREE.BufferGeometry {
  const list = geos.filter((g) => g.getAttribute('position')?.count)
  const hasUv = keepUv && list.every((g) => g.getAttribute('uv'))
  let vCount = 0
  let iCount = 0
  for (const g of list) {
    ensureIndexed(g)
    if (!g.getAttribute('normal')) g.computeVertexNormals()
    vCount += g.getAttribute('position').count
    iCount += g.getIndex()!.count
  }
  const pos = new Float32Array(vCount * 3)
  const nrm = new Float32Array(vCount * 3)
  const uv = hasUv ? new Float32Array(vCount * 2) : null
  const idx = vCount > 65535 ? new Uint32Array(iCount) : new Uint16Array(iCount)
  let vo = 0
  let io = 0
  for (const g of list) {
    const p = g.getAttribute('position') as THREE.BufferAttribute
    const n = g.getAttribute('normal') as THREE.BufferAttribute
    for (let k = 0; k < p.count; k++) {
      pos[(vo + k) * 3] = p.getX(k)
      pos[(vo + k) * 3 + 1] = p.getY(k)
      pos[(vo + k) * 3 + 2] = p.getZ(k)
      nrm[(vo + k) * 3] = n.getX(k)
      nrm[(vo + k) * 3 + 1] = n.getY(k)
      nrm[(vo + k) * 3 + 2] = n.getZ(k)
    }
    if (uv) {
      const u = g.getAttribute('uv') as THREE.BufferAttribute
      for (let k = 0; k < u.count; k++) {
        uv[(vo + k) * 2] = u.getX(k)
        uv[(vo + k) * 2 + 1] = u.getY(k)
      }
    }
    const ia = g.getIndex()!
    for (let k = 0; k < ia.count; k++) idx[io + k] = ia.getX(k) + vo
    vo += p.count
    io += ia.count
  }
  const out = new THREE.BufferGeometry()
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  out.setAttribute('normal', new THREE.BufferAttribute(nrm, 3))
  if (uv) out.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  out.setIndex(new THREE.BufferAttribute(idx, 1))
  out.computeBoundingBox()
  out.computeBoundingSphere()
  return out
}

/** Copia transformada (la original no se toca). */
export function transformed(g: THREE.BufferGeometry, m: THREE.Matrix4): THREE.BufferGeometry {
  const c = g.clone()
  c.applyMatrix4(m)
  return c
}

const _m = new THREE.Matrix4()
const _q = new THREE.Quaternion()
const _e = new THREE.Euler()
const _s = new THREE.Vector3()
const _p = new THREE.Vector3()

export function matrix(pos: [number, number, number], rot: [number, number, number] = [0, 0, 0], scale: number | [number, number, number] = 1) {
  _e.set(rot[0], rot[1], rot[2])
  _q.setFromEuler(_e)
  if (typeof scale === 'number') _s.set(scale, scale, scale)
  else _s.set(scale[0], scale[1], scale[2])
  _p.set(pos[0], pos[1], pos[2])
  return _m.clone().compose(_p, _q, _s)
}
