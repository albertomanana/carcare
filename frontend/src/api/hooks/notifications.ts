/**
 * E16 · notificaciones en la app (contrato §3.13.8, ADR‑0007 decisión 4).
 * El contador se pide cada 60 s solo con la pestaña visible: `refetchInterval` sin `refetchIntervalInBackground`
 * (TanStack Query no lanza el intervalo con `document.hidden`). Al volver a la pestaña se refresca
 * (`refetchOnWindowFocus`, activo por defecto en App.tsx).
 */
import { type InfiniteData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../client'
import { qk } from '../keys'
import type { AppNotification, MarkNotificationsReadInput, NotificationCount, Paginated, Resource } from '../types'
import { useInfiniteList } from './shared'

export const NOTIFICATIONS_REFRESH_MS = 60_000
export const NOTIFICATIONS_PER_PAGE = 20

export function useNotificationsCount(enabled = true) {
  return useQuery({
    queryKey: qk.notificationsCount,
    queryFn: async ({ signal }) => (await api.get<Resource<NotificationCount>>('/notifications/count', undefined, { signal })).data,
    refetchInterval: NOTIFICATIONS_REFRESH_MS,
    refetchIntervalInBackground: false,
    staleTime: 0,
    enabled,
  })
}

/** Últimas notificaciones (20 por página, "Ver más" pide la siguiente). Solo se piden al abrir la campana. */
export function useNotifications(enabled: boolean) {
  const params = { per_page: NOTIFICATIONS_PER_PAGE }
  return useInfiniteList<AppNotification>(qk.notifications(params), '/notifications', params, enabled)
}

type ListData = InfiniteData<Paginated<AppNotification>> | undefined

/**
 * POST /notifications/read. Sin `ids`, todas. Actualiza en el momento el contador y la lista (optimista) y,
 * al terminar, vuelve a pedirlos para quedarse con lo que diga la API.
 */
export function useMarkNotificationsRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: MarkNotificationsReadInput) => api.post<void>('/notifications/read', input),
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: ['notifications'] })
      const now = new Date().toISOString()
      const ids = input.ids ? new Set(input.ids) : null
      let newlyRead = 0
      qc.setQueriesData<ListData>({ queryKey: ['notifications', 'list'] }, (old) => {
        if (!old) return old
        return {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            data: page.data.map((n) => {
              if (n.read_at || (ids && !ids.has(n.id))) return n
              newlyRead += 1
              return { ...n, read_at: now }
            }),
          })),
        }
      })
      qc.setQueryData<NotificationCount>(qk.notificationsCount, (old) => {
        if (!old) return old
        if (!ids) return { unread: 0 }
        return { unread: Math.max(0, old.unread - newlyRead) }
      })
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  })
}
