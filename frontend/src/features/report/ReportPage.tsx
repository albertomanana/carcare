import { ArrowLeft, Info, Printer } from 'lucide-react'
import { type ReactNode, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router'
import { useVehicleReport } from '@/api/hooks/vehicles'
import type { MaintenanceRecord, Reminder, VehicleReport } from '@/api/types'
import { LogoMark } from '@/components/layout/Logo'
import { Plate } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Checkbox } from '@/components/ui/Checkbox'
import { Skeleton, SkeletonText } from '@/components/ui/Skeleton'
import { ErrorState } from '@/components/ui/States'
import { useWorkspace, type WorkspaceContextValue } from '@/features/workspace/workspace-context'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { cn } from '@/lib/cn'
import { formatDate, formatDateTime, formatDecimal, formatKm, formatMoney, todayISO, toNumber } from '@/lib/format'
import {
  BODY_LABEL,
  DOCUMENT_TYPE_LABEL,
  EXPENSE_CATEGORY_LABEL,
  FUEL_LABEL,
  MILEAGE_SOURCE_LABEL,
  RECORD_TYPE_LABEL,
  TRANSMISSION_LABEL,
  ZONE_LABEL,
} from '@/lib/labels'
import { dueSummary, INTERVAL_DISCLAIMER, recurrenceText } from '@/lib/reminders'
import { dedupeReadings, lastReadingPerMonth, reportFileTitle } from '@/lib/report'
import { REMINDER_STATE } from '@/lib/status'
import { plural } from '@/lib/text'
import { CarSilhouette } from '@/three'

/**
 * Informe imprimible del vehículo (GET /vehicles/{id}/report). Hoja siempre clara, @media print sin controles.
 * «Imprimir / Guardar PDF» usa el diálogo del navegador: no hay generación de PDF en el servidor.
 */
export default function ReportPage() {
  const ctx = useWorkspace()
  const { vehicleId } = useParams()
  const id = Number(vehicleId)
  const report = useVehicleReport(id)
  const [allReadings, setAllReadings] = useState(false)
  const data = report.data
  useDocumentTitle(data ? reportFileTitle(data.vehicle.display_name, data.vehicle.plate, todayISO()) : 'Informe del vehículo')
  const back = `${ctx.base}/vehiculos/${id}`

  return (
    <div className="min-h-dvh bg-canvas print:bg-white">
      <header className="no-print sticky top-0 z-20 border-b border-line bg-canvas">
        <div className="mx-auto flex h-16 max-w-[900px] items-center gap-3 px-4 sm:px-6">
          <Link to={back} className="inline-flex min-h-11 items-center gap-1.5 rounded-control text-sm text-fg-muted hover:text-fg">
            <ArrowLeft aria-hidden className="size-4" />
            <span className="max-sm:sr-only">Volver a la ficha</span>
          </Link>
          <div className="flex-1" />
          {data && data.mileage_logs.length > 0 && (
            <Checkbox
              className="max-md:hidden"
              label="Todas las lecturas de km"
              checked={allReadings}
              onChange={(e) => setAllReadings(e.target.checked)}
            />
          )}
          <Button variant="primary" icon={<Printer aria-hidden />} onClick={() => window.print()} disabled={!data}>
            Imprimir / Guardar PDF
          </Button>
        </div>
      </header>

      <main id="contenido" className="mx-auto max-w-[900px] px-0 py-0 sm:px-6 sm:py-8 print:max-w-none print:p-0">
        {report.isPending ? (
          <PaperSkeleton />
        ) : report.isError ? (
          <div className="px-4 py-8 sm:px-0">
            <ErrorState
              error={report.error}
              title={report.error && 'status' in report.error && report.error.status === 404 ? 'Este vehículo no existe o no es de tus espacios' : undefined}
              onRetry={() => void report.refetch()}
            />
          </div>
        ) : (
          <>
            {data && data.mileage_logs.length > 0 && (
              <div className="no-print px-4 pt-4 md:hidden">
                <Checkbox label="Incluir todas las lecturas de km" checked={allReadings} onChange={(e) => setAllReadings(e.target.checked)} />
              </div>
            )}
            <ReportSheet report={report.data} ctx={ctx} allReadings={allReadings} />
          </>
        )}
      </main>
    </div>
  )
}

// ───────── Hoja ─────────

function ReportSheet({ report, ctx, allReadings }: { report: VehicleReport; ctx: WorkspaceContextValue; allReadings: boolean }) {
  const v = report.vehicle
  const spaceName = ctx.isPersonal ? 'Mi garaje' : ctx.workspace.name
  const overdue = report.pending_reminders.filter((r) => r.state === 'overdue').length
  const recordsTotal = report.records.reduce((sum, r) => sum + (toNumber(r.total_cost) ?? 0), 0)
  const recordsWithCost = report.records.filter((r) => toNumber(r.total_cost) !== null).length
  const showExpenses = ctx.canExpenses
  const driven = v.current_mileage !== null && v.purchase_mileage !== null && v.current_mileage >= v.purchase_mileage ? v.current_mileage - v.purchase_mileage : null

  const readings = useMemo(() => {
    const unique = dedupeReadings(report.mileage_logs)
    return allReadings ? unique : lastReadingPerMonth(unique)
  }, [report.mileage_logs, allReadings])

  const subtitle = [v.make, v.model, v.version, v.year].filter(Boolean).join(' · ')
  const specs: { label: string; value: ReactNode }[] = [
    { label: 'Matrícula', value: v.plate ? <Plate value={v.plate} /> : null },
    { label: 'Bastidor (VIN)', value: v.vin ? <span className="break-all font-mono text-[12px]">{v.vin}</span> : null },
    { label: 'Combustible', value: v.fuel_type ? FUEL_LABEL[v.fuel_type] : null },
    { label: 'Cambio', value: v.transmission ? TRANSMISSION_LABEL[v.transmission] : null },
    { label: 'Motor', value: v.engine },
    { label: 'Carrocería', value: v.body_type ? BODY_LABEL[v.body_type] : null },
    { label: 'Fecha de compra', value: v.purchase_date ? formatDate(v.purchase_date, 'long') : null },
    { label: 'Km al comprarlo', value: v.purchase_mileage !== null ? formatKm(v.purchase_mileage) : null },
    ...(ctx.isWorkshop ? [{ label: 'Cliente', value: v.customer?.name ?? null }] : []),
  ]

  return (
    <article className="paper mx-auto px-5 py-8 shadow-2xl shadow-black/40 sm:rounded-card sm:border sm:border-line sm:px-10 sm:py-10 print:border-0 print:p-0 print:shadow-none" aria-labelledby="informe-titulo">
      {/* Cabecera */}
      <header className="flex flex-col gap-6 border-b-2 border-fg pb-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-semibold tracking-tight">
            <LogoMark className="size-6" />
            CarCare · Informe del vehículo
          </p>
          <h1 id="informe-titulo" className="mt-4 font-display text-3xl font-semibold tracking-tight text-fg-warm text-balance">
            {v.display_name}
          </h1>
          {subtitle && <p className="mt-1 text-base text-fg-muted">{subtitle}</p>}
          <p className="mt-3 text-xs text-fg-subtle">
            Generado el {formatDateTime(report.generated_at)} · Espacio «{spaceName}»
          </p>
        </div>
        <div className="w-48 shrink-0 self-center sm:w-56">
          <CarSilhouette appearance={{ bodyType: v.body_type, colorHex: v.color_hex }} className="h-auto w-full" title={`Ilustración genérica de la carrocería (${v.body_type ? BODY_LABEL[v.body_type].toLowerCase() : 'sin indicar'}), sin marca`} />
        </div>
      </header>

      {/* Resumen */}
      <section aria-label="Resumen" className="print-break-avoid grid grid-cols-2 gap-px overflow-hidden border-b border-line sm:grid-cols-4">
        <Kpi label="Kilometraje actual" value={formatKm(v.current_mileage, { empty: 'Sin lecturas' })} hint={v.mileage_updated_at ? `Lectura del ${formatDate(v.mileage_updated_at)}` : undefined} />
        <Kpi label="Recorridos desde la compra" value={driven !== null ? formatKm(driven) : '—'} hint={driven === null ? 'Faltan los km de compra' : undefined} />
        <Kpi label="Intervenciones" value={String(report.records.length)} hint={recordsWithCost ? `${formatMoney(recordsTotal)} en ${plural(recordsWithCost, 'intervención con importe', 'intervenciones con importe')}` : undefined} />
        <Kpi
          label="Recordatorios pendientes"
          value={String(report.pending_reminders.length)}
          hint={overdue ? plural(overdue, 'vencido', 'vencidos') : report.pending_reminders.length ? 'Ninguno vencido' : undefined}
        />
      </section>

      <ReportSection title="Datos del vehículo">
        <dl className="grid gap-x-8 sm:grid-cols-2">
          {specs.map((s) => (
            <div key={s.label} className="flex items-baseline justify-between gap-4 border-b border-line py-2 text-sm">
              <dt className="text-fg-muted">{s.label}</dt>
              <dd className={cn('text-right', s.value === null || s.value === '' ? 'italic text-fg-subtle' : 'text-fg')}>{s.value === null || s.value === '' ? 'Sin indicar' : s.value}</dd>
            </div>
          ))}
        </dl>
      </ReportSection>

      <ReportSection title="Historial de intervenciones" count={report.records.length}>
        {report.records.length ? <RecordsTable records={report.records} /> : <Empty>Sin intervenciones registradas.</Empty>}
      </ReportSection>

      {showExpenses && (
        <ReportSection title="Gastos" aside={<span className="font-semibold tabular">Total: {formatMoney(report.expenses.total)}</span>}>
          {report.expenses.by_category.length ? (
            <div className="grid gap-6 sm:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
              <Table caption="Gasto por categoría" head={['Categoría', 'Nº', 'Importe']} align={['left', 'right', 'right']}>
                {report.expenses.by_category.map((c) => (
                  <tr key={c.category}>
                    <Td>{EXPENSE_CATEGORY_LABEL[c.category]}</Td>
                    <Td align="right">{c.count}</Td>
                    <Td align="right">{formatMoney(c.total)}</Td>
                  </tr>
                ))}
              </Table>
              <Table caption="Gasto por año" head={['Año', 'Importe']} align={['left', 'right']}>
                {report.expenses.by_year.map((y) => (
                  <tr key={y.year}>
                    <Td>{y.year}</Td>
                    <Td align="right">{formatMoney(y.total)}</Td>
                  </tr>
                ))}
              </Table>
            </div>
          ) : (
            <Empty>Sin gastos registrados.</Empty>
          )}
          {report.expenses.by_category.length > 0 && ctx.isPersonal && (
            <Note>Incluye los gastos que generan las intervenciones con importe, contados una sola vez.</Note>
          )}
        </ReportSection>
      )}

      <ReportSection
        title="Kilometraje"
        count={report.mileage_logs.length}
        countLabel={['lectura', 'lecturas']}
        aside={!allReadings && readings.length < report.mileage_logs.length ? <span className="text-fg-muted">Última lectura de cada mes</span> : undefined}
      >
        {readings.length ? (
          <Table caption="Lecturas de kilometraje" head={['Fecha', 'Kilómetros', 'Origen', 'Nota']} align={['left', 'right', 'left', 'left']}>
            {readings.map((m) => (
              <tr key={m.id}>
                <Td nowrap>{formatDate(m.recorded_at)}</Td>
                <Td align="right" nowrap>
                  {formatKm(m.mileage)}
                </Td>
                <Td>{MILEAGE_SOURCE_LABEL[m.source]}</Td>
                <Td muted>{m.note ?? ''}</Td>
              </tr>
            ))}
          </Table>
        ) : (
          <Empty>Sin lecturas de kilometraje.</Empty>
        )}
      </ReportSection>

      <ReportSection title="Recordatorios pendientes" count={report.pending_reminders.length}>
        {report.pending_reminders.length ? (
          <>
            <RemindersTable reminders={report.pending_reminders} />
            <Note>{INTERVAL_DISCLAIMER}: el estado sale de las fechas y kilómetros que se definieron, no de una medición del vehículo.</Note>
          </>
        ) : (
          <Empty>No hay recordatorios pendientes.</Empty>
        )}
      </ReportSection>

      <ReportSection title="Documentos" count={report.documents.length}>
        {report.documents.length ? (
          <>
            <Table caption="Documentos guardados" head={['Documento', 'Tipo', 'Subido', 'Caduca']} align={['left', 'left', 'left', 'left']}>
              {report.documents.map((d) => (
                <tr key={d.id}>
                  <Td>{d.title}</Td>
                  <Td>{DOCUMENT_TYPE_LABEL[d.document_type]}</Td>
                  <Td nowrap>{formatDate(d.created_at)}</Td>
                  <Td nowrap muted={!d.expires_at}>
                    {d.expires_at ? formatDate(d.expires_at) : 'No caduca'}
                  </Td>
                </tr>
              ))}
            </Table>
            <Note>Los archivos no se incluyen en el informe: se consultan y descargan desde CarCare.</Note>
          </>
        ) : (
          <Empty>Sin documentos guardados.</Empty>
        )}
      </ReportSection>

      <footer className="mt-10 border-t border-line pt-4 text-xs leading-relaxed text-fg-subtle">
        <p className="flex items-start gap-1.5">
          <Info aria-hidden className="mt-0.5 size-3.5 shrink-0" />
          <span>
            Informe generado por CarCare el {formatDate(report.generated_at, 'long')} con los datos registrados en el espacio «{spaceName}» por sus usuarios.
            CarCare no contrasta estos datos con talleres, aseguradoras ni organismos oficiales. La ilustración es genérica y no representa la marca ni el modelo.
          </span>
        </p>
      </footer>
    </article>
  )
}

function RecordsTable({ records }: { records: MaintenanceRecord[] }) {
  return (
    <Table caption="Intervenciones, de la más reciente a la más antigua" head={['Fecha', 'Km', 'Intervención', 'Importe']} align={['left', 'right', 'left', 'right']}>
      {records.map((r) => (
        <tr key={r.id} className="print-break-avoid align-top">
          <Td nowrap>{formatDate(r.service_date)}</Td>
          <Td align="right" nowrap>
            {r.mileage !== null ? formatKm(r.mileage) : '—'}
          </Td>
          <Td>
            <span className="font-medium text-fg">{r.title}</span>
            <span className="block text-xs text-fg-muted">
              {[RECORD_TYPE_LABEL[r.type], ZONE_LABEL[r.zone], r.workshop_name].filter(Boolean).join(' · ')}
            </span>
            {r.items.length > 0 && (
              <span className="mt-0.5 block text-xs text-fg-subtle">
                {r.items
                  .map((i) => `${i.name}${i.unit_price !== null ? ` (${formatDecimal(i.quantity, Number.isInteger(Number(i.quantity)) ? 0 : 2)} × ${formatMoney(i.unit_price)})` : ''}`)
                  .join(' · ')}
              </span>
            )}
          </Td>
          <Td align="right" nowrap>
            {r.total_cost !== null ? formatMoney(r.total_cost) : <span className="text-fg-subtle">Sin importe</span>}
          </Td>
        </tr>
      ))}
    </Table>
  )
}

function RemindersTable({ reminders }: { reminders: Reminder[] }) {
  return (
    <Table caption="Recordatorios pendientes por urgencia" head={['Recordatorio', 'Vence', 'Estado']} align={['left', 'left', 'left']}>
      {reminders.map((r) => {
        const st = r.state ? REMINDER_STATE[r.state] : null
        const Icon = st?.icon
        const recurrence = recurrenceText(r)
        return (
          <tr key={r.id} className="align-top">
            <Td>
              <span className="font-medium text-fg">{r.title}</span>
              {recurrence && <span className="block text-xs text-fg-muted">{recurrence}</span>}
            </Td>
            <Td>{dueSummary(r)}</Td>
            <Td nowrap>
              {st && Icon ? (
                <span className={cn('inline-flex items-center gap-1 font-medium', st.tone === 'danger' ? 'text-danger' : st.tone === 'warning' ? 'text-warning' : st.tone === 'ok' ? 'text-ok' : 'text-fg-muted')}>
                  <Icon aria-hidden className="size-3.5" />
                  {st.label}
                </span>
              ) : (
                '—'
              )}
            </Td>
          </tr>
        )
      })}
    </Table>
  )
}

// ───────── Piezas ─────────

function ReportSection({
  title,
  count,
  countLabel,
  aside,
  children,
}: {
  title: string
  count?: number
  countLabel?: [string, string]
  aside?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="mt-8">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-line pb-2">
        <h2 className="font-display text-lg font-semibold tracking-tight text-fg-warm print:break-after-avoid">
          {title}
          {count !== undefined && (
            <span className="ml-2 text-sm font-normal text-fg-muted tabular">{countLabel ? `(${plural(count, countLabel[0], countLabel[1])})` : `(${count})`}</span>
          )}
        </h2>
        {aside && <div className="text-sm">{aside}</div>}
      </div>
      {children}
    </section>
  )
}

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="bg-surface px-1 py-4 sm:px-3">
      <p className="text-xs text-fg-subtle">{label}</p>
      <p className="mt-1 font-display text-xl font-semibold text-fg-warm tabular">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-fg-muted">{hint}</p>}
    </div>
  )
}

function Table({ caption, head, align, children }: { caption: string; head: string[]; align: ('left' | 'right')[]; children: ReactNode }) {
  return (
    <div className="-mx-5 overflow-x-auto px-5 sm:mx-0 sm:px-0 print:overflow-visible">
      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            {head.map((h, i) => (
              <th key={h} scope="col" className={cn('border-b border-line-strong px-2 py-1.5 text-xs font-semibold text-fg-muted first:pl-0 last:pr-0', align[i] === 'right' ? 'text-right' : 'text-left')}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="[&_tr]:border-b [&_tr]:border-line">{children}</tbody>
      </table>
    </div>
  )
}

function Td({ children, align = 'left', nowrap, muted }: { children: ReactNode; align?: 'left' | 'right'; nowrap?: boolean; muted?: boolean }) {
  return (
    <td className={cn('px-2 py-2 first:pl-0 last:pr-0 tabular', align === 'right' ? 'text-right' : 'text-left', nowrap && 'whitespace-nowrap', muted ? 'text-fg-subtle' : 'text-fg')}>{children}</td>
  )
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="py-2 text-sm italic text-fg-subtle">{children}</p>
}

function Note({ children }: { children: ReactNode }) {
  return <p className="mt-2 text-xs text-fg-subtle">{children}</p>
}

function PaperSkeleton() {
  return (
    <div role="status" aria-live="polite" className="paper mx-auto space-y-8 px-5 py-8 sm:rounded-card sm:border sm:border-line sm:px-10 sm:py-10">
      <span className="sr-only">Preparando el informe…</span>
      <div aria-hidden className="flex justify-between gap-6 border-b-2 border-line pb-6">
        <div className="flex-1 space-y-3">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-40" />
        </div>
        <Skeleton className="h-24 w-48" />
      </div>
      <div aria-hidden className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-16" />
        ))}
      </div>
      <SkeletonText lines={8} />
      <SkeletonText lines={6} />
    </div>
  )
}
