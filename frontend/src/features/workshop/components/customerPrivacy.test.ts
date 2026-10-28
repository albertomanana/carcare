import { describe, expect, it } from 'vitest'
import { ApiError } from '@/api/client'
import { exportFileName, privacyErrorMessage } from './customerPrivacy'

describe('RGPD del cliente', () => {
  it('nombra el archivo como pide el contrato (cliente-{id}-{AAAA-MM-DD}.json)', () => {
    expect(exportFileName(7, '2026-10-26')).toBe('cliente-7-2026-10-26.json')
  })

  it('explica el 403 y el 404 con un texto propio y deja el motivo del 409 tal como lo da la API', () => {
    expect(privacyErrorMessage(new ApiError(403, 'This action is unauthorized.'))).toBe('Solo el propietario o un gerente del taller pueden hacerlo.')
    expect(privacyErrorMessage(new ApiError(404, 'Not found'))).toBe('Este cliente ya no existe en el taller.')
    const conflict = 'No se puede anonimizar un cliente con órdenes de trabajo abiertas. Entrégalas o cancélalas antes.'
    expect(privacyErrorMessage(new ApiError(409, conflict))).toBe(conflict)
    expect(privacyErrorMessage(new Error('x'))).toBe('Algo ha fallado. Inténtalo de nuevo.')
  })
})
