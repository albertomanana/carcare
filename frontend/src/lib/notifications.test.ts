import { describe, expect, it } from 'vitest'
import { bellLabel, notificationHref, unreadAnnouncement, unreadBadge } from './notifications'

describe('campana de avisos (E16‑10)', () => {
  it('el contador dice "9+" a partir de 10 y no se pinta con 0', () => {
    expect(unreadBadge(0)).toBeNull()
    expect(unreadBadge(1)).toBe('1')
    expect(unreadBadge(9)).toBe('9')
    expect(unreadBadge(10)).toBe('9+')
    expect(unreadBadge(250)).toBe('9+')
  })

  it('el nombre accesible lleva la cifra real', () => {
    expect(bellLabel(0)).toBe('Notificaciones')
    expect(bellLabel(3)).toBe('Notificaciones, 3 sin leer')
    expect(bellLabel(12)).toBe('Notificaciones, 12 sin leer')
  })

  it('el anuncio concuerda en número', () => {
    expect(unreadAnnouncement(1)).toBe('Tienes 1 notificación sin leer')
    expect(unreadAnnouncement(2)).toBe('Tienes 2 notificaciones sin leer')
  })

  it('un aviso lleva a la solicitud desde el espacio del destinatario', () => {
    expect(notificationHref({ workspace_id: 5, repair_request_id: 12 })).toBe('/app/5/solicitudes/12')
    expect(notificationHref({ workspace_id: 5, repair_request_id: null })).toBeNull()
  })
})
