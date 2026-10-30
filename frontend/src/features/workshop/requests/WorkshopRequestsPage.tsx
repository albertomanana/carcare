import { ChevronRight, Inbox } from 'lucide-react'
import { Link } from 'react-router'
import { useDirectoryProfile, useRepairRequests } from '@/api/hooks/repairRequests'
import { flattenPages, totalFromPages } from '@/api/hooks/shared'
import { useRepairRequestCount } from '@/api/hooks/workshopRequests'
import type { RepairRequest } from '@/api/types'
import { Plate, StatusPill } from '@/components/ui/Badge'
import { ButtonLink } from '@/components/ui/Button'
import { LoadMore } from '@/components/ui/LoadMore'
import { PageHeader } from '@/components/ui/PageHeader'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState, ErrorState } from '@/components/ui/States'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs'
import { requestStatusDescriptor } from '@/features/requests/requestStatus'
import { useWorkspace } from '@/features/workspace/workspace-context'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useSearchParam } from '@/hooks/useSearchParam'
import { formatDate, formatRelativeTime } from '@/lib/format'
import { ZONE_LABEL } from '@/lib/labels'
import { TONE_CLASSES } from '@/lib/status'
import { plural } from '@/lib/text'

type TabId = 'nuevas' | 'abiertas' | 'todas'

const TABS: { id: TabId; label: string; status?: string; caption: string }[] = [
  { id: 'nuevas', label: 'Nuevas', status: 'pending', caption: 'Solicitudes nuevas' },
  { id: 'abiertas', label: 'Abiertas', status: 'open', caption: 'Solicitudes abiertas' },
  { id: 'todas', label: 'Todas', caption: 'Todas las solicitudes' },
]

/**
 * Bandeja del taller (E16‑4): solicitudes que llegan desde el directorio, en lista (R4). Pestañas Nuevas, Abiertas
 * y Todas guardadas en la URL (`?ver=`). Solo se pide la pestaña visible y el contador de nuevas (R12).
 */
export default function WorkshopRequestsPage() {
  const ctx = useWorkspace()
  useDocumentTitle('Solicitudes')
  const [ver, setVer] = useSearchParam('ver', 'nuevas')
  const active: TabId = TABS.some((t) => t.id === ver) ? (ver as TabId) : 'nuevas'
  const pending = useRepairRequestCount(ctx.id, 'pending')
  const newCount = pending.data ?? 0

  return (
    <>
      <PageHeader
        title="Solicitudes"
        description={newCount > 0 ? `${plural(newCount, 'solicitud nueva', 'solicitudes nuevas')} por responder.` : undefined}
      />
      <Tabs value={active} onValueChange={(v) => setVer(v)}>
        <TabsList aria-label="Qué solicitudes ver" className="w-fit">
          {TABS.map((t) => (
            <TabsTrigger key={t.id} value={t.id}>
              {t.label}
              {t.id === 'nuevas' && newCount > 0 && (
                <span className="text-fg-muted tabular">
                  <span className="sr-only">:</span> {newCount}
                </span>
              )}
            </TabsTrigger>
          ))}
        </TabsList>
        {TABS.map((t) => (
          <TabsContent key={t.id} value={t.id}>
            <RequestList tab={t.id} status={t.status} caption={t.caption} onShowAll={() => setVer('todas')} />
          </TabsContent>
        ))}
      </Tabs>
    </>
  )
}

function RequestList({ tab, status, caption, onShowAll }: { tab: TabId; status?: string; caption: string; onShowAll: () => void }) {
  const ctx = useWorkspace()
  const list = useRepairRequests(ctx.id, { status, per_page: 20 })
  const requests = flattenPages(list.data)
  const total = totalFromPages(list.data)

  if (list.isPending) return <RequestListSkeleton />
  if (list.isError) return <ErrorState error={list.error} onRetry={() => void list.refetch()} />
  if (requests.length === 0) return <RequestsEmpty tab={tab} onShowAll={onShowAll} />

  return (
    <>
      <ul className="border-t border-line" aria-label={caption}>
        {requests.map((r) => (
          <RequestRow key={r.id} request={r} to={`${ctx.base}/solicitudes/${r.id}`} />
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
  )
}

/** Fila enlazada sin caja. Píldora solo si te toca actuar (R5); el resto del estado, en texto con su icono. */
function RequestRow({ request: r, to }: { request: RepairRequest; to: string }) {
  const status = requestStatusDescriptor(r)
  const StatusIcon = status.icon
  const sub = [r.requester.name, r.zone ? ZONE_LABEL[r.zone] : null, `quiere venir el ${formatDate(r.preferred_date)}`].filter(Boolean).join(' · ')
  return (
    <li className="border-b border-line">
      <Link to={to} className="group flex items-center gap-3 px-1 py-2.5 transition-colors duration-150 hover:bg-surface-2/60">
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            <span className="min-w-0 truncate text-sm font-medium text-fg">{r.title}</span>
            {status.attention ? (
              <StatusPill status={status} size="sm" />
            ) : (
              <span className={`inline-flex items-center gap-1 text-xs ${TONE_CLASSES[status.tone].text}`}>
                <StatusIcon aria-hidden className="size-3.5" />
                {status.label}
              </span>
            )}
          </div>
          <p className="mt-0.5 truncate text-xs text-fg-muted">
            {r.vehicle.display_name}
            {r.vehicle.plate && (
              <>
                {' '}
                <Plate value={r.vehicle.plate} />
              </>
            )}
            {' · '}
            <span className="tabular">{sub}</span>
          </p>
          <p className="mt-0.5 text-xs text-fg-subtle sm:hidden">Recibida {formatRelativeTime(r.created_at, new Date(), { pastOnly: true })}</p>
        </div>
        <span className="hidden shrink-0 text-xs text-fg-subtle sm:block">Recibida {formatRelativeTime(r.created_at, new Date(), { pastOnly: true })}</span>
        <ChevronRight aria-hidden className="size-4 shrink-0 text-fg-subtle transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" />
      </Link>
    </li>
  )
}

function RequestListSkeleton() {
  return (
    <div role="status" aria-live="polite" className="border-t border-line">
      <span className="sr-only">Cargando solicitudes…</span>
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} aria-hidden className="space-y-2 border-b border-line px-1 py-3">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-3 w-56" />
        </div>
      ))}
    </div>
  )
}

/**
 * Vacío con salida. En "Nuevas" y "Abiertas" se lleva a "Todas"; si el taller no sale en el directorio, se dice
 * (nadie puede enviarle solicitudes nuevas) y el propietario tiene el enlace para activarlo.
 */
function RequestsEmpty({ tab, onShowAll }: { tab: TabId; onShowAll: () => void }) {
  const ctx = useWorkspace()
  const profile = useDirectoryProfile(ctx.id)
  const notListed = profile.data && !profile.data.listed
  const isOwner = ctx.can('own')

  const title = tab === 'nuevas' ? 'No hay solicitudes nuevas' : tab === 'abiertas' ? 'No hay solicitudes abiertas' : 'Todavía no has recibido solicitudes'
  const description = notListed
    ? isOwner
      ? 'Tu taller no aparece en el directorio, así que los particulares no pueden enviarte solicitudes. Actívalo en Ajustes.'
      : 'Tu taller no aparece en el directorio, así que los particulares no pueden enviarte solicitudes. Solo el propietario puede activarlo.'
    : 'Los particulares te encuentran en el directorio de CarCare y te piden presupuesto desde aquí. Cuando llegue una, la verás en esta lista.'

  return (
    <EmptyState
      icon={<Inbox />}
      title={title}
      description={description}
      action={
        notListed && isOwner ? (
          <ButtonLink to="/app/ajustes#directorio">Aparecer en el directorio</ButtonLink>
        ) : tab !== 'todas' ? (
          <button type="button" onClick={onShowAll} className="text-sm font-medium text-fg underline-offset-4 hover:underline">
            Ver todas las solicitudes
          </button>
        ) : undefined
      }
    />
  )
}
