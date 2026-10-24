import { Archive, ArchiveRestore, ChevronDown, ClipboardList, FileText, History, Link2, Pencil, Plus, Receipt } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router'
import { toast } from 'sonner'
import { errorMessage } from '@/api/client'
import { useArchiveRecord, useMaintenanceList } from '@/api/hooks/records'
import { flattenPages, totalFromPages } from '@/api/hooks/shared'
import type { MaintenanceRecord, RecordType } from '@/api/types'
import { Badge } from '@/components/ui/Badge'
import { Button, ButtonLink } from '@/components/ui/Button'
import { SearchInput, Select } from '@/components/ui/inputs'
import { LoadMore } from '@/components/ui/LoadMore'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState, ErrorState, NoResults } from '@/components/ui/States'
import { useWorkspace } from '@/features/workspace/workspace-context'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { useSearchParam } from '@/hooks/useSearchParam'
import { cn } from '@/lib/cn'
import { formatDate, formatKm, formatMoney, formatNumber } from '@/lib/format'
import { ITEM_KIND_LABEL, RECORD_TYPE_ICON, RECORD_TYPE_LABEL, SERVICE_KIND_LABEL, ZONE_LABEL, ZONES } from '@/lib/labels'
import { useVehicleOutlet } from '../vehicle-outlet'

const TYPES = Object.keys(RECORD_TYPE_LABEL) as RecordType[]

export default function HistoryTab() {
  const { vehicle } = useVehicleOutlet()
  const ctx = useWorkspace()
  const location = useLocation()
  const [q, setQ] = useSearchParam('q')
  const [type, setType] = useSearchParam('tipo')
  const [zone, setZone] = useSearchParam('zona')
  const [year, setYear] = useSearchParam('anio')
  const [archivedParam, setArchived] = useSearchParam('archivadas', '0')
  const archived = archivedParam === '1'
  const [term, setTerm] = useState(q)
  const debounced = useDebouncedValue(term)
  useEffect(() => {
    if (debounced !== q) setQ(debounced)
  }, [debounced, q, setQ])

  const list = useMaintenanceList(vehicle.id, { search: q, type, zone, year, archived: archived ? 1 : 0, per_page: 20 })
  const records = flattenPages(list.data)
  const filtering = !!(q || type || zone || year)
  const canOperate = ctx.can('operate') && !vehicle.archived_at
  const base = `${ctx.base}/vehiculos/${vehicle.id}`
  const thisYear = new Date().getFullYear()
  const firstYear = Math.max(1990, Math.min(vehicle.year ?? thisYear - 10, thisYear))
  const years = Array.from({ length: thisYear - firstYear + 1 }, (_, i) => thisYear - i)

  // Enlaces del tipo #intervencion-12: desplazarse hasta la tarjeta
  const hashId = /^#intervencion-(\d+)$/.exec(location.hash)?.[1]
  useEffect(() => {
    if (!hashId || !records.length) return
    document.getElementById(`intervencion-${hashId}`)?.scrollIntoView({ block: 'center' })
  }, [hashId, records.length])

  const reset = () => {
    setTerm('')
    setQ(null)
    setType(null)
    setZone(null)
    setYear(null)
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <SearchInput value={term} onValueChange={setTerm} aria-label="Buscar en el historial por título, taller o descripción" placeholder="Buscar en el historial…" className="lg:w-72" />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:flex">
          <Select aria-label="Filtrar por tipo" value={type} onChange={(e) => setType(e.target.value)} className="lg:w-40">
            <option value="">Todos los tipos</option>
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {RECORD_TYPE_LABEL[t]}
              </option>
            ))}
          </Select>
          <Select aria-label="Filtrar por zona" value={zone} onChange={(e) => setZone(e.target.value)} className="lg:w-44">
            <option value="">Todas las zonas</option>
            {ZONES.map((z) => (
              <option key={z} value={z}>
                {ZONE_LABEL[z]}
              </option>
            ))}
          </Select>
          <Select aria-label="Filtrar por año" value={year} onChange={(e) => setYear(e.target.value)} className="lg:w-32">
            <option value="">Todos los años</option>
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </Select>
          <Select aria-label="Mostrar archivadas o activas" value={archived ? '1' : '0'} onChange={(e) => setArchived(e.target.value)} className="lg:w-36">
            <option value="0">Activas</option>
            <option value="1">Archivadas</option>
          </Select>
        </div>
        {canOperate && (
          <ButtonLink to={`${base}/intervenciones/nueva`} icon={<Plus aria-hidden />} className="lg:ml-auto">
            Nueva intervención
          </ButtonLink>
        )}
      </div>

      {list.isPending ? (
        <div role="status" className="space-y-3">
          <span className="sr-only">Cargando historial…</span>
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-card" />
          ))}
        </div>
      ) : list.isError ? (
        <ErrorState error={list.error} onRetry={() => void list.refetch()} />
      ) : records.length === 0 ? (
        filtering ? (
          <NoResults what="intervenciones" onReset={reset} />
        ) : archived ? (
          <EmptyState compact icon={<Archive />} title="No hay intervenciones archivadas" />
        ) : (
          <EmptyState
            icon={<History />}
            title="El historial está vacío"
            description="Registra mantenimientos, reparaciones, averías o la ITV: con piezas, mano de obra y facturas."
            action={
              canOperate && (
                <ButtonLink to={`${base}/intervenciones/nueva`} icon={<Plus aria-hidden />}>
                  Nueva intervención
                </ButtonLink>
              )
            }
          />
        )
      ) : (
        <>
          <ol className="relative space-y-3 before:absolute before:bottom-4 before:left-[19px] before:top-4 before:w-px before:bg-line" aria-label="Intervenciones, de la más reciente a la más antigua">
            {records.map((r) => (
              <RecordCard key={r.id} record={r} base={base} canOperate={canOperate} showMoney={ctx.canExpenses || ctx.isPersonal} vehicleId={vehicle.id} highlighted={hashId === String(r.id)} />
            ))}
          </ol>
          <LoadMore hasNextPage={!!list.hasNextPage} isFetchingNextPage={list.isFetchingNextPage} fetchNextPage={list.fetchNextPage} shown={records.length} total={totalFromPages(list.data)} what="intervenciones" />
        </>
      )}
    </div>
  )
}

function RecordCard({
  record: r,
  base,
  canOperate,
  showMoney,
  vehicleId,
  highlighted,
}: {
  record: MaintenanceRecord
  base: string
  canOperate: boolean
  showMoney: boolean
  vehicleId: number
  highlighted: boolean
}) {
  const ctx = useWorkspace()
  const [open, setOpen] = useState(highlighted)
  const archive = useArchiveRecord(vehicleId)
  const Icon = RECORD_TYPE_ICON[r.type]
  const archived = !!r.archived_at
  const detailId = `intervencion-${r.id}-detalle`

  const toggleArchive = () =>
    archive.mutate(
      { id: r.id, restore: archived },
      {
        onSuccess: () => toast.success(archived ? 'Intervención restaurada' : 'Intervención archivada: deja de contar en zonas y gastos'),
        onError: (err) => toast.error(errorMessage(err)),
      },
    )

  return (
    <li id={`intervencion-${r.id}`} className="relative scroll-mt-32 pl-12">
      <span
        aria-hidden
        className={cn(
          'absolute left-0 top-4 grid size-10 place-items-center rounded-full border-4 border-canvas bg-surface-2 text-fg-muted',
          r.type === 'breakdown' && 'bg-danger-soft text-danger',
          r.type === 'inspection' && 'bg-info-soft text-info',
        )}
      >
        <Icon className="size-4" />
      </span>
      <article className={cn('rounded-card border bg-surface', highlighted ? 'border-accent/60' : 'border-line', archived && 'opacity-80')}>
        <div className="flex flex-wrap items-start gap-3 p-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-medium text-fg">{r.title}</h2>
              {archived && <Badge size="sm">Archivada</Badge>}
            </div>
            <p className="mt-0.5 text-sm text-fg-muted tabular">
              {[formatDate(r.service_date), r.mileage !== null ? formatKm(r.mileage) : null, r.workshop_name].filter(Boolean).join(' · ')}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Badge size="sm">{RECORD_TYPE_LABEL[r.type]}</Badge>
              <Badge size="sm">{ZONE_LABEL[r.zone]}</Badge>
              {r.service_kind && r.service_kind !== 'other' && <Badge size="sm">{SERVICE_KIND_LABEL[r.service_kind]}</Badge>}
              {r.documents_count > 0 && (
                <Badge size="sm" icon={<FileText aria-hidden />}>
                  {r.documents_count} {r.documents_count === 1 ? 'documento' : 'documentos'}
                </Badge>
              )}
              {r.work_order_id && (
                <Badge size="sm" tone="info" icon={<ClipboardList aria-hidden />}>
                  Desde orden de trabajo
                </Badge>
              )}
            </div>
          </div>
          {showMoney && (
            <div className="text-right">
              <p className="font-display text-lg font-semibold text-fg-warm tabular">{r.total_cost ? formatMoney(r.total_cost) : '—'}</p>
              {r.expense_id && <p className="text-xs text-fg-subtle">Cuenta como gasto</p>}
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1 border-t border-line px-2 py-1.5">
          <Button variant="ghost" size="sm" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls={detailId} iconRight={<ChevronDown aria-hidden className={cn('transition-transform', open && 'rotate-180')} />}>
            {open ? 'Ocultar detalle' : 'Ver detalle'}
          </Button>
          <div className="flex-1" />
          {canOperate && !archived && !r.work_order_id && (
            <ButtonLink variant="ghost" size="sm" to={`${base}/intervenciones/${r.id}/editar`} icon={<Pencil aria-hidden />}>
              Editar
            </ButtonLink>
          )}
          {canOperate && (
            <Button variant="ghost" size="sm" onClick={toggleArchive} loading={archive.isPending} icon={archived ? <ArchiveRestore aria-hidden /> : <Archive aria-hidden />}>
              {archived ? 'Restaurar' : 'Archivar'}
            </Button>
          )}
        </div>
        {open && (
          <div id={detailId} className="space-y-4 border-t border-line p-4 text-sm animate-fade-in">
            {r.description ? <p className="whitespace-pre-line text-fg-muted">{r.description}</p> : <p className="italic text-fg-subtle">Sin descripción.</p>}
            {r.items.length > 0 ? (
              <div className="overflow-x-auto rounded-control border border-line">
                <table className="w-full min-w-[480px] text-sm">
                  <caption className="sr-only">Líneas de la intervención</caption>
                  <thead className="bg-surface-2/50 text-left text-xs text-fg-subtle">
                    <tr>
                      <th scope="col" className="px-3 py-2 font-medium">
                        Concepto
                      </th>
                      <th scope="col" className="px-3 py-2 font-medium">
                        Tipo
                      </th>
                      <th scope="col" className="px-3 py-2 text-right font-medium">
                        Cant.
                      </th>
                      {showMoney && (
                        <>
                          <th scope="col" className="px-3 py-2 text-right font-medium">
                            Precio/u
                          </th>
                          <th scope="col" className="px-3 py-2 text-right font-medium">
                            Total
                          </th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {r.items.map((it, i) => (
                      <tr key={it.id ?? i}>
                        <td className="px-3 py-2 text-fg">
                          {it.name}
                          {it.part_number && <span className="block text-xs text-fg-subtle">Ref. {it.part_number}</span>}
                        </td>
                        <td className="px-3 py-2 text-fg-muted">{ITEM_KIND_LABEL[it.kind]}</td>
                        <td className="px-3 py-2 text-right tabular">{formatNumber(it.quantity, 2)}</td>
                        {showMoney && (
                          <>
                            <td className="px-3 py-2 text-right tabular">{formatMoney(it.unit_price)}</td>
                            <td className="px-3 py-2 text-right font-medium tabular">{formatMoney(it.total)}</td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-fg-subtle">Sin líneas de piezas o mano de obra.</p>
            )}
            {showMoney && (r.parts_cost || r.labor_cost) && (
              <dl className="flex flex-wrap gap-x-6 gap-y-1 text-fg-muted">
                {r.parts_cost && (
                  <div>
                    <dt className="inline">Piezas: </dt>
                    <dd className="inline text-fg tabular">{formatMoney(r.parts_cost)}</dd>
                  </div>
                )}
                {r.labor_cost && (
                  <div>
                    <dt className="inline">Mano de obra: </dt>
                    <dd className="inline text-fg tabular">{formatMoney(r.labor_cost)}</dd>
                  </div>
                )}
              </dl>
            )}
            <div className="flex flex-wrap gap-x-4 gap-y-2">
              {r.documents_count > 0 && (
                <Link to={`${base}/documentos?intervencion=${r.id}`} className="inline-flex items-center gap-1.5 font-medium text-accent-ink hover:underline">
                  <FileText aria-hidden className="size-4" />
                  Ver documentos
                </Link>
              )}
              {r.expense_id && ctx.canExpenses && (
                <Link to={`${base}/gastos`} className="inline-flex items-center gap-1.5 font-medium text-accent-ink hover:underline">
                  <Receipt aria-hidden className="size-4" />
                  Gasto vinculado
                </Link>
              )}
              {r.work_order_id && ctx.isWorkshop && (
                <Link to={`${ctx.base}/ordenes/${r.work_order_id}`} className="inline-flex items-center gap-1.5 font-medium text-accent-ink hover:underline">
                  <Link2 aria-hidden className="size-4" />
                  Orden de trabajo
                </Link>
              )}
            </div>
          </div>
        )}
      </article>
    </li>
  )
}
