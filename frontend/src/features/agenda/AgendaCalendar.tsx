import { CalendarX2, ChevronLeft, ChevronRight } from 'lucide-react'
import { type KeyboardEvent, useEffect, useMemo, useRef } from 'react'
import type { ISODate, Reminder } from '@/api/types'
import { Button, IconButton } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/States'
import { ReminderItem, type ReminderActions } from '@/components/vehicles/ReminderItem'
import { groupByDueDate, monthGrid, monthKey, nextDueDate, parseMonthKey, shiftMonth, worstState } from '@/lib/agenda'
import { cn } from '@/lib/cn'
import { addDays, formatDate, formatMonth, parseISODate, toISODate, todayISO } from '@/lib/format'
import { REMINDER_STATE, TONE_CLASSES } from '@/lib/status'
import { plural } from '@/lib/text'

const WEEKDAYS = [
  { short: 'L', long: 'lunes' },
  { short: 'M', long: 'martes' },
  { short: 'X', long: 'miércoles' },
  { short: 'J', long: 'jueves' },
  { short: 'V', long: 'viernes' },
  { short: 'S', long: 'sábado' },
  { short: 'D', long: 'domingo' },
]

export interface AgendaCalendarProps {
  reminders: Reminder[]
  /** Día seleccionado 'YYYY-MM-DD': su mes es el mes visible. */
  selected: ISODate
  onSelect: (date: ISODate) => void
  actions: ReminderActions
  vehicleLink: (r: Reminder) => string
}

function dayLabel(date: ISODate, items: Reminder[]): string {
  const base = formatDate(date, 'weekday')
  if (!items.length) return `${base}: sin vencimientos`
  const overdue = items.filter((r) => r.state === 'overdue').length
  const soon = items.filter((r) => r.state === 'soon').length
  const extra = [overdue ? plural(overdue, 'vencido', 'vencidos') : null, soon ? plural(soon, 'próximo', 'próximos') : null].filter(Boolean).join(', ')
  return `${base}: ${plural(items.length, 'vencimiento', 'vencimientos')}${extra ? ` (${extra})` : ''}`
}

/**
 * Calendario mensual de vencimientos por fecha. Rejilla de botones con «tabindex itinerante»:
 * flechas para moverse por días/semanas, Inicio/Fin para la semana, RePág/AvPág para el mes.
 */
export function AgendaCalendar({ reminders, selected, onSelect, actions, vehicleLink }: AgendaCalendarProps) {
  const today = todayISO()
  const month = selected.slice(0, 7)
  const weeks = useMemo(() => monthGrid(month, today), [month, today])
  const byDate = useMemo(() => groupByDueDate(reminders), [reminders])
  const gridRef = useRef<HTMLTableElement>(null)
  const focusPending = useRef(false)
  const monthTitle = formatMonth(month, 'long')
  const inMonthCount = reminders.filter((r) => r.due_date?.startsWith(month)).length
  const selectedItems = byDate.get(selected) ?? []
  const nextDue = nextDueDate(reminders, selected > today ? selected : today)

  // Tras moverse con el teclado a otro día (o mes), el foco sigue al día seleccionado
  useEffect(() => {
    if (!focusPending.current) return
    focusPending.current = false
    gridRef.current?.querySelector<HTMLButtonElement>(`button[data-date="${selected}"]`)?.focus()
  }, [selected, month])

  const goTo = (date: ISODate, focus = false) => {
    focusPending.current = focus
    onSelect(date)
  }

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, date: ISODate) => {
    const d = parseISODate(date)
    const weekday = (d.getDay() + 6) % 7
    let next: Date | null = null
    switch (e.key) {
      case 'ArrowLeft':
        next = addDays(d, -1)
        break
      case 'ArrowRight':
        next = addDays(d, 1)
        break
      case 'ArrowUp':
        next = addDays(d, -7)
        break
      case 'ArrowDown':
        next = addDays(d, 7)
        break
      case 'Home':
        next = addDays(d, -weekday)
        break
      case 'End':
        next = addDays(d, 6 - weekday)
        break
      case 'PageUp':
      case 'PageDown': {
        const target = parseMonthKey(shiftMonth(month, e.key === 'PageUp' ? -1 : 1)) ?? d
        const last = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate()
        next = new Date(target.getFullYear(), target.getMonth(), Math.min(d.getDate(), last))
        break
      }
      default:
        return
    }
    e.preventDefault()
    goTo(toISODate(next), true)
  }

  const changeMonth = (delta: number) => {
    const key = shiftMonth(month, delta)
    // Al cambiar de mes se selecciona el día 1 (u hoy si es el mes actual)
    onSelect(key === monthKey(new Date()) ? today : `${key}-01`)
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <div className="min-w-0 rounded-card border border-line bg-surface p-3 sm:p-5">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <h2 className="min-w-0 flex-1 basis-full font-display sm:basis-auto text-lg font-semibold tracking-tight text-fg-warm first-letter:uppercase" aria-live="polite">
            {monthTitle}
            <span className="sr-only">. {plural(inMonthCount, 'vencimiento', 'vencimientos')} este mes.</span>
          </h2>
          <Button size="sm" variant="ghost" className="mr-auto border border-line sm:mr-0" onClick={() => goTo(today)} disabled={selected === today}>
            Hoy
          </Button>
          <IconButton label="Mes anterior" variant="secondary" size="sm" onClick={() => changeMonth(-1)}>
            <ChevronLeft aria-hidden />
          </IconButton>
          <IconButton label="Mes siguiente" variant="secondary" size="sm" onClick={() => changeMonth(1)}>
            <ChevronRight aria-hidden />
          </IconButton>
        </div>

        <p id="agenda-cal-help" className="sr-only">
          Usa las flechas para cambiar de día, Inicio y Fin para ir al principio o al final de la semana, y Retroceder página o Avanzar página para cambiar de mes.
        </p>
        <table ref={gridRef} className="w-full table-fixed border-collapse" aria-label={`Vencimientos de ${monthTitle}`} aria-describedby="agenda-cal-help">
          <thead>
            <tr>
              {WEEKDAYS.map((w) => (
                <th key={w.short} scope="col" abbr={w.long} className="pb-2 text-center text-xs font-medium uppercase tracking-wider text-fg-subtle">
                  {w.short}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {weeks.map((week) => (
              <tr key={week[0].date}>
                {week.map((day) => {
                  const items = byDate.get(day.date) ?? []
                  const worst = worstState(items)
                  const isSelected = day.date === selected
                  return (
                    <td key={day.date} className="p-0.5 align-top sm:p-1">
                      <button
                        type="button"
                        data-date={day.date}
                        tabIndex={isSelected ? 0 : -1}
                        aria-pressed={isSelected}
                        aria-label={dayLabel(day.date, items)}
                        aria-current={day.isToday ? 'date' : undefined}
                        onClick={() => goTo(day.date)}
                        onKeyDown={(e) => onKeyDown(e, day.date)}
                        className={cn(
                          'flex h-14 w-full flex-col items-center gap-1 rounded-control border p-1 text-left transition-colors duration-150 sm:h-24 sm:items-stretch sm:p-1.5',
                          day.inMonth ? 'bg-surface-2/50 text-fg' : 'bg-transparent text-fg-subtle',
                          isSelected ? 'border-accent ring-1 ring-accent' : 'border-transparent hover:border-line-strong',
                        )}
                      >
                        <span
                          className={cn(
                            'grid size-6 shrink-0 place-items-center rounded-full text-xs font-medium tabular sm:size-7 sm:text-sm',
                            day.isToday && 'bg-accent font-semibold text-on-accent',
                          )}
                        >
                          {day.day}
                        </span>
                        {items.length > 0 && (
                          <>
                            {/* Móvil: icono del peor estado + número (nunca solo color) */}
                            {worst && <DayBadge count={items.length} state={worst} />}
                            {/* Escritorio: los dos primeros títulos con su icono de estado */}
                            <span aria-hidden className="hidden min-w-0 flex-col gap-0.5 sm:flex">
                              {items.slice(0, 2).map((r) => {
                                const st = r.state ? REMINDER_STATE[r.state] : null
                                const Icon = st?.icon
                                return (
                                  <span key={r.id} className={cn('flex min-w-0 items-center gap-1 rounded px-1 py-px text-[11px] leading-4', st ? TONE_CLASSES[st.tone].soft : 'bg-surface-3 text-fg-muted')}>
                                    {Icon && <Icon className="size-3 shrink-0" />}
                                    <span className="truncate">{r.title}</span>
                                  </span>
                                )
                              })}
                              {items.length > 2 && <span className="px-1 text-[11px] text-fg-muted">+{items.length - 2} más</span>}
                            </span>
                          </>
                        )}
                      </button>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <section aria-labelledby="agenda-day-title" className="min-w-0">
        <h2 id="agenda-day-title" className="mb-3 font-display text-lg font-semibold tracking-tight text-fg-warm first-letter:uppercase">
          {formatDate(selected, 'weekday')}
          {selected === today && <span className="ml-2 text-sm font-normal text-fg-muted">(hoy)</span>}
        </h2>
        {selectedItems.length ? (
          <ul className="space-y-2" aria-label={`Vencimientos del ${formatDate(selected, 'long')}`}>
            {selectedItems.map((r) => (
              <ReminderItem key={r.id} reminder={r} compact actions={actions} vehicleLink={vehicleLink(r)} />
            ))}
          </ul>
        ) : (
          <EmptyState
            compact
            icon={<CalendarX2 />}
            title="Nada vence este día"
            description={
              nextDue
                ? `El siguiente vencimiento por fecha es el ${formatDate(nextDue, 'long')}.`
                : inMonthCount === 0
                  ? `No hay vencimientos por fecha en ${monthTitle}.`
                  : undefined
            }
            action={
              nextDue && (
                <Button size="sm" onClick={() => goTo(nextDue)}>
                  Ir al {formatDate(nextDue, 'dayMonth')}
                </Button>
              )
            }
          />
        )}
      </section>
    </div>
  )
}

function DayBadge({ count, state }: { count: number; state: NonNullable<Reminder['state']> }) {
  const st = REMINDER_STATE[state]
  const Icon = st.icon
  return (
    <span aria-hidden className={cn('inline-flex items-center gap-0.5 rounded-full px-1 text-[10px] font-semibold leading-4 tabular sm:hidden', TONE_CLASSES[st.tone].soft)}>
      <Icon className="size-2.5" />
      {count}
    </span>
  )
}
