import { useQueryClient } from '@tanstack/react-query'
import { type ReactNode, useEffect, useMemo } from 'react'
import { onUnauthorized } from '@/api/client'
import { useMeQuery } from '@/api/hooks/auth'
import { qk } from '@/api/keys'
import { type AuthContextValue, AuthContext } from './auth-context'

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient()
  const meQuery = useMeQuery()

  // Un 401 en cualquier petición ⇒ la sesión ha caducado: limpiamos y RequireAuth redirige al login.
  useEffect(
    () =>
      onUnauthorized(() => {
        if (qc.getQueryData(qk.me)) {
          qc.clear()
          qc.setQueryData(qk.me, null)
        }
      }),
    [qc],
  )

  const value = useMemo<AuthContextValue>(() => {
    const me = meQuery.data ?? null
    const status = meQuery.isPending ? 'loading' : meQuery.isError && !me ? 'error' : me ? 'authenticated' : 'anonymous'
    return {
      status,
      me,
      user: me?.user ?? null,
      workspaces: me?.workspaces ?? [],
      error: meQuery.error,
      refetch: () => void meQuery.refetch(),
    }
  }, [meQuery])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
