import { describe, expect, it } from 'vitest'
import type { MileageSource } from '@/api/types'
import { mileageSourceLink } from './mileage'

const V = '/app/3/vehiculos/7'
const W = '/app/3'
const log = (source: MileageSource, source_id: number | null, recorded_at = '2024-05-10') => ({ source, source_id, recorded_at })

describe('origen de una lectura de km (contrato §3.4.1)', () => {
  it('enlaza intervenciones, gastos, recordatorios y órdenes', () => {
    expect(mileageSourceLink(log('maintenance', 12), V, W)?.to).toBe(`${V}/historial?ver=intervenciones#intervencion-12`)
    expect(mileageSourceLink(log('expense', 5, '2024-05-10'), V, W)?.to).toBe(`${V}/gastos?periodo=2024#gasto-5`)
    expect(mileageSourceLink(log('reminder', 9), V, W)?.to).toBe(`${V}/recordatorios?estado=done#recordatorio-9`)
    expect(mileageSourceLink(log('work_order', 4), V, W)?.to).toBe(`${W}/ordenes/4`)
  })
  it('el texto accesible empieza por la etiqueta visible y dice a dónde va', () => {
    expect(mileageSourceLink(log('maintenance', 1), V, W)?.label).toBe('Intervención: ver en el historial')
    expect(mileageSourceLink(log('work_order', 1), V, W)?.label).toMatch(/^Orden de trabajo: /)
  })
  it('sin enlace: manual, alta del vehículo o sin source_id (gastos para el mecánico)', () => {
    expect(mileageSourceLink(log('manual', null), V, W)).toBeNull()
    expect(mileageSourceLink(log('vehicle_created', 7), V, W)).toBeNull()
    expect(mileageSourceLink(log('expense', null), V, W)).toBeNull()
  })
})
