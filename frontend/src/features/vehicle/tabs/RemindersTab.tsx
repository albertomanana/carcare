import { BellPlus, CalendarClock } from 'lucide-react'
import { lazy, Suspense, useState } from 'react'
import { useReminders } from '@/api/hooks/records'
import type { ReminderStatus } from '@/api/types'
import { Button } from '@/components/ui/Button'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { EmptyState, ErrorState } from '@/components/ui/States'
import { ReminderItem, ReminderListSkeleton } from '@/components/vehicles/ReminderItem'
import { useWorkspace } from '@/features/workspace/workspace-context'
import { useSearchParam } from '@/hooks/useSearchParam'
import { formatKm } from '@/lib/format'
import { INTERVAL_DISCLAIMER } from '@/lib/reminders'
import { useReminderActions } from '../useReminderActions'
import { useVehicleOutlet } from '../vehicle-outlet'

const ReminderDialog = lazy(() => import('../dialogs/ReminderDialog'))

const STATUSES: { value: ReminderStatus | 'all'; label: string }[] = [
  { value: 'pending', label: 'Pendientes' },
  { value: 'done', label: 'Hechos' },
  { value: 'dismissed', label: 'Descartados' },
  { value: 'all', label: 'Todos' },
]

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

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <SegmentedControl label="Estado de los recordatorios" size="sm" value={status} onValueChange={(v) => setStatus(v)} options={STATUSES.map((s) => ({ value: s.value, label: s.label }))} className="max-w-full overflow-x-auto" />
        {canOperate && (
          <Button icon={<BellPlus aria-hidden />} onClick={() => setCreating(true)} className="sm:ml-auto">
            Nuevo recordatorio
          </Button>
        )}
      </div>
      <p className="text-xs text-fg-subtle">
        {INTERVAL_DISCLAIMER}. El estado se calcula con la fecha de hoy y el kilometraje actual ({formatKm(vehicle.current_mileage, { empty: 'sin lecturas' })}).
      </p>

      {query.isPending ? (
        <ReminderListSkeleton />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : reminders.length === 0 ? (
        <EmptyState
          icon={<CalendarClock />}
          title={status === 'pending' ? 'No hay recordatorios pendientes' : 'Nada por aquí'}
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
      ) : (
        <ul className="space-y-3">
          {reminders.map((r) => (
            <ReminderItem key={r.id} reminder={r} actions={actions} />
          ))}
        </ul>
      )}

      <Suspense fallback={null}>{creating && <ReminderDialog vehicle={vehicle} open onOpenChange={(o) => !o && setCreating(false)} />}</Suspense>
      {dialogs}
    </div>
  )
}
