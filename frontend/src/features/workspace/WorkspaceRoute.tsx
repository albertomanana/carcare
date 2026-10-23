import { useEffect, useMemo } from 'react'
import { Outlet, useParams } from 'react-router'
import { useAuth } from '@/features/auth/auth-context'
import { NotFoundPage } from '@/features/errors/NotFoundPage'
import { readStorage, STORAGE_KEYS, writeStorage } from '@/lib/storage'
import { buildWorkspaceContext, WorkspaceContext } from './workspace-context'

/** /app/:ws — resuelve el espacio activo desde la URL y lo expone por contexto. */
export function WorkspaceRoute() {
  const { ws } = useParams()
  const { workspaces } = useAuth()
  const workspace = workspaces.find((w) => String(w.id) === ws)
  const value = useMemo(() => (workspace ? buildWorkspaceContext(workspace) : null), [workspace])

  useEffect(() => {
    if (workspace) writeStorage(STORAGE_KEYS.lastWorkspace, String(workspace.id))
  }, [workspace])

  if (!value) return <NotFoundPage title="Espacio no encontrado" description="Este espacio no existe o no perteneces a él." />
  return (
    <WorkspaceContext.Provider value={value}>
      <Outlet />
    </WorkspaceContext.Provider>
  )
}

/** Rutas sin :ws (Ajustes): usan el último espacio o el personal para la navegación. */
export function DefaultWorkspaceRoute() {
  const { workspaces } = useAuth()
  const last = Number(readStorage(STORAGE_KEYS.lastWorkspace))
  const workspace = workspaces.find((w) => w.id === last) ?? workspaces.find((w) => w.type === 'personal') ?? workspaces[0]
  const value = useMemo(() => (workspace ? buildWorkspaceContext(workspace) : null), [workspace])
  if (!value) return <Outlet />
  return (
    <WorkspaceContext.Provider value={value}>
      <Outlet />
    </WorkspaceContext.Provider>
  )
}
