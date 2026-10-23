import { EllipsisVertical, Lock, Pencil, Plus, Receipt, Trash2 } from 'lucide-react'
import { lazy, Suspense, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { errorMessage } from '@/api/client'
import { useDeleteExpense, useExpenses } from '@/api/hooks/records'
import { flattenPages, totalFromPages } from '@/api/hooks/shared'
import { useVehicleSummary } from '@/api/hooks/vehicles'
import type { Expense, ExpenseCategory } from '@/api/types'
import { CategoryBreakdown } from '@/components/charts/Charts'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/DropdownMenu'
import { Select } from '@/components/ui/inputs'
import { LoadMore } from '@/components/ui/LoadMore'
import { Skeleton } from '@/components/ui/Skeleton'
import { StatCard } from '@/components/ui/StatCard'
import { EmptyState, ErrorState, NoResults } from '@/components/ui/States'
import { useWorkspace } from '@/features/workspace/workspace-context'
import { useSearchParam } from '@/hooks/useSearchParam'
import { formatDate, formatDecimal, formatKm, formatMoney } from '@/lib/format'
import { EXPENSE_CATEGORIES, EXPENSE_CATEGORY_ICON, EXPENSE_CATEGORY_LABEL, FUEL_UNIT_SHORT } from '@/lib/labels'
import { PERIOD_LABEL, presetPeriod } from '@/lib/period'
import { useVehicleOutlet } from '../vehicle-outlet'

const ExpenseDialog = lazy(() => import('../dialogs/ExpenseDialog'))

const PRESETS = ['this_year', 'last_12', 'last_year'] as const
type Preset = (typeof PRESETS)[number]

export default function ExpensesTab() {
  const { vehicle } = useVehicleOutlet()
  const ctx = useWorkspace()
  const [presetParam, setPreset] = useSearchParam('periodo', 'this_year')
  const preset: Preset = (PRESETS as readonly string[]).includes(presetParam) ? (presetParam as Preset) : 'this_year'
  const [category, setCategory] = useSearchParam('categoria')
  const period = useMemo(() => presetPeriod(preset), [preset])
  const summary = useVehicleSummary(vehicle.id, { from: period.from, to: period.to }, ctx.canExpenses)
  const list = useExpenses(vehicle.id, { from: period.from, to: period.to, category, per_page: 25 }, ctx.canExpenses)
  const remove = useDeleteExpense(vehicle.id)
  const expenses = flattenPages(list.data)
  const [editing, setEditing] = useState<Expense | null>(null)
  const [creating, setCreating] = useState(false)
  const [deleting, setDeleting] = useState<Expense | null>(null)
  const canWrite = ctx.canExpenses && !vehicle.archived_at

  if (!ctx.canExpenses) return <ErrorState error={undefined} title="Tu rol no incluye los gastos de este espacio" />

  const s = summary.data
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Select aria-label="Periodo" value={preset} onChange={(e) => setPreset(e.target.value)} className="sm:w-52">
          {PRESETS.map((p) => (
            <option key={p} value={p}>
              {PERIOD_LABEL[p]}
            </option>
          ))}
        </Select>
        <Select aria-label="Categoría" value={category} onChange={(e) => setCategory(e.target.value)} className="sm:w-52">
          <option value="">Todas las categorías</option>
          {EXPENSE_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {EXPENSE_CATEGORY_LABEL[c]}
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
        <Skeleton className="h-56 w-full rounded-card" />
      ) : summary.isError ? (
        <ErrorState compact error={summary.error} onRetry={() => void summary.refetch()} />
      ) : s ? (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-1">
            <StatCard label={`Total · ${PERIOD_LABEL[preset].toLowerCase()}`} value={formatMoney(s.totals.period)} change={s.totals.change_pct} upIsGood={false} emphasis />
            <StatCard
              label="Coste por km"
              value={s.cost_per_km.value ? formatMoney(s.cost_per_km.value) : '—'}
              hint={s.cost_per_km.km !== null ? `Sobre ${formatKm(s.cost_per_km.km)}` : undefined}
              unavailable={!s.cost_per_km.available ? { reason: s.cost_per_km.reason } : undefined}
            />
            <StatCard
              label="Consumo medio"
              value={s.consumption.value ? formatDecimal(s.consumption.value, 1) : '—'}
              unit={s.consumption.unit?.replace('100km', '100 km') ?? undefined}
              hint={s.consumption.available ? `Método lleno a lleno · ${s.consumption.fills} repostajes` : undefined}
              unavailable={!s.consumption.available ? { reason: s.consumption.reason } : undefined}
              className="col-span-2 lg:col-span-1"
            />
          </div>
          <Card className="p-4 sm:p-5">
            <h2 className="mb-4 font-display text-base font-semibold text-fg-warm">Por categoría</h2>
            {s.by_category.length ? <CategoryBreakdown data={s.by_category} /> : <p className="py-10 text-center text-sm text-fg-muted">Sin gastos en este periodo.</p>}
          </Card>
        </div>
      ) : null}

      <section aria-labelledby="gastos-lista">
        <h2 id="gastos-lista" className="mb-3 font-display text-lg font-semibold text-fg-warm">
          Movimientos
        </h2>
        {list.isPending ? (
          <div role="status" className="space-y-2">
            <span className="sr-only">Cargando gastos…</span>
            {Array.from({ length: 5 }, (_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-card" />
            ))}
          </div>
        ) : list.isError ? (
          <ErrorState error={list.error} onRetry={() => void list.refetch()} />
        ) : expenses.length === 0 ? (
          category ? (
            <NoResults what="gastos" onReset={() => setCategory(null)} />
          ) : (
            <EmptyState
              icon={<Receipt />}
              title="Sin gastos en este periodo"
              description="Repostajes, seguro, impuestos, parking… Las intervenciones con coste aparecen aquí automáticamente."
              action={canWrite && <Button onClick={() => setCreating(true)}>Añadir gasto</Button>}
            />
          )
        ) : (
          <>
            <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface">
              {expenses.map((e) => (
                <ExpenseRow key={e.id} expense={e} canWrite={canWrite} historyHref={`${ctx.base}/vehiculos/${vehicle.id}/historial#intervencion-${e.maintenance_record_id}`} onEdit={setEditing} onDelete={setDeleting} />
              ))}
            </ul>
            <LoadMore hasNextPage={!!list.hasNextPage} isFetchingNextPage={list.isFetchingNextPage} fetchNextPage={list.fetchNextPage} shown={expenses.length} total={totalFromPages(list.data)} what="gastos" />
          </>
        )}
      </section>

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

function ExpenseRow({
  expense: e,
  canWrite,
  historyHref,
  onEdit,
  onDelete,
}: {
  expense: Expense
  canWrite: boolean
  historyHref: string
  onEdit: (e: Expense) => void
  onDelete: (e: Expense) => void
}) {
  const Icon = EXPENSE_CATEGORY_ICON[e.category as ExpenseCategory]
  const meta = [
    formatDate(e.expense_date),
    e.mileage !== null ? formatKm(e.mileage) : null,
    e.fuel_quantity ? `${formatDecimal(e.fuel_quantity, 2)} ${e.fuel_unit ? FUEL_UNIT_SHORT[e.fuel_unit] : ''}`.trim() : null,
  ]
    .filter(Boolean)
    .join(' · ')
  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <span className="grid size-10 shrink-0 place-items-center rounded-control bg-surface-2 text-fg-muted">
        <Icon aria-hidden className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-fg">{e.description || EXPENSE_CATEGORY_LABEL[e.category]}</p>
        <p className="truncate text-xs text-fg-muted tabular">
          {e.description ? `${EXPENSE_CATEGORY_LABEL[e.category]} · ` : ''}
          {meta}
        </p>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {e.full_tank && <Badge size="sm">Depósito lleno</Badge>}
          {e.is_linked && (
            <Link to={historyHref} className="rounded-full">
              <Badge size="sm" tone="info" icon={<Lock aria-hidden />}>
                Desde su intervención
              </Badge>
            </Link>
          )}
        </div>
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
