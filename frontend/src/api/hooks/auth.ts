import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { STORAGE_KEYS, writeStorage } from '@/lib/storage'
import { api, ensureCsrfCookie, isApiError } from '../client'
import { qk } from '../keys'
import type { ForgotPasswordInput, LoginInput, Me, RegisterInput, ResetPasswordInput, Resource, User } from '../types'

/** Sesión actual. null = sin sesión (401). */
export function useMeQuery() {
  return useQuery({
    queryKey: qk.me,
    queryFn: async ({ signal }) => {
      try {
        const res = await api.get<Resource<Me>>('/me', undefined, { signal, silentUnauthorized: true })
        return res.data
      } catch (err) {
        if (isApiError(err) && err.status === 401) return null
        throw err
      }
    },
    staleTime: 5 * 60_000,
    retry: (count, err) => !(isApiError(err) && err.status < 500 && err.status !== 0) && count < 2,
  })
}

export function useLogin() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: LoginInput) => {
      await ensureCsrfCookie()
      const res = await api.post<Resource<Me>>('/auth/login', input)
      return res.data
    },
    onSuccess: (me) => {
      qc.setQueryData(qk.me, me)
    },
  })
}

export function useRegister() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: RegisterInput) => {
      await ensureCsrfCookie()
      const res = await api.post<Resource<Me>>('/auth/register', input)
      // Si se registra como taller, entra directamente en su espacio de taller
      const workshop = input.account_type === 'workshop' ? res.data.workspaces.find((w) => w.type === 'workshop') : undefined
      const target = workshop ?? res.data.workspaces.find((w) => w.type === 'personal')
      if (target) writeStorage(STORAGE_KEYS.lastWorkspace, String(target.id))
      return res.data
    },
    onSuccess: (me) => {
      qc.setQueryData(qk.me, me)
    },
  })
}

/** POST /auth/forgot-password: 204 siempre, exista o no la cuenta (contrato §3.1.1). */
export function useForgotPassword() {
  return useMutation({
    mutationFn: async (input: ForgotPasswordInput) => {
      await ensureCsrfCookie()
      await api.post<void>('/auth/forgot-password', input)
    },
  })
}

/** POST /auth/reset-password: 204, cierra todas las sesiones y no inicia sesión (contrato §3.1.1). */
export function useResetPassword() {
  return useMutation({
    mutationFn: async (input: ResetPasswordInput) => {
      await ensureCsrfCookie()
      await api.post<void>('/auth/reset-password', input)
    },
  })
}

export function useLogout() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api.post<void>('/auth/logout'),
    onSettled: () => {
      qc.clear()
      qc.setQueryData(qk.me, null)
    },
  })
}

export function useUpdateProfile() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: Partial<Pick<User, 'name' | 'email'>>) => (await api.patch<Resource<Me>>('/me', input)).data,
    onSuccess: (me) => qc.setQueryData(qk.me, me),
  })
}

export function useChangePassword() {
  return useMutation({
    mutationFn: (input: { current_password: string; password: string; password_confirmation: string }) =>
      api.put<void>('/me/password', input),
  })
}

export function useDeleteAccount() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: { password: string }) => api.delete<void>('/me', input),
    onSuccess: () => {
      qc.clear()
      qc.setQueryData(qk.me, null)
    },
  })
}
