/**
 * Telemetría radial del coche elegido en el garaje: tarjetas de datos en dos columnas a los lados del coche que gira,
 * unidas a él por líneas guía. Las tarjetas son HTML normal (enlaces, foco, lectores de pantalla) en una capa sobre el
 * lienzo; `RingProjector`, dentro del `<Canvas>`, proyecta el coche en cada fotograma y escribe posiciones y líneas
 * directamente en el DOM. La distribución (`ringLayout`) garantiza que nada se pisa en ningún ángulo de giro.
 */
import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, type ReactNode } from 'react'
import * as THREE from 'three'
import type { GarageTelemetryItem } from '../../types'
import { ISO_DIR } from '../workshop/iso'
import { RING_CARD_H, RING_CARD_W, RING_MARGIN, ringLayout, RingStore } from './telemetry'

export function useRingStore() {
  return useMemo(() => new RingStore(), [])
}

/** Capa HTML (fuera del `<Canvas>`): líneas guía y tarjetas, ocultas hasta que el proyector las coloca. */
export function TelemetryRingLayer({ store, items, label }: { store: RingStore; items: GarageTelemetryItem[]; label: string }) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" role="group" aria-label={label}>
      <svg className="absolute inset-0 h-full w-full overflow-visible" aria-hidden focusable="false">
        {items.map((it, i) => (
          <g key={it.id}>
            <line
              ref={(el) => {
                store.lines[i] = el
              }}
              stroke="var(--accent)"
              strokeWidth={1.25}
              strokeOpacity={0.7}
              strokeLinecap="round"
              style={{ visibility: 'hidden' }}
            />
            <circle
              ref={(el) => {
                store.dots[i] = el
              }}
              r={3.5}
              fill="var(--accent)"
              stroke="var(--base)"
              strokeWidth={1.5}
              style={{ visibility: 'hidden' }}
            />
          </g>
        ))}
      </svg>
      {items.map((it, i) => (
        <RingCard key={it.id} store={store} index={i}>
          {it.node}
        </RingCard>
      ))}
    </div>
  )
}

function RingCard({ store, index, children }: { store: RingStore; index: number; children: ReactNode }) {
  return (
    <div
      ref={(el) => {
        store.cards[index] = el
      }}
      className="pointer-events-auto absolute left-0 top-0 will-change-transform"
      style={{ width: RING_CARD_W, height: RING_CARD_H, visibility: 'hidden' }}
    >
      {children}
    </div>
  )
}

const _p = new THREE.Vector3()
/** Px que se dejan libres bajo las columnas: ahí van la ayuda de la escena y «Ver todo el garaje». */
const CONTROLS_H = 44
const ELEV_SIN = ISO_DIR.y
const ELEV_COS = Math.sqrt(1 - ISO_DIR.y * ISO_DIR.y)

/**
 * Dentro del `<Canvas>`: coloca las tarjetas alrededor del coche. `rho` es el radio en planta del cilindro que barre
 * el coche al girar (m), `height` su altura y `base` la altura a la que está apoyado (la plataforma).
 */
export function RingProjector({
  store,
  count,
  track,
  rho,
  height,
  base,
  inset,
}: {
  store: RingStore
  count: number
  track: () => THREE.Object3D | null | undefined
  rho: number
  height: number
  base: number
  inset: { left?: number; right?: number; top?: number; bottom?: number }
}) {
  const invalidate = useThree((s) => s.invalidate)
  // un dato nuevo o menos datos: hay que pintar un fotograma para recolocarlos (el lienzo está en `demand`)
  useEffect(() => {
    invalidate()
  }, [count, invalidate])

  const hide = (i: number) => {
    const c = store.cards[i]
    if (c) c.style.visibility = 'hidden'
    const l = store.lines[i]
    if (l) l.style.visibility = 'hidden'
    const d = store.dots[i]
    if (d) d.style.visibility = 'hidden'
  }

  useFrame(({ camera, size }) => {
    const obj = track()
    if (!obj || !obj.visible || !(camera instanceof THREE.OrthographicCamera)) {
      for (let i = 0; i < count; i++) hide(i)
      return
    }
    obj.getWorldPosition(_p)
    _p.y = base + height / 2
    _p.project(camera)
    const cx = (_p.x * 0.5 + 0.5) * size.width
    const cy = (-_p.y * 0.5 + 0.5) * size.height
    const a = rho * camera.zoom
    const b = (rho * ELEV_SIN + (height / 2) * ELEV_COS) * camera.zoom
    const slots = ringLayout({
      cx,
      cy,
      a,
      b,
      area: { x0: (inset.left ?? 0) + 8, y0: (inset.top ?? 0) + 8, x1: size.width - (inset.right ?? 0) - 8, y1: size.height - (inset.bottom ?? 0) - 8 - CONTROLS_H },
      count,
      cardW: RING_CARD_W,
      cardH: RING_CARD_H,
      margin: RING_MARGIN,
    })
    const shown = new Set<number>()
    for (const s of slots) {
      shown.add(s.index)
      const c = store.cards[s.index]
      if (c) {
        c.style.transform = `translate3d(${Math.round(s.x)}px, ${Math.round(s.y)}px, 0)`
        c.style.visibility = 'visible'
      }
      const l = store.lines[s.index]
      if (l) {
        l.setAttribute('x1', s.ax.toFixed(1))
        l.setAttribute('y1', s.ay.toFixed(1))
        l.setAttribute('x2', s.lx.toFixed(1))
        l.setAttribute('y2', s.ly.toFixed(1))
        l.style.visibility = 'visible'
      }
      const d = store.dots[s.index]
      if (d) {
        d.setAttribute('cx', s.ax.toFixed(1))
        d.setAttribute('cy', s.ay.toFixed(1))
        d.style.visibility = 'visible'
      }
    }
    for (let i = 0; i < count; i++) if (!shown.has(i)) hide(i)
  })
  return null
}
