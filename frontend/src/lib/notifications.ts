/**
 * E16‑10 · textos y destino de la campana de avisos (contrato §3.13.8). Sin React, para poder probarlos con Vitest.
 */
import type { AppNotification } from '@/api/types'

/** Número de la campana: nada con 0, "9+" a partir de 10. */
export function unreadBadge(unread: number): string | null {
  if (unread <= 0) return null
  return unread >= 10 ? '9+' : String(unread)
}

/** Nombre accesible de la campana: "Notificaciones, 3 sin leer". Aquí va la cifra real, no "9+". */
export function bellLabel(unread: number): string {
  return unread > 0 ? `Notificaciones, ${unread} sin leer` : 'Notificaciones'
}

/** Lo que oye un lector de pantalla cuando llega un aviso. */
export function unreadAnnouncement(unread: number): string {
  return unread === 1 ? 'Tienes 1 notificación sin leer' : `Tienes ${unread} notificaciones sin leer`
}

/** A dónde lleva un aviso: la solicitud, desde el espacio del destinatario. null si la solicitud ya no se puede abrir. */
export function notificationHref(n: Pick<AppNotification, 'workspace_id' | 'repair_request_id'>): string | null {
  return n.repair_request_id === null ? null : `/app/${n.workspace_id}/solicitudes/${n.repair_request_id}`
}
