import { CalendarDays, Gauge, NotebookPen, Receipt, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { errorMessage } from '@/api/client'
import { flattenPages, totalFromPages } from '@/api/hooks/shared'
import { useDeleteMileage, useJournal, useMileageLogs } from '@/api/hooks/vehicles'
import type { ExpenseCategory, FuelUnit, JournalDay, JournalEntry, MileageLog } from '@/api/types'
import { Badge } from '@/components/ui/Badge'
import { Button, IconButton } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { LoadMore } from '@/components/ui/LoadMore'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { Skeleton } from '@/components/ui/Skeleton'
import { StatCard } from '@/components/ui/StatCard'
import { EmptyState, ErrorState } from '@/components/ui/States'
import { useQuickActions } from '@/features/quick-actions/quick-actions-context'
import { useWorkspace } from '@/features/workspace/workspace-context'
import { useSearchParam } from '@/hooks/useSearchParam'
import { cn } from '@/lib/cn'
import { addDays, daysBetween, formatDate, formatDecimal, formatKm, formatMoney, parseISODate, toISODate, toNumber } from '@/lib/format'
import { EXPENSE_CATEGORY_LABEL, FUEL_UNIT_SHORT, JOURNAL_TYPE_ICON, JOURNAL_TYPE_LABEL, MILEAGE_SOURCE_LABEL } from '@/lib/labels'
import { type PeriodPreset, presetPeriod } from '@/lib/period'
import { useVehicleOutlet } from '../vehicle-outlet'

type Range = Extract<PeriodPreset, 'last_30' | 'last_90' | 'last_12'>

export default function JournalTab() {
  const [view, setView] = useSearchParam('vista', 'diario')
  return (
    <div className="space-y-6">
      <SegmentedControl
        label="Vista del diario"
        value={view === 'lecturas' ? 'lecturas' : 'diario'}
        onValueChange={setView}
        options={[
          { value: 'diario', label: 'Día a día', icon: <CalendarDays aria-hidden /> },
          { value: 'lecturas', label: 'Lecturas de km', icon: <Gauge aria-hidden /> },
        ]}
      />
      {view === 'lecturas' ? <MileageLogs /> : <Journal />}
    </div>
  )
}

function Journal() {
  const { vehicle } = useVehicleOutlet()
  const ctx = useWorkspace()
  const quick = useQuickActions()
  const [range, setRange] = useState<Range>('last_30')
  const period = useMemo(() => presetPeriod(range), [range])
  const journal = useJournal(vehicle.id, { from: period.from, to: period.to })
  const days = journal.data ?? []
  const canOperate = ctx.can('operate') && !vehicle.archived_at

  const totals = useMemo(() => {
    let spent = 0
    let km = 0
    let kmDays = 0
    for (const d of days) {
      spent += toNumber(d.spent) ?? 0
      if (d.km_driven !== null) {
        km += d.km_driven
        kmDays++
      }
    }
    return { spent, km, kmDays, activeDays: days.length }
  }, [days])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SegmentedControl
          label="Periodo"
          size="sm"
          value={range}
          onValueChange={setRange}
          options={[
            { value: 'last_30', label: '30 días' },
            { value: 'last_90', label: '90 días' },
            { value: 'last_12', label: '12 meses' },
          ]}
        />
        {canOperate && (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" icon={<Gauge aria-hidden />} onClick={() => quick.run('mileage', vehicle.id)}>
              Anotar km
            </Button>
            {ctx.canExpenses && (
              <Button size="sm" icon={<Receipt aria-hidden />} onClick={() => quick.run('expense', vehicle.id)}>
                Añadir gasto
              </Button>
            )}
          </div>
        )}
      </div>

      {journal.isPending ? (
        <div role="status" aria-live="polite" className="space-y-3">
          <span className="sr-only">Cargando diario…</span>
          <Skeleton className="h-28 w-full rounded-card" />
          <Skeleton className="h-40 w-full rounded-card" />
        </div>
      ) : journal.isError ? (
        <ErrorState error={journal.error} onRetry={() => void journal.refetch()} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            <StatCard label="Días con actividad" value={String(totals.activeDays)} hint={`Del ${formatDate(period.from)} al ${formatDate(period.to)}`} />
            <StatCard
              label="Km recorridos"
              value={totals.kmDays ? formatKm(totals.km).replace(' km', '') : '—'}
              unit={totals.kmDays ? 'km' : undefined}
              hint={totals.kmDays ? `En ${totals.kmDays} ${totals.kmDays === 1 ? 'día con lecturas' : 'días con lecturas'}` : 'Faltan lecturas para calcularlo'}
            />
            {ctx.canExpenses && <StatCard label="Gastado" value={formatMoney(totals.spent)} hint="Suma de gastos del periodo" className="col-span-2 lg:col-span-1" />}
          </div>

          <ActivityCalendar days={days} from={period.from} to={period.to} />

          {days.length === 0 ? (
            <EmptyState
              icon={<NotebookPen />}
              title="Nada registrado en este periodo"
              description="Anota los kilómetros o un repostaje y aquí verás tu día a día."
              action={
                canOperate && (
                  <Button onClick={() => quick.run('mileage', vehicle.id)} icon={<Gauge aria-hidden />}>
                    Anotar km
                  </Button>
                )
              }
            />
          ) : (
            <ol className="space-y-3" aria-label="Días con actividad">
              {days.map((day) => (
                <DayCard key={day.date} day={day} showMoney={ctx.canExpenses} base={`${ctx.base}/vehiculos/${vehicle.id}`} />
              ))}
            </ol>
          )}
        </>
      )}
    </div>
  )
}

function DayCard({ day, showMoney, base }: { day: JournalDay; showMoney: boolean; base: string }) {
  const spent = toNumber(day.spent) ?? 0
  return (
    <li className="rounded-card border border-line bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-2.5">
        <h3 className="text-sm font-semibold capitalize text-fg">{formatDate(day.date, 'weekday')}</h3>
        <div className="flex flex-wrap gap-1.5">
          {day.km_driven !== null && <Badge icon={<Gauge aria-hidden />}>{formatKm(day.km_driven)} recorridos</Badge>}
          {showMoney && spent > 0 && <Badge tone="accent">{formatMoney(day.spent)}</Badge>}
        </div>
      </div>
      <ul className="divide-y divide-line">
        {day.entries.map((e) => (
          <EntryRow key={`${e.type}-${e.id}`} entry={e} base={base} showMoney={showMoney} />
        ))}
      </ul>
    </li>
  )
}

function entryHref(e: JournalEntry, base: string): string | null {
  switch (e.type) {
    case 'record':
      return `${base}/historial#intervencion-${e.id}`
    case 'expense':
      return `${base}/gastos`
    case 'document':
      return `${base}/documentos`
    case 'reminder_done':
      return `${base}/recordatorios?estado=done`
    default:
      return null
  }
}

function EntryRow({ entry: e, base, showMoney }: { entry: JournalEntry; base: string; showMoney: boolean }) {
  const Icon = JOURNAL_TYPE_ICON[e.type]
  const href = entryHref(e, base)
  const category = typeof e.meta.category === 'string' ? (e.meta.category as ExpenseCategory) : null
  const qty = e.meta.fuel_quantity
  const unit = typeof e.meta.fuel_unit === 'string' ? FUEL_UNIT_SHORT[e.meta.fuel_unit as FuelUnit] : null
  const detail = [
    JOURNAL_TYPE_LABEL[e.type],
    category && EXPENSE_CATEGORY_LABEL[category] ? EXPENSE_CATEGORY_LABEL[category] : null,
    qty !== undefined && qty !== null && qty !== '' ? `${formatDecimal(String(qty), 2)}${unit ? ` ${unit}` : ''}` : null,
    e.mileage !== null ? formatKm(e.mileage) : null,
  ]
    .filter(Boolean)
    .join(' · ')
  const content = (
    <>
      <span className="grid size-8 shrink-0 place-items-center rounded-control bg-surface-2 text-fg-muted">
        <Icon aria-hidden className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm text-fg">{e.title}</span>
        <span className="block truncate text-xs text-fg-muted tabular">{detail}</span>
      </span>
      {showMoney && e.amount && <span className="shrink-0 text-sm font-medium text-fg tabular">{formatMoney(e.amount)}</span>}
    </>
  )
  return (
    <li>
      {href ? (
        <Link to={href} className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-surface-2/60">
          {content}
        </Link>
      ) : (
        <div className="flex items-center gap-3 px-4 py-2.5">{content}</div>
      )}
    </li>
  )
}

/** Calendario de actividad (decorativo: la lista de días es la versión accesible). */
function ActivityCalendar({ days, from, to }: { days: JournalDay[]; from: string; to: string }) {
  const byDate = new Map(days.map((d) => [d.date, d.entries.length]))
  const start = parseISODate(from)
  const end = parseISODate(to)
  // Empieza en lunes para alinear filas por día de la semana
  const offset = (start.getDay() + 6) % 7
  const gridStart = addDays(start, -offset)
  const total = daysBetween(gridStart, end) + 1
  const weeks = Math.ceil(total / 7)
  const cells = Array.from({ length: weeks * 7 }, (_, i) => {
    const date = addDays(gridStart, i)
    const iso = toISODate(date)
    const inRange = date >= start && date <= end
    return { iso, inRange, count: byDate.get(iso) ?? 0 }
  })
  const level = (n: number) => (n === 0 ? 'bg-surface-3' : n === 1 ? 'bg-accent/35' : n <= 3 ? 'bg-accent/65' : 'bg-accent')

  return (
    <div aria-hidden className="overflow-x-auto rounded-card border border-line bg-surface p-4">
      <div className="grid w-max grid-flow-col grid-rows-7 gap-1">
        {cells.map((c) => (
          <span key={c.iso} title={c.inRange ? `${formatDate(c.iso)}: ${c.count} ${c.count === 1 ? 'registro' : 'registros'}` : undefined} className={cn('size-3 rounded-[3px]', c.inRange ? level(c.count) : 'bg-transparent')} />
        ))}
      </div>
      <div className="mt-3 flex items-center gap-1.5 text-[11px] text-fg-subtle">
        Menos
        {[0, 1, 2, 4].map((n) => (
          <span key={n} className={cn('size-3 rounded-[3px]', level(n))} />
        ))}
        Más
      </div>
    </div>
  )
}

function MileageLogs() {
  const { vehicle } = useVehicleOutlet()
  const ctx = useWorkspace()
  const quick = useQuickActions()
  const logs = useMileageLogs(vehicle.id)
  const remove = useDeleteMileage(vehicle.id)
  const [deleting, setDeleting] = useState<MileageLog | null>(null)
  const items = flattenPages(logs.data)
  const canOperate = ctx.can('operate') && !vehicle.archived_at

  if (logs.isPending)
    return (
      <div role="status" className="space-y-2">
        <span className="sr-only">Cargando lecturas…</span>
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-14 w-full rounded-card" />
        ))}
      </div>
    )
  if (logs.isError) return <ErrorState error={logs.error} onRetry={() => void logs.refetch()} />
  if (!items.length)
    return (
      <EmptyState
        icon={<Gauge />}
        title="Sin lecturas de kilometraje"
        description="Cada vez que anotas los km, registras una intervención o un repostaje con km, queda aquí."
        action={canOperate && <Button onClick={() => quick.run('mileage', vehicle.id)}>Anotar km</Button>}
      />
    )

  return (
    <>
      <div className="overflow-hidden rounded-card border border-line bg-surface">
        <table className="w-full text-sm">
          <caption className="sr-only">Lecturas de kilometraje, de la más reciente a la más antigua</caption>
          <thead className="border-b border-line bg-surface-2/50 text-left text-xs text-fg-subtle">
            <tr>
              <th scope="col" className="px-4 py-2.5 font-medium">
                Fecha
              </th>
              <th scope="col" className="px-4 py-2.5 text-right font-medium">
                Kilómetros
              </th>
              <th scope="col" className="hidden px-4 py-2.5 font-medium sm:table-cell">
                Origen
              </th>
              <th scope="col" className="px-2 py-2.5">
                <span className="sr-only">Acciones</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {items.map((log) => (
              <tr key={log.id}>
                <td className="px-4 py-2.5 tabular">
                  <span className="text-fg">{formatDate(log.recorded_at)}</span>
                  {log.note && <span className="block text-xs text-fg-muted">{log.note}</span>}
                  <span className="block text-xs text-fg-subtle sm:hidden">{MILEAGE_SOURCE_LABEL[log.source]}</span>
                </td>
                <td className="px-4 py-2.5 text-right font-medium text-fg tabular">{formatKm(log.mileage)}</td>
                <td className="hidden px-4 py-2.5 text-fg-muted sm:table-cell">{MILEAGE_SOURCE_LABEL[log.source]}</td>
                <td className="px-2 py-1 text-right">
                  {canOperate && log.source === 'manual' && (
                    <IconButton label={`Borrar la lectura de ${formatKm(log.mileage)} del ${formatDate(log.recorded_at)}`} onClick={() => setDeleting(log)}>
                      <Trash2 aria-hidden />
                    </IconButton>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-fg-subtle">Solo se pueden borrar las lecturas manuales; las demás se gestionan desde su intervención, gasto u orden.</p>
      <LoadMore hasNextPage={!!logs.hasNextPage} isFetchingNextPage={logs.isFetchingNextPage} fetchNextPage={logs.fetchNextPage} shown={items.length} total={totalFromPages(logs.data)} what="lecturas" />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="¿Borrar esta lectura?"
        description={deleting ? `${formatKm(deleting.mileage)} el ${formatDate(deleting.recorded_at)}. El kilometraje actual se recalculará con las demás lecturas.` : undefined}
        confirmLabel="Borrar lectura"
        loading={remove.isPending}
        onConfirm={() =>
          deleting &&
          remove.mutate(deleting.id, {
            onSuccess: () => {
              toast.success('Lectura borrada')
              setDeleting(null)
            },
            onError: (err) => toast.error(errorMessage(err)),
          })
        }
      />
    </>
  )
}
