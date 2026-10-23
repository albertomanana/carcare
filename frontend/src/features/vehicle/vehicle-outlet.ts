import { useOutletContext } from 'react-router'
import type { Vehicle } from '@/api/types'

/** Las pestañas de la ficha reciben el vehículo ya cargado por VehicleDetailPage. */
export interface VehicleOutletContext {
  vehicle: Vehicle
}

export function useVehicleOutlet(): VehicleOutletContext {
  return useOutletContext<VehicleOutletContext>()
}
