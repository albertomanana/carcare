import { BellPlus, CalendarClock, ChevronRight } from 'lucide-react'
import { lazy, Suspense, useState } from 'react'
import { useReminders } from '@/api/hooks/records'
import type { Reminder, ReminderState, ReminderStatus } from '@/api/types'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/inputs'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { EmptyState, ErrorState } from '@/components/ui/States'
import { ReminderItem, ReminderList, ReminderListSkeleton } from '@/components/vehicles/ReminderItem'
import { useWorkspace } from '@/features/workspace/workspace-context'
import { useHashTarget, useRevealHashTarget } from '@/hooks/useHashTarget'
import { useSearchParam } from '@/hooks/useSearchParam'
import { cn } from '@/lib/cn'
import { formatKm } from '@/lib/format'
import { INTERVAL_DISCLAIMER } from '@/lib/reminders'
import { REMINDER_STATE, REMINDER_STATE_ORDER, TONE_CLASSES } from '@/lib/status'
import { useReminderActions } from '../useReminderActions'
import { useVehicleOutlet } from '../vehicle-outlet'

const ReminderDialog = lazy(() => import('../dialogs/ReminderDialog'))

const STATUSES: { value: ReminderStatus | 'all'; label: string }[] = [
  { value: 'pending', label: 'Pendientes' },
  { value: 'done', label: 'Hechos' },
  { value: 'dismissed', label: 'Descartados' },
  { value: 'all', label: 'Todos' },
]

const GROUP_TITLE: Record<ReminderState, string> = {
  overdue: 'Vencidos',
  soon: 'Próximos',
  ok: 'En plazo',
  unknown: 'Sin datos para calcular',
}

/** Los grupos que no piden atención empiezan plegados, como en la agenda (5.5). */
const FOLDED: ReminderState[] = ['ok', 'unknown']

/**
 * Recordatorios de la ficha (5.2 del informe de UX): lista compacta. Los pendientes van por grupos de urgencia
 * (Vencidos · Próximos · En plazo ▸ · Sin datos ▸); el aviso "según tus intervalos" sale una vez (R9).
 */
export default function RemindersTab() {
  const { vehicle } = useVehicleOutlet()
  const ctx = useWorkspace()
  const [statusParam, setStatus] = useSearchParam('estado', 'pending')
  const status = (STATUSES.find((s) => s.value === statusParam)?.value ?? 'pending') as ReminderStatus | 'all'
  const query = useReminders(vehicle.id, status)
  const [creating, setCreating] = useState(false)
  const canOperate = ctx.can('operate') && !vehicle.archived_at
  const { actions, dialogs } = useReminderActions({ canOperate, currentMileage: vehicle.current_mileage })
  const reminders = query.data ?? []
  const hashId = useHashTarget('recordatorio')
  useRevealHashTarget({ id: hashId, prefix: 'recordatorio', ready: !query.isPending, found: !!hashId && reminders.some((r) => String(r.id) === hashId) })
  const statusLabel = STATUSES.find((s) => s.value === status)?.label ?? ''

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        {/* En el móvil, selector nativo: las 4 opciones no caben en una fila y no se esconden en un scroll lateral (I4) */}
        <Select aria-label="Estado de los recordatorios" value={status} onChange={(e) => setStatus(e.target.value)} className="sm:hidden">
          {STATUSES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </Select>
        <SegmentedControl label="Estado de los recordatorios" size="sm" value={status} onValueChange={(v) => setStatus(v)} options={STATUSES} className="max-sm:hidden" />
        {canOperate && (
          <Button icon={<BellPlus aria-hidden />} onClick={() => setCreating(true)} className="sm:ml-auto">
            Nuevo recordatorio
          </Button>
        )}
      </div>
      <p className="text-sm text-fg-muted">
        {INTERVAL_DISCLAIMER}. El estado se calcula con la fecha de hoy y el kilometraje actual ({formatKm(vehicle.current_mileage, { empty: 'sin lecturas' })}).
      </p>

      {query.isPending ? (
        <ReminderListSkeleton />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : reminders.length === 0 ? (
        <EmptyState
          compact
          icon={<CalendarClock />}
          title={status === 'pending' ? 'No hay recordatorios pendientes' : `Sin recordatorios en «${statusLabel.toLowerCase()}»`}
          description={status === 'pending' ? 'ITV, seguro, impuesto, aceite, neumáticos… Por fecha, por kilómetros o lo que llegue antes.' : undefined}
          action={
            canOperate &&
            status === 'pending' && (
              <Button icon={<BellPlus aria-hidden />} onClick={() => setCreating(true)}>
                Nuevo recordatorio
              </Button>
            )
          }
        />
      ) : status === 'pending' ? (
        <div className="space-y-8">
          {REMINDER_STATE_ORDER.map((state) => {
            const items = reminders.filter((r) => (r.state ?? 'unknown') === state)
            if (!items.length) return null
            return <Group key={state} state={state} items={items} actions={actions} hashId={hashId} />
          })}
        </div>
      ) : (
        <>
          <h2 id="recordatorios-lista" className="sr-only">
            Recordatorios: {statusLabel.toLowerCase()}
          </h2>
          <ReminderList aria-labelledby="recordatorios-lista">
            {reminders.map((r) => (
              <ReminderItem key={r.id} reminder={r} actions={actions} highlighted={hashId === String(r.id)} />
            ))}
          </ReminderList>
        </>
      )}

      <Suspense fallback={null}>{creating && <ReminderDialog vehicle={vehicle} open onOpenChange={(o) => !o && setCreating(false)} />}</Suspense>
      {dialogs}
    </div>
  )
}

function Group({ state, items, actions, hashId }: { state: ReminderState; items: Reminder[]; actions: ReturnType<typeof useReminderActions>['actions']; hashId: string | null }) {
  const folded = FOLDED.includes(state)
  // Si un enlace `#recordatorio-{id}` apunta a un grupo plegado, empieza abierto para poder llevar el foco
  const [open, setOpen] = useState(!folded || items.some((r) => String(r.id) === hashId))
  const st = REMINDER_STATE[state]
  const Icon = st.icon
  const titleId = `recordatorios-${state}-title`
  const listId = `recordatorios-${state}-lista`
  const heading = (
    <span className="inline-flex items-center gap-2">
      <Icon aria-hidden className={cn('size-4', TONE_CLASSES[st.tone].text)} />
      {GROUP_TITLE[state]}
      <span className="font-normal text-fg-muted tabular">({items.length})</span>
    </span>
  )
  return (
    <section aria-labelledby={titleId} className="min-w-0">
      <h2 id={titleId} className="mb-1 font-display text-base font-semibold tracking-tight text-fg-warm">
        {folded ? (
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-controls={open ? listId : undefined}
            className="inline-flex min-h-11 items-center gap-1 rounded-control text-left hover:text-fg md:min-h-9"
          >
            <ChevronRight aria-hidden className={cn('size-4 text-fg-subtle transition-transform duration-150 ease-out-soft motion-reduce:transition-none', open && 'rotate-90')} />
            {heading}
          </button>
        ) : (
          heading
        )}
      </h2>
      {open && (
        <ReminderList id={listId}>
          {items.map((r) => (
            <ReminderItem key={r.id} reminder={r} actions={actions} highlighted={hashId === String(r.id)} />
          ))}
        </ReminderList>
      )}
    </section>
  )
}
