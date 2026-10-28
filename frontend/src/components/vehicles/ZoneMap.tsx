import { ArrowLeft, BellPlus, Box, History, List, Wrench } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import type { Vehicle, Zone, ZoneStatus } from '@/api/types'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Switch } from '@/components/ui/Checkbox'
import { Progress } from '@/components/ui/Progress'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { cn } from '@/lib/cn'
import { formatDate, formatKm, formatMoney } from '@/lib/format'
import { RECORD_TYPE_LABEL } from '@/lib/labels'
import { dueByDate, dueByMileage, INTERVAL_DISCLAIMER } from '@/lib/reminders'
import { readStorage, STORAGE_KEYS, writeStorage } from '@/lib/storage'
import { TONE_CLASSES, zoneDescriptor } from '@/lib/status'
import { CarSilhouette, CarViewer, useWebGLAvailable } from '@/three'

export interface ZoneMapProps {
  vehicle: Vehicle
  zones: ZoneStatus[]
  canOperate: boolean
  onCreateReminder: (zone: Zone) => void
  /** Ruta del formulario de intervención con la zona preseleccionada. */
  recordHref: (zone: Zone) => string
  /** Ruta del historial filtrado por zona. */
  historyHref: (zone: Zone) => string
}

type View = '3d' | '2d'

/** Mapa de zonas: visor 3D (o silueta 2D) + lista HTML equivalente + panel de detalle. */
export function ZoneMap({ vehicle, zones, canOperate, onCreateReminder, recordHref, historyHref }: ZoneMapProps) {
  const webgl = useWebGLAvailable()
  // Petición 19 (5.7): si no hay nada guardado, en pantallas de menos de 640 px se abre en "Lista" (se lee mejor,
  // ahorra batería y no descarga three.js); en las demás, en 3D
  const [view, setView] = useState<View>(() => {
    const stored = readStorage(STORAGE_KEYS.zoneView)
    if (stored === '2d' || stored === '3d') return stored
    return typeof window !== 'undefined' && window.matchMedia?.('(max-width: 639px)').matches ? '2d' : '3d'
  })
  const [selected, setSelected] = useState<Zone | null>(null)
  const [xray, setXray] = useState(false)
  const effectiveView: View = webgl ? view : '2d'
  const selectedZone = zones.find((z) => z.zone === selected) ?? null
  const appearance = { bodyType: vehicle.body_type, colorHex: vehicle.color_hex }

  // Esc cierra el panel de la zona
  useEffect(() => {
    if (!selected) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !document.querySelector('[role="dialog"]')) setSelected(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selected])

  const changeView = (v: View) => {
    setView(v)
    writeStorage(STORAGE_KEYS.zoneView, v)
  }

  return (
    <section aria-labelledby="zonas-title" className="min-w-0">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 id="zonas-title" className="font-display text-lg font-semibold tracking-tight text-fg-warm">
            Zonas
          </h2>
          <p className="mt-0.5 text-sm text-fg-muted">{INTERVAL_DISCLAIMER}: el estado sale de tus recordatorios.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {webgl && (
            <SegmentedControl
              label="Tipo de vista"
              size="sm"
              value={effectiveView}
              onValueChange={changeView}
              options={[
                { value: '3d', label: '3D', icon: <Box aria-hidden /> },
                { value: '2d', label: 'Lista', icon: <List aria-hidden /> },
              ]}
            />
          )}
        </div>
      </div>

      {/* La caja solo rodea el visor (R3); la lista y el detalle van al lado, sin caja */}
      <div className="grid gap-x-6 gap-y-4 lg:grid-cols-[minmax(0,1fr)_minmax(300px,360px)]">
        <div className={cn('relative overflow-hidden rounded-card border border-line bg-surface', effectiveView === '3d' ? 'min-h-[300px] sm:min-h-[340px] lg:min-h-[400px]' : 'min-h-[180px] sm:min-h-[260px] lg:min-h-[400px]')}>
          {effectiveView === '3d' ? (
            <CarViewer
              appearance={appearance}
              mode="inspect"
              zones={zones}
              selectedZone={selected}
              onSelectZone={setSelected}
              xray={xray}
              className="absolute inset-0 h-full w-full"
              ariaLabel={`Modelo 3D de ${vehicle.display_name} con ${zones.length} zonas. Usa la lista de zonas para la información detallada.`}
            />
          ) : (
            <div className="absolute inset-0 grid place-items-center p-6">
              <CarSilhouette appearance={appearance} title={`Silueta de ${vehicle.display_name}`} className="h-auto w-full max-w-lg" />
            </div>
          )}
          {effectiveView === '3d' && (
            <div className="absolute left-3 top-3 rounded-control border border-line bg-surface px-2">
              <Switch checked={xray} onCheckedChange={setXray} label="Rayos X" description="Ilustrativo" className="min-h-10" />
            </div>
          )}
          {!webgl && (
            <p className="absolute inset-x-4 bottom-3 text-center text-xs text-fg-subtle">Tu navegador no permite 3D: te mostramos la silueta y la lista de zonas.</p>
          )}
        </div>

        <div className="min-w-0">
          {selectedZone ? (
            <ZoneDetail
              zone={selectedZone}
              canOperate={canOperate}
              onBack={() => setSelected(null)}
              onCreateReminder={() => onCreateReminder(selectedZone.zone)}
              recordHref={recordHref(selectedZone.zone)}
              historyHref={historyHref(selectedZone.zone)}
            />
          ) : (
            <ZoneList zones={zones} selected={selected} onSelect={setSelected} />
          )}
        </div>
      </div>
    </section>
  )
}

function ZoneList({ zones, selected, onSelect }: { zones: ZoneStatus[]; selected: Zone | null; onSelect: (z: Zone) => void }) {
  return (
    <div>
      <h3 className="sr-only">Estado de las {zones.length} zonas</h3>
      {/* Filas de texto: el estado con icono + texto y sin píldora, para que quepa a 360 px (hallazgo I4) */}
      <ul className="grid gap-x-6 border-t border-line sm:grid-cols-2 lg:grid-cols-1">
        {zones.map((z) => {
          const d = zoneDescriptor(z)
          const StateIcon = d.icon
          return (
            <li key={z.zone} className="min-w-0 border-b border-line">
              <button
                type="button"
                onClick={() => onSelect(z.zone)}
                aria-pressed={selected === z.zone}
                aria-label={`${z.label}: ${d.label}`}
                className="flex min-h-11 w-full min-w-0 items-center gap-3 rounded-control px-1 text-left transition-colors hover:bg-surface-2"
              >
                <span className="min-w-0 flex-1 truncate text-sm text-fg">{z.label}</span>
                <span className={cn('inline-flex shrink-0 items-center gap-1 text-xs', TONE_CLASSES[d.tone].text)}>
                  <StateIcon aria-hidden className="size-3.5" />
                  {d.label}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function ZoneDetail({
  zone,
  canOperate,
  onBack,
  onCreateReminder,
  recordHref,
  historyHref,
}: {
  zone: ZoneStatus
  canOperate: boolean
  onBack: () => void
  onCreateReminder: () => void
  recordHref: string
  historyHref: string
}) {
  const d = zoneDescriptor(zone)
  const StateIcon = d.icon
  const next = zone.next_reminder
  const byDate = next ? dueByDate(next) : null
  const byKm = next ? dueByMileage(next) : null

  return (
    <div className="animate-fade-in" aria-live="polite">
      <button type="button" onClick={onBack} className="mb-3 inline-flex min-h-10 items-center gap-1.5 rounded-control px-1 text-sm text-fg-muted hover:text-fg">
        <ArrowLeft aria-hidden className="size-4" />
        Todas las zonas
      </button>
      <h3 className="font-display text-xl font-semibold text-fg-warm">{zone.label}</h3>
      <p className={cn('mt-1 inline-flex items-center gap-1 text-sm', TONE_CLASSES[d.tone].text)}>
        <StateIcon aria-hidden className="size-4" />
        {d.label}
      </p>

      <div className="mt-4 space-y-3 text-sm">
        {zone.basis === 'reminders' && next && (
          <div className="border-t border-line pt-3">
            <h4 className="text-sm text-fg-muted">Próximo recordatorio</h4>
            <p className="mt-1 font-medium text-fg">{next.title}</p>
            <ul className="mt-1 space-y-0.5 text-fg-muted tabular">
              {byDate && (
                <li>
                  {byDate.label}
                  {byDate.relative && ` · ${byDate.relative}`}
                </li>
              )}
              {byKm && (
                <li>
                  {byKm.label}
                  {byKm.relative && ` · ${byKm.relative}`}
                </li>
              )}
            </ul>
            <Progress
              className="mt-3"
              value={next.progress}
              tone={d.tone === 'danger' ? 'danger' : d.tone === 'warning' ? 'warning' : 'ok'}
              label={`Intervalo transcurrido de ${next.title}`}
            />
          </div>
        )}
        {zone.basis === 'records' && <p className="text-fg-muted">Hay historial, pero no tienes recordatorios para esta zona. Crea uno para saber cuándo toca.</p>}
        {zone.basis === 'none' && <p className="text-fg-muted">Sin datos: no hay intervenciones ni recordatorios en esta zona.</p>}

        {zone.last_record ? (
          <div className="border-t border-line pt-3">
            <h4 className="text-sm text-fg-muted">Última intervención</h4>
            <p className="mt-1 font-medium text-fg">{zone.last_record.title}</p>
            <p className="text-fg-muted tabular">
              {[RECORD_TYPE_LABEL[zone.last_record.type], formatDate(zone.last_record.service_date), zone.last_record.mileage !== null ? formatKm(zone.last_record.mileage) : null, zone.last_record.total_cost ? formatMoney(zone.last_record.total_cost) : null]
                .filter(Boolean)
                .join(' · ')}
            </p>
            <Link to={historyHref} className="mt-2 inline-flex min-h-10 items-center gap-1.5 text-sm font-medium text-accent-ink hover:underline">
              <History aria-hidden className="size-4" />
              Ver {zone.records_count} {zone.records_count === 1 ? 'intervención' : 'intervenciones'} de esta zona
            </Link>
          </div>
        ) : (
          <p className="text-fg-subtle">Sin intervenciones registradas en esta zona.</p>
        )}
      </div>

      {canOperate && (
        <div className={cn('mt-4 flex flex-wrap gap-2')}>
          {zone.basis !== 'reminders' && (
            <Button onClick={onCreateReminder} icon={<BellPlus aria-hidden />}>
              Crear recordatorio
            </Button>
          )}
          <ButtonLink to={recordHref} icon={<Wrench aria-hidden />}>
            Registrar intervención
          </ButtonLink>
          {zone.basis === 'reminders' && (
            <Button variant="ghost" onClick={onCreateReminder} icon={<BellPlus aria-hidden />}>
              Otro recordatorio
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
