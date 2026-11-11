import { describe, expect, it } from 'vitest'
import type { Vehicle } from '@/api/types'
import { mileageMissions, STALE_MILEAGE_DAYS } from './missions'

const NOW = new Date(2026, 10, 11)
function car(id: number, over: Partial<Vehicle>): Vehicle {
  return { id, display_name: `Coche ${id}`, archived_at: null, current_mileage: 1000, mileage_updated_at: '2026-11-10', ...over } as Vehicle
}

describe('misiones de kilometraje', () => {
  it('no avisa si la lectura es reciente', () => {
    expect(mileageMissions([car(1, {})], NOW)).toEqual([])
  })
  it('avisa al llegar al umbral, con los días reales', () => {
    const d = new Date(NOW)
    d.setDate(d.getDate() - STALE_MILEAGE_DAYS)
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    const [m] = mileageMissions([car(1, { mileage_updated_at: iso })], NOW)
    expect(m.kind).toBe('stale')
    expect(m.days).toBe(STALE_MILEAGE_DAYS)
  })
  it('un vehículo sin lecturas va primero; los archivados no cuentan', () => {
    const list = mileageMissions(
      [car(1, { mileage_updated_at: '2026-01-01' }), car(2, { current_mileage: null, mileage_updated_at: null }), car(3, { archived_at: '2026-02-01T00:00:00Z', current_mileage: null })],
      NOW,
    )
    expect(list.map((m) => [m.vehicle.id, m.kind])).toEqual([
      [2, 'none'],
      [1, 'stale'],
    ])
  })
})
