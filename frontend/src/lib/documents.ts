/** Reglas de archivos del contrato §3.9: PDF o imagen, máximo 10 MB. */
import { CalendarClock, Clock, OctagonAlert } from 'lucide-react'
import type { ISODate } from '@/api/types'
import { daysBetween, formatDate, formatDays, formatFileSize, parseISODate } from './format'
import type { StatusDescriptor } from './status'

export const MAX_FILE_BYTES = 10 * 1024 * 1024
export const ACCEPTED_MIME = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']

/** Validación en cliente del archivo (el servidor comprueba además el MIME real). */
export function fileError(file: File | null): string | null {
  if (!file) return 'Elige un archivo.'
  if (!ACCEPTED_MIME.includes(file.type)) return 'Formato no admitido: sube un PDF o una imagen JPG, PNG o WebP.'
  if (file.size > MAX_FILE_BYTES) return `El archivo pesa ${formatFileSize(file.size)}; el máximo es 10 MB.`
  return null
}

export function isPreviewable(mime: string): boolean {
  return mime === 'application/pdf' || mime.startsWith('image/')
}

export function isImage(mime: string): boolean {
  return mime.startsWith('image/')
}

/** Días hasta la caducidad (negativo si ya caducó). */
export function daysToExpiry(expiresAt: ISODate | null, now: Date = new Date()): number | null {
  if (!expiresAt) return null
  return daysBetween(now, parseISODate(expiresAt))
}

/** Margen en el que un documento «caduca pronto» (igual que los recordatorios: 30 días). */
export const EXPIRY_SOON_DAYS = 30

/** Estado de caducidad con icono + texto (nunca solo color). null si no caduca. */
export function expiryDescriptor(expiresAt: ISODate | null, now: Date = new Date()): (StatusDescriptor & { days: number }) | null {
  const days = daysToExpiry(expiresAt, now)
  if (days === null || !expiresAt) return null
  if (days < 0) return { days, tone: 'danger', icon: OctagonAlert, label: `Caducó hace ${formatDays(days)}` }
  if (days === 0) return { days, tone: 'danger', icon: OctagonAlert, label: 'Caduca hoy' }
  if (days === 1) return { days, tone: 'warning', icon: Clock, label: 'Caduca mañana' }
  if (days <= EXPIRY_SOON_DAYS) return { days, tone: 'warning', icon: Clock, label: `Caduca en ${formatDays(days)}` }
  return { days, tone: 'neutral', icon: CalendarClock, label: `Caduca el ${formatDate(expiresAt)}` }
}
