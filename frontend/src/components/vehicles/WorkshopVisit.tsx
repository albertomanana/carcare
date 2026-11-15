/**
 * «En el taller»: lo que ve el particular cuando uno de sus coches tiene una orden abierta en un taller que usa CarCare
 * (contrato §3.13.6). Luz ámbar, taller, dónde está el coche, quién lo lleva y el tiempo en vivo. Todo viene de la
 * orden real; el ámbar es el color de «en taller» y siempre va con texto.
 */
import { ChevronRight, Warehouse } from 'lucide-react'
import { Link } from 'react-router'
import { LiveTimer } from '@/components/orders/OrderTimer'
import { cn } from '@/lib/cn'
import { orderTiming, timingSentence, useNow } from '@/lib/orderTiming'
import { visitPlace, visitSentence, visitStatus, type WorkshopVisit } from '@/lib/workshopVisit'

/** Luz ámbar de «en el taller» (decorativa: el texto va al lado). Late despacio; quieta con movimiento reducido. */
export function WorkshopBeacon({ className }: { className?: string }) {
  return (
    <span aria-hidden className={cn('relative grid size-2.5 shrink-0 place-items-center', className)}>
      <span className="absolute inset-0 rounded-full bg-[#f59e0b] opacity-60 motion-safe:animate-ping" />
      <span className="relative size-2.5 rounded-full bg-[#f59e0b] shadow-[0_0_8px_2px_rgb(245_158_11/0.55)]" />
    </span>
  )
}

/** Insignia corta para tarjetas y listas. */
export function InWorkshopChip({ className }: { className?: string }) {
  return (
    <span className={cn('chip chip-warning', className)}>
      <WorkshopBeacon />
      <span className="truncate">En el taller</span>
    </span>
  )
}

/**
 * Bloque con el seguimiento: taller, lugar, estado, mecánico y reloj en vivo. Con `to`, lleva al detalle de la
 * solicitud (el progreso completo). `inert`: sin enlace, para ir dentro de una tarjeta que ya es un enlace.
 */
export function WorkshopVisitStrip({ visit, to, inert = false, className }: { visit: WorkshopVisit; to?: string; inert?: boolean; className?: string }) {
  const now = useNow(30_000)
  const o = visit.order
  const ready = o.status === 'ready'
  const sentence = `${visitSentence(visit)}; ${timingSentence(orderTiming(o, now))}`
  return (
    <div className={cn('flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5 rounded-control border px-3 py-2', ready ? 'border-ok/40 bg-ok-soft' : 'border-[#f59e0b]/45 bg-warning-soft', className)}>
      <span className={cn('grid size-8 shrink-0 place-items-center rounded-lg', ready ? 'bg-ok/15 text-ok' : 'bg-[#f59e0b]/20 text-warning')}>
        <Warehouse aria-hidden className="size-4" />
      </span>
      <div className="min-w-0 flex-1 basis-40">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-fg">
          {!ready && <WorkshopBeacon />}
          <span className="truncate">
            {ready ? 'Listo en' : 'En el taller ·'} {visit.workshopName}
          </span>
        </p>
        <p className="truncate text-xs text-fg-muted">
          {visitPlace(o)} · {visitStatus(o)}
        </p>
        <p className="sr-only">{sentence}.</p>
      </div>
      {!ready && <LiveTimer order={o} className="w-36 shrink-0" />}
      {to && !inert && (
        <Link to={to} className="inline-flex min-h-9 shrink-0 items-center gap-0.5 rounded-control px-2 text-sm font-semibold text-accent-ink underline-offset-4 hover:underline max-lg:min-h-12">
          Ver progreso
          <ChevronRight aria-hidden className="size-4" />
        </Link>
      )}
    </div>
  )
}
