import { AlarmClockPlus, CalendarDays, CircleCheck, EllipsisVertical, Gauge, Pencil, Repeat, Trash2, X } from 'lucide-react'
import { Link } from 'react-router'
import type { Reminder } from '@/api/types'
import { Badge, StatusPill } from '@/components/ui/Badge'
import { Button, IconButton } from '@/components/ui/Button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/DropdownMenu'
import { Progress } from '@/components/ui/Progress'
import { cn } from '@/lib/cn'
import { formatDate, formatKm } from '@/lib/format'
import { REMINDER_KIND_ICON, REMINDER_STATUS_LABEL, ZONE_LABEL } from '@/lib/labels'
import { dueByDate, dueByMileage, INTERVAL_DISCLAIMER, recurrenceText } from '@/lib/reminders'
import { REMINDER_STATE } from '@/lib/status'
import { VehicleSwatch } from './VehicleVisuals'

export interface ReminderActions {
  onComplete?: (r: Reminder) => void
  onEdit?: (r: Reminder) => void
  /** Mover el vencimiento más adelante (fecha y/o km). */
  onPostpone?: (r: Reminder) => void
  onDismiss?: (r: Reminder) => void
  onDelete?: (r: Reminder) => void
}

/** Fila de recordatorio: estado con icono + texto, vencimientos y progreso según los intervalos del usuario. */
export function ReminderItem({
  reminder,
  vehicleLink,
  actions = {},
  compact,
}: {
  reminder: Reminder
  /** Si se indica, muestra el vehículo enlazado (agenda, dashboards). */
  vehicleLink?: string
  actions?: ReminderActions
  compact?: boolean
}) {
  const Icon = REMINDER_KIND_ICON[reminder.kind]
  const state = reminder.state ? REMINDER_STATE[reminder.state] : null
  const byDate = dueByDate(reminder)
  const byKm = dueByMileage(reminder)
  // Lo vencido primero; si no, fecha y después km
  const dueParts = [
    byDate && { key: 'date', term: 'Por fecha', Icon: CalendarDays, part: byDate },
    byKm && { key: 'km', term: 'Por kilómetros', Icon: Gauge, part: byKm },
  ]
    .filter((p): p is NonNullable<typeof p> => !!p)
    .sort((a, b) => Number(b.part.overdue) - Number(a.part.overdue))
  const recurrence = recurrenceText(reminder)
  const pending = reminder.status === 'pending'
  const hasMenu = pending && !!(actions.onEdit || actions.onPostpone || actions.onDismiss || actions.onDelete)
  const progressTone = state?.tone === 'danger' ? 'danger' : state?.tone === 'warning' ? 'warning' : state?.tone === 'ok' ? 'ok' : 'neutral'
  const pct = reminder.progress === null ? null : Math.round(reminder.progress * 100)

  return (
    <li className={cn('flex gap-3 rounded-card border border-line bg-surface', compact ? 'p-3' : 'p-4')}>
      <span
        aria-hidden
        className={cn(
          'mt-0.5 grid shrink-0 place-items-center rounded-control bg-surface-2 text-fg-muted',
          compact ? 'size-9 [&_svg]:size-4' : 'size-10 [&_svg]:size-5',
          state?.tone === 'danger' && 'bg-danger-soft text-danger',
          state?.tone === 'warning' && 'bg-warning-soft text-warning',
        )}
      >
        <Icon />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <h3 className="min-w-0 truncate font-medium text-fg">{reminder.title}</h3>
          {pending && state ? <StatusPill status={state} size="sm" /> : <Badge size="sm">{REMINDER_STATUS_LABEL[reminder.status]}</Badge>}
        </div>
        {vehicleLink && reminder.vehicle && (
          <Link to={vehicleLink} className="mt-1 inline-flex max-w-full items-center gap-1.5 text-sm text-fg-muted hover:text-fg">
            <VehicleSwatch vehicle={reminder.vehicle} size="sm" className="size-5 [&_svg]:size-3" />
            <span className="truncate">
              {reminder.vehicle.display_name}
              {reminder.vehicle.plate ? ` · ${reminder.vehicle.plate}` : ''}
            </span>
          </Link>
        )}
        <dl className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm">
          {dueParts.map(({ key, term, Icon: DueIcon, part }) => (
            <div key={key} className="flex items-center gap-1.5">
              <dt className="sr-only">{term}</dt>
              <DueIcon aria-hidden className="size-4 shrink-0 text-fg-subtle" />
              <dd className="tabular">
                {/* Si ya venció, la causa va primero (hallazgo C4): «superado por 443 km · A los 81.127 km» */}
                {part.overdue && part.relative ? (
                  <>
                    <span className="text-danger">{part.relative}</span>
                    <span className="ml-1 text-fg-muted">· {part.label}</span>
                  </>
                ) : (
                  <>
                    <span className="text-fg">{part.label}</span>
                    {part.relative && <span className="ml-1 text-fg-muted">· {part.relative}</span>}
                  </>
                )}
              </dd>
            </div>
          ))}
          {reminder.status === 'done' && (
            <div className="flex items-center gap-1.5 text-fg-muted">
              <dt className="sr-only">Completado</dt>
              <CircleCheck aria-hidden className="size-4 text-ok" />
              <dd className="tabular">
                Hecho el {formatDate(reminder.completed_at)}
                {reminder.completed_mileage !== null ? ` a ${formatKm(reminder.completed_mileage)}` : ''}
              </dd>
            </div>
          )}
        </dl>
        {pending && !compact && (
          <div className="mt-3 max-w-md">
            <Progress
              value={reminder.progress}
              tone={progressTone}
              label={`Intervalo transcurrido de ${reminder.title}`}
              valueText={pct === null ? 'Sin datos suficientes' : `${pct} % del intervalo`}
            />
            <p className="mt-1 flex flex-wrap justify-between gap-x-3 text-[11px] text-fg-subtle">
              <span>{INTERVAL_DISCLAIMER}</span>
              <span>
                {pct === null ? 'Progreso no calculable' : `${pct} % del intervalo`} · {ZONE_LABEL[reminder.zone]}
              </span>
            </p>
          </div>
        )}
        {recurrence && !compact && (
          <p className="mt-2 flex items-center gap-1.5 text-xs text-fg-muted">
            <Repeat aria-hidden className="size-3.5" />
            {recurrence}
          </p>
        )}
      </div>
      {pending && (actions.onComplete || hasMenu) && (
        <div className="flex shrink-0 items-start gap-1">
          {actions.onComplete &&
            (compact ? (
              <IconButton label={`Marcar como hecho: ${reminder.title}`} variant="secondary" size="sm" onClick={() => actions.onComplete?.(reminder)}>
                <CircleCheck aria-hidden />
              </IconButton>
            ) : (
              <Button size="sm" onClick={() => actions.onComplete?.(reminder)} icon={<CircleCheck aria-hidden />} className="max-sm:px-2.5" aria-label={`Marcar como hecho: ${reminder.title}`}>
                <span className="max-sm:sr-only">Hecho</span>
              </Button>
            ))}
          {hasMenu && (
            <DropdownMenu>
              <DropdownMenuTrigger
                className="grid size-11 place-items-center rounded-control text-fg-muted hover:bg-surface-2 hover:text-fg md:size-9"
                aria-label={`Más acciones de ${reminder.title}`}
              >
                <EllipsisVertical aria-hidden className="size-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {actions.onEdit && (
                  <DropdownMenuItem icon={<Pencil aria-hidden />} onSelect={() => actions.onEdit?.(reminder)}>
                    Editar
                  </DropdownMenuItem>
                )}
                {actions.onPostpone && (
                  <DropdownMenuItem icon={<AlarmClockPlus aria-hidden />} onSelect={() => actions.onPostpone?.(reminder)}>
                    Posponer
                  </DropdownMenuItem>
                )}
                {actions.onDismiss && (
                  <DropdownMenuItem icon={<X aria-hidden />} onSelect={() => actions.onDismiss?.(reminder)}>
                    Descartar
                  </DropdownMenuItem>
                )}
                {actions.onDelete && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem danger icon={<Trash2 aria-hidden />} onSelect={() => actions.onDelete?.(reminder)}>
                      Eliminar
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      )}
    </li>
  )
}

export function ReminderListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div role="status" aria-live="polite" className="space-y-3">
      <span className="sr-only">Cargando recordatorios…</span>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} aria-hidden className="flex gap-3 rounded-card border border-line bg-surface p-4">
          <div className="skeleton size-10 rounded-control" />
          <div className="flex-1 space-y-2">
            <div className="skeleton h-4 w-1/2 rounded" />
            <div className="skeleton h-3 w-2/3 rounded" />
            <div className="skeleton h-1.5 w-full max-w-md rounded" />
          </div>
        </div>
      ))}
    </div>
  )
}
