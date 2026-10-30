/**
 * Decisiones del taller sobre una solicitud (contrato §3.13.4), solo para `manage`:
 * - Aceptar, con sus dos caminos: con presupuesto ya (⇒ `quoted`, v1) o "lo añadiré después" (⇒ `accepted`);
 * - Rechazar con motivo (5–500), que verá el cliente;
 * - Enviar presupuesto: la primera versión tras aceptar sin él, otra tras un rechazo del cliente o una corrección.
 * Un 409/403 (otra persona respondió antes) cierra el diálogo y vuelve a pedir la solicitud (`refetchOnConflict`).
 */
import { useId, useState } from 'react'
import { toast } from 'sonner'
import { errorMessage, isApiError } from '@/api/client'
import { useAcceptRepairRequest, useRejectRepairRequest, useSendRepairQuote } from '@/api/hooks/workshopRequests'
import type { RepairQuote, RepairQuoteInput, RepairRequest } from '@/api/types'
import { FormErrors } from '@/components/forms/MileageConflictNotice'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Dialog, DialogBody, DialogClose, DialogContent, DialogFooter } from '@/components/ui/Dialog'
import { Field } from '@/components/ui/Field'
import { Textarea } from '@/components/ui/inputs'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { QuoteEditor } from './QuoteEditor'

const REASON_MIN = 5
const REASON_MAX = 500

/** 409 o 403: la solicitud cambió por otro lado. Se avisa y se cierra (el hook ya vuelve a pedirla). */
function isConflict(error: unknown): boolean {
  return isApiError(error) && (error.status === 409 || error.status === 403)
}

/** Ejecuta la llamada; si hay conflicto, avisa y cierra; si no, relanza para que el editor lleve los 422 a cada campo. */
async function runOrClose(call: () => Promise<unknown>, onClose: () => void) {
  try {
    await call()
  } catch (error) {
    if (isConflict(error)) {
      toast.error(errorMessage(error))
      onClose()
      return
    }
    throw error
  }
}

type AcceptMode = 'quote' | 'later'

export function AcceptDialog({ request, defaultTaxRate, open, onClose }: { request: RepairRequest; defaultTaxRate: string; open: boolean; onClose: () => void }) {
  const [mode, setMode] = useState<AcceptMode>('quote')
  const formId = `accept-${useId().replace(/:/g, '')}`
  const accept = useAcceptRepairRequest(request.workshop.id, request.id)

  const acceptLater = () =>
    accept.mutate(
      {},
      {
        onSuccess: () => {
          toast.success('Solicitud aceptada. Envía el presupuesto cuando lo tengas.')
          onClose()
        },
        onError: (error) => {
          toast.error(errorMessage(error))
          if (isConflict(error)) onClose()
        },
      },
    )

  const acceptWithQuote = (quote: RepairQuoteInput) =>
    runOrClose(async () => {
      await accept.mutateAsync({ quote })
      toast.success('Solicitud aceptada y presupuesto enviado al cliente.')
      onClose()
    }, onClose)

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !accept.isPending && onClose()}>
      <DialogContent
        title="Aceptar la solicitud"
        description={`${request.vehicle.display_name} · «${request.title}»`}
        variant="sheet"
        size={mode === 'quote' ? 'xl' : 'md'}
      >
        <DialogBody className="space-y-6">
          <div className="space-y-2">
            <SegmentedControl<AcceptMode>
              label="Cómo la aceptas"
              value={mode}
              onValueChange={setMode}
              block
              options={[
                { value: 'quote', label: 'Con presupuesto' },
                { value: 'later', label: 'Lo añadiré después' },
              ]}
            />
            <p className="text-sm text-fg-muted">
              {mode === 'quote'
                ? 'El cliente recibe el presupuesto ahora. Si lo acepta, se abre la orden de trabajo sola.'
                : 'El cliente verá «Aceptada · presupuesto pendiente». Útil si necesitas ver el coche antes de presupuestar.'}
            </p>
          </div>
          {/* Oculto (no desmontado) al elegir "después": si se vuelve, las líneas siguen ahí */}
          <div hidden={mode !== 'quote'}>
            <QuoteEditor formId={formId} defaultTaxRate={defaultTaxRate} errorPrefix="quote." onSubmit={acceptWithQuote} disabled={accept.isPending} />
          </div>
        </DialogBody>
        <DialogFooter>
          <DialogClose asChild>
            <Button disabled={accept.isPending}>Cancelar</Button>
          </DialogClose>
          {mode === 'quote' ? (
            <Button type="submit" form={formId} variant="primary" loading={accept.isPending}>
              Aceptar y enviar presupuesto
            </Button>
          ) : (
            <Button variant="primary" loading={accept.isPending} onClick={acceptLater}>
              Aceptar sin presupuesto
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function SendQuoteDialog({
  request,
  defaultTaxRate,
  initial,
  open,
  onClose,
}: {
  request: RepairRequest
  defaultTaxRate: string
  /** Versión de la que partir: la vigente (para corregirla) o la que rechazó el cliente. */
  initial: RepairQuote | null
  open: boolean
  onClose: () => void
}) {
  const formId = `quote-${useId().replace(/:/g, '')}`
  const send = useSendRepairQuote(request.workshop.id, request.id)
  const nextVersion = (request.quotes[0]?.version ?? 0) + 1
  const current = request.quotes[0]?.status === 'sent' ? request.quotes[0] : null

  const submit = (input: RepairQuoteInput) =>
    runOrClose(async () => {
      await send.mutateAsync(input)
      toast.success(`Presupuesto v${nextVersion} enviado al cliente.`)
      onClose()
    }, onClose)

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !send.isPending && onClose()}>
      <DialogContent
        title={nextVersion === 1 ? 'Enviar presupuesto' : `Enviar presupuesto v${nextVersion}`}
        description={
          current
            ? `La v${current.version} quedará sustituida: el cliente solo podrá responder a la nueva.`
            : `${request.vehicle.display_name} · «${request.title}»`
        }
        variant="sheet"
        size="xl"
      >
        <DialogBody>
          <QuoteEditor formId={formId} defaultTaxRate={defaultTaxRate} initial={initial} onSubmit={submit} disabled={send.isPending} />
        </DialogBody>
        <DialogFooter>
          <DialogClose asChild>
            <Button disabled={send.isPending}>Cancelar</Button>
          </DialogClose>
          <Button type="submit" form={formId} variant="primary" loading={send.isPending}>
            Enviar presupuesto
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function RejectDialog({ request, open, onClose }: { request: RepairRequest; open: boolean; onClose: () => void }) {
  const [reason, setReason] = useState('')
  const [fieldError, setFieldError] = useState<string | null>(null)
  const [otherErrors, setOtherErrors] = useState<string[]>([])
  const reject = useRejectRepairRequest(request.workshop.id, request.id)

  const close = () => {
    setReason('')
    setFieldError(null)
    setOtherErrors([])
    onClose()
  }

  const confirm = () => {
    const text = reason.trim()
    if (text.length < REASON_MIN) {
      setFieldError(`Explica el motivo en al menos ${REASON_MIN} caracteres.`)
      return
    }
    setFieldError(null)
    setOtherErrors([])
    reject.mutate(
      { reason: text },
      {
        onSuccess: () => {
          toast.success('Solicitud rechazada. El cliente verá tu motivo.')
          close()
        },
        onError: (error) => {
          if (isApiError(error) && error.status === 422) {
            setFieldError(error.fieldError('reason') ?? null)
            if (!error.fieldError('reason')) setOtherErrors([error.message])
            return
          }
          toast.error(errorMessage(error))
          if (isConflict(error)) close()
        },
      },
    )
  }

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={(o) => !o && close()}
      title="¿Rechazar la solicitud?"
      description={
        request.status === 'quoted'
          ? 'El cliente verá tu motivo y ya no podrá aceptar el presupuesto. No se puede deshacer.'
          : 'El cliente verá tu motivo. No se puede deshacer.'
      }
      confirmLabel="Rechazar solicitud"
      loading={reject.isPending}
      onConfirm={confirm}
    >
      <Field label="Motivo" required error={fieldError} hint={`Entre ${REASON_MIN} y ${REASON_MAX} caracteres. Por ejemplo: «No trabajamos con eléctricos».`}>
        <Textarea rows={3} maxLength={REASON_MAX} value={reason} onChange={(e) => setReason(e.target.value)} autoFocus />
      </Field>
      {otherErrors.length > 0 && (
        <div className="mt-3">
          <FormErrors messages={otherErrors} />
        </div>
      )}
    </ConfirmDialog>
  )
}
