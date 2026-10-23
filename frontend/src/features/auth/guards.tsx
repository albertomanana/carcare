import type { ReactNode } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router'
import { Splash } from '@/components/layout/Logo'
import { ErrorState } from '@/components/ui/States'
import { safeRedirect } from '@/lib/navigation'
import { readStorage, STORAGE_KEYS } from '@/lib/storage'
import { useAuth } from './auth-context'

/** Rutas privadas: sin sesión ⇒ /entrar?volver=<ruta pedida>. */
export function RequireAuth() {
  const { status, error, refetch } = useAuth()
  const location = useLocation()
  if (status === 'loading') return <Splash />
  if (status === 'error')
    return (
      <div className="grid min-h-dvh place-items-center p-6">
        <ErrorState error={error} onRetry={refetch} className="w-full max-w-md" />
      </div>
    )
  if (status === 'anonymous') {
    const back = location.pathname + location.search
    return <Navigate to={`/entrar?volver=${encodeURIComponent(back)}`} replace />
  }
  return <Outlet />
}

/** Login/registro: con sesión ⇒ a la app. */
export function GuestOnly({ children }: { children: ReactNode }) {
  const { status } = useAuth()
  const location = useLocation()
  if (status === 'loading') return <Splash />
  if (status === 'authenticated') {
    const back = new URLSearchParams(location.search).get('volver')
    return <Navigate to={safeRedirect(back) ?? '/app'} replace />
  }
  return <>{children}</>
}

/** /app ⇒ último espacio usado o el personal. */
export function AppIndexRedirect() {
  const { workspaces } = useAuth()
  const last = Number(readStorage(STORAGE_KEYS.lastWorkspace))
  const personal = workspaces.find((w) => w.type === 'personal')
  const workshop = workspaces.find((w) => w.type === 'workshop')
  // Sin preferencia guardada: el garaje personal, salvo que esté vacío y la persona trabaje en un taller
  const fallback = personal && (personal.vehicles_count > 0 || !workshop) ? personal : (workshop ?? personal)
  const target = workspaces.find((w) => w.id === last) ?? fallback ?? workspaces[0]
  if (!target) return <Navigate to="/app/ajustes" replace />
  return <Navigate to={`/app/${target.id}`} replace />
}
