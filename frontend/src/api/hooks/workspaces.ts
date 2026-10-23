import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, type QueryParams } from '../client'
import { qk } from '../keys'
import type {
  Activity,
  ID,
  Member,
  Paginated,
  Reminder,
  Resource,
  Workspace,
  WorkspaceAnalytics,
  WorkspaceDashboard,
  WorkspaceRole,
  WorkspaceSettings,
} from '../types'
import { useInfiniteList } from './shared'

export function useDashboard(ws: ID | undefined) {
  return useQuery({
    queryKey: qk.dashboard(ws ?? 0),
    queryFn: async ({ signal }) => (await api.get<Resource<WorkspaceDashboard>>(`/workspaces/${ws}/dashboard`, undefined, { signal })).data,
    enabled: !!ws,
  })
}

export function useActivity(ws: ID, params: QueryParams = {}) {
  return useInfiniteList<Activity>(qk.activity(ws, params), `/workspaces/${ws}/activity`, params)
}

export function useWorkspaceReminders(ws: ID, params: QueryParams = {}) {
  return useQuery({
    queryKey: qk.wsReminders(ws, params),
    queryFn: ({ signal }) => api.get<Paginated<Reminder>>(`/workspaces/${ws}/reminders`, params, { signal }),
    placeholderData: keepPreviousData,
  })
}

export function useAnalytics(ws: ID, params: QueryParams = {}, enabled = true) {
  return useQuery({
    queryKey: qk.analytics(ws, params),
    queryFn: async ({ signal }) => (await api.get<Resource<WorkspaceAnalytics>>(`/workspaces/${ws}/analytics`, params, { signal })).data,
    placeholderData: keepPreviousData,
    enabled,
  })
}

// ───────── Espacios ─────────

export function useCreateWorkspace() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { name: string }) => (await api.post<Resource<Workspace>>('/workspaces', input)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.me }),
  })
}

export function useUpdateWorkspace(ws: ID) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { name?: string; settings?: Partial<Pick<WorkspaceSettings, 'bays_count' | 'tax_rate'>> }) =>
      (await api.patch<Resource<Workspace>>(`/workspaces/${ws}`, input)).data,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.me })
      void qc.invalidateQueries({ queryKey: qk.workspace(ws) })
    },
  })
}

export function useDeleteWorkspace() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (ws: ID) => api.delete<void>(`/workspaces/${ws}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.me }),
  })
}

// ───────── Miembros ─────────

export function useMembers(ws: ID) {
  return useQuery({
    queryKey: qk.members(ws),
    queryFn: async ({ signal }) => (await api.get<{ data: Member[] }>(`/workspaces/${ws}/members`, undefined, { signal })).data,
  })
}

export function useAddMember(ws: ID) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: { email: string; role: Exclude<WorkspaceRole, 'owner'> }) => api.post<Resource<Member>>(`/workspaces/${ws}/members`, input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.members(ws) })
      void qc.invalidateQueries({ queryKey: qk.me })
    },
  })
}

export function useUpdateMemberRole(ws: ID) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ userId, role }: { userId: ID; role: WorkspaceRole }) => api.patch<Resource<Member>>(`/workspaces/${ws}/members/${userId}`, { role }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.members(ws) })
      void qc.invalidateQueries({ queryKey: qk.me })
    },
  })
}

export function useRemoveMember(ws: ID) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (userId: ID) => api.delete<void>(`/workspaces/${ws}/members/${userId}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.members(ws) })
      void qc.invalidateQueries({ queryKey: qk.me })
    },
  })
}
