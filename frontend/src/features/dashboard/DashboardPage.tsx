import { lazy } from 'react'
import { useWorkspace } from '@/features/workspace/workspace-context'

const PersonalDashboard = lazy(() => import('./PersonalDashboard'))
// Taller: la portada es la maqueta a pantalla completa (antes «Inicio» y «Taller» eran dos pantallas)
const WorkshopHome = lazy(() => import('@/features/workshop/WorkshopFloorPage'))

/** Inicio del espacio: cabina (particular) o la maqueta del taller con su HUD (taller). */
export default function DashboardPage() {
  const ctx = useWorkspace()
  return ctx.isWorkshop ? <WorkshopHome /> : <PersonalDashboard />
}
