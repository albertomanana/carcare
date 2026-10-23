import { type QueryClient, type QueryKey, useInfiniteQuery } from '@tanstack/react-query'
import { api, type QueryParams } from '../client'
import type { ID, Paginated } from '../types'

/** Listado paginado con "Cargar más" (meta.current_page / last_page del contrato). */
export function useInfiniteList<T>(key: QueryKey, path: string, params: QueryParams = {}, enabled = true) {
  return useInfiniteQuery({
    queryKey: [...key, 'infinite'],
    queryFn: ({ pageParam, signal }) => api.get<Paginated<T>>(path, { ...params, page: pageParam }, { signal }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.meta.current_page < last.meta.last_page ? last.meta.current_page + 1 : undefined),
    enabled,
  })
}

/** Aplana las páginas de un useInfiniteList. */
export function flattenPages<T>(data: { pages: Paginated<T>[] } | undefined): T[] {
  return data?.pages.flatMap((p) => p.data) ?? []
}

export function totalFromPages<T>(data: { pages: Paginated<T>[] } | undefined): number | null {
  return data?.pages[0]?.meta.total ?? null
}

/**
 * Tras escribir algo de un vehículo, todo lo que cuelga de él y de los espacios puede haber cambiado
 * (km actuales, resumen, zonas, diario, dashboard, agenda, actividad…).
 */
export function invalidateVehicle(qc: QueryClient, vehicleId: ID) {
  return Promise.all([
    qc.invalidateQueries({ queryKey: ['vehicles', vehicleId] }),
    qc.invalidateQueries({ queryKey: ['workspaces'] }),
  ])
}

export function invalidateWorkspace(qc: QueryClient, ws: ID) {
  return qc.invalidateQueries({ queryKey: ['workspaces', ws] })
}
