/**
 * Respaldos 2D (sin three.js, bundle inicial): se muestran mientras carga el chunk 3D, si falla, o si no hay WebGL.
 * Mantienen la misma información accesible que el 3D (p. ej. los marcadores de zona).
 */
import { Component, useEffect, useRef, useState, type ReactNode } from 'react'
import type { Bay, Zone, ZoneStatus } from '@/api/types'
import { WORK_ORDER_STATUS } from '@/lib/status'
import type { CarAppearance, CarViewerProps, WorkshopSceneProps } from './types'
import { getCarLayout } from './car/anchors'
import { resolveBody } from './car/specs'
import { useThemeTokens } from './env'
import { ZONE_DISCLAIMER, ZoneMarkerButton } from './markers/ZoneMarkerButton'
import { CarSilhouette } from './silhouette/CarSilhouette'
import { describeCar } from './silhouette/describe'
import { getSilhouettePaths } from './silhouette/paths'

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ')

/** Si el 3D lanza un error (contexto WebGL perdido, chunk no disponible…), se muestra el respaldo. */
export class ThreeBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch(error: unknown) {
    if (import.meta.env.DEV) console.warn('[3D] Se usa el respaldo 2D:', error)
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}

export function SilhouetteBox({ appearance, className, title, loading }: { appearance: CarAppearance; className?: string; title?: string; loading?: boolean }) {
  return (
    <div className={cx('relative grid min-h-40 place-items-center overflow-hidden', className)} aria-busy={loading || undefined}>
      <CarSilhouette appearance={appearance} title={title} className={cx('h-auto max-h-full w-[84%]', loading && 'opacity-70 motion-safe:animate-pulse')} />
    </div>
  )
}

/** Tamaño de un rectángulo de proporción `ratio` que cabe en el contenedor (como object-fit: contain). */
function useContainBox(ratio: number) {
  const ref = useRef<HTMLDivElement>(null)
  const [box, setBox] = useState<{ w: number; h: number } | null>(null)
  useEffect(() => {
    const el = ref.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(([e]) => {
      const W = e.contentRect.width
      const H = e.contentRect.height || W / ratio
      const w = Math.min(W, H * ratio)
      setBox({ w, h: w / ratio })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [ratio])
  return { ref, box }
}

/** Mapa de zonas 2D: la silueta lateral con los mismos botones de zona que el visor 3D. */
export function ZoneMap2D({
  appearance,
  zones,
  selectedZone,
  onSelectZone,
  className,
  ariaLabel,
}: Pick<CarViewerProps, 'appearance' | 'zones' | 'selectedZone' | 'onSelectZone' | 'className' | 'ariaLabel'>) {
  const body = resolveBody(appearance.bodyType)
  const paths = getSilhouettePaths(body)
  const { anchors } = getCarLayout(body)
  const tokens = useThemeTokens()
  const [vx, vy, vw, vh] = paths.viewBox
  // margen para que quepan los marcadores por encima y por debajo
  const pad = 0.18
  const ratio = vw / (vh + pad * 2)
  const { ref, box } = useContainBox(ratio)
  const select = (z: Zone | null) => onSelectZone?.(z)

  return (
    <div ref={ref} className={cx('relative grid min-h-48 place-items-center overflow-hidden p-2', className)}>
      <div className="relative" style={box ? { width: box.w, height: box.h } : { width: '100%', aspectRatio: String(ratio) }}>
        <CarSilhouette
          appearance={appearance}
          title={ariaLabel ?? `Mapa de zonas: ${describeCar(appearance.bodyType, appearance.colorHex)}`}
          className="absolute inset-x-0 w-full"
        />
        {zones?.map((z: ZoneStatus) => {
          const [x, y] = anchors[z.zone].position
          const left = ((x - vx) / vw) * 100
          const top = ((-y - vy + pad) / (vh + pad * 2)) * 100
          return (
            <div key={z.zone} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${left}%`, top: `${top}%`, zIndex: z.zone === selectedZone ? 2 : 1 }}>
              <ZoneMarkerButton status={z} selected={z.zone === selectedZone} tokens={tokens} onSelect={select} />
            </div>
          )
        })}
      </div>
      {zones && zones.length > 0 && <p className="absolute bottom-1 left-3 text-[11px] text-fg-subtle">Vista 2D · colores {ZONE_DISCLAIMER}</p>}
    </div>
  )
}

/** Taller sin WebGL: rejilla de elevadores como botones. */
export function Workshop2D({ bays, waiting = [], selectedBay = null, onSelectBay, onSelectOrder, className }: WorkshopSceneProps) {
  return (
    <div className={cx('grid content-start gap-3 overflow-auto p-3', className)} role="group" aria-label="Taller (vista 2D)">
      <ul className="grid grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] gap-3">
        {bays.map((b: Bay) => {
          const o = b.work_order
          const st = o ? WORK_ORDER_STATUS[o.status] : null
          const sel = selectedBay === b.number
          return (
            <li key={b.number}>
              <button
                type="button"
                aria-pressed={sel}
                onClick={() => onSelectBay?.(sel ? null : b.number)}
                className={cx(
                  'flex w-full flex-col items-stretch gap-1 rounded-card border bg-surface p-2 text-left text-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
                  sel ? 'border-accent' : 'border-line',
                )}
              >
                <span className="font-display text-sm font-semibold text-fg">Elevador {b.number}</span>
                {o ? (
                  <>
                    <CarSilhouette appearance={{ bodyType: o.vehicle.body_type, colorHex: o.vehicle.color_hex }} className="h-12 w-full" title={o.vehicle.display_name} />
                    <span className="truncate text-fg">{o.number} · {o.vehicle.display_name}</span>
                    {st && <span className="text-fg-muted">{st.label}</span>}
                  </>
                ) : (
                  <span className="py-4 text-fg-subtle">Libre</span>
                )}
              </button>
            </li>
          )
        })}
      </ul>
      {waiting.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-medium text-fg-muted">En espera</p>
          <ul className="flex flex-wrap gap-2">
            {waiting.slice(0, 8).map((o) => (
              <li key={o.id}>
                <button
                  type="button"
                  onClick={() => onSelectOrder?.(o.id)}
                  className="rounded-control border border-line bg-surface px-2 py-1 text-xs text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  {o.number} · {o.vehicle.display_name}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
