import { AlarmClockPlus, CircleCheck, EllipsisVertical, Pencil, Trash2, X } from 'lucide-react'
import type { ComponentProps } from 'react'
import { Link } from 'react-router'
import type { Reminder } from '@/api/types'
import { StatusPill } from '@/components/ui/Badge'
import { Button, IconButton } from '@/components/ui/Button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/DropdownMenu'
import { cn } from '@/lib/cn'
import { formatDate, formatKm, formatPlate } from '@/lib/format'
import { REMINDER_STATUS_LABEL } from '@/lib/labels'
import { dueShort, recurrenceText } from '@/lib/reminders'
import { REMINDER_STATE, TONE_CLASSES } from '@/lib/status'

export interface ReminderActions {
  onComplete?: (r: Reminder) => void
  onEdit?: (r: Reminder) => void
  /** Mover el vencimiento más adelante (fecha y/o km). */
  onPostpone?: (r: Reminder) => void
  onDismiss?: (r: Reminder) => void
  onDelete?: (r: Reminder) => void
}

/** Lista de recordatorios: filas con separador fino, sin cajas (reglas R3 y R4 del informe de UX). */
export function ReminderList({ className, ...props }: ComponentProps<'ul'>) {
  return <ul className={cn('divide-y divide-line border-y border-line', className)} {...props} />
}

/**
 * Fila de recordatorio: estado · título · vehículo · cuándo · "Marcar hecho" · menú.
 * - Píldora solo para lo que pide atención (Vencido, Próximo); "En plazo" y "Sin datos" van como texto (R5).
 * - Cuando está vencido, la causa va primero ("pasado en 443 km", hallazgo C4).
 * - El aviso "Según tus intervalos, no medido" lo pone la sección una vez, no cada fila (R9).
 * `compact` quita el progreso y la repetición.
 */
export function ReminderItem({
  reminder,
  vehicleLink,
  actions = {},
  compact,
  highlighted,
}: {
  reminder: Reminder
  /** Si se indica, muestra el vehículo enlazado (agenda, inicio). */
  vehicleLink?: string
  actions?: ReminderActions
  compact?: boolean
  /** Destino de un enlace `#recordatorio-{id}`: se resalta y puede recibir el foco. */
  highlighted?: boolean
}) {
  const state = reminder.state ? REMINDER_STATE[reminder.state] : null
  const pending = reminder.status === 'pending'
  const attention = pending && (reminder.state === 'overdue' || reminder.state === 'soon')
  const hasMenu = pending && !!(actions.onEdit || actions.onPostpone || actions.onDismiss || actions.onDelete)
  const pct = reminder.progress === null ? null : Math.round(reminder.progress * 100)
  const recurrence = recurrenceText(reminder)
  const StateIcon = state?.icon

  const when =
    reminder.status === 'done'
      ? `Hecho el ${formatDate(reminder.completed_at)}${reminder.completed_mileage !== null ? ` a ${formatKm(reminder.completed_mileage)}` : ''}`
      : dueShort(reminder)
  const extra = pending && !compact ? [pct !== null ? `${pct} % del intervalo` : null, recurrence].filter(Boolean).join(' · ') : ''

  return (
    <li
      id={`recordatorio-${reminder.id}`}
      tabIndex={highlighted ? -1 : undefined}
      className={cn(
        'flex scroll-mt-32 items-start gap-2 py-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:gap-3',
        highlighted && 'rounded-control bg-surface-2 px-2',
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {attention && state ? (
            <StatusPill status={state} size="sm" />
          ) : pending && state && StateIcon ? (
            <span className={cn('inline-flex items-center gap-1 text-xs', TONE_CLASSES[state.tone].text)}>
              <StateIcon aria-hidden className="size-3.5" />
              {state.label}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs text-fg-muted">
              {reminder.status === 'done' && <CircleCheck aria-hidden className="size-3.5 text-ok" />}
              {REMINDER_STATUS_LABEL[reminder.status]}
            </span>
          )}
          <h3 className="min-w-0 break-words font-medium text-fg">{reminder.title}</h3>
        </div>
        <p className="mt-0.5 text-sm text-fg-muted tabular">
          {vehicleLink && reminder.vehicle && (
            <>
              <Link to={vehicleLink} className="text-fg underline-offset-4 hover:underline">
                {reminder.vehicle.display_name}
                {reminder.vehicle.plate ? ` · ${formatPlate(reminder.vehicle.plate)}` : ''}
              </Link>
              {' · '}
            </>
          )}
          <span className={cn(pending && reminder.state === 'overdue' && 'text-danger')}>{when}</span>
        </p>
        {extra && <p className="mt-0.5 text-xs text-fg-subtle">{extra}</p>}
      </div>
      {pending && (actions.onComplete || hasMenu) && (
        <div className="flex shrink-0 items-center gap-1">
          {actions.onComplete && (
            <>
              <Button variant="ghost" size="sm" onClick={() => actions.onComplete?.(reminder)} className="max-sm:hidden" aria-label={`Marcar como hecho: ${reminder.title}`}>
                Marcar hecho
              </Button>
              <IconButton label={`Marcar como hecho: ${reminder.title}`} size="sm" onClick={() => actions.onComplete?.(reminder)} className="sm:hidden">
                <CircleCheck aria-hidden />
              </IconButton>
            </>
          )}
          {hasMenu && (
            <DropdownMenu>
              <DropdownMenuTrigger
                className="grid size-11 place-items-center rounded-control text-fg-muted hover:bg-surface-2 hover:text-fg md:size-9"
                aria-label={`Más acciones de ${reminder.title}`}
              >
                <EllipsisVertical aria-hidden className="size-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
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
    <div role="status" aria-live="polite" className="divide-y divide-line border-y border-line">
      <span className="sr-only">Cargando recordatorios…</span>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} aria-hidden className="space-y-2 py-3">
          <div className="skeleton h-4 w-1/2 rounded" />
          <div className="skeleton h-3 w-2/3 rounded" />
        </div>
      ))}
    </div>
  )
}
