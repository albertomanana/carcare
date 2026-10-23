import { useState } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { errorMessage, isApiError } from '@/api/client'
import { useChangeWorkOrderStatus } from '@/api/hooks/workshop'
import type { WorkOrder, WorkOrderStatus } from '@/api/types'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { useWorkspace } from '@/features/workspace/workspace-context'
import { formatMoney, toNumber } from '@/lib/format'
import { isFinalStatus, statusLabel } from './orderUtils'

type Confirm = { kind: 'deliver' | 'cancel'; order: WorkOrder } | null

export interface MoveOptions {
  /** Se llama con el mensaje del servidor si falla (p. ej. 409 de elevador ocupado), además del toast. */
  onError?: (message: string) => void
  onSuccess?: (order: WorkOrder) => void
}

/**
 * Acciones de estado de una orden con avisos claros:
 *  - move(): cambio optimista (tablero, elevadores) con «Deshacer» y rollback si el servidor lo rechaza (409…).
 *  - request(): igual, pero entregar y cancelar piden confirmación (entregar crea la intervención en el historial).
 * Renderiza `dialogs` una vez en la pantalla que use el hook.
 */
export function useOrderActions() {
  const ctx = useWorkspace()
  const navigate = useNavigate()
  const change = useChangeWorkOrderStatus(ctx.id)
  const [confirm, setConfirm] = useState<Confirm>(null)
  const [busyId, setBusyId] = useState<number | null>(null)
  const showPrices = ctx.can('manage')

  function move(order: WorkOrder, status: WorkOrderStatus, bay?: number | null, opts: MoveOptions = {}): Promise<WorkOrder | null> {
    if (status === order.status && (bay === undefined || bay === order.bay)) return Promise.resolve(order)
    const input = bay === undefined ? { status } : { status, bay }
    const prev = { status: order.status, bay: order.bay }
    setBusyId(order.id)
    return change
      .mutateAsync({ id: order.id, input })
      .then((updated) => {
        setConfirm(null)
        opts.onSuccess?.(updated)
        if (status === 'delivered') {
          toast.success(`${order.number} entregada`, {
            description: 'Se ha añadido al historial del vehículo como intervención.',
            action: { label: 'Ver historial', onClick: () => navigate(`${ctx.base}/vehiculos/${order.vehicle.id}/historial`) },
          })
        } else if (status === 'cancelled') {
          toast.success(`${order.number} cancelada`)
        } else {
          const parts: string[] = []
          if (status !== prev.status) parts.push(`«${statusLabel(status)}»`)
          if (updated.bay !== prev.bay) parts.push(updated.bay ? `elevador ${updated.bay}` : 'fuera del elevador')
          const canUndo = !isFinalStatus(prev.status)
          toast.success(`${order.number} movida a ${parts.join(' · ') || statusLabel(status)}`, {
            action: canUndo
              ? {
                  label: 'Deshacer',
                  onClick: () => void move(updated, prev.status, prev.bay !== updated.bay ? prev.bay : undefined),
                }
              : undefined,
          })
        }
        return updated
      })
      .catch((err: unknown) => {
        const message = errorMessage(err)
        opts.onError?.(message)
        toast.error(isApiError(err) && err.isConflict ? `No se pudo mover ${order.number}` : 'No se pudo cambiar el estado', { description: message })
        return null
      })
      .finally(() => setBusyId((id) => (id === order.id ? null : id)))
  }

  /** Cambio pedido desde el tablero, el menú «Mover a…» o el panel: entregar y cancelar se confirman. */
  function request(order: WorkOrder, status: WorkOrderStatus, bay?: number | null) {
    if (status === 'delivered' || status === 'cancelled') {
      setConfirm({ kind: status === 'delivered' ? 'deliver' : 'cancel', order })
      return
    }
    void move(order, status, bay)
  }

  const order = confirm?.order
  const loading = !!order && busyId === order.id
  const total = order ? toNumber(order.total) : null
  const dialogs = (
    <>
      <ConfirmDialog
        open={confirm?.kind === 'deliver'}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={order ? `¿Entregar ${order.number} al cliente?` : ''}
        description={
          order ? (
            <>
              La orden se cerrará y quedará en solo lectura. Se añadirá al historial de <strong className="text-fg">{order.vehicle.display_name}</strong> como
              intervención «{order.title}»
              {order.items.length === 0 ? '' : order.items.length === 1 ? ' con su línea' : ` con sus ${order.items.length} líneas`}
              {showPrices && total ? ` (total ${formatMoney(order.total)})` : ''}.{order.bay ? ` El elevador ${order.bay} quedará libre.` : ''}
            </>
          ) : undefined
        }
        confirmLabel="Entregar y cerrar"
        tone="primary"
        loading={loading}
        onConfirm={() => order && void move(order, 'delivered')}
      />
      <ConfirmDialog
        open={confirm?.kind === 'cancel'}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={order ? `¿Cancelar ${order.number}?` : ''}
        description="La orden quedará cancelada y en solo lectura. No se añadirá nada al historial del vehículo y, si ocupa un elevador, se liberará."
        confirmLabel="Cancelar orden"
        cancelLabel="Volver"
        loading={loading}
        onConfirm={() => order && void move(order, 'cancelled')}
      />
    </>
  )

  return { move, request, busyId, dialogs }
}

export type OrderActions = ReturnType<typeof useOrderActions>
