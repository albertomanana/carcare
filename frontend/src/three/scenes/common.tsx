/**
 * Piezas comunes de los lienzos (chunk diferido): rótulo de rayos X, reanudación al volver a la pestaña y
 * liberación de recursos al desmontar.
 */
import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import type * as THREE from 'three'

export function XrayBadge() {
  return (
    <p className="pointer-events-none absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full border border-info/40 bg-surface/85 px-2.5 py-1 text-[11px] font-medium text-info backdrop-blur">
      <span className="size-1.5 rounded-full bg-info" aria-hidden />
      Rayos X · Ilustrativo
    </p>
  )
}

/** Pinta un fotograma al volver a la pestaña (con `frameloop="never"` mientras estaba oculta no se pinta nada). */
export function ResumeOnVisible({ visible }: { visible: boolean }) {
  const invalidate = useThree((s) => s.invalidate)
  useEffect(() => {
    if (visible) invalidate()
  }, [visible, invalidate])
  return null
}

type Disposable = { dispose: () => void }

/**
 * Al desmontar el lienzo llama a `dispose()` de todas las geometrías, materiales y texturas que ha pintado, incluidas
 * las compartidas que se memorizan a nivel de módulo (coche por carrocería, materiales, piezas del elevador).
 * Motivo (medido): cada WebGLRenderer añade un oyente 'dispose' a lo que pinta y ese oyente lo retiene entero, así que
 * con recursos en caché ningún renderizador desmontado se liberaba (~1,5 MB de JS por visita a la ficha). `dispose()`
 * solo suelta lo de la GPU y los oyentes: la geometría en CPU sigue en caché y el siguiente lienzo la vuelve a subir.
 * El recorrido se hace como mucho cada 0,5 s y solo en fotogramas que se pintan (con "demand", pocos).
 */
export function ReleaseOnUnmount() {
  const scene = useThree((s) => s.scene)
  const used = useMemo(() => new Set<Disposable>(), [])
  const scanned = useMemo(() => new WeakSet<THREE.Material>(), [])
  const last = useRef(-1)
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    if (last.current >= 0 && t - last.current < 0.5) return
    last.current = t
    scene.traverse((o) => {
      const m = o as THREE.Mesh
      if (m.geometry) used.add(m.geometry)
      const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : []
      for (const mat of mats) {
        if (scanned.has(mat)) continue
        scanned.add(mat)
        used.add(mat)
        for (const v of Object.values(mat)) if (v && (v as THREE.Texture).isTexture) used.add(v as THREE.Texture)
      }
    })
  })
  useEffect(
    () => () => {
      for (const r of used) r.dispose()
      used.clear()
    },
    [used],
  )
  return null
}
