import { Store } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useDirectory } from '@/api/hooks/repairRequests'
import type { DirectoryWorkshop, WorkshopService } from '@/api/types'
import { ButtonLink } from '@/components/ui/Button'
import { SearchInput, Select } from '@/components/ui/inputs'
import { PageHeader } from '@/components/ui/PageHeader'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState, ErrorState } from '@/components/ui/States'
import { telHref } from '@/features/workshop/components/floor'
import { useWorkspace } from '@/features/workspace/workspace-context'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useSearchParam, useSearchParamsPatch } from '@/hooks/useSearchParam'
import { plural } from '@/lib/text'
import { WORKSHOP_SERVICE_LABEL, WORKSHOP_SERVICES } from './requestStatus'

const PER_PAGE = 50

/**
 * E16‑2 · Directorio de talleres de CarCare (solo los que el owner ha publicado). Búsqueda por nombre o ciudad y
 * filtro por servicio. Una fila por taller (R4); si falta un dato, no se muestra ni se rellena.
 */
export default function DirectoryPage() {
  const ctx = useWorkspace()
  useDocumentTitle('Talleres')
  const [q, setQ] = useSearchParam('q')
  const [service] = useSearchParam('servicio')
  const [vehiculo] = useSearchParam('vehiculo')
  const patch = useSearchParamsPatch()
  const [term, setTerm] = useState(q)
  const debounced = useDebouncedValue(term)
  const query = useDirectory({ search: q || undefined, service: service || undefined, per_page: PER_PAGE })
  const workshops = query.data?.data ?? []
  const total = query.data?.meta.total ?? null
  const canRequest = ctx.isPersonal && ctx.can('own')
  const filtered = !!(q || service)

  useEffect(() => {
    if (debounced !== q) setQ(debounced.trim() || null)
  }, [debounced, q, setQ])

  const requestHref = (w: DirectoryWorkshop) => {
    const params = new URLSearchParams({ taller: String(w.id) })
    if (vehiculo) params.set('vehiculo', vehiculo)
    return `${ctx.base}/solicitudes/nueva?${params}`
  }

  return (
    <>
      <PageHeader
        title="Talleres"
        description={
          canRequest
            ? 'Talleres de CarCare a los que puedes pedir una reparación. Solo aparecen los que han decidido publicarse.'
            : 'Talleres de CarCare que han decidido publicarse. Las solicitudes se envían desde un espacio personal.'
        }
      />

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchInput
          value={term}
          onValueChange={setTerm}
          aria-label="Buscar taller por nombre o ciudad"
          placeholder="Nombre o ciudad…"
          className="w-full sm:max-w-sm"
        />
        <Select
          aria-label="Filtrar por servicio"
          value={service}
          onChange={(e) => patch({ servicio: e.target.value || null })}
          className="sm:w-64"
        >
          <option value="">Todos los servicios</option>
          {WORKSHOP_SERVICES.map((s) => (
            <option key={s} value={s}>
              {WORKSHOP_SERVICE_LABEL[s]}
            </option>
          ))}
        </Select>
      </div>

      {query.isPending ? (
        <DirectorySkeleton />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : workshops.length === 0 ? (
        filtered ? (
          <EmptyState
            compact
            icon={<Store />}
            title="No hay talleres con ese nombre o ciudad"
            description={service ? `Ni con el servicio «${WORKSHOP_SERVICE_LABEL[service as WorkshopService] ?? service}». Prueba con otra búsqueda.` : 'Prueba con otra búsqueda.'}
          />
        ) : (
          <EmptyState icon={<Store />} title="Todavía no hay talleres en el directorio" description="Cuando un taller de CarCare se publique, aparecerá aquí." />
        )
      ) : (
        <>
          <p className="mb-2 text-sm text-fg-muted" aria-live="polite">
            {filtered ? plural(total ?? workshops.length, 'taller coincide', 'talleres coinciden') : plural(total ?? workshops.length, 'taller', 'talleres')}
            {total !== null && total > workshops.length && ` · se muestran los ${workshops.length} primeros: afina la búsqueda`}
          </p>
          <ul className="divide-y divide-line border-y border-line" aria-label="Talleres del directorio">
            {workshops.map((w) => (
              <WorkshopRow key={w.id} workshop={w} action={canRequest && !w.is_member ? requestHref(w) : null} />
            ))}
          </ul>
        </>
      )}
    </>
  )
}

function WorkshopRow({ workshop: w, action }: { workshop: DirectoryWorkshop; action: string | null }) {
  const place = [w.city, w.address].filter(Boolean).join(' · ')
  return (
    <li className="flex flex-col gap-3 py-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 space-y-0.5">
        <h2 className="font-display text-base font-semibold text-fg-warm">{w.name}</h2>
        <p className="text-sm text-fg-muted">{place}</p>
        {w.phone && (
          <p className="text-sm">
            <a href={telHref(w.phone)} className="text-fg-muted tabular underline-offset-2 hover:text-fg hover:underline">
              <span className="sr-only">Llamar al </span>
              {w.phone}
            </a>
          </p>
        )}
        {w.services.length > 0 && (
          <p className="text-sm text-fg">
            <span className="sr-only">Servicios: </span>
            {w.services.map((s) => WORKSHOP_SERVICE_LABEL[s]).join(' · ')}
          </p>
        )}
        {w.opening_hours && (
          <p className="text-sm text-fg-muted">
            <span className="sr-only">Horario: </span>
            {w.opening_hours}
          </p>
        )}
      </div>
      {action ? (
        <ButtonLink to={action} size="sm" className="shrink-0 self-start" aria-label={`Solicitar reparación a ${w.name}`}>
          Solicitar reparación
        </ButtonLink>
      ) : w.is_member ? (
        <p className="shrink-0 text-sm text-fg-subtle">Formas parte de este taller</p>
      ) : null}
    </li>
  )
}

function DirectorySkeleton() {
  return (
    <div role="status" aria-live="polite" className="divide-y divide-line border-y border-line">
      <span className="sr-only">Cargando talleres…</span>
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} aria-hidden className="space-y-2 py-4">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-3.5 w-64 max-w-full" />
          <Skeleton className="h-3.5 w-80 max-w-full" />
        </div>
      ))}
    </div>
  )
}
