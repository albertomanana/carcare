/**
 * Estados → tono + icono + texto. El estado nunca se comunica solo con color.
 */
import {
  CircleCheck,
  CircleDashed,
  CircleQuestionMark,
  Clock,
  Flag,
  type LucideIcon,
  OctagonAlert,
  PackageSearch,
  Stethoscope,
  TriangleAlert,
  Wrench,
  Ban,
  Inbox,
  ArrowDown,
  Minus,
  ArrowUp,
  ChevronsUp,
} from 'lucide-react'
import type { Priority, ReminderState, WorkOrderStatus, ZoneStatus } from '@/api/types'
import { PRIORITY_LABEL, REMINDER_STATE_LABEL, WORK_ORDER_STATUS_LABEL } from './labels'

export type Tone = 'neutral' | 'accent' | 'ok' | 'warning' | 'danger' | 'info'

export interface StatusDescriptor {
  label: string
  tone: Tone
  icon: LucideIcon
}

export const REMINDER_STATE: Record<ReminderState, StatusDescriptor> = {
  overdue: { label: REMINDER_STATE_LABEL.overdue, tone: 'danger', icon: OctagonAlert },
  soon: { label: REMINDER_STATE_LABEL.soon, tone: 'warning', icon: Clock },
  ok: { label: REMINDER_STATE_LABEL.ok, tone: 'ok', icon: CircleCheck },
  unknown: { label: REMINDER_STATE_LABEL.unknown, tone: 'neutral', icon: CircleQuestionMark },
}

/** Orden de urgencia (contrato §3.7). */
export const REMINDER_STATE_ORDER: ReminderState[] = ['overdue', 'soon', 'ok', 'unknown']

export function zoneDescriptor(zone: Pick<ZoneStatus, 'state' | 'basis'>): StatusDescriptor {
  if (zone.basis === 'none') return { label: 'Sin datos', tone: 'neutral', icon: CircleDashed }
  if (zone.basis === 'records') return { label: 'Con historial, sin intervalos', tone: 'info', icon: CircleQuestionMark }
  return REMINDER_STATE[zone.state]
}

export const WORK_ORDER_STATUS: Record<WorkOrderStatus, StatusDescriptor> = {
  received: { label: WORK_ORDER_STATUS_LABEL.received, tone: 'neutral', icon: Inbox },
  diagnosing: { label: WORK_ORDER_STATUS_LABEL.diagnosing, tone: 'info', icon: Stethoscope },
  waiting_parts: { label: WORK_ORDER_STATUS_LABEL.waiting_parts, tone: 'warning', icon: PackageSearch },
  in_progress: { label: WORK_ORDER_STATUS_LABEL.in_progress, tone: 'accent', icon: Wrench },
  ready: { label: WORK_ORDER_STATUS_LABEL.ready, tone: 'ok', icon: Flag },
  delivered: { label: WORK_ORDER_STATUS_LABEL.delivered, tone: 'ok', icon: CircleCheck },
  cancelled: { label: WORK_ORDER_STATUS_LABEL.cancelled, tone: 'neutral', icon: Ban },
}

export const PRIORITY: Record<Priority, StatusDescriptor> = {
  low: { label: PRIORITY_LABEL.low, tone: 'neutral', icon: ArrowDown },
  normal: { label: PRIORITY_LABEL.normal, tone: 'neutral', icon: Minus },
  high: { label: PRIORITY_LABEL.high, tone: 'warning', icon: ArrowUp },
  urgent: { label: PRIORITY_LABEL.urgent, tone: 'danger', icon: ChevronsUp },
}

export const LATE: StatusDescriptor = { label: 'Tarde', tone: 'danger', icon: TriangleAlert }

/** Clases de texto/fondo por tono (tokens del sistema). */
export const TONE_CLASSES: Record<Tone, { text: string; soft: string; solid: string; dot: string }> = {
  neutral: { text: 'text-fg-muted', soft: 'bg-surface-3 text-fg-muted', solid: 'bg-line-strong', dot: 'bg-fg-subtle' },
  accent: { text: 'text-accent-ink', soft: 'bg-accent-soft text-accent-ink', solid: 'bg-accent', dot: 'bg-accent' },
  ok: { text: 'text-ok', soft: 'bg-ok-soft text-ok', solid: 'bg-ok', dot: 'bg-ok' },
  warning: { text: 'text-warning', soft: 'bg-warning-soft text-warning', solid: 'bg-warning', dot: 'bg-warning' },
  danger: { text: 'text-danger', soft: 'bg-danger-soft text-danger', solid: 'bg-danger', dot: 'bg-danger' },
  info: { text: 'text-info', soft: 'bg-info-soft text-info', solid: 'bg-info', dot: 'bg-info' },
}
