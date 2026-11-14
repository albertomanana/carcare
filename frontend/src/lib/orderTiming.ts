/**
 * Tiempos de una orden de trabajo (contrato §3.11.1): el reloj del estado actual y, en «En reparación», el tiempo
 * acumulado comparado con lo que estimó el taller. Es tiempo en un estado, no trabajo medido: la interfaz lo rotula así.
 * Lógica pura: se prueba con Vitest y la usan los rótulos de la maqueta y la ficha.
 */
import { useEffect, useState } from 'react'
import type { WorkOrder } from '@/api/types'

export type TimedOrder = Pick<WorkOrder, 'status' | 'status_changed_at' | 'repair_seconds' | 'estimated_minutes'>

export interface OrderTiming {
  /** Segundos que lleva la orden en su estado actual. */
  stateSeconds: number
  /** Segundos en «En reparación» (tramos anteriores + el actual); null si la orden no está en reparación. */
  repairSeconds: number | null
  /** Segundos estimados de mano de obra; null si el taller no los indicó. */
  estimateSeconds: number | null
  /** Parte de lo estimado ya consumida (0…1, se queda en 1 al pasarse); null sin estimación o fuera de reparación. */
  progress: number | null
  /** Segundos por encima de lo estimado (0 si aún no se ha pasado o no hay estimación). */
  overSeconds: number
}

export function orderTiming(order: TimedOrder, nowMs: number): OrderTiming {
  const since = Date.parse(order.status_changed_at)
  const stateSeconds = Number.isFinite(since) ? Math.max(0, Math.floor((nowMs - since) / 1000)) : 0
  const estimateSeconds = order.estimated_minutes != null ? order.estimated_minutes * 60 : null
  if (order.status !== 'in_progress') return { stateSeconds, repairSeconds: null, estimateSeconds, progress: null, overSeconds: 0 }
  const repairSeconds = Math.max(0, order.repair_seconds) + stateSeconds
  if (estimateSeconds == null || estimateSeconds <= 0) return { stateSeconds, repairSeconds, estimateSeconds: null, progress: null, overSeconds: 0 }
  return {
    stateSeconds,
    repairSeconds,
    estimateSeconds,
    progress: Math.min(1, repairSeconds / estimateSeconds),
    overSeconds: Math.max(0, repairSeconds - estimateSeconds),
  }
}

const two = (n: number) => String(n).padStart(2, '0')

/** Cronómetro `HH:MM:SS` (las horas siguen creciendo: `127:04:09`). */
export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds))
  return `${two(Math.floor(s / 3600))}:${two(Math.floor((s % 3600) / 60))}:${two(s % 60)}`
}

/** Duración corta para frases: «45 min», «2 h», «1 h 30 min», «3 d 4 h». */
export function formatDuration(seconds: number): string {
  const m = Math.max(0, Math.round(seconds / 60))
  if (m < 60) return `${m} min`
  const h = Math.floor(m / 60)
  if (h < 24) return m % 60 ? `${h} h ${m % 60} min` : `${h} h`
  const d = Math.floor(h / 24)
  return h % 24 ? `${d} d ${h % 24} h` : `${d} d`
}

/** Frase accesible del cronómetro: «lleva 1 h 20 min en reparación, de 2 h estimadas». */
export function timingSentence(t: OrderTiming): string {
  if (t.repairSeconds == null) return `lleva ${formatDuration(t.stateSeconds)} en este estado`
  const base = `lleva ${formatDuration(t.repairSeconds)} en reparación`
  if (t.estimateSeconds == null) return `${base}, sin tiempo estimado`
  return t.overSeconds > 0
    ? `${base}, ${formatDuration(t.overSeconds)} más de las ${formatDuration(t.estimateSeconds)} estimadas`
    : `${base}, de ${formatDuration(t.estimateSeconds)} estimadas`
}

/** Hora actual en ms que se renueva cada `everyMs` (un solo intervalo por componente; se para con la pestaña oculta). */
export function useNow(everyMs = 1000): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    let id: ReturnType<typeof setInterval> | null = null
    const start = () => {
      if (id != null) return
      setNow(Date.now())
      id = setInterval(() => setNow(Date.now()), everyMs)
    }
    const stop = () => {
      if (id != null) clearInterval(id)
      id = null
    }
    const onVis = () => (document.hidden ? stop() : start())
    start()
    document.addEventListener('visibilitychange', onVis)
    return () => {
      stop()
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [everyMs])
  return now
}
