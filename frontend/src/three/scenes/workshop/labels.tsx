/**
 * Rótulos HTML del taller (botones accesibles proyectados sobre la maqueta): uno por elevador, uno por coche en la
 * zona de espera o de entrega, el del almacén, el del terminal de diagnóstico y uno por persona sin orden en curso.
 * El texto accesible describe siempre el elevador, la orden o la persona completos.
 */
import { HardHat, MonitorCog, Warehouse } from 'lucide-react'
import type { Bay, WorkOrder } from '@/api/types'
import { isBeingWorked, overallColor } from '@/lib/mechanic'
import { LiveTimer } from '@/components/orders/OrderTimer'
import { orderTiming, timingSentence, useNow } from '@/lib/orderTiming'
import { LATE, TONE_CLASSES, WORK_ORDER_STATUS } from '@/lib/status'
import { beaconText, crewStatusText, roleLabel, type BayBeacon, type CrewPlacement } from './crew'

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ')

function vehicleText(o: WorkOrder) {
  return o.vehicle.plate ? `${o.vehicle.display_name} (${o.vehicle.plate})` : o.vehicle.display_name
}

export function BayLabel({
  bay,
  selected,
  compact,
  beacon = null,
  onSelect,
}: {
  bay: Bay
  selected: boolean
  compact: boolean
  /** Baliza del elevador: coche sin técnico o técnico trabajando en otro elevador (ver `crew.ts`). */
  beacon?: BayBeacon | null
  onSelect: (n: number | null) => void
}) {
  const o = bay.work_order
  const st = o ? WORK_ORDER_STATUS[o.status] : null
  const tone = st ? TONE_CLASSES[st.tone] : null
  const Icon = st?.icon
  // El texto accesible se renueva cada medio minuto (el cronómetro visible, cada segundo y sin anunciarse)
  const now = useNow(30_000)
  const working = !!o && isBeingWorked(o.status)
  const who = o?.assigned_to ?? null
  const aria = o
    ? `Elevador ${bay.number}: orden ${o.number}, ${vehicleText(o)}, ${st!.label}${o.is_late ? ', fuera de plazo' : ''}; ` +
      `${who ? `${working ? 'trabaja' : 'asignada a'} ${who.name}` : 'sin mecánico asignado'}${beacon ? ` (${beaconText(beacon)})` : ''}, ${o.title}; ${timingSentence(orderTiming(o, now))}`
    : `Elevador ${bay.number}: libre`
  const full = !compact || selected
  if (o && st && tone)
    return (
      <div className="flex flex-col items-center">
        <button
          type="button"
          aria-pressed={selected}
          aria-label={aria}
          title={aria}
          onClick={(e) => {
            e.stopPropagation()
            onSelect(selected ? null : bay.number)
          }}
          className={cx(
            'flex cursor-pointer flex-col items-stretch gap-1 rounded-card border px-2.5 py-1.5 text-left text-xs shadow-lg backdrop-blur-md',
            'transition-[background-color,box-shadow,border-color] duration-200 motion-reduce:transition-none',
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-ink',
            full && 'w-60',
            selected ? 'border-accent bg-surface text-fg ring-2 ring-accent/35' : 'border-line/70 bg-surface/90 text-fg hover:bg-surface',
          )}
        >
          <span className="flex items-center justify-between gap-2 whitespace-nowrap">
            <span className="flex items-baseline gap-1.5">
              <span className="font-display text-xs font-semibold text-fg-subtle">{full ? `Elevador ${bay.number}` : `E${bay.number}`}</span>
              {full && <span className="tabular font-medium">{o.number.split('-').pop()}</span>}
            </span>
            <span className="flex items-center gap-1">
              {full && Icon ? (
                <span className={cx('inline-flex items-center gap-1 rounded-[5px] px-1.5 py-px text-[11px] font-medium', tone.soft)}>
                  <Icon className="size-3" aria-hidden strokeWidth={2.4} />
                  {st.label}
                </span>
              ) : (
                <span className={cx('size-2 rounded-full', tone.dot)} aria-hidden />
              )}
              {o.is_late && <LATE.icon className="size-3.5 text-danger" aria-hidden strokeWidth={2.4} />}
              {beacon && !full && <HardHat className="size-3.5 text-warning" aria-hidden strokeWidth={2.4} />}
            </span>
          </span>
          {full && beacon && (
            <span className={cx('inline-flex items-center gap-1 self-start rounded-[5px] px-1.5 py-px text-[11px] font-medium', TONE_CLASSES.warning.soft)}>
              <HardHat className="size-3" aria-hidden strokeWidth={2.4} />
              {beacon.kind === 'awaiting_tech' ? beaconText(beacon) : `${beacon.name.split(' ')[0]} está en el elevador ${beacon.bay}`}
            </span>
          )}
          {full ? (
            <>
              <span className="flex min-w-0 items-center gap-1.5">
                <span
                  aria-hidden
                  className={cx('size-2.5 shrink-0 rounded-full', !who && 'border border-dashed border-fg-subtle', working && who && 'motion-safe:animate-pulse')}
                  style={who ? { backgroundColor: overallColor(who.id) } : undefined}
                />
                <span className="min-w-0 truncate">
                  <span className="font-medium text-fg">{who ? who.name.split(' ')[0] : 'Sin asignar'}</span>
                  <span className="text-fg-muted"> · {o.title}</span>
                </span>
              </span>
              <LiveTimer order={o} />
            </>
          ) : (
            <LiveTimer order={o} bar={false} short />
          )}
        </button>
        <span className="h-3 w-px bg-fg-subtle/70" aria-hidden />
      </div>
    )
  return (
    <div className="flex flex-col items-center">
      <button
        type="button"
        aria-pressed={selected}
        aria-label={aria}
        title={aria}
        onClick={(e) => {
          e.stopPropagation()
          onSelect(selected ? null : bay.number)
        }}
        className={cx(
          'flex cursor-pointer flex-col items-start gap-0.5 rounded-card border px-2.5 py-1.5 text-left text-xs shadow-lg backdrop-blur-md',
          'transition-[background-color,box-shadow,border-color] duration-200 motion-reduce:transition-none',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-ink',
          selected ? 'border-accent bg-surface text-fg ring-2 ring-accent/35' : 'border-line/70 bg-surface/90 text-fg hover:bg-surface',
        )}
      >
        <span className="flex items-center gap-1.5 whitespace-nowrap">
          <span className="font-display text-xs font-semibold text-fg-subtle">{compact && !selected ? `E${bay.number}` : `Elevador ${bay.number}`}</span>
          {o ? (
            <>
              {tone && <span className={cx('size-2 rounded-full', tone.dot)} aria-hidden />}
              {full && <span className="font-medium tabular-nums">{o.number}</span>}
            </>
          ) : (
            <span className="text-fg-muted">Libre</span>
          )}
        </span>
        {o && full && (
          <span className="flex items-center gap-1.5 whitespace-nowrap text-fg-muted">
            {st && tone && Icon && (
              <span className={cx('inline-flex items-center gap-1 rounded-[5px] px-1.5 py-px text-[11px] font-medium', tone.soft)}>
                <Icon className="size-3" aria-hidden strokeWidth={2.4} />
                {st.label}
              </span>
            )}
            {o.is_late && (
              <span className={cx('inline-flex items-center gap-1 rounded-[5px] px-1.5 py-px text-[11px] font-medium', TONE_CLASSES[LATE.tone].soft)}>
                <LATE.icon className="size-3" aria-hidden strokeWidth={2.4} />
                {LATE.label}
              </span>
            )}
            <span className="max-w-40 truncate">{o.vehicle.plate ?? o.vehicle.display_name}</span>
          </span>
        )}
        {o && selected && o.vehicle.plate && <span className="max-w-56 truncate text-fg-muted">{o.vehicle.display_name}</span>}
      </button>
      <span className="h-3 w-px bg-fg-subtle/70" aria-hidden />
    </div>
  )
}

/**
 * Coche aparcado en la zona de espera o de entrega. Con `dot` (vista general, cuando no hay sitio para tantos rótulos)
 * es solo un punto con el color del estado y un anillo; el número aparece al pasar el puntero, con el teclado y al
 * seleccionarlo. El texto accesible es siempre el completo.
 */
export function CarLabel({
  order,
  zone,
  selected,
  compact,
  dot = false,
  onSelect,
}: {
  order: WorkOrder
  zone: 'park' | 'ready'
  selected: boolean
  compact: boolean
  dot?: boolean
  onSelect: (id: number | null) => void
}) {
  const st = WORK_ORDER_STATUS[order.status]
  const tone = TONE_CLASSES[st.tone]
  const short = order.number.split('-').pop() ?? order.number
  const where = zone === 'ready' ? 'Zona de entrega' : 'En espera'
  const aria = `${where}: orden ${order.number}, ${vehicleText(order)}, ${st.label}${order.is_late ? ', fuera de plazo' : ''}`
  const click = (e: React.MouseEvent) => {
    e.stopPropagation()
    onSelect(selected ? null : order.id)
  }
  if (dot && !selected) {
    return (
      <div className="group/dot relative flex flex-col items-center">
        <button
          type="button"
          aria-pressed={false}
          aria-label={aria}
          title={aria}
          onClick={click}
          className={cx(
            'grid size-6 cursor-pointer place-items-center rounded-full border bg-surface/90 shadow-md backdrop-blur-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-ink',
            order.is_late ? 'border-danger' : 'border-line/80',
          )}
        >
          <span className={cx('size-2.5 rounded-full', tone.dot)} aria-hidden />
        </button>
        <span
          aria-hidden
          className="pointer-events-none absolute bottom-full mb-1 hidden whitespace-nowrap rounded-full border border-line/70 bg-surface px-2 py-0.5 text-[11px] font-medium tabular-nums text-fg shadow-md group-focus-within/dot:block group-hover/dot:block"
        >
          {short}
          {order.is_late && <LATE.icon className="ml-1 inline size-3 text-danger" aria-hidden />}
        </span>
      </div>
    )
  }
  return (
    <div className="flex flex-col items-center">
      <button
        type="button"
        aria-pressed={selected}
        aria-label={aria}
        title={aria}
        onClick={click}
        className={cx(
          'inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium text-fg shadow-md backdrop-blur-md',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-ink',
          selected ? 'border-accent bg-surface ring-2 ring-accent/35' : 'border-line/70 bg-surface/90 hover:bg-surface',
        )}
      >
        <span className={cx('size-1.5 rounded-full', tone.dot)} aria-hidden />
        <span className="tabular-nums">{compact && !selected ? short : order.number}</span>
        {selected && <span className="max-w-32 truncate text-fg-muted">{order.vehicle.plate ?? order.vehicle.display_name}</span>}
        {order.is_late && <LATE.icon className="size-3 text-danger" aria-hidden />}
      </button>
      <span className="h-2 w-px bg-fg-subtle/60" aria-hidden />
    </div>
  )
}

const panelBtn = cx(
  'flex w-full cursor-pointer items-baseline gap-1.5 rounded-[6px] px-1.5 py-0.5 text-left text-[11px] hover:bg-surface-2',
  'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent-ink',
)

/** Rótulo de una zona del lateral (almacén o diagnóstico): título, resumen y hasta tres órdenes que se pueden elegir. */
function ZoneLabel({
  icon: Icon,
  title,
  summary,
  alert,
  rows,
  compact,
  selectedOrderId,
  onSelect,
}: {
  icon: typeof Warehouse
  title: string
  summary: string
  alert: boolean
  rows: { order: WorkOrder; detail: string }[]
  compact: boolean
  selectedOrderId: number | null
  onSelect: (id: number) => void
}) {
  const shown = rows.slice(0, 3)
  return (
    <div className="flex flex-col items-center">
      <section
        aria-label={`${title}: ${summary}`}
        className={cx(
          'flex flex-col gap-0.5 rounded-card border bg-surface/90 px-2 py-1.5 text-xs text-fg shadow-lg backdrop-blur-md',
          compact ? 'max-w-48' : 'w-60',
          alert ? 'border-warning/70' : 'border-line/70',
        )}
      >
        <span className="flex items-center gap-1.5 whitespace-nowrap px-0.5">
          <Icon className={cx('size-3.5', alert ? 'text-warning' : 'text-fg-subtle')} aria-hidden strokeWidth={2.2} />
          <span className="font-display font-semibold text-fg-subtle">{title}</span>
          {alert && <span className="size-1.5 rounded-full bg-warning motion-safe:animate-pulse" aria-hidden />}
        </span>
        <span className="px-0.5 text-[11px] text-fg-muted">{summary}</span>
        {!compact &&
          shown.map(({ order, detail }) => (
            <button
              key={order.id}
              type="button"
              aria-pressed={selectedOrderId === order.id}
              aria-label={`Orden ${order.number}, ${vehicleText(order)}: ${detail}`}
              onClick={(e) => {
                e.stopPropagation()
                onSelect(order.id)
              }}
              className={cx(panelBtn, selectedOrderId === order.id && 'bg-surface-2 ring-1 ring-accent/50')}
            >
              <span className="shrink-0 font-medium tabular-nums">{order.number.split('-').pop()}</span>
              <span className="min-w-0 truncate text-fg-muted">{detail}</span>
            </button>
          ))}
        {!compact && rows.length > shown.length && <span className="px-1.5 text-[11px] text-fg-subtle">y {rows.length - shown.length} más en la lista</span>}
      </section>
      <span className="h-3 w-px bg-fg-subtle/70" aria-hidden />
    </div>
  )
}

const partsOf = (o: WorkOrder) => o.items.filter((i) => i.kind === 'part')

/** Almacén de piezas: se enciende con las órdenes en «Esperando piezas» (no hay inventario: son las órdenes). */
export function StoreLabel({ orders, compact, selectedOrderId, onSelect }: { orders: WorkOrder[]; compact: boolean; selectedOrderId: number | null; onSelect: (id: number) => void }) {
  const n = orders.length
  const summary = n ? `${n} ${n === 1 ? 'orden espera' : 'órdenes esperan'} piezas` : 'Ninguna orden espera piezas'
  const rows = orders.map((o) => {
    const parts = partsOf(o)
    const detail = parts.length ? `${parts[0].name}${parts.length > 1 ? ` y ${parts.length - 1} más` : ''}` : 'Sin piezas anotadas'
    return { order: o, detail }
  })
  return <ZoneLabel icon={Warehouse} title="Almacén" summary={summary} alert={n > 0} rows={rows} compact={compact} selectedOrderId={selectedOrderId} onSelect={onSelect} />
}

/** Terminal de diagnóstico: las órdenes en diagnóstico con lo que se ha anotado (el diagnóstico de la orden, no una lectura OBD). */
export function DiagLabel({ orders, compact, selectedOrderId, onSelect }: { orders: WorkOrder[]; compact: boolean; selectedOrderId: number | null; onSelect: (id: number) => void }) {
  const n = orders.length
  const summary = n ? `${n} ${n === 1 ? 'coche' : 'coches'} en diagnóstico` : 'Ningún coche en diagnóstico'
  const rows = orders.map((o) => ({ order: o, detail: o.diagnosis?.trim() || 'Sin diagnóstico anotado' }))
  return <ZoneLabel icon={MonitorCog} title="Diagnóstico" summary={summary} alert={false} rows={rows} compact={compact} selectedOrderId={selectedOrderId} onSelect={onSelect} />
}

/** Persona del equipo en la maqueta: nombre con el color de su mono; con `dot`, solo el punto (nombre al pasar el puntero). */
export function CrewLabel({ person, selected, dot, onSelect }: { person: CrewPlacement; selected: boolean; dot: boolean; onSelect: (id: number | null) => void }) {
  const role = roleLabel(person.member.role)
  const aria = `${person.member.name}${role ? `, ${role}` : ''}: ${crewStatusText(person)}`
  const color = overallColor(person.member.id)
  const click = (e: React.MouseEvent) => {
    e.stopPropagation()
    onSelect(selected ? null : person.member.id)
  }
  const first = person.member.name.split(' ')[0]
  return (
    <div className="group/dot relative flex flex-col items-center">
      <button
        type="button"
        aria-pressed={selected}
        aria-label={aria}
        title={aria}
        onClick={click}
        className={cx(
          'inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full border text-[11px] font-medium text-fg shadow-md backdrop-blur-md',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-ink',
          dot && !selected ? 'size-6 justify-center' : 'px-2 py-0.5',
          selected ? 'border-accent bg-surface ring-2 ring-accent/35' : 'border-line/70 bg-surface/90 hover:bg-surface',
        )}
      >
        <span className="size-2.5 shrink-0 rounded-full ring-1 ring-black/20" style={{ backgroundColor: color }} aria-hidden />
        {(!dot || selected) && (
          <>
            <span>{first}</span>
            {selected && role && <span className="text-fg-muted">· {role}</span>}
          </>
        )}
      </button>
      {dot && !selected && (
        <span
          aria-hidden
          className="pointer-events-none absolute bottom-full mb-1 hidden whitespace-nowrap rounded-full border border-line/70 bg-surface px-2 py-0.5 text-[11px] font-medium text-fg shadow-md group-focus-within/dot:block group-hover/dot:block"
        >
          {first}
        </span>
      )}
      <span className="h-2 w-px bg-fg-subtle/60" aria-hidden />
    </div>
  )
}
