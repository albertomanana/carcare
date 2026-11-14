import { describe, expect, it } from 'vitest'
import { formatClock, formatDuration, orderTiming, timingSentence, type TimedOrder } from './orderTiming'

const at = (iso: string) => Date.parse(iso)
const order = (o: Partial<TimedOrder>): TimedOrder => ({
  status: 'in_progress',
  status_changed_at: '2026-11-13T10:00:00+01:00',
  repair_seconds: 0,
  estimated_minutes: null,
  ...o,
})

describe('orderTiming', () => {
  it('en reparación suma los tramos anteriores y el actual, y lo compara con lo estimado', () => {
    const t = orderTiming(order({ repair_seconds: 1800, estimated_minutes: 120 }), at('2026-11-13T10:30:00+01:00'))
    expect(t.stateSeconds).toBe(1800)
    expect(t.repairSeconds).toBe(3600)
    expect(t.estimateSeconds).toBe(7200)
    expect(t.progress).toBe(0.5)
    expect(t.overSeconds).toBe(0)
  })

  it('al pasarse de lo estimado el progreso se queda en 1 y dice cuánto se ha pasado', () => {
    const t = orderTiming(order({ estimated_minutes: 60 }), at('2026-11-13T11:15:00+01:00'))
    expect(t.progress).toBe(1)
    expect(t.overSeconds).toBe(900)
  })

  it('sin tiempo estimado no hay progreso, solo el tiempo', () => {
    const t = orderTiming(order({}), at('2026-11-13T10:10:00+01:00'))
    expect(t.repairSeconds).toBe(600)
    expect(t.estimateSeconds).toBeNull()
    expect(t.progress).toBeNull()
  })

  it('fuera de reparación solo cuenta el tiempo en el estado', () => {
    const t = orderTiming(order({ status: 'waiting_parts', repair_seconds: 2700, estimated_minutes: 90 }), at('2026-11-13T12:00:00+01:00'))
    expect(t.stateSeconds).toBe(7200)
    expect(t.repairSeconds).toBeNull()
    expect(t.progress).toBeNull()
  })

  it('nunca da tiempos negativos (reloj del equipo atrasado o fecha rara)', () => {
    expect(orderTiming(order({}), at('2026-11-13T09:00:00+01:00')).stateSeconds).toBe(0)
    expect(orderTiming(order({ status_changed_at: 'no-es-fecha' }), Date.now()).stateSeconds).toBe(0)
  })
})

describe('formato', () => {
  it('cronómetro HH:MM:SS con horas que siguen creciendo', () => {
    expect(formatClock(0)).toBe('00:00:00')
    expect(formatClock(3725)).toBe('01:02:05')
    expect(formatClock(127 * 3600 + 4 * 60 + 9)).toBe('127:04:09')
  })

  it('duración corta para frases', () => {
    expect(formatDuration(45 * 60)).toBe('45 min')
    expect(formatDuration(2 * 3600)).toBe('2 h')
    expect(formatDuration(90 * 60)).toBe('1 h 30 min')
    expect(formatDuration(76 * 3600)).toBe('3 d 4 h')
  })

  it('frase accesible: dice que es tiempo en el estado, no trabajo medido', () => {
    const o = order({ estimated_minutes: 120 })
    expect(timingSentence(orderTiming(o, at('2026-11-13T11:20:00+01:00')))).toBe('lleva 1 h 20 min en reparación, de 2 h estimadas')
    expect(timingSentence(orderTiming(o, at('2026-11-13T12:30:00+01:00')))).toBe('lleva 2 h 30 min en reparación, 30 min más de las 2 h estimadas')
    const w = order({ status: 'diagnosing' })
    expect(timingSentence(orderTiming(w, at('2026-11-13T10:42:00+01:00')))).toBe('lleva 42 min en este estado')
  })
})
