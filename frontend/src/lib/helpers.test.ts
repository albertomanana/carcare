import { describe, expect, it } from 'vitest'
import { expiryDescriptor } from './documents'
import { effectiveTotalCents, splitLines, totalMismatch } from './lineItems'
import { linkedExpenseCategory, matchQuickService, quickServiceFromParam } from './maintenance'
import { joinList, plural, pluralWord } from './text'

describe('plural', () => {
  it('usa singular solo para 1', () => {
    expect(plural(1, 'recordatorio vencido', 'recordatorios vencidos')).toBe('1 recordatorio vencido')
    expect(plural(0, 'vehículo', 'vehículos')).toBe('0 vehículos')
    expect(plural(2, 'día', 'días')).toBe('2 días')
  })
  it('agrupa miles al estilo es-ES', () => {
    expect(plural(1234, 'km', 'km')).toBe('1.234 km')
  })
  it('pluralWord devuelve solo la palabra', () => {
    expect(pluralWord(1, 'gasto', 'gastos')).toBe('gasto')
    expect(pluralWord(-1, 'día', 'días')).toBe('día')
    expect(pluralWord(5, 'gasto', 'gastos')).toBe('gastos')
  })
  it('joinList une con «y»', () => {
    expect(joinList(['a'])).toBe('a')
    expect(joinList(['a', 'b'])).toBe('a y b')
    expect(joinList(['a', 'b', 'c'])).toBe('a, b y c')
    expect(joinList([])).toBe('')
  })
})

describe('líneas de intervención', () => {
  const lines = [
    { kind: 'part', quantity: '1', unit_price: '109,90' },
    { kind: 'labor', quantity: '0,3', unit_price: '45' },
    { kind: 'fluid', quantity: '4', unit_price: '' },
  ]

  it('reparte piezas y mano de obra', () => {
    expect(splitLines(lines)).toEqual({ partsCents: 10990, laborCents: 1350, pricedCount: 2 })
  })

  it('total efectivo: manual > desglose > líneas > sin coste', () => {
    expect(effectiveTotalCents({ total: '150', parts: '', labor: '' }, lines)).toEqual({ cents: 15000, source: 'manual' })
    expect(effectiveTotalCents({ total: '', parts: '100', labor: '20,5' }, lines)).toEqual({ cents: 12050, source: 'breakdown' })
    expect(effectiveTotalCents({ total: '', parts: '', labor: '' }, lines)).toEqual({ cents: 12340, source: 'lines' })
    expect(effectiveTotalCents({ total: '', parts: '', labor: '' }, [])).toEqual({ cents: null, source: 'none' })
  })

  it('detecta un total manual que no cuadra con las líneas', () => {
    expect(totalMismatch('123,40', lines).mismatch).toBe(false)
    expect(totalMismatch('120', lines).mismatch).toBe(true)
    expect(totalMismatch('', lines).mismatch).toBe(false)
  })
})

describe('reglas de intervención', () => {
  it('categoría del gasto vinculado (D3‑A)', () => {
    expect(linkedExpenseCategory('breakdown')).toBe('repair')
    expect(linkedExpenseCategory('bodywork')).toBe('repair')
    expect(linkedExpenseCategory('inspection')).toBe('inspection')
    expect(linkedExpenseCategory('tyres')).toBe('maintenance')
  })

  it('reconoce el chip rápido de la combinación actual', () => {
    expect(matchQuickService({ type: 'maintenance', zone: 'engine', service_kind: 'oil' })?.id).toBe('oil')
    expect(matchQuickService({ type: 'breakdown', zone: 'general', service_kind: '' })?.id).toBe('breakdown')
    expect(matchQuickService({ type: 'repair', zone: 'engine', service_kind: 'oil' })).toBeNull()
  })

  it('traduce ?servicio= de la cabina', () => {
    expect(quickServiceFromParam('itv')?.type).toBe('inspection')
    expect(quickServiceFromParam('oil')?.service_kind).toBe('oil')
    expect(quickServiceFromParam('nada')).toBeNull()
    expect(quickServiceFromParam(null)).toBeNull()
  })
})

describe('caducidad de documentos', () => {
  const now = new Date(2026, 9, 23)
  it('sin fecha no hay estado', () => {
    expect(expiryDescriptor(null, now)).toBeNull()
  })
  it('caducado, hoy, pronto y en plazo', () => {
    expect(expiryDescriptor('2026-10-20', now)).toMatchObject({ tone: 'danger', label: 'Caducó hace 3 días' })
    expect(expiryDescriptor('2026-10-23', now)).toMatchObject({ tone: 'danger', label: 'Caduca hoy' })
    expect(expiryDescriptor('2026-10-24', now)).toMatchObject({ tone: 'warning', label: 'Caduca mañana' })
    expect(expiryDescriptor('2026-11-09', now)).toMatchObject({ tone: 'warning', label: 'Caduca en 17 días' })
    expect(expiryDescriptor('2027-03-01', now)).toMatchObject({ tone: 'neutral', label: 'Caduca el 1 mar 2027' })
  })
})
