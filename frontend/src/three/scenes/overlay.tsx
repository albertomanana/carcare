/**
 * Rótulos HTML proyectados sobre una escena 3D (marcadores de zona, elevadores del taller).
 *
 * A diferencia de drei <Html> (un root de React por rótulo), aquí:
 *  - Los botones viven en el árbol normal de React, en una capa absoluta encima del lienzo: orden de tabulación
 *    lógico, lectores de pantalla y estilos del sistema de diseño sin trucos.
 *  - Dentro del <Canvas>, `OverlayProjector` proyecta los anclajes 3D a píxeles en cada fotograma que se pinta y
 *    escribe transform/opacity directamente en el DOM (sin renders de React).
 *  - Desapilado: si dos rótulos se solapan en pantalla, se desplaza el de menor prioridad a la posición libre más
 *    cercana (preferentemente hacia fuera del grupo) y se dibuja una línea guía desde el punto real.
 */
import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, type ReactNode } from 'react'
import * as THREE from 'three'

export type Pivot = 'center' | 'bottom' | 'icon'

export interface OverlayAnchor {
  id: string
  position: [number, number, number]
  /** Mayor ⇒ se coloca antes y conserva su posición ideal. */
  priority?: number
  /** Normal aproximada (en planta) del punto: si mira al lado contrario de la cámara, el rótulo se atenúa. */
  facing?: [number, number, number] | null
  /** Qué punto del rótulo coincide con el anclaje. 'icon' = centro del icono circular de 34 px a la izquierda. */
  pivot?: Pivot
  /** No se desplaza nunca (p. ej. el seleccionado). */
  fixed?: boolean
  /** Opacidad cuando no está "activo" (para atenuar el resto al seleccionar uno). */
  dim?: boolean
}

export class OverlayStore {
  readonly els = new Map<string, HTMLElement>()
  readonly lines = new Map<string, SVGLineElement>()
  readonly dots = new Map<string, SVGCircleElement>()
  /** Desplazamiento elegido en el fotograma anterior (histéresis: evita saltos entre posiciones equivalentes). */
  readonly prev = new Map<string, [number, number]>()
  invalidate: (() => void) | null = null

  setEl(id: string, el: HTMLElement | null) {
    if (el) this.els.set(id, el)
    else this.els.delete(id)
    this.invalidate?.()
  }
  setLine(id: string, el: SVGLineElement | null) {
    if (el) this.lines.set(id, el)
    else this.lines.delete(id)
  }
  setDot(id: string, el: SVGCircleElement | null) {
    if (el) this.dots.set(id, el)
    else this.dots.delete(id)
  }
}

export function useOverlayStore() {
  return useMemo(() => new OverlayStore(), [])
}

/** Capa HTML (fuera del <Canvas>, mismo tamaño) con las líneas guía y los rótulos. */
export function OverlayLayer({ store, ids, children, label }: { store: OverlayStore; ids: string[]; children: ReactNode; label?: string }) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" role={label ? 'group' : undefined} aria-label={label}>
      <svg className="absolute inset-0 h-full w-full overflow-visible" aria-hidden focusable="false">
        {ids.map((id) => (
          <g key={id}>
            <line
              ref={(el) => store.setLine(id, el)}
              x1={0}
              y1={0}
              x2={0}
              y2={0}
              stroke="var(--fg-muted)"
              strokeWidth={1.25}
              strokeOpacity={0.75}
              strokeLinecap="round"
              style={{ visibility: 'hidden' }}
            />
            <circle ref={(el) => store.setDot(id, el)} r={3} fill="var(--fg)" stroke="var(--base)" strokeWidth={1.5} style={{ visibility: 'hidden' }} />
          </g>
        ))}
      </svg>
      {children}
    </div>
  )
}

/** Contenedor de un rótulo: se posiciona desde el proyector. Oculto hasta el primer fotograma. */
export function OverlayItem({ store, id, children, className }: { store: OverlayStore; id: string; children: ReactNode; className?: string }) {
  return (
    <div
      ref={(el) => store.setEl(id, el)}
      data-overlay={id}
      className={['pointer-events-auto absolute left-0 top-0 will-change-transform hover:!z-40 focus-within:!z-40', className].filter(Boolean).join(' ')}
      style={{ visibility: 'hidden' }}
    >
      {children}
    </div>
  )
}

interface Slot {
  a: OverlayAnchor
  el: HTMLElement
  /** Anclaje en px. */
  ax: number
  ay: number
  w: number
  h: number
  px: number
  py: number
  visible: boolean
  behind: boolean
  /** Desplazamiento final del pivote respecto al anclaje. */
  ox: number
  oy: number
}

const DIRS = Array.from({ length: 12 }, (_, i) => {
  const a = (i / 12) * Math.PI * 2 - Math.PI / 2 // empieza hacia arriba
  return [Math.cos(a), Math.sin(a)] as [number, number]
})
const GAP = 4

/** Recorta a [4, max - 4] (margen de 4 px dentro del lienzo). */
function clampTo(v: number, max: number) {
  return Math.min(Math.max(v, 4), Math.max(4, max - 4))
}

function overlaps(x: number, y: number, w: number, h: number, placed: number[][]) {
  for (const r of placed) {
    if (x < r[0] + r[2] + GAP && x + w + GAP > r[0] && y < r[1] + r[3] + GAP && y + h + GAP > r[1]) return true
  }
  return false
}

/**
 * Dentro del <Canvas>: proyecta y desapila. Se ejecuta en cada fotograma pintado (con frameloop="demand",
 * solo cuando la cámara o la escena cambian).
 */
export function OverlayProjector({ store, anchors, declutter = true }: { store: OverlayStore; anchors: OverlayAnchor[]; declutter?: boolean }) {
  const invalidate = useThree((s) => s.invalidate)
  const v = useMemo(() => new THREE.Vector3(), [])
  const cam = useMemo(() => new THREE.Vector3(), [])

  useEffect(() => {
    store.invalidate = invalidate
    invalidate()
    return () => {
      if (store.invalidate === invalidate) store.invalidate = null
    }
  }, [store, invalidate])
  useEffect(() => {
    invalidate()
  }, [anchors, invalidate])

  useFrame(({ camera, size }) => {
    camera.updateMatrixWorld()
    cam.setFromMatrixPosition(camera.matrixWorld)
    const W = size.width
    const H = size.height
    const slots: Slot[] = []
    // 1) Lecturas (tamaños) y proyección
    for (const a of anchors) {
      const el = store.els.get(a.id)
      if (!el) continue
      v.set(a.position[0], a.position[1], a.position[2]).project(camera)
      const ax = (v.x * 0.5 + 0.5) * W
      const ay = (-v.y * 0.5 + 0.5) * H
      const visible = v.z < 1 && ax > -12 && ax < W + 12 && ay > -12 && ay < H + 12
      const w = el.offsetWidth
      const h = el.offsetHeight
      const pivot = a.pivot ?? 'center'
      const px = pivot === 'icon' ? Math.min(17, w / 2) : w / 2
      const py = pivot === 'bottom' ? h : h / 2
      let behind = false
      if (a.facing) {
        const dx = cam.x - a.position[0]
        const dz = cam.z - a.position[2]
        const l = Math.hypot(dx, dz) || 1
        behind = (dx * a.facing[0] + dz * a.facing[2]) / l < -0.15
      }
      slots.push({ a, el, ax, ay, w, h, px, py, visible, behind, ox: 0, oy: 0 })
    }

    // 2) Desapilado voraz por prioridad
    const vis = slots.filter((s) => s.visible)
    if (declutter && vis.length > 1) {
      let cx = 0
      let cy = 0
      for (const s of vis) {
        cx += s.ax
        cy += s.ay
      }
      cx /= vis.length
      cy /= vis.length
      const order = vis
        .map((s, i) => ({ s, i }))
        .sort((p, q) => Number(!!q.s.a.fixed) - Number(!!p.s.a.fixed) || (q.s.a.priority ?? 0) - (p.s.a.priority ?? 0) || p.i - q.i)
        .map((p) => p.s)
      const placed: number[][] = []
      for (const s of order) {
        // posiciones siempre dentro del lienzo: se comprueban ya recortadas (si no, el recorte final reintroduce solapes)
        const x0 = s.ax - s.px
        const y0 = s.ay - s.py
        const cxp = (x: number) => clampTo(x, W - s.w)
        const cyp = (y: number) => clampTo(y, H - s.h)
        const free = (dx: number, dy: number) => !overlaps(cxp(x0 + dx), cyp(y0 + dy), s.w, s.h, placed)
        let best: [number, number] | null = null
        if (s.a.fixed || free(0, 0)) best = [0, 0]
        else {
          const prev = store.prev.get(s.a.id)
          if (prev && (prev[0] || prev[1]) && free(prev[0], prev[1])) best = prev
          const ux = s.ax - cx
          const uy = s.ay - cy
          const dirs = [...DIRS].sort((d1, d2) => d2[0] * ux + d2[1] * uy - (d1[0] * ux + d1[1] * uy))
          const step = Math.max(18, Math.min(s.w, s.h) * 0.9)
          let found: [number, number] | null = null
          for (let ring = 1; ring <= 5 && !found; ring++) {
            for (const d of dirs) {
              // en vertical cuesta menos desplazar (los rótulos son más anchos que altos)
              const dx = d[0] * step * ring * 1.15
              const dy = d[1] * step * ring
              if (free(dx, dy)) {
                found = [dx, dy]
                break
              }
            }
          }
          // histéresis: se mantiene la posición anterior salvo que la nueva sea claramente más cercana
          if (best && found && Math.hypot(found[0], found[1]) + 14 < Math.hypot(best[0], best[1])) best = found
          if (!best) best = found ?? [0, 0]
        }
        store.prev.set(s.a.id, best)
        s.ox = cxp(x0 + best[0]) - x0
        s.oy = cyp(y0 + best[1]) - y0
        placed.push([x0 + s.ox, y0 + s.oy, s.w, s.h])
      }
    } else {
      for (const s of vis) store.prev.delete(s.a.id)
    }

    // 3) Escrituras
    for (const s of slots) {
      const line = store.lines.get(s.a.id)
      const dot = store.dots.get(s.a.id)
      if (!s.visible) {
        s.el.style.visibility = 'hidden'
        if (line) line.style.visibility = 'hidden'
        if (dot) dot.style.visibility = 'hidden'
        continue
      }
      let x = s.ax - s.px + s.ox
      let y = s.ay - s.py + s.oy
      // siempre dentro del lienzo (para poder pulsarlo)
      x = clampTo(x, W - s.w)
      y = clampTo(y, H - s.h)
      s.el.style.visibility = 'visible'
      s.el.style.transform = `translate3d(${Math.round(x)}px, ${Math.round(y)}px, 0)`
      s.el.style.opacity = s.behind && !s.a.fixed ? '0.45' : s.a.dim ? '0.6' : '1'
      s.el.style.zIndex = s.a.fixed ? '30' : String(10 + Math.max(0, Math.min(9, s.a.priority ?? 0)))
      const moved = Math.hypot(x + s.px - s.ax, y + s.py - s.ay) > 10
      if (line && dot) {
        line.style.visibility = moved ? 'visible' : 'hidden'
        dot.style.visibility = moved ? 'visible' : 'hidden'
        if (moved) {
          line.setAttribute('x1', s.ax.toFixed(1))
          line.setAttribute('y1', s.ay.toFixed(1))
          // la línea termina en el borde del rótulo más cercano al anclaje
          const ex = Math.min(Math.max(s.ax, x), x + s.w)
          const ey = Math.min(Math.max(s.ay, y), y + s.h)
          line.setAttribute('x2', ex.toFixed(1))
          line.setAttribute('y2', ey.toFixed(1))
          dot.setAttribute('cx', s.ax.toFixed(1))
          dot.setAttribute('cy', s.ay.toFixed(1))
          line.style.opacity = s.behind ? '0.45' : '1'
          dot.style.opacity = s.behind ? '0.45' : '1'
        }
      }
    }
  })
  return null
}
