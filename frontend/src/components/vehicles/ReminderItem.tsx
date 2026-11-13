import { AlarmClockPlus, CircleCheck, EllipsisVertical, Pencil, Trash2, X } from 'lucide-react'
import type { ComponentProps } from 'react'
import { Link } from 'react-router'
import type { Reminder } from '@/api/types'
import { StatusPill } from '@/components/ui/Badge'
import { Button, IconButton } from '@/components/ui/Button'
import { Progress } from '@/components/ui/Progress'
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
export function ReminderList({ className, variant = 'rows', ...props }: ComponentProps<'ul'> & { variant?: 'rows' | 'missions' }) {
  return <ul className={cn(variant === 'missions' ? 'grid gap-2.5' : 'list-panel', className)} {...props} />
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
  variant = 'row',
}: {
  reminder: Reminder
  /** Si se indica, muestra el vehículo enlazado (agenda, inicio). */
  vehicleLink?: string
  actions?: ReminderActions
  compact?: boolean
  /** Destino de un enlace `#recordatorio-{id}`: se resalta y puede recibir el foco. */
  highlighted?: boolean
  /** `mission`: tarjeta de misión (mundo «Diorama»), con barra de estado, icono y barra segmentada del intervalo. */
  variant?: 'row' | 'mission'
}) {
  const mission = variant === 'mission'
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
  // Las cifras no se parten de su unidad ni de su fecha: «617 km», «1 día», «9 nov 2026» (espacios de no separación)
  const whenText = keepTogether(when)
  const extra = pending && !compact ? [pct !== null ? `${pct} % del intervalo` : null, recurrence].filter(Boolean).join(' · ') : ''

  return (
    <li
      id={`recordatorio-${reminder.id}`}
      tabIndex={highlighted ? -1 : undefined}
      data-tone={mission && pending && state && state.tone !== 'neutral' ? state.tone : mission && reminder.status === 'done' ? 'ok' : undefined}
      className={cn(
        '@container flex scroll-mt-32 items-start gap-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-ink sm:gap-3',
        mission ? 'mission' : 'py-3',
        highlighted && (mission ? 'ring-2 ring-accent' : 'rounded-control bg-surface-2 px-2'),
      )}
    >
      {mission && (
        <span aria-hidden className={cn('grid size-10 shrink-0 place-items-center rounded-xl [&_svg]:size-5', pending && state ? TONE_CLASSES[state.tone].soft : 'bg-ok-soft text-ok')}>
          {pending && StateIcon ? <StateIcon /> : <CircleCheck />}
        </span>
      )}
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
        <p className="mt-0.5 text-sm text-fg-muted">
          {vehicleLink && reminder.vehicle && (
            <>
              <Link to={vehicleLink} className="font-bold text-fg underline decoration-fg-subtle underline-offset-4 hover:decoration-fg">
                {reminder.vehicle.display_name}
                {/* espacios de no separación: la matrícula no se parte y cada «·» va pegado a lo que le sigue */}
                {reminder.vehicle.plate && <span className="tabular">{` · ${formatPlate(reminder.vehicle.plate).replace(' ', ' ')}`}</span>}
              </Link>
            </>
          )}
          <span className={cn('@[32rem]:hidden', pending && reminder.state === 'overdue' && 'text-danger')}>
            {vehicleLink && reminder.vehicle ? ' · ' : ''}
            <span className="tabular">{whenText}</span>
          </span>
        </p>
        {extra && <p className="mt-0.5 text-xs text-fg-subtle">{extra}</p>}
        {mission && pending && !compact && pct !== null && (
          <Progress value={reminder.progress} tone={state?.tone ?? 'accent'} label={`Intervalo de ${reminder.title}`} valueText={`${pct} % del intervalo`} className="mt-2 max-w-xs" />
        )}
      </div>
      {/* el plazo, pegado al margen derecho con cifras tabulares (en filas estrechas va bajo el título) */}
      <p className={cn('tabular hidden max-w-[14rem] shrink-0 self-center text-right text-sm @[32rem]:block', pending && reminder.state === 'overdue' ? 'text-danger' : 'text-fg-muted')}>{whenText}</p>
      {pending && (actions.onComplete || hasMenu) && (
        <div className="flex shrink-0 items-center gap-1">
          {actions.onComplete && (
            <>
              <Button variant="ghost" size="sm" onClick={() => actions.onComplete?.(reminder)} className="hidden @[40rem]:inline-flex" aria-label={`Marcar hecho: ${reminder.title}`}>
                Marcar hecho
              </Button>
              <IconButton label={`Marcar como hecho: ${reminder.title}`} size="sm" onClick={() => actions.onComplete?.(reminder)} className="@[40rem]:hidden">
                <CircleCheck aria-hidden />
              </IconButton>
            </>
          )}
          {hasMenu && (
            <DropdownMenu>
              <DropdownMenuTrigger
                className="grid size-12 place-items-center rounded-control text-fg-muted hover:bg-surface-2 hover:text-fg lg:size-9"
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
    <div role="status" aria-live="polite" className="list-panel">
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

/** Une con espacios de no separación cada cifra con lo que la acompaña (unidad, mes, año). */
function keepTogether(text: string): string {
  const NBSP = String.fromCharCode(0xa0)
  return text.replace(/(\d) (?=\S)/g, `$1${NBSP}`).replace(/(\p{L}) (?=\d{4}\b)/gu, `$1${NBSP}`)
}
