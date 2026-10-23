/** Utilidades del informe imprimible del vehículo. */
import type { MileageLog } from '@/api/types'

/**
 * Una lectura por mes (la de más km del mes; a igualdad, la de fecha más reciente), de más reciente a más antigua.
 * Sirve para que el informe no ocupe páginas con lecturas semanales; la tabla completa sigue disponible.
 */
export function lastReadingPerMonth(logs: MileageLog[]): MileageLog[] {
  const byMonth = new Map<string, MileageLog>()
  for (const log of logs) {
    const key = log.recorded_at.slice(0, 7)
    const prev = byMonth.get(key)
    if (!prev || log.mileage > prev.mileage || (log.mileage === prev.mileage && log.recorded_at > prev.recorded_at)) byMonth.set(key, log)
  }
  return [...byMonth.values()].sort((a, b) => (a.recorded_at === b.recorded_at ? b.mileage - a.mileage : a.recorded_at < b.recorded_at ? 1 : -1))
}

/** Quita lecturas repetidas (misma fecha y mismos km con distinto origen, p. ej. repostaje + lectura manual). */
export function dedupeReadings(logs: MileageLog[]): MileageLog[] {
  const seen = new Set<string>()
  return logs.filter((log) => {
    const key = `${log.recorded_at}|${log.mileage}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

/** Nombre de archivo sugerido al guardar en PDF (el navegador usa el título del documento). */
export function reportFileTitle(displayName: string, plate: string | null, date: string): string {
  return ['Informe', displayName, plate, date].filter(Boolean).join(' ')
}
