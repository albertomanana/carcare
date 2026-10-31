import { describe, expect, it } from 'vitest'
import type { RepairQuote } from '@/api/types'
import { liveTotals } from '@/features/workshop/components/totals'
import { lastRejectedQuote, quoteSchema, quoteToValues, rateToInput, stripErrorPrefix, taxRateError, validDaysError, validUntilPreview, valuesToQuoteInput, type QuoteValues } from './quoteForm'

const QUOTE: RepairQuote = {
  id: 7,
  version: 2,
  status: 'rejected',
  items: [{ kind: 'labor', name: 'Cambiar pastillas', part_number: 'PF-12', quantity: '1.50', unit_price: '45.00', total: '67.50' }],
  subtotal: '67.50',
  tax_rate: '10.50',
  tax_amount: '7.09',
  total: '74.59',
  valid_days: 30,
  valid_until: '2026-11-29',
  is_expired: false,
  note: 'Incluye revisión',
  client_reason: null,
  sent_at: '2026-10-30T10:00:00Z',
  answered_at: null,
}

function values(partial: Partial<QuoteValues> = {}): QuoteValues {
  return {
    items: [{ kind: 'labor', name: 'Mano de obra', part_number: '', quantity: '1', unit_price: '50' }],
    tax_rate: '21',
    valid_days: '15',
    note: '',
    ...partial,
  }
}

describe('valores por defecto del presupuesto', () => {
  it('una línea vacía de mano de obra, el IVA del taller y 15 días', () => {
    const v = quoteToValues('21.00')
    expect(v.items).toHaveLength(1)
    expect(v.items[0].kind).toBe('labor')
    expect(v.tax_rate).toBe('21')
    expect(v.valid_days).toBe('15')
    expect(v.note).toBe('')
  })

  it('parte de la versión anterior si se indica', () => {
    const v = quoteToValues('21.00', QUOTE)
    expect(v.items[0]).toMatchObject({ kind: 'labor', name: 'Cambiar pastillas', part_number: 'PF-12', quantity: '1,50' })
    expect(v.tax_rate).toBe('10,5')
    expect(v.valid_days).toBe('30')
    expect(v.note).toBe('Incluye revisión')
  })

  it('rateToInput como lo escribiría una persona', () => {
    expect(rateToInput('21.00')).toBe('21')
    expect(rateToInput('10.50')).toBe('10,5')
    expect(rateToInput('')).toBe('')
    expect(rateToInput(null)).toBe('')
  })
})

describe('validación', () => {
  it('el precio es obligatorio en un presupuesto', () => {
    const result = quoteSchema.safeParse(values({ items: [{ kind: 'labor', name: 'Mano de obra', part_number: '', quantity: '1', unit_price: '' }] }))
    expect(result.success).toBe(false)
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path.join('.') === 'items.0.unit_price')
      expect(issue?.message).toBe('Indica el precio.')
    }
  })

  it('exige al menos una línea', () => {
    expect(quoteSchema.safeParse(values({ items: [] })).success).toBe(false)
  })

  it('acepta un presupuesto correcto', () => {
    expect(quoteSchema.safeParse(values()).success).toBe(true)
  })

  it('IVA entre 0 y 100 con 2 decimales como mucho', () => {
    expect(taxRateError('')).toBe('Indica el IVA (0 si no se aplica).')
    expect(taxRateError('0')).toBeNull()
    expect(taxRateError('21')).toBeNull()
    expect(taxRateError('10,5')).toBeNull()
    expect(taxRateError('100')).toBeNull()
    expect(taxRateError('100,01')).toBe('Debe estar entre 0 y 100.')
    expect(taxRateError('10,555')).toBe('Máximo 2 decimales.')
  })

  it('validez entre 1 y 90 días', () => {
    expect(validDaysError('0')).toBe('Entre 1 y 90 días.')
    expect(validDaysError('1')).toBeNull()
    expect(validDaysError('90')).toBeNull()
    expect(validDaysError('91')).toBe('Entre 1 y 90 días.')
    expect(validDaysError('abc')).toBe('Escribe un número entero de días.')
  })
})

describe('valuesToQuoteInput: el dinero viaja como string con 2 decimales', () => {
  it('normaliza coma decimal, IVA y validez', () => {
    const input = valuesToQuoteInput(
      values({
        items: [{ kind: 'part', name: ' Pastillas ', part_number: ' PF-12 ', quantity: '2,5', unit_price: '1.234,5' }],
        tax_rate: '10,5',
        valid_days: '30',
        note: '  Incluye montaje  ',
      }),
    )
    expect(input).toEqual({
      items: [{ kind: 'part', name: 'Pastillas', part_number: 'PF-12', quantity: '2.5', unit_price: '1234.50' }],
      tax_rate: '10.50',
      valid_days: 30,
      note: 'Incluye montaje',
    })
  })

  it('sin referencia ni nota, null', () => {
    const input = valuesToQuoteInput(values())
    expect(input.items[0].part_number).toBeNull()
    expect(input.note).toBeNull()
    expect(input.items[0].unit_price).toBe('50.00')
    expect(input.tax_rate).toBe('21.00')
  })
})

describe('totales en vivo (mismas reglas que el servidor, §3.13.5)', () => {
  it('subtotal, IVA con redondeo half‑up a 2 decimales y total', () => {
    const t = liveTotals(
      [
        { kind: 'labor', name: 'Mano de obra', part_number: '', quantity: '1,5', unit_price: '45' },
        { kind: 'part', name: 'Pastillas', part_number: '', quantity: '2', unit_price: '19,99' },
      ],
      '21',
    )
    expect(t.subtotal).toBe('107.48')
    // 107,48 × 21 % = 22,5708 ⇒ 22,57
    expect(t.tax).toBe('22.57')
    expect(t.total).toBe('130.05')
  })

  it('redondea al alza el medio céntimo', () => {
    // 0,50 × 1 % = 0,005 ⇒ 0,01
    const t = liveTotals([{ kind: 'other', name: 'x', part_number: '', quantity: '1', unit_price: '0,50' }], '1')
    expect(t.tax).toBe('0.01')
    expect(t.total).toBe('0.51')
  })

  it('sin líneas con precio, todo a cero', () => {
    const t = liveTotals([{ kind: 'labor', name: '', part_number: '', quantity: '1', unit_price: '' }], '21')
    expect(t.subtotal).toBe('0.00')
    expect(t.total).toBe('0.00')
  })
})

describe('validUntilPreview', () => {
  it('suma los días a hoy', () => {
    expect(validUntilPreview('15', new Date(2026, 9, 30))).toBe('2026-11-14')
    expect(validUntilPreview('1', new Date(2026, 11, 31))).toBe('2027-01-01')
  })

  it('con días no válidos, nada', () => {
    expect(validUntilPreview('0', new Date(2026, 9, 30))).toBeNull()
    expect(validUntilPreview('', new Date(2026, 9, 30))).toBeNull()
  })
})

describe('errores 422 del servidor', () => {
  it('quita el prefijo quote. de las claves al aceptar con presupuesto', () => {
    const errors = { 'quote.items.0.unit_price': ['x'], 'quote.tax_rate': ['y'], other: ['z'] }
    expect(stripErrorPrefix(errors, 'quote.')).toEqual({
      'quote.items.0.unit_price': 'items.0.unit_price',
      'quote.tax_rate': 'tax_rate',
      other: 'other',
    })
  })

  it('sin prefijo, las claves no cambian', () => {
    expect(stripErrorPrefix({ 'items.0.name': ['x'] }, '')).toEqual({ 'items.0.name': 'items.0.name' })
  })
})

describe('lastRejectedQuote', () => {
  it('solo si la última versión la rechazó el cliente', () => {
    expect(lastRejectedQuote([QUOTE])).toBe(QUOTE)
    expect(lastRejectedQuote([{ ...QUOTE, status: 'sent' }])).toBeNull()
    expect(lastRejectedQuote([])).toBeNull()
  })
})
