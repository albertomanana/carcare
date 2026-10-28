import type { MileageLog } from '@/api/types'

export interface MileageSourceLink {
  /** Ruta de la SPA a la que lleva el enlace. */
  to: string
  /** Texto accesible: empieza por la etiqueta visible ("Intervención…") y dice a dónde va. */
  label: string
}

/**
 * Enlace al registro que generó una lectura de km (contrato §3.4.1, regla 5).
 * Solo enlaza con `source_id` y si el origen es una intervención, un gasto, una orden o un recordatorio;
 * con `manual`, `vehicle_created` o `source_id = null` (p. ej. gastos para el rol mecánico) devuelve null
 * y el origen se muestra como texto.
 *
 * @param vehicleBase ruta de la ficha: `/app/{ws}/vehiculos/{id}`
 * @param wsBase ruta del espacio: `/app/{ws}`
 */
export function mileageSourceLink(log: Pick<MileageLog, 'source' | 'source_id' | 'recorded_at'>, vehicleBase: string, wsBase: string): MileageSourceLink | null {
  const id = log.source_id
  if (id === null) return null
  switch (log.source) {
    case 'maintenance':
      return { to: `${vehicleBase}/historial?ver=intervenciones#intervencion-${id}`, label: 'Intervención: ver en el historial' }
    case 'expense':
      // El periodo de la pestaña Gastos es el año de la lectura, así el gasto siempre está en la lista
      return { to: `${vehicleBase}/gastos?periodo=${log.recorded_at.slice(0, 4)}#gasto-${id}`, label: 'Gasto: ver en gastos' }
    case 'reminder':
      return { to: `${vehicleBase}/recordatorios?estado=done#recordatorio-${id}`, label: 'Recordatorio completado: ver en recordatorios hechos' }
    case 'work_order':
      return { to: `${wsBase}/ordenes/${id}`, label: 'Orden de trabajo: ver la orden' }
    default:
      return null
  }
}
