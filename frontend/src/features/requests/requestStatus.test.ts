import { describe, expect, it } from 'vitest'
import type { RepairRequest, RepairRequestStatus } from '@/api/types'
import {
  consentText,
  currentQuote,
  isOpenRequest,
  needsAttention,
  quoteStatus,
  requestStatusDescriptor,
  requestStatusText,
  SHARE_HISTORY_TEXT,
  vehicleCopyFacts,
} from './requestStatus'

const WORK_ORDER = { id: 9, number: 'OT-2026-0031', status: 'received', received_at: '2026-10-30T10:00:00Z', completed_at: null, delivered_at: null } as const

function req(status: RepairRequestStatus, perspective: RepairRequest['perspective'], work_order: RepairRequest['work_order'] = null) {
  return { status, perspective, work_order }
}

describe('requestStatusText: tabla de §3.13.4', () => {
  it.each<[RepairRequestStatus, string, string]>([
    ['pending', 'Enviada', 'Nueva'],
    ['accepted', 'Aceptada · presupuesto pendiente', 'Aceptada · falta el presupuesto'],
    ['quoted', 'Presupuesto recibido', 'Presupuesto enviado'],
    ['rejected', 'Rechazada', 'Rechazada'],
    ['cancelled', 'Cancelada', 'Cancelada por el cliente'],
  ])('%s: "%s" para el particular y "%s" para el taller', (status, requester, workshop) => {
    expect(requestStatusText(req(status, 'requester'))).toBe(requester)
    expect(requestStatusText(req(status, 'workshop'))).toBe(workshop)
  })

  it('converted lleva el número de la orden con el texto de cada parte', () => {
    expect(requestStatusText(req('converted', 'requester', WORK_ORDER))).toBe('En el taller · OT-2026-0031')
    expect(requestStatusText(req('converted', 'workshop', WORK_ORDER))).toBe('Orden OT-2026-0031')
  })

  it('converted sin orden: el taller la borró y se dice', () => {
    expect(requestStatusText(req('converted', 'requester', null))).toBe('En el taller · orden eliminada')
    expect(requestStatusText(req('converted', 'workshop', null))).toBe('Orden eliminada')
  })
})

describe('needsAttention: a quién le toca actuar', () => {
  it('al particular, solo con un presupuesto recibido', () => {
    expect(needsAttention(req('quoted', 'requester'))).toBe(true)
    expect(needsAttention(req('pending', 'requester'))).toBe(false)
    expect(needsAttention(req('accepted', 'requester'))).toBe(false)
  })

  it('al taller, con una nueva o una aceptada sin presupuesto', () => {
    expect(needsAttention(req('pending', 'workshop'))).toBe(true)
    expect(needsAttention(req('accepted', 'workshop'))).toBe(true)
    expect(needsAttention(req('quoted', 'workshop'))).toBe(false)
    expect(needsAttention(req('converted', 'workshop', WORK_ORDER))).toBe(false)
  })

  it('el descriptor siempre lleva icono y texto', () => {
    for (const status of ['pending', 'accepted', 'quoted', 'rejected', 'cancelled', 'converted'] as const) {
      const d = requestStatusDescriptor(req(status, 'requester', WORK_ORDER))
      expect(d.icon).toBeTruthy()
      expect(d.label.length).toBeGreaterThan(0)
    }
  })
})

describe('isOpenRequest', () => {
  it('abiertas: pending, accepted y quoted', () => {
    expect((['pending', 'accepted', 'quoted', 'rejected', 'cancelled', 'converted'] as const).filter(isOpenRequest)).toEqual(['pending', 'accepted', 'quoted'])
  })
})

describe('presupuesto', () => {
  it('una versión vigente caducada se muestra como "Caducado"', () => {
    expect(quoteStatus({ status: 'sent', is_expired: true }).label).toBe('Caducado')
    expect(quoteStatus({ status: 'sent', is_expired: false }).label).toBe('Vigente')
    expect(quoteStatus({ status: 'superseded', is_expired: false }).label).toBe('Sustituido')
    expect(quoteStatus({ status: 'rejected', is_expired: false }).label).toBe('Rechazado')
    expect(quoteStatus({ status: 'accepted', is_expired: false }).label).toBe('Aceptado')
  })

  it('la versión vigente es la primera, solo si está enviada', () => {
    const sent = { id: 2, status: 'sent' } as RepairRequest['quotes'][number]
    const old = { id: 1, status: 'superseded' } as RepairRequest['quotes'][number]
    expect(currentQuote({ quotes: [sent, old] })).toBe(sent)
    expect(currentQuote({ quotes: [old] })).toBeNull()
    expect(currentQuote({ quotes: [] })).toBeNull()
  })
})

describe('copia fija del coche', () => {
  it('saca los datos en el orden del consentimiento y lo que falta no se rellena', () => {
    expect(vehicleCopyFacts({ make: 'Seat', model: 'Ibiza', year: 2019, fuel_type: 'gasoline', body_type: 'hatchback', color_hex: null, plate: '1234ABC' })).toEqual(['Seat Ibiza', '2019', 'Gasolina', 'Compacto', '1234 ABC'])
    expect(vehicleCopyFacts({ make: 'Seat', model: 'Ibiza', year: null, fuel_type: null, body_type: null, color_hex: null, plate: null })).toEqual(['Seat Ibiza'])
  })
})

describe('consentimiento: literal de §3.13.7', () => {
  it('primer párrafo con el nombre del taller', () => {
    expect(consentText('Taller Demo')).toBe(
      'Taller Demo verá tu nombre, tu email, el teléfono que indiques, estos datos del coche (marca, modelo, año, combustible, carrocería, color y matrícula) y los km. Si aceptas su presupuesto, te dará de alta como cliente suyo.',
    )
  })

  it('texto de la casilla', () => {
    expect(SHARE_HISTORY_TEXT).toBe(
      'Compartir también el historial de intervenciones (fecha, tipo, zona, título, km y taller; nunca importes ni notas) mientras la solicitud esté abierta. Puedes retirarlo cuando quieras.',
    )
  })
})
