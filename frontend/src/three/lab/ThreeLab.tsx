/**
 * Laboratorio de revisión visual del módulo 3D (solo desarrollo: /dev/3d y /three-lab.html).
 * Todas las carrocerías, estados de zona, rayos X, iluminación, miniaturas, siluetas, taller y portada.
 * El estado inicial se puede fijar por URL (?tab=viewer&body=suv&color=%23b3202a&mode=inspect&zone=brakes&xray=1&lighting=night)
 * para hacer capturas reproducibles.
 */
import { lazy, Suspense, useMemo, useState } from 'react'
import type { BodyType, Zone } from '@/api/types'
import { BODY_LABEL, ZONE_LABEL } from '@/lib/labels'
import { CarPreview, CarSilhouette, CarThumbnail, CarViewer, HeroScene, WorkshopScene } from '../index'
import { BODY_TYPES } from '../car/specs'
import { demoWorkshop, demoZones } from './demoData'

type Tab = 'viewer' | 'thumbs' | 'preview' | 'workshop' | 'hero' | 'debug'

const DebugStage = lazy(() => import('./DebugStage'))

const SWATCHES = ['#3a4248', '#e8e6e1', '#101214', '#b3202a', '#1f3a5f', '#2e5e4e', '#c9a227', '#7c8a96', '#c7f36b']

function param(name: string): string | null {
  if (typeof window === 'undefined') return null
  return new URLSearchParams(window.location.search).get(name)
}

export function ThreeLab() {
  const [tab, setTab] = useState<Tab>((param('tab') as Tab) ?? 'viewer')
  const [body, setBody] = useState<BodyType>((param('body') as BodyType) ?? 'hatchback')
  const [color, setColor] = useState<string>(param('color') ?? '#3a4248')
  const [mode, setMode] = useState<'showcase' | 'inspect'>((param('mode') as 'inspect') ?? 'inspect')
  const [xray, setXray] = useState(param('xray') === '1')
  const [lighting, setLighting] = useState<'studio' | 'night'>((param('lighting') as 'night') ?? 'studio')
  const [zone, setZone] = useState<Zone | null>((param('zone') as Zone) ?? null)
  const [bay, setBay] = useState<number | null>(param('bay') ? Number(param('bay')) : null)
  const [progress, setProgress] = useState(Number(param('progress') ?? 0))
  const [lastOrder, setLastOrder] = useState<number | null>(null)
  const zones = useMemo(() => demoZones(), [])
  const shop = useMemo(() => demoWorkshop(), [])
  const appearance = { bodyType: body, colorHex: color }
  const full = param('full') === '1'

  const tabs: [Tab, string][] = [
    ['viewer', 'Visor'],
    ['thumbs', 'Miniaturas y siluetas'],
    ['preview', 'Vista previa'],
    ['workshop', 'Taller'],
    ['hero', 'Portada'],
  ]

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-4 p-4 text-fg sm:p-6">
      {!full && (
        <header className="flex flex-wrap items-center gap-3">
          <h1 className="font-display text-xl font-semibold">Laboratorio 3D</h1>
          <nav aria-label="Escenas" className="flex flex-wrap gap-1">
            {tabs.map(([t, l]) => (
              <button
                key={t}
                type="button"
                aria-pressed={tab === t}
                onClick={() => setTab(t)}
                className={`rounded-control px-3 py-1.5 text-sm ${tab === t ? 'bg-accent text-on-accent' : 'bg-surface-2 text-fg-muted hover:text-fg'}`}
              >
                {l}
              </button>
            ))}
          </nav>
        </header>
      )}

      {(tab === 'viewer' || tab === 'preview' || tab === 'thumbs') && !full && (
        <section aria-label="Controles" className="flex flex-wrap items-center gap-3 rounded-card border border-line bg-surface p-3 text-sm">
          <label className="flex items-center gap-2">
            Carrocería
            <select value={body} onChange={(e) => setBody(e.target.value as BodyType)} className="rounded-control border border-line bg-surface-2 px-2 py-1">
              {BODY_TYPES.map((b) => (
                <option key={b} value={b}>
                  {BODY_LABEL[b]}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-center gap-1" role="group" aria-label="Color">
            {SWATCHES.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`Color ${c}`}
                aria-pressed={color === c}
                onClick={() => setColor(c)}
                className={`size-6 rounded-full border-2 ${color === c ? 'border-accent' : 'border-line'}`}
                style={{ background: c }}
              />
            ))}
          </div>
          {tab === 'viewer' && (
            <>
              <label className="flex items-center gap-2">
                Modo
                <select value={mode} onChange={(e) => setMode(e.target.value as 'showcase' | 'inspect')} className="rounded-control border border-line bg-surface-2 px-2 py-1">
                  <option value="showcase">Escaparate</option>
                  <option value="inspect">Inspección</option>
                </select>
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={xray} onChange={(e) => setXray(e.target.checked)} /> Rayos X
              </label>
              <label className="flex items-center gap-2">
                Luz
                <select value={lighting} onChange={(e) => setLighting(e.target.value as 'studio' | 'night')} className="rounded-control border border-line bg-surface-2 px-2 py-1">
                  <option value="studio">Estudio</option>
                  <option value="night">Noche</option>
                </select>
              </label>
              <span className="text-fg-muted">Zona: {zone ? ZONE_LABEL[zone] : 'ninguna'}</span>
            </>
          )}
        </section>
      )}

      {tab === 'viewer' && (
        <CarViewer
          appearance={appearance}
          mode={mode}
          zones={zones}
          selectedZone={zone}
          onSelectZone={setZone}
          xray={xray}
          lighting={lighting}
          className={full ? 'h-[calc(100dvh-2rem)] w-full rounded-hero bg-surface' : 'h-[min(70dvh,640px)] w-full rounded-hero border border-line bg-surface'}
        />
      )}

      {tab === 'debug' && (
        <Suspense fallback={null}>
          <DebugStage body={body} color={color} xray={xray} night={lighting === 'night'} zone={zone} />
        </Suspense>
      )}

      {tab === 'thumbs' && (
        <div className="grid gap-6">
          <section>
            <h2 className="mb-2 text-sm font-medium text-fg-muted">Miniaturas (renderizador compartido, imagen cacheada)</h2>
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {BODY_TYPES.map((b) => (
                <li key={b} className="rounded-card border border-line bg-surface p-2">
                  <CarThumbnail appearance={{ bodyType: b, colorHex: color }} alt={BODY_LABEL[b]} className="aspect-[16/9] w-full" />
                  <p className="mt-1 text-xs text-fg-muted">{BODY_LABEL[b]}</p>
                </li>
              ))}
            </ul>
          </section>
          <section>
            <h2 className="mb-2 text-sm font-medium text-fg-muted">Siluetas SVG (respaldo sin WebGL)</h2>
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {BODY_TYPES.map((b, i) => (
                <li key={b} className="rounded-card border border-line bg-surface p-2">
                  <CarSilhouette appearance={{ bodyType: b, colorHex: SWATCHES[i % SWATCHES.length] }} className="aspect-[16/9] w-full" />
                  <p className="mt-1 text-xs text-fg-muted">{BODY_LABEL[b]}</p>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}

      {tab === 'preview' && (
        <div className="grid gap-4 md:grid-cols-[1fr_320px]">
          <CarPreview appearance={appearance} className="aspect-[16/9] w-full rounded-hero border border-line bg-surface" />
          <p className="text-sm text-fg-muted">Cambia carrocería y color arriba: la vista previa se actualiza en vivo (sin controles, giro lento salvo movimiento reducido).</p>
        </div>
      )}

      {tab === 'workshop' && (
        <div className="grid gap-2">
          <WorkshopScene
            bays={shop.bays}
            waiting={shop.waiting}
            selectedBay={bay}
            onSelectBay={setBay}
            onSelectOrder={setLastOrder}
            className={full ? 'h-[calc(100dvh-2rem)] w-full rounded-hero' : 'h-[min(72dvh,680px)] w-full rounded-hero border border-line'}
          />
          {!full && (
            <p className="text-sm text-fg-muted">
              Elevador seleccionado: {bay ?? 'ninguno'} · Última orden pulsada: {lastOrder ?? '—'}
            </p>
          )}
        </div>
      )}

      {tab === 'hero' && (
        <div className="grid gap-3">
          {!full && (
            <label className="flex items-center gap-3 text-sm">
              Progreso {progress.toFixed(2)}
              <input type="range" min={0} max={1} step={0.01} value={progress} onChange={(e) => setProgress(Number(e.target.value))} className="w-64" />
            </label>
          )}
          <div className={full ? 'h-[calc(100dvh-2rem)]' : 'h-[min(72dvh,680px)] rounded-hero border border-line bg-base'}>
            <HeroScene progress={progress} className="h-full w-full" />
          </div>
        </div>
      )}
    </div>
  )
}

export default ThreeLab
