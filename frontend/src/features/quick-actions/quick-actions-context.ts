import { createContext, useContext } from 'react'
import type { ID } from '@/api/types'

/**
 * Acciones rápidas disponibles desde cualquier pantalla (paleta de comandos, botón "+" móvil, cabina):
 *  - mileage / expense / reminder abren un diálogo sobre el vehículo.
 *  - record navega al formulario de intervención.
 * Si no se indica vehículo y hay más de uno, se pide elegirlo.
 */
export type QuickActionKind = 'mileage' | 'expense' | 'reminder' | 'record'

export interface QuickActionsValue {
  run: (kind: QuickActionKind, vehicleId?: ID) => void
}

export const QuickActionsContext = createContext<QuickActionsValue>({ run: () => {} })

export function useQuickActions() {
  return useContext(QuickActionsContext)
}
