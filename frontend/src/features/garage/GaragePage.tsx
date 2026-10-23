import { Archive, CarFront, Plus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { flattenPages, totalFromPages } from '@/api/hooks/shared'
import { useVehiclesInfinite } from '@/api/hooks/vehicles'
import { ButtonLink } from '@/components/ui/Button'
import { SearchInput, Select } from '@/components/ui/inputs'
import { LoadMore } from '@/components/ui/LoadMore'
import { PageHeader } from '@/components/ui/PageHeader'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { EmptyState, ErrorState, NoResults } from '@/components/ui/States'
import { VehicleCard, VehicleCardSkeleton } from '@/components/vehicles/VehicleCard'
import { useWorkspace } from '@/features/workspace/workspace-context'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useSearchParam } from '@/hooks/useSearchParam'

const SORTS = [
  { value: 'recent', label: 'Recientes' },
  { value: 'name', label: 'Nombre' },
  { value: 'mileage', label: 'Kilometraje' },
]

/** Garaje (particular) o flota de vehículos (taller). */
export default function GaragePage() {
  const ctx = useWorkspace()
  const title = ctx.isWorkshop ? 'Vehículos' : 'Garaje'
  useDocumentTitle(title)
  const [tab, setTab] = useSearchParam('ver', 'activos')
  const [sort, setSort] = useSearchParam('orden', 'recent')
  const [q, setQ] = useSearchParam('q')
  const [term, setTerm] = useState(q)
  const debounced = useDebouncedValue(term)
  const archived = tab === 'archivados'

  useEffect(() => {
    if (debounced !== q) setQ(debounced)
  }, [debounced, q, setQ])

  const query = useVehiclesInfinite(ctx.id, { archived: archived ? 1 : 0, search: q, sort, per_page: 24 })
  const vehicles = flattenPages(query.data)
  const total = totalFromPages(query.data)
  const canOperate = ctx.can('operate')
  const filtering = !!q

  return (
    <>
      <PageHeader
        title={title}
        description={
          ctx.isWorkshop ? 'Todos los vehículos que gestiona el taller, con su cliente y su orden abierta.' : 'Tus vehículos, con su kilometraje y sus avisos.'
        }
        actions={
          canOperate && (
            <ButtonLink to={`${ctx.base}/vehiculos/nuevo`} variant="primary" icon={<Plus aria-hidden />}>
              Añadir vehículo
            </ButtonLink>
          )
        }
      />

      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center">
        <SegmentedControl
          label="Mostrar"
          value={archived ? 'archivados' : 'activos'}
          onValueChange={(v) => setTab(v)}
          options={[
            { value: 'activos', label: 'Activos', icon: <CarFront aria-hidden /> },
            { value: 'archivados', label: 'Archivados', icon: <Archive aria-hidden /> },
          ]}
        />
        <SearchInput
          value={term}
          onValueChange={setTerm}
          aria-label={ctx.isWorkshop ? 'Buscar por marca, modelo, matrícula, VIN o cliente' : 'Buscar por marca, modelo, apodo o matrícula'}
          placeholder={ctx.isWorkshop ? 'Marca, matrícula, VIN o cliente…' : 'Marca, modelo o matrícula…'}
          className="md:ml-auto md:w-80"
        />
        <label className="flex items-center gap-2 text-sm text-fg-muted">
          <span className="shrink-0">Ordenar por</span>
          <Select value={sort} onChange={(e) => setSort(e.target.value)} className="md:w-40">
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </Select>
        </label>
      </div>

      {query.isPending ? (
        <div role="status" aria-live="polite" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <span className="sr-only">Cargando vehículos…</span>
          {Array.from({ length: 6 }, (_, i) => (
            <VehicleCardSkeleton key={i} />
          ))}
        </div>
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : vehicles.length === 0 ? (
        filtering ? (
          <NoResults
            what="vehículos"
            onReset={() => {
              setTerm('')
              setQ(null)
            }}
          />
        ) : archived ? (
          <EmptyState icon={<Archive />} title="No hay vehículos archivados" description="Al archivar un vehículo deja de aparecer en el panel, pero conserva todo su historial." />
        ) : (
          <EmptyState
            icon={<CarFront />}
            title={ctx.isWorkshop ? 'Aún no hay vehículos en el taller' : 'Tu garaje está vacío'}
            description={
              ctx.isWorkshop
                ? 'Da de alta el primer vehículo de un cliente para abrirle una orden de trabajo.'
                : 'Añade tu coche con su marca, modelo, carrocería y color: lo verás en 3D y podrás empezar a registrar su historia.'
            }
            action={
              canOperate && (
                <ButtonLink to={`${ctx.base}/vehiculos/nuevo`} variant="primary" icon={<Plus aria-hidden />}>
                  Añadir vehículo
                </ButtonLink>
              )
            }
          />
        )
      ) : (
        <>
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-label={title}>
            {vehicles.map((v) => (
              <li key={v.id} className="flex [&>a]:w-full">
                <VehicleCard vehicle={v} to={`${ctx.base}/vehiculos/${v.id}`} showCustomer={ctx.isWorkshop} />
              </li>
            ))}
          </ul>
          <LoadMore
            hasNextPage={!!query.hasNextPage}
            isFetchingNextPage={query.isFetchingNextPage}
            fetchNextPage={query.fetchNextPage}
            shown={vehicles.length}
            total={total}
            what="vehículos"
          />
        </>
      )}
    </>
  )
}
