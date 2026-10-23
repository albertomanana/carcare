/**
 * Selección del taller (escena 3D ⇄ panel ⇄ lista HTML de elevadores), guardada en la URL:
 * `?elevador=2` o `?orden=31`. Así se puede compartir, sobrevive a recargas y el botón «atrás» no la pierde.
 */
import { useCallback } from 'react'
import { useSearchParams } from 'react-router'
import type { Bay, WorkOrder } from '@/api/types'

export interface FloorSelectionState {
  bay: number | null
  orderId: number | null
}

function toId(value: string | null): number | null {
  if (!value || !/^\d+$/.test(value)) return null
  const n = Number(value)
  return n > 0 ? n : null
}

export function useFloorSelection() {
  const [params, setParams] = useSearchParams()
  const bay = toId(params.get('elevador'))
  const orderId = toId(params.get('orden'))

  const select = useCallback(
    (next: Partial<FloorSelectionState> | null) => {
      setParams(
        (prev) => {
          const p = new URLSearchParams(prev)
          p.delete('elevador')
          p.delete('orden')
          if (next?.orderId) p.set('orden', String(next.orderId))
          else if (next?.bay) p.set('elevador', String(next.bay))
          return p
        },
        { replace: true, preventScrollReset: true },
      )
    },
    [setParams],
  )

  return { bay, orderId, select }
}

export type FloorSelection = ReturnType<typeof useFloorSelection>

export interface ResolvedSelection {
  /** Elevador resaltado en la escena (el elegido o el de la orden elegida). */
  bay: number | null
  /** Orden que muestra el panel. */
  order: WorkOrder | null
  /** true si se eligió un elevador vacío. */
  freeBay: boolean
}

/** Resuelve la selección de la URL contra los datos actuales (la orden puede haberse movido o cerrado). */
export function resolveSelection(sel: FloorSelectionState, bays: Bay[], orders: WorkOrder[]): ResolvedSelection {
  if (sel.orderId) {
    const order = orders.find((o) => o.id === sel.orderId) ?? bays.find((b) => b.work_order?.id === sel.orderId)?.work_order ?? null
    if (order) return { bay: order.bay, order, freeBay: false }
    return { bay: null, order: null, freeBay: false }
  }
  if (sel.bay) {
    const bay = bays.find((b) => b.number === sel.bay)
    if (!bay) return { bay: null, order: null, freeBay: false }
    return { bay: bay.number, order: bay.work_order, freeBay: !bay.work_order }
  }
  return { bay: null, order: null, freeBay: false }
}

/** `tel:` limpio a partir de un teléfono escrito a mano ('600 000 002' → 'tel:600000002'). */
export function telHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, '')}`
}
