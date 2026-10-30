import { FilePlus2, Lock, Mail, Phone, SquareKanban, X } from 'lucide-react'
import { useState } from 'react'
import { useParams } from 'react-router'
import { isApiError } from '@/api/client'
import { useRepairRequest, useRepairRequestHistory } from '@/api/hooks/repairRequests'
import type { RepairRequest } from '@/api/types'
import { Plate, StatusPill } from '@/components/ui/Badge'
import { Button, ButtonLink } from '@/components/ui/Button'
import { DataList } from '@/components/ui/Card'
import { Disclosure } from '@/components/ui/Disclosure'
import { PageHeader } from '@/components/ui/PageHeader'
import { Section } from '@/components/ui/Section'
import { Skeleton, SkeletonText } from '@/components/ui/Skeleton'
import { ErrorState } from '@/components/ui/States'
import { VehicleSwatch, VehicleThumb } from '@/components/vehicles/VehicleVisuals'
import { QuoteCard } from '@/features/requests/components/QuoteCard'
import { currentQuote, isOpenRequest, requestStatusDescriptor } from '@/features/requests/requestStatus'
import { mailHref } from '@/features/workshop/components/customerForm'
import { telHref } from '@/features/workshop/components/floor'
import { useWorkspace } from '@/features/workspace/workspace-context'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { vehicleColorName } from '@/lib/colors'
import { formatDate, formatKm } from '@/lib/format'
import { BODY_LABEL, FUEL_LABEL, RECORD_TYPE_LABEL, SERVICE_KIND_LABEL, WORK_ORDER_STATUS_LABEL, ZONE_LABEL } from '@/lib/labels'
import { TONE_CLASSES } from '@/lib/status'
import { plural } from '@/lib/text'
import { AcceptDialog, RejectDialog, SendQuoteDialog } from './components/DecisionDialogs'
import { lastRejectedQuote } from './components/quoteForm'

type OpenDialog = 'accept' | 'reject' | 'quote' | null

/**
 * Detalle de una solicitud para el taller (E16‑1, 5 y 6): qué le pasa, la copia fija del coche con su silueta,
 * el contacto, el presupuesto y sus versiones, el historial que comparte el cliente y, con `manage`, decidir.
 * El mecánico lo ve todo, pero no los botones de decidir (la API le daría 403).
 */
export default function WorkshopRequestDetailPage() {
  const ctx = useWorkspace()
  const { requestId } = useParams()
  const id = Number(requestId) || undefined
  const query = useRepairRequest(id)
  const request = query.data
  useDocumentTitle(request ? request.title : 'Solicitud')
  const back = { to: `${ctx.base}/solicitudes`, label: 'Solicitudes' }

  if (query.isPending) return <DetailSkeleton back={back} />
  if (query.isError || !request) {
    const notFound = isApiError(query.error) && query.error.status === 404
    return (
      <>
        <PageHeader title="Solicitud" back={back} />
        <ErrorState
          error={query.error}
          title={notFound ? 'Esta solicitud ya no existe' : undefined}
          onRetry={() => void query.refetch()}
        />
      </>
    )
  }
  return <RequestDetail request={request} back={back} />
}

function RequestDetail({ request: r, back }: { request: RepairRequest; back: { to: string; label: string } }) {
  const ctx = useWorkspace()
  const [dialog, setDialog] = useState<OpenDialog>(null)
  const [showOld, setShowOld] = useState(false)
  const canDecide = ctx.can('manage') && isOpenRequest(r.status)
  const status = requestStatusDescriptor(r)
  const StatusIcon = status.icon
  const current = currentQuote(r)
  const latest = r.quotes[0] ?? null
  const older = r.quotes.slice(1)
  const taxRate = ctx.workspace.settings.tax_rate
  const close = () => setDialog(null)

  // Una sola acción primaria (R1): la que toca según el estado
  const actions = canDecide ? (
    <>
      {r.status === 'pending' && (
        <Button variant="primary" onClick={() => setDialog('accept')}>
          Aceptar
        </Button>
      )}
      {r.status === 'accepted' && (
        <Button variant="primary" icon={<FilePlus2 aria-hidden />} onClick={() => setDialog('quote')}>
          Enviar presupuesto
        </Button>
      )}
      {r.status === 'quoted' && (
        <Button icon={<FilePlus2 aria-hidden />} onClick={() => setDialog('quote')}>
          Enviar otra versión
        </Button>
      )}
      <Button variant="ghost" icon={<X aria-hidden />} onClick={() => setDialog('reject')}>
        Rechazar
      </Button>
    </>
  ) : r.status === 'converted' && r.work_order ? (
    <ButtonLink to={`${ctx.base}/ordenes/${r.work_order.id}`} icon={<SquareKanban aria-hidden />}>
      Ver la orden {r.work_order.number}
    </ButtonLink>
  ) : undefined

  return (
    <>
      <PageHeader title={r.title} back={back} actions={actions}>
        <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
          {status.attention ? (
            <StatusPill status={status} />
          ) : (
            <span className={`inline-flex items-center gap-1.5 font-medium ${TONE_CLASSES[status.tone].text}`}>
              <StatusIcon aria-hidden className="size-4" />
              {status.label}
            </span>
          )}
          <span className="text-fg-muted">
            Recibida el <span className="tabular">{formatDate(r.created_at)}</span>
          </span>
        </p>
        <StatusExplanation request={r} canManage={ctx.can('manage')} />
      </PageHeader>

      {/* Móvil: qué le pasa, coche y contacto, presupuesto e historial. Escritorio: coche y contacto a la derecha */}
      <div className="grid gap-x-10 gap-y-8 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
        <Section title="Qué le pasa" className="lg:col-start-1">
          <p className="whitespace-pre-line text-sm text-fg">{r.description}</p>
          <DataList
            className="mt-3 border-t border-line"
            items={[
              { label: 'Zona', value: r.zone ? ZONE_LABEL[r.zone] : 'Sin indicar', empty: !r.zone },
              { label: 'Quiere venir', value: <span className="tabular">{formatDate(r.preferred_date, 'long')}</span> },
              { label: 'Km que declara', value: <span className="tabular">{formatKm(r.mileage)}</span> },
            ]}
          />
        </Section>

        <aside className="min-w-0 space-y-8 lg:col-start-2 lg:row-span-3 lg:row-start-1" aria-label="Coche y contacto">
          <VehicleCopy request={r} />
          <Contact request={r} />
          {r.status === 'converted' && <OrderSummary request={r} />}
        </aside>

        {latest && (
          <section aria-label="Presupuesto" className="min-w-0 space-y-4 lg:col-start-1">
            <QuoteCard quote={latest} perspective="workshop" />
            {older.length > 0 && (
              <Disclosure label="Versiones anteriores" summary={plural(older.length, 'versión', 'versiones')} open={showOld} onOpenChange={setShowOld}>
                <div className="space-y-8 pt-2">
                  {older.map((q) => (
                    <QuoteCard key={q.id} quote={q} perspective="workshop" as="h3" />
                  ))}
                </div>
              </Disclosure>
            )}
          </section>
        )}

        <div className="min-w-0 lg:col-start-1">
          <SharedHistory request={r} />
        </div>
      </div>

      {canDecide && (
        <>
          <AcceptDialog key={`a${r.id}`} request={r} defaultTaxRate={taxRate} open={dialog === 'accept'} onClose={close} />
          {dialog === 'quote' && (
            <SendQuoteDialog request={r} defaultTaxRate={taxRate} initial={current ?? lastRejectedQuote(r.quotes)} open onClose={close} />
          )}
          <RejectDialog request={r} open={dialog === 'reject'} onClose={close} />
        </>
      )}
    </>
  )
}

/** Qué significa el estado y qué toca ahora, en una frase (sin caja: R3). */
function StatusExplanation({ request: r, canManage }: { request: RepairRequest; canManage: boolean }) {
  const latest = r.quotes[0]
  const current = currentQuote(r)
  let text: string | null = null
  switch (r.status) {
    case 'pending':
      text = canManage
        ? 'Acéptala, con presupuesto o sin él, o recházala. El cliente verá tu respuesta en CarCare.'
        : 'Pendiente de respuesta. Solo el propietario y el gerente pueden responder.'
      break
    case 'accepted':
      if (latest?.status === 'rejected')
        text = `El cliente rechazó la v${latest.version}${latest.client_reason ? `: «${latest.client_reason}»` : ''}. ${canManage ? 'Envía otra versión o rechaza la solicitud.' : ''}`
      else text = canManage ? 'La aceptaste sin presupuesto. Envíalo cuando lo tengas.' : 'Aceptada. Falta enviar el presupuesto.'
      break
    case 'quoted':
      text = current?.is_expired
        ? `El presupuesto caducó el ${formatDate(current.valid_until)}. ${canManage ? 'Si el cliente sigue interesado, envía otra versión.' : ''}`
        : 'Esperando al cliente. Si acepta el presupuesto, la orden de trabajo se abre sola.'
      break
    case 'rejected':
      text = `Rechazada el ${formatDate(r.closed_at ?? r.updated_at)}${r.reject_reason ? `. Motivo: «${r.reject_reason}»` : '.'}`
      break
    case 'cancelled':
      text = `El cliente la canceló el ${formatDate(r.closed_at ?? r.updated_at)}.`
      break
    case 'converted':
      text = r.work_order
        ? `El cliente aceptó el presupuesto el ${formatDate(r.closed_at ?? r.updated_at)} y se abrió la orden ${r.work_order.number}.`
        : 'El cliente aceptó el presupuesto, pero el taller ha eliminado la orden.'
      break
  }
  return text ? <p className="mt-1 max-w-2xl text-sm text-fg-muted">{text.trim()}</p> : null
}

/** Copia fija de 7 datos tomada al enviar (ADR‑0007): lo único que el taller ve del coche. */
function VehicleCopy({ request: r }: { request: RepairRequest }) {
  const v = r.vehicle
  const color = vehicleColorName(v.color_hex)
  return (
    <Section title="Coche" description={`Datos que envió el cliente el ${formatDate(r.created_at)}.`}>
      <VehicleThumb vehicle={v} className="mx-auto w-full max-w-60" />
      <p className="mt-2 font-medium text-fg">
        {v.display_name}
        {v.plate && (
          <>
            {' · '}
            <Plate value={v.plate} className="text-fg" />
          </>
        )}
      </p>
      <DataList
        className="mt-2 border-t border-line"
        items={[
          { label: 'Año', value: v.year ? <span className="tabular">{v.year}</span> : 'Sin indicar', empty: !v.year },
          { label: 'Combustible', value: v.fuel_type ? FUEL_LABEL[v.fuel_type] : 'Sin indicar', empty: !v.fuel_type },
          { label: 'Carrocería', value: v.body_type ? BODY_LABEL[v.body_type] : 'Sin indicar', empty: !v.body_type },
          {
            label: 'Color',
            value: color ? (
              <span className="inline-flex items-center gap-2">
                <VehicleSwatch vehicle={v} size="sm" className="size-4" />
                {color}
              </span>
            ) : (
              'Sin indicar'
            ),
            empty: !color,
          },
        ]}
      />
    </Section>
  )
}

function Contact({ request: r }: { request: RepairRequest }) {
  return (
    <Section title="Contacto">
      <p className="font-medium text-fg">{r.requester.name}</p>
      <ul className="mt-1 space-y-1 text-sm">
        <li>
          <a href={mailHref(r.requester.email)} className="inline-flex min-h-11 items-center gap-2 break-all text-fg-muted hover:text-fg hover:underline md:min-h-0">
            <Mail aria-hidden className="size-4 shrink-0" />
            <span className="sr-only">Escribir a </span>
            {r.requester.email}
          </a>
        </li>
        <li>
          {r.contact_phone ? (
            <a href={telHref(r.contact_phone)} className="inline-flex min-h-11 items-center gap-2 text-fg-muted tabular hover:text-fg hover:underline md:min-h-0">
              <Phone aria-hidden className="size-4 shrink-0" />
              <span className="sr-only">Llamar al </span>
              {r.contact_phone}
            </a>
          ) : (
            <span className="text-fg-subtle">No ha dejado teléfono.</span>
          )}
        </li>
      </ul>
      <p className="mt-2 text-xs text-fg-subtle">Te los envió para pedir presupuesto. Si acepta el tuyo, pasará a tu lista de clientes.</p>
    </Section>
  )
}

function OrderSummary({ request: r }: { request: RepairRequest }) {
  const o = r.work_order
  return (
    <Section title="Orden de trabajo">
      {o ? (
        <DataList
          className="border-t border-line"
          items={[
            { label: 'Número', value: <span className="tabular">{o.number}</span> },
            { label: 'Estado', value: WORK_ORDER_STATUS_LABEL[o.status] },
            { label: 'Abierta', value: <span className="tabular">{formatDate(o.received_at)}</span> },
          ]}
        />
      ) : (
        <p className="text-sm text-fg-muted">El taller ha eliminado la orden.</p>
      )}
    </Section>
  )
}

/** Historial que comparte el cliente: sin importes ni notas, y solo mientras la solicitud está abierta (§3.13.7). */
function SharedHistory({ request: r }: { request: RepairRequest }) {
  const history = useRepairRequestHistory(r.id, r.history_available)
  const reason = !r.share_history
    ? 'El cliente no comparte su historial con el taller.'
    : !isOpenRequest(r.status)
      ? 'El historial solo se ve mientras la solicitud está abierta.'
      : !r.history_available
        ? 'El cliente ya no tiene ese coche en su garaje, así que no hay historial que ver.'
        : null

  return (
    <Section title="Historial del coche" description={r.history_available ? 'Lo comparte el cliente. Sin importes ni notas.' : undefined}>
      {reason ? (
        <p className="flex items-start gap-2 text-sm text-fg-muted">
          <Lock aria-hidden className="mt-0.5 size-4 shrink-0" />
          {reason}
        </p>
      ) : history.isPending ? (
        <div role="status" aria-live="polite">
          <span className="sr-only">Cargando el historial…</span>
          <SkeletonText lines={3} />
        </div>
      ) : history.isError ? (
        <ErrorState error={history.error} onRetry={() => void history.refetch()} compact />
      ) : history.data.length === 0 ? (
        <p className="text-sm text-fg-muted">El cliente no tiene intervenciones anotadas en este coche.</p>
      ) : (
        <ul className="border-t border-line" aria-label="Intervenciones del coche">
          {history.data.map((h, i) => (
            <li key={i} className="border-b border-line px-1 py-2.5">
              <p className="text-sm font-medium text-fg">{h.title}</p>
              <p className="mt-0.5 text-xs text-fg-muted">
                <span className="tabular">{formatDate(h.service_date)}</span>
                {' · '}
                {[RECORD_TYPE_LABEL[h.type], ZONE_LABEL[h.zone], h.service_kind ? SERVICE_KIND_LABEL[h.service_kind] : null].filter(Boolean).join(' · ')}
                {h.mileage !== null && (
                  <>
                    {' · '}
                    <span className="tabular">{formatKm(h.mileage)}</span>
                  </>
                )}
                {h.workshop_name && ` · ${h.workshop_name}`}
              </p>
            </li>
          ))}
        </ul>
      )}
    </Section>
  )
}

function DetailSkeleton({ back }: { back: { to: string; label: string } }) {
  return (
    <>
      <PageHeader title="Solicitud" back={back} />
      <div role="status" aria-live="polite" className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <span className="sr-only">Cargando la solicitud…</span>
        <div aria-hidden className="space-y-4">
          <Skeleton className="h-6 w-1/2" />
          <SkeletonText lines={4} />
          <Skeleton className="h-40 w-full" />
        </div>
        <div aria-hidden className="space-y-3">
          <Skeleton className="mx-auto h-28 w-full max-w-60" />
          <SkeletonText lines={3} />
        </div>
      </div>
    </>
  )
}
