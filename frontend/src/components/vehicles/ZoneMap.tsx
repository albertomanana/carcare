import { ArrowLeft, BellPlus, Box, History, List, ScanEye, Wrench } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import type { Vehicle, Zone, ZoneStatus } from '@/api/types'
import { StatusPill } from '@/components/ui/Badge'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Switch } from '@/components/ui/Checkbox'
import { Progress } from '@/components/ui/Progress'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { cn } from '@/lib/cn'
import { formatDate, formatKm, formatMoney } from '@/lib/format'
import { RECORD_TYPE_LABEL, ZONE_ICON } from '@/lib/labels'
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
  const [view, setView] = useState<View>(() => (readStorage(STORAGE_KEYS.zoneView) === '2d' ? '2d' : '3d'))
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
    <section aria-labelledby="zonas-title" className="overflow-hidden rounded-hero border border-line bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3 sm:px-5">
        <div className="min-w-0">
          <h2 id="zonas-title" className="font-display text-lg font-semibold tracking-tight text-fg-warm">
            Mapa de zonas
          </h2>
          <p className="flex items-center gap-1.5 text-xs text-fg-muted">
            <ScanEye aria-hidden className="size-3.5 text-accent-ink" />
            {INTERVAL_DISCLAIMER}: el estado sale de tus recordatorios.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {effectiveView === '3d' && <Switch checked={xray} onCheckedChange={setXray} label="Rayos X" description="Ilustrativo" className="min-h-0" />}
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

      <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(320px,380px)]">
        <div className="relative min-h-[260px] border-b border-line bg-gradient-to-b from-surface-2/60 to-surface sm:min-h-[340px] lg:min-h-[460px] lg:border-b-0 lg:border-r">
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
          {!webgl && (
            <p className="absolute inset-x-4 bottom-3 text-center text-xs text-fg-subtle">Tu navegador no permite 3D: te mostramos la silueta y la lista de zonas.</p>
          )}
        </div>

        <div className="min-w-0 p-3 sm:p-4">
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
      <h3 className="px-1 pb-2 text-sm text-fg-muted">Zonas ({zones.length})</h3>
      {/* Filas de texto: el estado con icono + texto y sin píldora, para que quepa a 360 px (hallazgo I4) */}
      <ul className="grid gap-x-4 sm:grid-cols-2 lg:grid-cols-1">
        {zones.map((z) => {
          const d = zoneDescriptor(z)
          const StateIcon = d.icon
          return (
            <li key={z.zone} className="min-w-0 border-b border-line last:border-b-0">
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
  const Icon = ZONE_ICON[zone.zone]
  const d = zoneDescriptor(zone)
  const next = zone.next_reminder
  const byDate = next ? dueByDate(next) : null
  const byKm = next ? dueByMileage(next) : null

  return (
    <div className="animate-fade-in" aria-live="polite">
      <button type="button" onClick={onBack} className="mb-3 inline-flex min-h-10 items-center gap-1.5 rounded-control px-1 text-sm text-fg-muted hover:text-fg">
        <ArrowLeft aria-hidden className="size-4" />
        Todas las zonas
        <kbd className="ml-1 hidden rounded border border-line px-1 text-[10px] text-fg-subtle sm:inline">Esc</kbd>
      </button>
      <div className="flex items-start gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-card bg-surface-2 text-accent-ink">
          <Icon aria-hidden className="size-5" />
        </span>
        <div className="min-w-0">
          <h3 className="font-display text-xl font-semibold text-fg-warm">{zone.label}</h3>
          <StatusPill status={d} className="mt-1" />
        </div>
      </div>

      <div className="mt-4 space-y-3 text-sm">
        {zone.basis === 'reminders' && next && (
          <div className="rounded-card border border-line bg-surface-2/50 p-3">
            <p className="text-xs font-medium uppercase tracking-wider text-fg-subtle">Próximo recordatorio</p>
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
            <p className="mt-1 text-[11px] text-fg-subtle">{INTERVAL_DISCLAIMER}</p>
          </div>
        )}
        {zone.basis === 'records' && <p className="text-fg-muted">Hay historial, pero no tienes recordatorios para esta zona. Crea uno para saber cuándo toca.</p>}
        {zone.basis === 'none' && <p className="text-fg-muted">Sin datos: no hay intervenciones ni recordatorios en esta zona.</p>}

        {zone.last_record ? (
          <div className="rounded-card border border-line p-3">
            <p className="text-xs font-medium uppercase tracking-wider text-fg-subtle">Última intervención</p>
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
