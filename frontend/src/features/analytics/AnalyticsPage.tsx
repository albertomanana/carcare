/**
 * Analítica del espacio (GET /workspaces/{ws}/analytics, permiso manage). Una sola petición.
 *  - Particular: gasto total, por mes, por categoría y por vehículo. El coste por km y el consumo
 *    viven en la pestaña Gastos de cada vehículo (con su motivo si faltan datos).
 *  - Taller: importe de las órdenes entregadas, cuántas, ticket medio, tiempo medio en el taller,
 *    por mes y por cliente. Nunca se llama «facturación»: CarCare no emite facturas (D12 = A).
 * Solo se muestran cifras que da la API; si falta un dato se dice y se ofrece la acción que lo resuelve.
 */
import { useId, useMemo } from 'react'
import { Link } from 'react-router'
import { isApiError } from '@/api/client'
import { useAnalytics } from '@/api/hooks/workspaces'
import type { WorkspaceAnalytics } from '@/api/types'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Select } from '@/components/ui/inputs'
import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState, ErrorState } from '@/components/ui/States'
import { useQuickActions } from '@/features/quick-actions/quick-actions-context'
import { useWorkspace } from '@/features/workspace/workspace-context'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useSearchParam } from '@/hooks/useSearchParam'
import { ANALYTICS_PRESETS, analyticsPeriod, expensesCount, ordersWithoutCustomer, parseAnalyticsPreset, peakMonth, shareOf } from '@/lib/analytics'
import { cn } from '@/lib/cn'
import { formatDate, formatMoney, formatMonth, formatNumber, formatPercent, formatPlate, toNumber } from '@/lib/format'
import { EXPENSE_CATEGORY_LABEL } from '@/lib/labels'
import { PERIOD_LABEL } from '@/lib/period'
import { plural } from '@/lib/text'
import { Block, ContentSkeleton, ExpandableBars, Figures, MonthlyChart } from './parts'

export default function AnalyticsPage() {
  const ctx = useWorkspace()
  useDocumentTitle('Analítica')
  const allowed = ctx.can('manage')
  const [presetParam, setPreset] = useSearchParam('periodo', 'last_12')
  const preset = parseAnalyticsPreset(presetParam)
  const period = useMemo(() => analyticsPeriod(preset), [preset])
  const query = useAnalytics(ctx.id, { from: period.from, to: period.to }, allowed)
  const selectId = useId()
  const data = query.data
  const shown = data?.period ?? period
  const range = `del ${formatDate(shown.from)} al ${formatDate(shown.to)}`

  // El menú no la ofrece sin permiso manage; si se entra por URL (o la API responde 403), se avisa
  if (!allowed || (isApiError(query.error) && query.error.status === 403)) {
    return (
      <div className="max-w-3xl">
        <PageHeader title="Analítica" />
        <EmptyState
          title="Tu rol no incluye la analítica"
          description="La ven los propietarios y gerentes del espacio. Si la necesitas, pide a uno de ellos que cambie tu rol."
          action={<ButtonLink to={ctx.base}>{ctx.isWorkshop ? 'Ir al centro de control' : 'Ir al inicio'}</ButtonLink>}
        />
      </div>
    )
  }

  // Sin vehículos no hay nada que filtrar por periodo: solo el estado vacío con su acción
  const noVehicles = ctx.isPersonal && ctx.workspace.vehicles_count === 0

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Analítica"
        description={
          noVehicles
            ? undefined
            : ctx.isWorkshop
              ? `Importe con IVA de las órdenes entregadas ${range}. Es un resumen interno: CarCare no emite facturas.`
              : `Gasto de todos tus vehículos ${range}.`
        }
        actions={
          !noVehicles && (
          <div className="flex items-center gap-2">
            <label htmlFor={selectId} className="text-sm text-fg-muted">
              Periodo
            </label>
            <Select id={selectId} value={preset} onChange={(e) => setPreset(e.target.value)} className="w-48">
              {ANALYTICS_PRESETS.map((p) => (
                <option key={p} value={p}>
                  {PERIOD_LABEL[p]}
                </option>
              ))}
            </Select>
          </div>
          )
        }
      />

      {query.isPending ? (
        <ContentSkeleton label="Cargando la analítica…" />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : data ? (
        <div aria-busy={query.isPlaceholderData || undefined} className={cn('transition-opacity duration-200', query.isPlaceholderData && 'opacity-60')}>
          {query.isPlaceholderData && (
            <p role="status" className="sr-only">
              Actualizando el periodo…
            </p>
          )}
          {ctx.isWorkshop ? <WorkshopAnalytics data={data} /> : <PersonalAnalytics data={data} />}
        </div>
      ) : null}
    </div>
  )
}

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)

// ───────── Particular ─────────

function PersonalAnalytics({ data }: { data: WorkspaceAnalytics }) {
  const ctx = useWorkspace()
  const quick = useQuickActions()
  const total = toNumber(data.total) ?? 0
  const peak = peakMonth(data.by_month)
  const canAdd = ctx.canExpenses && ctx.can('operate')

  if (total === 0) {
    return ctx.workspace.vehicles_count === 0 ? (
      <EmptyState
        title="Aún no hay vehículos"
        description="Añade tu vehículo y anota repostajes, seguro o talleres: aquí verás en qué se va el dinero."
        action={
          ctx.can('operate') && (
            <ButtonLink to={`${ctx.base}/vehiculos/nuevo`} variant="primary">
              Añadir vehículo
            </ButtonLink>
          )
        }
      />
    ) : (
      <EmptyState
        title="Sin gastos en este periodo"
        description="Anota repostajes, seguro, impuestos o parking. Las intervenciones con coste cuentan solas como gasto. También puedes elegir otro periodo."
        action={
          canAdd && (
            <Button variant="primary" onClick={() => quick.run('expense')}>
              Añadir gasto
            </Button>
          )
        }
      />
    )
  }

  return (
    <div className="space-y-10">
      <Figures
        label="Resumen del periodo"
        items={[
          { label: 'Gasto total', value: formatMoney(data.total) },
          { label: 'Gastos anotados', value: formatNumber(expensesCount(data.by_category)) },
          { label: 'Mes con más gasto', value: peak ? formatMoney(peak.total) : '—', hint: peak ? capitalize(formatMonth(peak.month, 'long')) : undefined },
        ]}
      />

      <Block id="por-mes" title="Por mes">
        <MonthlyChart data={data.by_month} label="Gasto por mes" valueHeader="Gasto" />
      </Block>

      <Block id="por-categoria" title="Por categoría">
        <ExpandableBars
          what={['categoría', 'categorías']}
          emptyText="Sin gastos en este periodo."
          items={data.by_category.map((c) => ({
            key: c.category,
            label: EXPENSE_CATEGORY_LABEL[c.category],
            sublabel: `${plural(c.count, 'gasto', 'gastos')} · ${formatPercent(shareOf(c.total, data.total), { digits: 0 })}`,
            value: toNumber(c.total) ?? 0,
            display: formatMoney(c.total),
          }))}
        />
      </Block>

      <Block id="por-vehiculo" title="Por vehículo" description="El coste por km y el consumo de cada vehículo están en su pestaña Gastos.">
        <ExpandableBars
          what={['vehículo', 'vehículos']}
          emptyText="Sin gastos en este periodo."
          items={data.by_vehicle.map((v) => ({
            key: v.vehicle.id,
            label: (
              <Link to={`${ctx.base}/vehiculos/${v.vehicle.id}/gastos`} className="hover:underline">
                {v.vehicle.display_name}
              </Link>
            ),
            sublabel: [formatPlate(v.vehicle.plate), formatPercent(shareOf(v.total, data.total), { digits: 0 })].filter(Boolean).join(' · '),
            value: toNumber(v.total) ?? 0,
            display: formatMoney(v.total),
          }))}
        />
      </Block>
    </div>
  )
}

// ───────── Taller ─────────

function WorkshopAnalytics({ data }: { data: WorkspaceAnalytics }) {
  const ctx = useWorkspace()
  const w = data.workshop
  if (!w || w.orders_delivered === 0) {
    return (
      <EmptyState
        title="Aún no hay órdenes entregadas en este periodo"
        description="El importe, el ticket medio y el tiempo en el taller se calculan con las órdenes entregadas. Elige otro periodo o entrega las que estén listas."
        action={<ButtonLink to={`${ctx.base}/ordenes`}>Ver órdenes</ButtonLink>}
      />
    )
  }
  const noCustomer = ordersWithoutCustomer(w)
  const days = w.avg_days_in_shop

  return (
    <div className="space-y-10">
      <Figures
        label="Resumen del periodo"
        items={[
          { label: 'Importe de órdenes entregadas', value: formatMoney(data.total), hint: 'Con IVA' },
          { label: 'Órdenes entregadas', value: formatNumber(w.orders_delivered) },
          { label: 'Ticket medio', value: formatMoney(w.avg_ticket), hint: 'Por orden entregada' },
        ]}
      />
      {days !== null && (
        <p className="text-sm text-fg-muted">
          Tiempo medio en el taller, de la recepción a la entrega:{' '}
          <span className="font-medium text-fg tabular">
            {formatNumber(days, 1)} {days === 1 ? 'día' : 'días'}
          </span>
          .
        </p>
      )}

      <Block id="por-mes" title="Por mes" description="Según la fecha de entrega.">
        <MonthlyChart data={data.by_month} label="Importe de las órdenes entregadas por mes" valueHeader="Importe" />
      </Block>

      <Block
        id="por-cliente"
        title="Por cliente"
        description={noCustomer > 0 ? `${plural(noCustomer, 'orden entregada no tiene', 'órdenes entregadas no tienen')} cliente y no ${noCustomer === 1 ? 'aparece' : 'aparecen'} aquí.` : undefined}
      >
        <ExpandableBars
          what={['cliente', 'clientes']}
          emptyText="Ninguna orden entregada tenía cliente asignado."
          items={w.by_customer.map((c) => ({
            key: c.customer.id,
            label: (
              <Link to={`${ctx.base}/clientes/${c.customer.id}`} className="hover:underline">
                {c.customer.name}
              </Link>
            ),
            sublabel: plural(c.orders, 'orden', 'órdenes'),
            value: toNumber(c.total) ?? 0,
            display: formatMoney(c.total),
          }))}
        />
      </Block>
    </div>
  )
}
