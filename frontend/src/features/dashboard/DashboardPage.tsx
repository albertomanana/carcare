import { lazy } from 'react'
import { useWorkspace } from '@/features/workspace/workspace-context'

const PersonalDashboard = lazy(() => import('./PersonalDashboard'))
const WorkshopDashboard = lazy(() => import('./WorkshopDashboard'))

/** Inicio del espacio: cabina (particular) o centro de control (taller). */
export default function DashboardPage() {
  const ctx = useWorkspace()
  return ctx.isWorkshop ? <WorkshopDashboard /> : <PersonalDashboard />
}
