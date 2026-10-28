import { EllipsisVertical, Pencil, Plus, Receipt, Trash2 } from 'lucide-react'
import { lazy, Suspense, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { errorMessage } from '@/api/client'
import { useDeleteExpense, useExpenses } from '@/api/hooks/records'
import { flattenPages, totalFromPages } from '@/api/hooks/shared'
import { useVehicleSummary } from '@/api/hooks/vehicles'
import type { Expense, ExpenseCategory, Vehicle, VehicleSummary } from '@/api/types'
import { CategoryBreakdown, MonthlyBars } from '@/components/charts/Charts'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/DropdownMenu'
import { Select } from '@/components/ui/inputs'
import { LoadMore } from '@/components/ui/LoadMore'
import { Section } from '@/components/ui/Section'
import { Skeleton } from '@/components/ui/Skeleton'
import { StatCard } from '@/components/ui/StatCard'
import { EmptyState, ErrorState, NoResults } from '@/components/ui/States'
import { useQuickActions } from '@/features/quick-actions/quick-actions-context'
import { useWorkspace } from '@/features/workspace/workspace-context'
import { useHashTarget, useRevealHashTarget } from '@/hooks/useHashTarget'
import { useSearchParam } from '@/hooks/useSearchParam'
import { cn } from '@/lib/cn'
import { formatDate, formatDecimal, formatKm, formatMoney, formatMonth, toNumber } from '@/lib/format'
import { EXPENSE_CATEGORIES, EXPENSE_CATEGORY_LABEL, FUEL_UNIT_SHORT } from '@/lib/labels'
import { PERIOD_LABEL, presetPeriod } from '@/lib/period'
import { useVehicleOutlet } from '../vehicle-outlet'

const ExpenseDialog = lazy(() => import('../dialogs/ExpenseDialog'))

const PRESETS = ['this_year', 'last_12', 'last_year'] as const
type Preset = (typeof PRESETS)[number]

/**
 * Gastos de la ficha (5.2 del informe de UX): aquí viven las cifras que salieron del Resumen.
 * Periodo (afecta a todo) · 3 cifras sin caja · por mes y por categoría · movimientos. El filtro de categoría solo
 * afecta a la lista, por eso va junto a ella y no arriba: así ninguna cifra cambia de ámbito sin decirlo (C3).
 */
export default function ExpensesTab() {
  const { vehicle } = useVehicleOutlet()
  const ctx = useWorkspace()
  const [presetParam, setPreset] = useSearchParam('periodo', 'this_year')
  // `periodo` admite también un año ("2024"): lo usan los enlaces desde las lecturas de km (contrato §3.4.1)
  const thisYear = new Date().getFullYear()
  const yearParam = /^\d{4}$/.test(presetParam) ? Number(presetParam) : null
  const preset: Preset | 'year' =
    yearParam === thisYear ? 'this_year' : yearParam === thisYear - 1 ? 'last_year' : yearParam ? 'year' : (PRESETS as readonly string[]).includes(presetParam) ? (presetParam as Preset) : 'this_year'
  const [category, setCategory] = useSearchParam('categoria')
  const period = useMemo(() => (preset === 'year' ? { from: `${yearParam}-01-01`, to: `${yearParam}-12-31` } : presetPeriod(preset)), [preset, yearParam])
  const periodLabel = preset === 'year' ? `año ${yearParam}` : PERIOD_LABEL[preset].toLowerCase()
  const summary = useVehicleSummary(vehicle.id, { from: period.from, to: period.to }, ctx.canExpenses)
  const list = useExpenses(vehicle.id, { from: period.from, to: period.to, category, per_page: 25 }, ctx.canExpenses)
  const remove = useDeleteExpense(vehicle.id)
  const expenses = flattenPages(list.data)
  const [editing, setEditing] = useState<Expense | null>(null)
  const [creating, setCreating] = useState(false)
  const [deleting, setDeleting] = useState<Expense | null>(null)
  const canWrite = ctx.canExpenses && !vehicle.archived_at
  const hashId = useHashTarget('gasto')
  useRevealHashTarget({
    id: hashId,
    prefix: 'gasto',
    ready: !list.isPending,
    found: !!hashId && expenses.some((e) => String(e.id) === hashId),
    hasNextPage: list.hasNextPage,
    isFetchingNextPage: list.isFetchingNextPage,
    fetchNextPage: list.fetchNextPage,
  })

  if (!ctx.canExpenses) return <ErrorState error={undefined} title="Tu rol no incluye los gastos de este espacio" />

  const s = summary.data
  return (
    <div className="space-y-10">
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Select aria-label="Periodo" value={preset === 'year' ? String(yearParam) : preset} onChange={(e) => setPreset(e.target.value)} className="sm:w-52">
            {preset === 'year' && <option value={String(yearParam)}>Año {yearParam}</option>}
            {PRESETS.map((p) => (
              <option key={p} value={p}>
                {PERIOD_LABEL[p]}
              </option>
            ))}
          </Select>
          {canWrite && (
            <Button icon={<Plus aria-hidden />} onClick={() => setCreating(true)} className="sm:ml-auto">
              Añadir gasto
            </Button>
          )}
        </div>

        {summary.isPending ? (
          <div role="status" aria-live="polite" className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-3">
            <span className="sr-only">Cargando las cifras del periodo…</span>
            {Array.from({ length: 3 }, (_, i) => (
              <div key={i} aria-hidden className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-8 w-32" />
              </div>
            ))}
          </div>
        ) : summary.isError ? (
          <ErrorState compact error={summary.error} title="No se pudieron cargar las cifras" onRetry={() => void summary.refetch()} />
        ) : s ? (
          <Figures summary={s} periodLabel={periodLabel} vehicle={vehicle} canWrite={canWrite} onAddFuel={() => setCreating(true)} />
        ) : null}
      </div>

      {s && <Charts summary={s} />}

      <Section
        id="gastos-lista"
        title="Movimientos"
        action={
          <Select aria-label="Categoría de los movimientos" value={category} onChange={(e) => setCategory(e.target.value)} className="w-44 sm:w-52">
            <option value="">Categoría: todas</option>
            {EXPENSE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {EXPENSE_CATEGORY_LABEL[c]}
              </option>
            ))}
          </Select>
        }
      >
        {list.isPending ? (
          <div role="status" aria-live="polite" className="divide-y divide-line border-y border-line">
            <span className="sr-only">Cargando gastos…</span>
            {Array.from({ length: 5 }, (_, i) => (
              <div key={i} aria-hidden className="space-y-2 py-3">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-3 w-2/3" />
              </div>
            ))}
          </div>
        ) : list.isError ? (
          <ErrorState error={list.error} onRetry={() => void list.refetch()} />
        ) : expenses.length === 0 ? (
          category ? (
            <NoResults what="gastos" onReset={() => setCategory(null)} />
          ) : (
            <EmptyState
              compact
              icon={<Receipt />}
              title="Sin gastos en este periodo"
              description="Repostajes, seguro, impuestos, parking… Las intervenciones con coste aparecen aquí solas."
              action={canWrite && <Button onClick={() => setCreating(true)}>Añadir gasto</Button>}
            />
          )
        ) : (
          <>
            <ul className="divide-y divide-line border-y border-line">
              {expenses.map((e) => (
                <ExpenseRow key={e.id} expense={e} highlighted={hashId === String(e.id)} canWrite={canWrite} historyHref={`${ctx.base}/vehiculos/${vehicle.id}/historial?ver=intervenciones#intervencion-${e.maintenance_record_id}`} onEdit={setEditing} onDelete={setDeleting} />
              ))}
            </ul>
            <LoadMore hasNextPage={!!list.hasNextPage} isFetchingNextPage={list.isFetchingNextPage} fetchNextPage={list.fetchNextPage} shown={expenses.length} total={totalFromPages(list.data)} what="gastos" />
          </>
        )}
      </Section>

      <Suspense fallback={null}>
        {(creating || editing) && (
          <ExpenseDialog
            vehicle={vehicle}
            expense={editing}
            open
            onOpenChange={(o) => {
              if (!o) {
                setCreating(false)
                setEditing(null)
              }
            }}
          />
        )}
      </Suspense>
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="¿Eliminar este gasto?"
        description={deleting ? `${EXPENSE_CATEGORY_LABEL[deleting.category]} de ${formatMoney(deleting.amount)} del ${formatDate(deleting.expense_date)}.` : undefined}
        confirmLabel="Eliminar gasto"
        loading={remove.isPending}
        onConfirm={() =>
          deleting &&
          remove.mutate(deleting.id, {
            onSuccess: () => {
              toast.success('Gasto eliminado')
              setDeleting(null)
            },
            onError: (err) => toast.error(errorMessage(err)),
          })
        }
      />
    </div>
  )
}

/**
 * Botón con aspecto de enlace para la acción que resuelve un dato que falta. `purpose` completa el nombre accesible
 * ("Anotar km para calcular el coste por km"): empieza por el texto visible (WCAG 2.5.3) y no se confunde con el
 * "Anotar km" de la cabecera de la ficha.
 */
function FixAction({ onClick, purpose, children }: { onClick: () => void; purpose: string; children: string }) {
  return (
    <button type="button" onClick={onClick} aria-label={`${children} ${purpose}`} className="-my-1 self-start py-1 text-sm font-medium text-accent-ink underline-offset-4 hover:underline">
      {children}
    </button>
  )
}

/**
 * Las 3 cifras del periodo (R2: como mucho 3 grandes). Si la API dice `available: false` se muestra su `reason` y la
 * acción que lo resuelve: anotar km para el coste por km y un repostaje para el consumo.
 */
function Figures({ summary: s, periodLabel, vehicle, canWrite, onAddFuel }: { summary: VehicleSummary; periodLabel: string; vehicle: Vehicle; canWrite: boolean; onAddFuel: () => void }) {
  const ctx = useWorkspace()
  const quick = useQuickActions()
  const canLogKm = ctx.can('operate') && !vehicle.archived_at
  return (
    <div className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-3">
      <StatCard label={`Total · ${periodLabel}`} value={formatMoney(s.totals.period)} change={s.totals.change_pct} upIsGood={false} />
      <StatCard
        label="Coste por km"
        value={s.cost_per_km.value ? formatMoney(s.cost_per_km.value) : '—'}
        hint={s.cost_per_km.km !== null ? `Sobre ${formatKm(s.cost_per_km.km)}` : undefined}
        unavailable={
          !s.cost_per_km.available
            ? { reason: s.cost_per_km.reason, action: canLogKm && <FixAction onClick={() => quick.run('mileage', vehicle.id)} purpose="para calcular el coste por km">Anotar km</FixAction> }
            : undefined
        }
      />
      <StatCard
        label="Consumo medio"
        value={s.consumption.value ? formatDecimal(s.consumption.value, 1) : '—'}
        unit={s.consumption.unit?.replace('100km', '100 km') ?? undefined}
        hint={s.consumption.available ? `Lleno a lleno · ${s.consumption.fills} repostajes` : undefined}
        unavailable={!s.consumption.available ? { reason: s.consumption.reason, action: canWrite && <FixAction onClick={onAddFuel} purpose="para calcular el consumo">Añadir repostaje</FixAction> } : undefined}
        className="col-span-2 sm:col-span-1"
      />
    </div>
  )
}

/** Por mes y por categoría, sin caja (R3). Las barras por mes son el gráfico que estaba en el Resumen. */
function Charts({ summary: s }: { summary: VehicleSummary }) {
  const last = s.by_month[s.by_month.length - 1]?.month
  const anySpend = s.by_month.some((m) => (toNumber(m.total) ?? 0) > 0)
  return (
    <div className="grid gap-10 lg:grid-cols-2">
      <Section title="Por mes" description={last ? `12 meses hasta ${formatMonth(last, 'long')}, todas las categorías.` : undefined}>
        {anySpend ? (
          <MonthlyBars data={s.by_month} label="Gasto por mes" height={200} />
        ) : (
          <p className="border-y border-line py-3 text-sm text-fg-muted">Sin gastos en estos 12 meses.</p>
        )}
      </Section>
      <Section title="Por categoría" description="En el periodo elegido.">
        {s.by_category.length ? <CategoryBreakdown data={s.by_category} /> : <p className="border-y border-line py-3 text-sm text-fg-muted">Sin gastos en este periodo.</p>}
      </Section>
    </div>
  )
}

function ExpenseRow({
  expense: e,
  highlighted,
  canWrite,
  historyHref,
  onEdit,
  onDelete,
}: {
  expense: Expense
  highlighted: boolean
  canWrite: boolean
  historyHref: string
  onEdit: (e: Expense) => void
  onDelete: (e: Expense) => void
}) {
  // Todo como texto gris (R5 y R7): sin baldosa de icono ni píldoras de "Depósito lleno"
  const meta = [
    e.description ? EXPENSE_CATEGORY_LABEL[e.category as ExpenseCategory] : null,
    formatDate(e.expense_date),
    e.mileage !== null ? formatKm(e.mileage) : null,
    e.fuel_quantity ? `${formatDecimal(e.fuel_quantity, 2)} ${e.fuel_unit ? FUEL_UNIT_SHORT[e.fuel_unit] : ''}`.trim() : null,
    e.full_tank ? 'depósito lleno' : null,
  ]
    .filter(Boolean)
    .join(' · ')
  return (
    <li
      id={`gasto-${e.id}`}
      tabIndex={highlighted ? -1 : undefined}
      className={cn('flex scroll-mt-32 items-center gap-3 py-2.5 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent', highlighted && 'bg-surface-2 px-2')}
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-fg">{e.description || EXPENSE_CATEGORY_LABEL[e.category]}</p>
        <p className="text-sm text-fg-muted tabular">{meta}</p>
        {e.is_linked && (
          <Link to={historyHref} className="text-sm text-fg-muted underline-offset-4 hover:text-fg hover:underline">
            Viene de una intervención: se edita allí
          </Link>
        )}
      </div>
      <p className="shrink-0 text-right font-medium text-fg tabular">{formatMoney(e.amount)}</p>
      {canWrite && !e.is_linked ? (
        <DropdownMenu>
          <DropdownMenuTrigger className="grid size-11 shrink-0 place-items-center rounded-control text-fg-muted hover:bg-surface-2 hover:text-fg md:size-9" aria-label="Acciones del gasto">
            <EllipsisVertical aria-hidden className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem icon={<Pencil aria-hidden />} onSelect={() => onEdit(e)}>
              Editar
            </DropdownMenuItem>
            <DropdownMenuItem danger icon={<Trash2 aria-hidden />} onSelect={() => onDelete(e)}>
              Eliminar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        canWrite && <span className="w-11 shrink-0 md:w-9" aria-hidden />
      )}
    </li>
  )
}
