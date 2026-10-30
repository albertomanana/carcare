import { ClipboardList } from 'lucide-react'
import { Link } from 'react-router'
import { useRepairRequests } from '@/api/hooks/repairRequests'
import { flattenPages, totalFromPages } from '@/api/hooks/shared'
import type { RepairRequest } from '@/api/types'
import { Plate } from '@/components/ui/Badge'
import { ButtonLink } from '@/components/ui/Button'
import { LoadMore } from '@/components/ui/LoadMore'
import { PageHeader } from '@/components/ui/PageHeader'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState, ErrorState } from '@/components/ui/States'
import { useWorkspace } from '@/features/workspace/workspace-context'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useSearchParam } from '@/hooks/useSearchParam'
import { formatDate } from '@/lib/format'
import { RequestStatusLabel } from './components/RequestStatusLabel'

type Filter = 'abiertas' | 'todas'

/** E16 · "Solicitudes" del particular: las que ha enviado, de la más reciente a la más antigua (§3.13.1). */
export default function MyRequestsPage() {
  const ctx = useWorkspace()
  useDocumentTitle('Solicitudes')
  const [filterParam, setFilter] = useSearchParam('ver', 'todas')
  const filter: Filter = filterParam === 'abiertas' ? 'abiertas' : 'todas'
  const params = { per_page: 20, ...(filter === 'abiertas' ? { status: 'open' } : {}) }
  const list = useRepairRequests(ctx.id, params)
  const requests = flattenPages(list.data)
  const total = totalFromPages(list.data)
  const canRequest = ctx.can('own')

  const newAction = canRequest && (
    <ButtonLink to={`${ctx.base}/solicitudes/nueva`} variant="primary">
      Pedir reparación
    </ButtonLink>
  )

  return (
    <>
      <PageHeader title="Solicitudes" description="Reparaciones que has pedido a talleres de CarCare." actions={newAction} />

      <SegmentedControl<Filter>
        label="Qué solicitudes ver"
        value={filter}
        onValueChange={(v) => setFilter(v)}
        options={[
          { value: 'todas', label: 'Todas' },
          { value: 'abiertas', label: 'Abiertas' },
        ]}
        className="mb-5"
      />

      {list.isPending ? (
        <RequestsSkeleton />
      ) : list.isError ? (
        <ErrorState error={list.error} onRetry={() => void list.refetch()} />
      ) : requests.length === 0 ? (
        filter === 'abiertas' ? (
          <EmptyState
            compact
            icon={<ClipboardList />}
            title="No tienes solicitudes abiertas"
            description="Las que ya terminaron están en «Todas»."
          />
        ) : (
          <EmptyState
            icon={<ClipboardList />}
            title="Todavía no has pedido ninguna reparación"
            description="Busca un taller de CarCare, cuéntale qué le pasa a tu coche y te responderá con un presupuesto."
            action={
              canRequest && (
                <ButtonLink to={`${ctx.base}/talleres`} variant="primary">
                  Buscar un taller
                </ButtonLink>
              )
            }
          />
        )
      ) : (
        <>
          <ul className="divide-y divide-line border-y border-line" aria-label="Solicitudes enviadas">
            {requests.map((r) => (
              <RequestRow key={r.id} request={r} href={`${ctx.base}/solicitudes/${r.id}`} />
            ))}
          </ul>
          <LoadMore
            hasNextPage={!!list.hasNextPage}
            isFetchingNextPage={list.isFetchingNextPage}
            fetchNextPage={list.fetchNextPage}
            shown={requests.length}
            total={total}
            what="solicitudes"
          />
        </>
      )}
    </>
  )
}

/** Fila: coche y asunto a la izquierda; taller, fecha y estado debajo (móvil) o a la derecha (escritorio). */
function RequestRow({ request: r, href }: { request: RepairRequest; href: string }) {
  return (
    <li className="relative flex flex-col gap-1.5 px-1 py-3 transition-colors hover:bg-surface-2/60 has-[a:focus-visible]:outline-2 has-[a:focus-visible]:outline-accent sm:flex-row sm:items-center sm:gap-4">
      <div className="min-w-0 flex-1">
        <p className="flex min-w-0 items-baseline gap-2">
          <Link to={href} className="min-w-0 truncate font-medium text-fg outline-none after:absolute after:inset-0 after:content-['']">
            {r.title}
          </Link>
        </p>
        <p className="truncate text-sm text-fg-muted">
          {r.vehicle.display_name}
          {r.vehicle.plate && (
            <>
              {' · '}
              <Plate value={r.vehicle.plate} />
            </>
          )}
          {' · '}
          {r.workshop.name}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-3 sm:flex-col sm:items-end sm:gap-0.5">
        <RequestStatusLabel request={r} />
        <span className="text-xs text-fg-subtle tabular">Enviada el {formatDate(r.created_at)}</span>
      </div>
    </li>
  )
}

function RequestsSkeleton() {
  return (
    <div role="status" aria-live="polite" className="divide-y divide-line border-y border-line">
      <span className="sr-only">Cargando solicitudes…</span>
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} aria-hidden className="space-y-2 px-1 py-3.5">
          <Skeleton className="h-4 w-56 max-w-full" />
          <Skeleton className="h-3.5 w-72 max-w-full" />
        </div>
      ))}
    </div>
  )
}
