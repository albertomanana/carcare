/**
 * Color del mono de cada persona del taller: sale de su id, así que es estable y se repite en la figura de la maqueta,
 * en su rótulo y en la ficha. Distinguibles sobre el suelo oscuro y el claro; ninguno es un color de estado puro.
 */
export const OVERALL_COLORS = ['#ff6a1a', '#2f8fd6', '#8b5cf6', '#14a37f', '#e0457b', '#d6a312'] as const

export function overallColor(userId: number): string {
  return OVERALL_COLORS[Math.abs(userId) % OVERALL_COLORS.length]
}

/** Solo en estos estados hay alguien trabajando en el coche: diagnóstico y reparación. */
export function isBeingWorked(status: string): status is 'diagnosing' | 'in_progress' {
  return status === 'diagnosing' || status === 'in_progress'
}
