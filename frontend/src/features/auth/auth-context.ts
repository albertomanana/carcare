import { createContext, useContext } from 'react'
import type { Me, User, Workspace } from '@/api/types'

export type AuthStatus = 'loading' | 'authenticated' | 'anonymous' | 'error'

export interface AuthContextValue {
  status: AuthStatus
  me: Me | null
  user: User | null
  workspaces: Workspace[]
  error: unknown
  refetch: () => void
}

export const AuthContext = createContext<AuthContextValue>({
  status: 'loading',
  me: null,
  user: null,
  workspaces: [],
  error: null,
  refetch: () => {},
})

export function useAuth() {
  return useContext(AuthContext)
}
