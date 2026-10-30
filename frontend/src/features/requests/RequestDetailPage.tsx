import { CircleSlash } from 'lucide-react'
import { useState } from 'react'
import { useParams } from 'react-router'
import { toast } from 'sonner'
import { errorMessage, isApiError } from '@/api/client'
import { useAcceptQuote, useCancelRepairRequest, useRejectQuote, useRepairRequest, useUpdateRepairRequest } from '@/api/hooks/repairRequests'
import type { RepairQuote, RepairRequest } from '@/api/types'
import { Plate } from '@/components/ui/Badge'
import { Button, ButtonLink } from '@/components/ui/Button'
import { DataList } from '@/components/ui/Card'
import { Switch } from '@/components/ui/Checkbox'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Disclosure } from '@/components/ui/Disclosure'
import { Field } from '@/components/ui/Field'
import { Textarea } from '@/components/ui/inputs'
import { PageHeader } from '@/components/ui/PageHeader'
import { Section } from '@/components/ui/Section'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState, ErrorState } from '@/components/ui/States'
import { VehicleThumb } from '@/components/vehicles/VehicleVisuals'
import { telHref } from '@/features/workshop/components/floor'
import { useWorkspace } from '@/features/workspace/workspace-context'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { formatDate, formatKm, formatMoney } from '@/lib/format'
import { ZONE_LABEL } from '@/lib/labels'
import { TONE_CLASSES, WORK_ORDER_STATUS } from '@/lib/status'
import { plural } from '@/lib/text'
import { QuoteCard } from './components/QuoteCard'
import { RequestStatusLabel } from './components/RequestStatusLabel'
import { SharedHistoryList } from './components/SharedHistoryList'
import { isOpenRequest, vehicleCopyFacts } from './requestStatus'

/**
 * E16 · detalle de una solicitud para el particular: estado, presupuesto (aceptar o rechazar), cancelar,
 * interruptor del historial y seguimiento de la orden cuando ya existe (E16‑7, 8, 9 y 11).
 */
export default function RequestDetailPage() {
  const ctx = useWorkspace()
  const { requestId } = useParams()
  const id = Number(requestId) || undefined
  const query = useRepairRequest(id)
  useDocumentTitle(query.data?.title ?? 'Solicitud')
  const back = { to: `${ctx.base}/solicitudes`, label: 'Solicitudes' }

  if (!id || query.isError) {
    const notFound = !id || (isApiError(query.error) && query.error.status === 404)
    return (
      <>
        <PageHeader title="Solicitud" back={back} />
        {notFound ? (
          <EmptyState
            icon={<CircleSlash />}
            title="Esta solicitud ya no existe"
            description="Puede que se borrara junto con el coche o la cuenta, o que el enlace no sea correcto."
            action={<ButtonLink to={back.to}>Ver mis solicitudes</ButtonLink>}
          />
        ) : (
          <ErrorState error={query.error} onRetry={() => void query.refetch()} />
        )}
      </>
    )
  }

  if (query.isPending) return <DetailSkeleton back={back} />
  return <RequestDetail request={query.data} back={back} />
}

function RequestDetail({ request: r, back }: { request: RepairRequest; back: { to: string; label: string } }) {
  const ctx = useWorkspace()
  const open = isOpenRequest(r.status)
  const [latest, ...older] = r.quotes
  const [showOlder, setShowOlder] = useState(false)

  return (
    <>
      <PageHeader title={r.title} back={back}>
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-fg-muted">
          <RequestStatusLabel request={r} />
          <span>
            {r.vehicle.display_name} · {r.workshop.name} · Enviada el <span className="tabular">{formatDate(r.created_at)}</span>
          </span>
        </p>
      </PageHeader>

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-12">
        <div className="min-w-0 space-y-10">
          <StatusExplanation request={r} />

          {latest && (
            <QuoteBlock request={r} quote={latest} />
          )}

          {older.length > 0 && (
            <Disclosure
              label="Versiones anteriores del presupuesto"
              summary={plural(older.length, 'versión', 'versiones')}
              open={showOlder}
              onOpenChange={setShowOlder}
            >
              {older.map((q) => (
                <QuoteCard key={q.id} quote={q} as="h3" className="border-t border-line pt-4" />
              ))}
            </Disclosure>
          )}
        </div>

        <aside className="min-w-0 space-y-10" aria-label="Datos de la solicitud">
          <Section id="taller" title="Taller">
            <p className="font-medium text-fg">{r.workshop.name}</p>
            {r.workshop.city && <p className="text-sm text-fg-muted">{r.workshop.city}</p>}
            {r.workshop.phone && (
              <p className="text-sm">
                <a href={telHref(r.workshop.phone)} className="text-fg-muted tabular underline-offset-2 hover:text-fg hover:underline">
                  <span className="sr-only">Llamar al taller: </span>
                  {r.workshop.phone}
                </a>
              </p>
            )}
          </Section>

          <SentData request={r} />

          {open && <HistoryConsent request={r} />}

          {open && <CancelRequest request={r} />}
        </aside>
      </div>
      {/* El espacio activo se usa en los enlaces de los hijos */}
      <span hidden>{ctx.id}</span>
    </>
  )
}

/** Qué ha pasado y qué viene después, según el estado. */
function StatusExplanation({ request: r }: { request: RepairRequest }) {
  const taller = r.workshop.name
  switch (r.status) {
    case 'pending':
      return <p className="text-sm text-fg">{taller} todavía no ha respondido. Te avisaremos en la campana de arriba cuando lo haga.</p>
    case 'accepted':
      return r.quotes[0]?.status === 'rejected' ? (
        <p className="text-sm text-fg">
          Rechazaste el presupuesto v{r.quotes[0].version}. {taller} puede enviarte otro o cerrar la solicitud.
        </p>
      ) : (
        <p className="text-sm text-fg">
          {taller} aceptó tu solicitud{r.responded_at ? <> el <span className="tabular">{formatDate(r.responded_at)}</span></> : null}. El presupuesto llegará
          después: te avisaremos.
        </p>
      )
    case 'quoted':
      return null
    case 'rejected':
      return (
        <div className="space-y-1 text-sm">
          <p className="text-fg">
            {taller} rechazó tu solicitud{r.closed_at ? <> el <span className="tabular">{formatDate(r.closed_at)}</span></> : null}.
          </p>
          {r.reject_reason && (
            <p className="text-fg-muted">
              Motivo: <span className="text-fg">{r.reject_reason}</span>
            </p>
          )}
        </div>
      )
    case 'cancelled':
      return (
        <p className="text-sm text-fg">
          Solicitud cancelada{r.closed_at ? <> el <span className="tabular">{formatDate(r.closed_at)}</span></> : null}.
          {r.vehicle_id === null && ' El coche ya no está en tu garaje.'}
        </p>
      )
    case 'converted':
      return <OrderTracking request={r} />
  }
}

/** E16‑8 · Seguimiento de la orden en solo lectura (el particular no tiene acceso a la orden: sin enlace). */
function OrderTracking({ request: r }: { request: RepairRequest }) {
  const wo = r.work_order
  if (!wo)
    return (
      <Section id="orden" title="Seguimiento de la orden">
        <p className="text-sm text-fg">El taller ha eliminado la orden. Si tienes dudas, llama a {r.workshop.name}.</p>
      </Section>
    )
  const status = WORK_ORDER_STATUS[wo.status]
  const Icon = status.icon
  const date = (value: string | null) => (value ? <span className="tabular">{formatDate(value)}</span> : 'Pendiente')
  return (
    <Section id="orden" title="Seguimiento de la orden" description={`Aceptaste el presupuesto y ${r.workshop.name} abrió una orden con sus líneas.`}>
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-medium text-fg tabular">{wo.number}</span>
        <span className={`inline-flex items-center gap-1.5 text-sm ${TONE_CLASSES[status.tone].text}`}>
          <Icon aria-hidden className="size-4" />
          {status.label}
        </span>
      </p>
      <DataList
        className="mt-2 max-w-md"
        items={[
          { label: 'Recibido', value: date(wo.received_at) },
          { label: 'Terminado', value: date(wo.completed_at), empty: !wo.completed_at },
          { label: 'Entregado', value: date(wo.delivered_at), empty: !wo.delivered_at },
        ]}
      />
      <p className="mt-2 text-xs text-fg-subtle">El estado lo cambia el taller. Te avisaremos cuando esté listo.</p>
    </Section>
  )
}

/** Última versión del presupuesto; si está vigente, con "Aceptar" (la acción primaria) y "Rechazar". */
function QuoteBlock({ request: r, quote }: { request: RepairRequest; quote: RepairQuote }) {
  const ctx = useWorkspace()
  const accept = useAcceptQuote(r.id, ctx.id)
  const reject = useRejectQuote(r.id, ctx.id)
  const [dialog, setDialog] = useState<'accept' | 'reject' | null>(null)
  const [reason, setReason] = useState('')
  const live = quote.status === 'sent' && r.status === 'quoted'

  const onAccept = () =>
    accept.mutate(
      { quote_id: quote.id },
      {
        onSuccess: (updated) => {
          toast.success(updated.work_order ? `Presupuesto aceptado. ${updated.workshop.name} ha abierto la orden ${updated.work_order.number}.` : 'Presupuesto aceptado.')
          setDialog(null)
        },
        onError: (err) => {
          // 409: hay una versión nueva o caducó. Se recarga la solicitud (refetchOnConflict) y se dice por qué.
          toast.error(errorMessage(err))
          setDialog(null)
        },
      },
    )

  const onReject = () =>
    reject.mutate(
      { quote_id: quote.id, reason: reason.trim() || null },
      {
        onSuccess: () => {
          toast.success('Presupuesto rechazado. El taller puede enviarte otro.')
          setDialog(null)
          setReason('')
        },
        onError: (err) => {
          if (isApiError(err) && err.status === 422 && err.errors.reason) return
          toast.error(errorMessage(err))
          setDialog(null)
        },
      },
    )

  const reasonError = isApiError(reject.error) && reject.error.status === 422 ? reject.error.errors.reason?.[0] : undefined

  return (
    <>
      <QuoteCard
        quote={quote}
        actions={
          live && (
            <>
              {quote.is_expired ? (
                <p className="w-full text-sm text-fg">Este presupuesto ha caducado: pide a {r.workshop.name} uno nuevo. Puedes rechazarlo para que lo sepa.</p>
              ) : (
                <Button variant="primary" onClick={() => setDialog('accept')}>
                  Aceptar presupuesto
                </Button>
              )}
              <Button onClick={() => setDialog('reject')}>Rechazar presupuesto</Button>
            </>
          )
        }
      />

      <ConfirmDialog
        open={dialog === 'accept'}
        onOpenChange={(o) => !o && setDialog(null)}
        tone="primary"
        title={`¿Aceptar el presupuesto v${quote.version}?`}
        description={`${r.workshop.name} abrirá una orden con estas líneas por ${formatMoney(quote.total)} (IVA incluido). Después, para cancelarla tendrás que llamar al taller.`}
        confirmLabel="Aceptar presupuesto"
        cancelLabel="Volver"
        loading={accept.isPending}
        onConfirm={onAccept}
      />

      <ConfirmDialog
        open={dialog === 'reject'}
        onOpenChange={(o) => {
          if (!o) {
            setDialog(null)
            reject.reset()
          }
        }}
        tone="danger"
        title={`¿Rechazar el presupuesto v${quote.version}?`}
        description={`La solicitud sigue abierta: ${r.workshop.name} podrá enviarte otro presupuesto o cerrarla.`}
        confirmLabel="Rechazar presupuesto"
        cancelLabel="Volver"
        loading={reject.isPending}
        onConfirm={onReject}
      >
        <Field label="Motivo" hint="Opcional. Lo verá el taller (máximo 500 caracteres)." error={reasonError}>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} rows={3} placeholder="Es caro; ¿y sin cambiar los discos?" />
        </Field>
      </ConfirmDialog>
    </>
  )
}

/** Lo que recibió el taller: la copia fija del coche (7 datos) y lo demás que se envió. */
function SentData({ request: r }: { request: RepairRequest }) {
  const facts = vehicleCopyFacts(r.vehicle)
  return (
    <Section id="enviado" title="Lo que enviaste" description="Es lo que ve el taller del coche, aunque lo edites después.">
      <div className="flex items-center gap-3">
        <VehicleThumb vehicle={r.vehicle} className="h-14 w-24 shrink-0" />
        <div className="min-w-0 text-sm">
          <p className="font-medium text-fg">{r.vehicle.display_name}</p>
          <p className="text-fg-muted">
            {facts.slice(1).filter((f) => f !== (r.vehicle.plate ? undefined : f)).join(' · ')}
            {r.vehicle.plate && !facts.length && <Plate value={r.vehicle.plate} />}
          </p>
        </div>
      </div>
      <DataList
        className="mt-3"
        items={[
          { label: 'Kilómetros', value: <span className="tabular">{formatKm(r.mileage)}</span> },
          { label: 'Zona', value: r.zone ? ZONE_LABEL[r.zone] : 'Sin zona concreta', empty: !r.zone },
          { label: 'Fecha preferida', value: <span className="tabular">{formatDate(r.preferred_date)}</span> },
          { label: 'Teléfono', value: r.contact_phone ?? 'No indicado', empty: !r.contact_phone },
        ]}
      />
      <div className="mt-3 text-sm">
        <p className="text-fg-muted">Descripción</p>
        <p className="mt-0.5 whitespace-pre-line text-fg">{r.description}</p>
      </div>
    </Section>
  )
}

/** E16‑9 · Dar o retirar el consentimiento del historial mientras la solicitud está abierta. */
function HistoryConsent({ request: r }: { request: RepairRequest }) {
  const ctx = useWorkspace()
  const update = useUpdateRepairRequest(r.id, ctx.id)
  const [showHistory, setShowHistory] = useState(false)

  const onChange = (share: boolean) =>
    update.mutate(
      { share_history: share },
      {
        onSuccess: (updated) =>
          toast.success(updated.share_history ? `${r.workshop.name} ya puede ver tu historial de intervenciones.` : `${r.workshop.name} ya no ve tu historial.`),
        onError: (err) => toast.error(errorMessage(err)),
      },
    )

  return (
    <Section id="historial" title="Historial">
      <Switch
        checked={r.share_history}
        onCheckedChange={onChange}
        disabled={update.isPending}
        label="Compartir historial con el taller"
        description="Fecha, tipo, zona, título, km y taller de cada intervención; nunca importes ni notas. Mientras la solicitud esté abierta."
      />
      {r.history_available ? (
        <Disclosure label="Ver lo que ve el taller" open={showHistory} onOpenChange={setShowHistory} className="mt-2">
          <SharedHistoryList requestId={r.id} />
        </Disclosure>
      ) : r.share_history && r.vehicle_id === null ? (
        <p className="mt-2 text-xs text-fg-subtle">El coche ya no está en tu garaje: no hay historial que compartir.</p>
      ) : null}
    </Section>
  )
}

/** E16‑11 · Cancelar mientras no sea una orden. */
function CancelRequest({ request: r }: { request: RepairRequest }) {
  const ctx = useWorkspace()
  const cancel = useCancelRepairRequest(r.id, ctx.id)
  const [confirm, setConfirm] = useState(false)
  return (
    <div>
      <Button variant="ghost" className="text-danger" onClick={() => setConfirm(true)}>
        Cancelar solicitud
      </Button>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="¿Cancelar la solicitud?"
        description={`${r.workshop.name} recibirá un aviso. No se puede deshacer: para volver a pedirlo tendrás que enviar otra solicitud.`}
        confirmLabel="Cancelar solicitud"
        cancelLabel="Volver"
        loading={cancel.isPending}
        onConfirm={() =>
          cancel.mutate(undefined, {
            onSuccess: () => {
              toast.success('Solicitud cancelada.')
              setConfirm(false)
            },
            onError: (err) => {
              toast.error(errorMessage(err))
              setConfirm(false)
            },
          })
        }
      />
    </div>
  )
}

function DetailSkeleton({ back }: { back: { to: string; label: string } }) {
  return (
    <>
      <PageHeader title={<Skeleton className="h-8 w-64 max-w-full" />} back={back} />
      <div role="status" aria-live="polite" className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_320px]">
        <span className="sr-only">Cargando la solicitud…</span>
        <div aria-hidden className="space-y-3">
          <Skeleton className="h-6 w-72 max-w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-40 w-full" />
        </div>
        <div aria-hidden className="space-y-3">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      </div>
    </>
  )
}
